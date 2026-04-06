import { useState, useEffect } from 'react';
// @ts-ignore - JS module without types
import { api } from '../lib/api';
import type { Profile } from '../lib/client';

const AUTH_SYNC_STORAGE_KEY = 'grainology_auth_sync';
const AUTH_SYNC_EVENT = 'grainology-auth-changed';

export function useAuth() {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const syncSession = async () => {
      const { data: { session } }: any = await api.auth.getSession();

      if (!isMounted) return;

      const nextUser = session?.user ?? null;
      setUser(nextUser);

      if (nextUser) {
        const token = localStorage.getItem('auth_token');
        if (token) {
          api.setToken(token);
        }
        await loadProfile(nextUser);
      } else {
        setProfile(null);
        setLoading(false);
      }
    };

    syncSession();

    const { data: { subscription } } = api.auth.onAuthStateChange((_event: any, session: any) => {
      (async () => {
        if (!isMounted) return;

        const nextUser = session?.user ?? null;
        setUser(nextUser);
        if (nextUser) {
          await loadProfile(nextUser);
        } else {
          setProfile(null);
          setLoading(false);
        }
      })();
    });

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== 'auth_token' && event.key !== AUTH_SYNC_STORAGE_KEY) return;
      if (event.key === 'auth_token' && event.newValue == null) {
        api.setToken(null);
      }
      syncSession();
    };

    const handleAuthSync = () => {
      syncSession();
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener(AUTH_SYNC_EVENT, handleAuthSync);

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(AUTH_SYNC_EVENT, handleAuthSync);
    };
  }, []);

  async function loadProfile(currentUser?: any | null) {
    try {
      // Prefer server-side current-profile endpoint to avoid mismatched IDs or stale cache
      const current = await api.request('/profiles/me/current');
      const data = current || null;

      if (data) {
      setProfile(data);
    }
    } catch (err: any) {
      console.error('Error loading profile:', err);
      // If it's a 401, clear the token
      if (err?.error === 'Authentication required' || err?.status === 401) {
        api.setToken(null);
        setProfile(null);
      } else {
        // Fallback: use minimal profile from current user to avoid blank dashboard
        const fallbackUser = currentUser || user;
        if (fallbackUser) {
          setProfile({
            id: fallbackUser.id,
            email: fallbackUser.email,
            name: fallbackUser.name || fallbackUser.email || 'User',
            role: fallbackUser.role || 'customer'
          } as any);
        }
      }
    } finally {
    setLoading(false);
    }
  }

  const signUp = async (
    email: string,
    password: string,
    name: string,
    role: 'farmer' | 'trader' | 'fpo' | 'corporate' | 'miller' | 'financer' | 'admin',
    entityType: 'individual' | 'company' = 'individual',
    businessName?: string,
    businessType?: 'private_limited' | 'partnership' | 'proprietorship' | 'llp',
    additionalData?: any
  ) => {
    const { data, error } = await api.auth.signUp({
      email,
      password,
      name,
      role,
      entity_type: entityType,
      business_name: entityType === 'company' ? businessName : undefined,
      business_type: entityType === 'company' ? businessType : undefined,
      ...additionalData
    });

    if (error) throw error;
    return data;
  };

  const signIn = async (
    credentials: { mobile_number?: string; email?: string; password: string } | string,
    password?: string
  ) => {
    const payload =
      typeof credentials === 'string'
        ? { mobile_number: credentials, password: password! }
        : credentials;
    const { data, error } = await api.auth.signInWithPassword(payload);

    if (error) throw error;
    if (data?.session?.user) {
      await loadProfile();
    }
    return data;
  };

  const signOut = async () => {
    if (signingOut) return; // Prevent multiple clicks

    setSigningOut(true);
    console.log('🔐 [useAuth] Starting signOut process...');

    try {
      // Clear local state immediately and synchronously
      console.log('🔐 [useAuth] Clearing user and profile state...');
      setUser(null);
      setProfile(null);
      setLoading(false);

      // Clear all auth-related storage
      console.log('🔐 [useAuth] Clearing localStorage and sessionStorage...');
      localStorage.removeItem('auth_token');
      sessionStorage.clear(); // Clear all session storage
      api.setToken(null);

      // Fire the API call in the background so logout feels instant
      console.log('🔐 [useAuth] Calling backend signOut API...');
      api.auth.signOut().catch((error: any) => {
        console.warn('🔐 [useAuth] Sign out API call failed (but that\'s okay):', error);
      });
      
      console.log('✅ [useAuth] SignOut process completed');
    } catch (error) {
      console.error('🔐 [useAuth] SignOut error:', error);
    } finally {
      // Reset signingOut state after a brief delay to ensure state updates propagate
      setTimeout(() => {
        setSigningOut(false);
        console.log('🔐 [useAuth] signingOut flag reset to false');
      }, 100);
    }
  };

  return {
    user,
    profile,
    loading,
    signingOut,
    signUp,
    signIn,
    signOut,
  };
}
