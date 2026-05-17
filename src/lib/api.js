// JWT-based API client for backend auth and data
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://grainology-rmg1.onrender.com/api';
const AUTH_SYNC_STORAGE_KEY = 'grainology_auth_sync';
const AUTH_SYNC_EVENT = 'grainology-auth-changed';
const SESSION_RETRY_COOLDOWN_MS = 60000;

class ApiClient {
  constructor() {
    this.token = localStorage.getItem('auth_token') || null;
    this.sessionRequestVersion = 0;
    this.sessionRetryAfter = 0;
  }

  broadcastAuthState(token) {
    if (typeof window === 'undefined') return;

    const payload = {
      tokenPresent: !!token,
      timestamp: Date.now()
    };

    try {
      localStorage.setItem(AUTH_SYNC_STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.warn('Unable to persist auth sync state:', error);
    }

    window.dispatchEvent(new CustomEvent(AUTH_SYNC_EVENT, { detail: payload }));
  }

  setToken(token) {
    const normalizedToken = token || null;
    const previousToken = this.token || null;

    this.token = normalizedToken;
    if (normalizedToken) {
      localStorage.setItem('auth_token', normalizedToken);
    } else {
      localStorage.removeItem('auth_token');
    }

    if (previousToken !== normalizedToken) {
      this.sessionRequestVersion += 1;
      this.broadcastAuthState(normalizedToken);
    }
  }

  async request(endpoint, options = {}) {
    const { authToken, ...fetchOptions } = options;
    const url = `${API_BASE_URL}${endpoint}`;
    const isSessionCheck = endpoint === '/auth/session';

    if (isSessionCheck && this.sessionRetryAfter > Date.now()) {
      return { user: null, session: null };
    }

    const headers = {
      'Content-Type': 'application/json',
      ...fetchOptions.headers,
    };

    // Always get the latest token from localStorage in case it was updated.
    // authToken lets callers pin a request to the token snapshot they started with.
    const token = authToken !== undefined ? authToken : localStorage.getItem('auth_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      // Update this.token to keep it in sync
      this.token = token;
    } else {
      this.token = null;
    }

    // Create an AbortController for timeout (90s to allow Render free-tier cold start)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000); // 90 second timeout

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      if (isSessionCheck) {
        this.sessionRetryAfter = 0;
      }

      const activeToken = localStorage.getItem('auth_token');

      // Handle 401 (Unauthorized) gracefully for session endpoint
      if (response.status === 401 && endpoint === '/auth/session') {
        // Only clear auth state if the failing token is still the active one.
        if (token && activeToken === token) {
          this.setToken(null);
        }
        return { user: null, session: null };
      }

      // For 401 on other endpoints, clear token and throw
      if (response.status === 401) {
        if (token && activeToken === token) {
          this.setToken(null);
        }
        const error = await response.json().catch(() => ({ error: 'Authentication required' }));
        throw error;
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        if (!isSessionCheck) {
          console.error('API request failed:', {
            status: response.status,
            statusText: response.statusText,
            error: error,
            url: url,
          });
        }
        throw error;
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);

      // Session checks run in the background. Treat network/preflight failures
      // as a signed-out session and briefly pause polling to avoid request storms
      // during Render cold starts or temporary platform outages.
      if (isSessionCheck) {
        this.sessionRetryAfter = Date.now() + SESSION_RETRY_COOLDOWN_MS;
        return { user: null, session: null };
      }
      
      // Handle timeout/abort errors (e.g. Render cold start)
      if (error.name === 'AbortError' || error.name === 'TimeoutError') {
        console.error('Request timeout:', url);
        throw {
          error: 'Request timeout',
          message: 'The server is taking longer than usual (it may be starting up). Please try again in a moment.',
          details: 'Request timed out after 90 seconds'
        };
      }
      
      // Handle network errors
      if (error.message && (error.message.includes('Failed to fetch') || error.message.includes('NetworkError'))) {
        console.error('Network error:', url);
        throw {
          error: 'Network error',
          message: 'Unable to connect to the server. Please check your internet connection and try again.',
          details: error.message
        };
      }
      throw error;
    }
  }

  // Auth methods (JWT from backend)
  auth = {
    getSession: async () => {
      try {
        // Pin this lookup to the token that existed when the request started.
        // If logout/login changes the token mid-flight, ignore the stale response.
        const requestToken = localStorage.getItem('auth_token');
        if (!requestToken) {
          this.token = null;
          return {
            data: { session: null, user: null },
            error: null
          };
        }

        this.token = requestToken;
        const requestVersion = this.sessionRequestVersion;
        const data = await this.request('/auth/session', { authToken: requestToken });

        const currentToken = localStorage.getItem('auth_token');
        if (requestVersion !== this.sessionRequestVersion || currentToken !== requestToken) {
          if (!currentToken) {
            this.token = null;
            return {
              data: { session: null, user: null },
              error: null
            };
          }

          return this.auth.getSession();
        }

        // Persist access token if the session includes one (supports existing logins)
        if (data?.session?.access_token) {
          this.setToken(data.session.access_token);
        } else if (data?.session && !data.session.access_token) {
          // If session exists but no token in response, use stored token
          // This handles cases where backend doesn't return token in session response
          this.token = requestToken;
        }

        return {
          data: {
            session: data.session,
            user: data.user
          },
          error: null
        };
      } catch (error) {
        return {
          data: { session: null, user: null },
          error
        };
      }
    },

    signUp: async (signUpData) => {
      try {
        console.log('📤 Signup request payload:', { ...signUpData, password: '***' });
        console.log('🌐 API Base URL:', API_BASE_URL);
        console.log('🔗 Full URL:', `${API_BASE_URL}/auth/signup`);
        
        const startTime = Date.now();
        const data = await this.request('/auth/signup', {
          method: 'POST',
          body: JSON.stringify(signUpData),
        });
        const elapsedTime = Date.now() - startTime;
        
        console.log(`✅ Signup API response received in ${elapsedTime}ms:`, { 
          hasUser: !!data.user, 
          hasSession: !!data.session,
          userId: data.user?.id 
        });
        
        if (data.session?.access_token) {
          this.setToken(data.session.access_token);
        }
        return {
          data: {
            user: data.user,
            session: data.session
          },
          error: null
        };
      } catch (error) {
        console.error('❌ Signup error details:', {
          error: error,
          errorName: error?.name,
          errorMessage: error?.message,
          errorDetails: error?.details,
          errorError: error?.error
        });
        
        // Extract error message from response
        const errorMessage = error.error || error.message || error.details || 'An error occurred while creating an account';
        return { 
          data: { user: null, session: null }, 
          error: {
            message: errorMessage,
            error: error.error,
            details: error.details || error
          }
        };
      }
    },

    signInWithPassword: async ({ mobile_number, email, password }) => {
      try {
        const payload = { password };
        if (email) payload.email = email;
        if (mobile_number) payload.mobile_number = mobile_number;
        console.log('🔐 Sign in request:', {
          hasEmail: !!email,
          hasMobile: !!mobile_number,
          passwordLength: password?.length,
          apiUrl: `${API_BASE_URL}/auth/signin`
        });

        const data = await this.request('/auth/signin', {
          method: 'POST',
          body: JSON.stringify(payload),
        });

        console.log('📥 Sign in response data:', { 
          hasUser: !!data.user, 
          hasSession: !!data.session,
          error: data.error 
        });

        if (data.error) {
          console.error('❌ Sign in failed:', data);
          const message = data.message || (typeof data.error === 'string' ? data.error : data.error?.message) || 'Invalid credentials';
          return {
            data: { user: null, session: null },
            error: typeof data.error === 'object' ? data.error : { message, error: data.error }
          };
        }

        if (data.session?.access_token) {
          this.setToken(data.session.access_token);
        }
        return {
          data: {
            user: data.user,
            session: data.session
          },
          error: null
        };
      } catch (error) {
        console.error('🔐 Sign in error:', error);
        let errorMessage = 'Invalid credentials';
        if (error.message && error.message.includes('timeout')) {
          errorMessage = 'Login request is taking longer than expected. Please try again.';
        } else if (error.message && error.message.includes('Network')) {
          errorMessage = 'Network connection error. Please check your internet and try again.';
        } else if (error.message) {
          errorMessage = error.message;
        }
        return {
          data: { user: null, session: null },
          error: { message: errorMessage, details: error.message }
        };
      }
    },

    signOut: async () => {
      try {
        // Try to call the backend first (with token if available)
        await this.request('/auth/signout', { method: 'POST' });
      } catch (error) {
        // Ignore errors - we'll clear token anyway
        // This handles cases where token is invalid/expired or backend is unreachable
      } finally {
        // Always clear token, even if request fails
        this.setToken(null);
      }
      return { error: null };
    },

    getUser: async () => {
      try {
        const data = await this.request('/auth/user');
        return {
          data: { user: data.user },
          error: null
        };
      } catch (error) {
        return { data: { user: null }, error };
      }
    },

    onAuthStateChange: (callback) => {
      // Poll for auth state changes
      let currentUser = null;
      const interval = setInterval(async () => {
        const { data } = await this.auth.getSession();
        if (data.user?.id !== currentUser?.id) {
          currentUser = data.user;
          callback('SIGNED_IN', data.session);
        }
      }, 30000);

      // Initial check
      this.auth.getSession().then(({ data }) => {
        currentUser = data.user;
        callback('INITIAL_SESSION', data.session);
      });

      return {
        data: { subscription: { unsubscribe: () => clearInterval(interval) } }
      };
    }
  };

  // Registration methods for simple registration flow
  registration = {
    checkUser: async ({ mobile_number, email } = {}) => {
      try {
        const body = {};
        if (mobile_number != null) body.mobile_number = String(mobile_number).trim().replace(/\D/g, '').slice(0, 10);
        if (email != null) body.email = String(email).trim().toLowerCase();
        const data = await this.request('/auth/check-user', {
          method: 'POST',
          body: JSON.stringify(body),
        });
        return { data, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },

    sendWhatsAppOTP: async (mobile_number) => {
      try {
        const data = await this.request('/registration/send-whatsapp-otp', {
          method: 'POST',
          body: JSON.stringify({ mobile_number }),
        });
        return { data, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },

    sendEmailOTP: async (email, options = {}) => {
      try {
        const body = { email };
        if (options?.reentry_token) body.reentry_token = options.reentry_token;
        const data = await this.request('/registration/send-email-otp', {
          method: 'POST',
          body: JSON.stringify(body),
        });
        return { data, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },

    getDocumentOptions: async (user_type) => {
      try {
        const data = await this.request('/registration/get-document-options', {
          method: 'POST',
          body: JSON.stringify({ user_type }),
        });
        return { data, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },

    register: async (formData) => {
      try {
        // This will be a multipart/form-data request
        const url = `${API_BASE_URL}/registration/register`;
        const token = localStorage.getItem('auth_token');
        
        const response = await fetch(url, {
          method: 'POST',
          headers: token ? { 'Authorization': `Bearer ${token}` } : {},
          body: formData, // FormData object with file
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({ error: 'Registration failed' }));
          throw error;
        }

        const data = await response.json();
        
        if (data.session?.access_token) {
          this.setToken(data.session.access_token);
        }
        
        return { data, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },

    getReentryData: async (token) => {
      try {
        const data = await this.request(`/registration/reentry/${encodeURIComponent(token)}`, {
          method: 'GET',
        });
        return { data, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },

    registerReentry: async (token, formData) => {
      try {
        const url = `${API_BASE_URL}/registration/reentry/${encodeURIComponent(token)}`;
        const authToken = localStorage.getItem('auth_token');

        const response = await fetch(url, {
          method: 'POST',
          headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {},
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({ error: 'Registration re-submission failed' }));
          throw error;
        }

        const data = await response.json();
        return { data, error: null };
      } catch (error) {
        return { data: null, error };
      }
    }
  };

  // Database/table methods (proxied to backend)
  from(table) {
    const self = this;
    
    // Query builder class for chaining
    class QueryBuilder {
      constructor(table, columns = '*') {
        this.table = table;
        this.columns = columns;
        this.filters = {};
        this.options = {};
      }

      eq(column, value) {
        this.filters[column] = value;
        return this;
      }

      neq(column, value) {
        this.filters[column] = { $ne: value };
        return this;
      }

      in(column, values) {
        this.filters[column] = { $in: values };
        return this;
      }

      gte(column, value) {
        if (this.filters[column] && typeof this.filters[column] === 'object' && !Array.isArray(this.filters[column])) {
          this.filters[column] = { ...this.filters[column], $gte: value };
        } else {
          this.filters[column] = { $gte: value };
        }
        return this;
      }

      lte(column, value) {
        if (this.filters[column] && typeof this.filters[column] === 'object' && !Array.isArray(this.filters[column])) {
          this.filters[column] = { ...this.filters[column], $lte: value };
        } else {
          this.filters[column] = { $lte: value };
        }
        return this;
      }

      gt(column, value) {
        if (this.filters[column] && typeof this.filters[column] === 'object' && !Array.isArray(this.filters[column])) {
          this.filters[column] = { ...this.filters[column], $gt: value };
        } else {
          this.filters[column] = { $gt: value };
        }
        return this;
      }

      lt(column, value) {
        if (this.filters[column] && typeof this.filters[column] === 'object' && !Array.isArray(this.filters[column])) {
          this.filters[column] = { ...this.filters[column], $lt: value };
        } else {
          this.filters[column] = { $lt: value };
        }
        return this;
      }

      or(conditionString) {
        // Parse query condition: "column1.eq.value1,column2.eq.value2"
        // Store as special filter for backend to handle
        this.filters._or = conditionString;
        return this;
      }

      order(column, options = {}) {
        this.options.sort = { [column]: options.ascending ? 1 : -1 };
        return this;
      }

      limit(count) {
        this.options.limit = count;
        return this;
      }

      async maybeSingle() {
        this.options.single = true;
        return self.query(this.table, this.filters, this.columns, this.options);
      }

      async then(resolve, reject) {
        // Make it awaitable - execute query when awaited
        try {
          const result = await self.query(this.table, this.filters, this.columns, this.options);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }
    }

    return {
      select: (columns) => new QueryBuilder(table, columns),
      insert: (data) => this.insert(table, data),
      update: (data) => ({
        eq: (column, value) => this.update(table, { [column]: value }, data)
      }),
      delete: () => ({
        eq: (column, value) => this.delete(table, { [column]: value })
      })
    };
  }

  async query(table, filters = {}, columns = '*', options = {}) {
    try {
      const endpoint = this.getTableEndpoint(table);
      let url = endpoint;
      
      // Build query parameters
      const params = new URLSearchParams();
      
      // Handle filters - for profiles, we need to filter by id
      if (filters.id && !filters._or) {
        url = `${endpoint}/${filters.id}`;
      } else {
        // For other filters, add as query params
        Object.keys(filters).forEach(key => {
          if (key === '_or') {
            // Handle or condition - send to backend as special parameter
            params.append('or', filters[key]);
          } else if (typeof filters[key] === 'object' && filters[key] !== null) {
            // Handle comparison operators
            if (filters[key].$in) {
              filters[key].$in.forEach((val, idx) => {
                params.append(`${key}[${idx}]`, val);
              });
            } else if (filters[key].$ne !== undefined) {
              params.append(`${key}__ne`, filters[key].$ne);
            } else if (filters[key].$gte !== undefined) {
              params.append(`${key}__gte`, filters[key].$gte);
            } else if (filters[key].$lte !== undefined) {
              params.append(`${key}__lte`, filters[key].$lte);
            } else if (filters[key].$gt !== undefined) {
              params.append(`${key}__gt`, filters[key].$gt);
            } else if (filters[key].$lt !== undefined) {
              params.append(`${key}__lt`, filters[key].$lt);
            } else {
              // For complex objects, stringify
              params.append(key, JSON.stringify(filters[key]));
            }
          } else {
            params.append(key, filters[key]);
          }
        });
      }
      
      if (options.sort) {
        params.append('sort', JSON.stringify(options.sort));
      }
      if (options.limit) {
        params.append('limit', options.limit);
      }

      if (params.toString()) {
        url = `${url}?${params.toString()}`;
      }
      
      const data = await this.request(url);

      if (options.single) {
        // For single result, return the first item or null
        if (Array.isArray(data)) {
          return { data: data.length > 0 ? data[0] : null, error: null };
        }
        return { data: data || null, error: null };
      }

      return { data: Array.isArray(data) ? data : [data], error: null };
    } catch (error) {
      return { data: null, error };
    }
  }

  async insert(table, data) {
    try {
      const endpoint = this.getTableEndpoint(table);
      const result = await this.request(endpoint, {
        method: 'POST',
        body: JSON.stringify(Array.isArray(data) ? data : [data]),
      });
      return { data: result, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }

  async update(table, filters, data) {
    try {
      // For updates, we need to find the record first, then update
      const endpoint = this.getTableEndpoint(table);
      const params = new URLSearchParams();
      Object.keys(filters).forEach(key => {
        params.append(key, filters[key]);
      });
      
      // Get the record
      const records = await this.request(`${endpoint}?${params.toString()}`);
      if (!records || records.length === 0) {
        return { data: null, error: { message: 'Record not found' } };
      }

      // Update the record
      const updated = await this.request(`${endpoint}/${records[0].id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      return { data: updated, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }

  async delete(table, filters) {
    try {
      const endpoint = this.getTableEndpoint(table);
      const params = new URLSearchParams();
      Object.keys(filters).forEach(key => {
        params.append(key, filters[key]);
      });
      
      const records = await this.request(`${endpoint}?${params.toString()}`);
      if (!records || records.length === 0) {
        return { data: null, error: { message: 'Record not found' } };
      }

      await this.request(`${endpoint}/${records[0].id}`, {
        method: 'DELETE',
      });
      return { data: null, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }

  getTableEndpoint(table) {
    const tableMap = {
      'profiles': '/profiles',
      'offers': '/offers',
      'orders': '/orders',
      'quality_parameters': '/quality',
      'mandi_prices': '/mandi',
      'weather_data': '/weather',
      'logistics_providers': '/logistics',
      'logistics_shipments': '/logistics-shipments',
              'variety_master': '/variety-master',
              'purchase_orders': '/purchase-orders',
              'sale_orders': '/sale-orders',
              'reports': '/reports',
              'supply_transactions': '/supply-transactions'
            };
    return tableMap[table] || `/${table}`;
  }
}

export const api = new ApiClient();
