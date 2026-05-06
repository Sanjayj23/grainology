import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Sprout, Upload, CheckCircle, Eye, EyeOff, ChevronDown } from 'lucide-react';
import Navigation from './Navigation';
import Footer from './Footer';
// @ts-ignore - JS module without types
import { api } from '../lib/api';
import { usePopupContext } from '../contexts/PopupContext';

interface DocumentOption {
  value: string;
  label: string;
}

const USER_TYPES = [
  { value: 'farmer', label: 'Farmer' },
  { value: 'trader', label: 'Trader' },
  { value: 'fpo', label: 'FPO' },
  { value: 'corporate', label: 'Corporate' },
  { value: 'miller', label: 'Miller' },
  { value: 'financer', label: 'Financer' },
];

function ResendOtpButton({
  otpSentAt,
  onResend,
  sendingOtp,
  cooldownSeconds,
}: {
  otpSentAt: number | null;
  onResend: () => void;
  sendingOtp: boolean;
  cooldownSeconds: number;
}) {
  const [secondsLeft, setSecondsLeft] = useState(cooldownSeconds);
  useEffect(() => {
    if (otpSentAt == null) return;
    setSecondsLeft(Math.max(0, cooldownSeconds - Math.floor((Date.now() - otpSentAt) / 1000)));
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        const next = prev <= 1 ? 0 : prev - 1;
        if (next <= 0) clearInterval(interval);
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [otpSentAt, cooldownSeconds]);
  const canResend = secondsLeft <= 0 && !sendingOtp;
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => canResend && onResend()}
        disabled={!canResend}
        className="text-sm text-green-600 hover:text-green-700 disabled:text-gray-400 disabled:cursor-not-allowed underline"
      >
        {sendingOtp ? 'Sending...' : canResend ? 'Resend OTP' : `Resend OTP (${secondsLeft}s)`}
      </button>
    </div>
  );
}

export default function SimpleRegistration() {
  const { showAlert } = usePopupContext();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState(1);
  const [userType, setUserType] = useState('');
  const [documentType, setDocumentType] = useState('');
  const [documentOptions, setDocumentOptions] = useState<DocumentOption[]>([]);
  const [name, setName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [sameAsName, setSameAsName] = useState(false);
  const [mobileNumber, setMobileNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedDocTypes, setSelectedDocTypes] = useState<string[]>([]);
  const [documentFiles, setDocumentFiles] = useState<Record<string, File>>({});
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentPreview, setDocumentPreview] = useState<string | null>(null);
  const [draggingOver, setDraggingOver] = useState<string | null>(null);
  
  // OTP states (only email OTP when user provides email; no WhatsApp OTP)
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailOtp, setEmailOtp] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [otpSentAt, setOtpSentAt] = useState<number | null>(null); // for resend cooldown (60s)
  const [checkingMobile, setCheckingMobile] = useState(false);

  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [district, setDistrict] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('India');
  const [pincode, setPincode] = useState('');

  const [otherDocumentLabel, setOtherDocumentLabel] = useState(''); // when user selects "Other" document type

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [reentryMode, setReentryMode] = useState(false);
  const [reentryToken, setReentryToken] = useState('');
  const [reentryOriginalEmail, setReentryOriginalEmail] = useState('');
  const [reentryDeclineReason, setReentryDeclineReason] = useState('');
  const [loadingReentryData, setLoadingReentryData] = useState(false);

  const navigate = useNavigate();
  const urlReentryToken = searchParams.get('reentry_token') || searchParams.get('reentryToken') || '';
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedOriginalReentryEmail = reentryOriginalEmail.trim().toLowerCase();
  const requiresEmailOtp = Boolean(normalizedEmail) && (!reentryMode || normalizedEmail !== normalizedOriginalReentryEmail);

  // Fetch all document options once (same list for every role)
  useEffect(() => {
    fetchDocumentOptions();
  }, []);

  useEffect(() => {
    if (!urlReentryToken) return;

    let cancelled = false;
    (async () => {
      setLoadingReentryData(true);
      setError('');
      try {
        const { data, error } = await api.registration.getReentryData(urlReentryToken);
        if (cancelled) return;
        if (error || !data?.success || !data?.prefill) {
          setError(error?.message || error?.error || 'Invalid or expired re-entry link. Ask Admin for a fresh link.');
          return;
        }

        const prefill = data.prefill;
        const prefillsDocTypes = Array.isArray(prefill.document_types) ? prefill.document_types : [];
        const prefillName = String(prefill.name || '').trim();
        const prefillTradeName = String(prefill.trade_name || '').trim();

        setReentryMode(true);
        setReentryToken(urlReentryToken);
        setReentryDeclineReason(String(prefill.declined_reason || '').trim());
        setName(prefillName);
        setTradeName(prefillTradeName || prefillName);
        setSameAsName(Boolean(prefillTradeName && prefillName && prefillTradeName === prefillName));
        setMobileNumber(String(prefill.mobile_number || '').replace(/\D/g, '').slice(0, 10));
        setEmail(String(prefill.email || '').trim());
        setReentryOriginalEmail(String(prefill.email || '').trim());
        setUserType(String(prefill.user_type || ''));
        setAddressLine1(String(prefill.address_line1 || ''));
        setAddressLine2(String(prefill.address_line2 || ''));
        setDistrict(String(prefill.district || ''));
        setState(String(prefill.state || ''));
        setCountry(String(prefill.country || 'India') || 'India');
        setPincode(String(prefill.pincode || '').replace(/\D/g, '').slice(0, 6));
        setSelectedDocTypes(prefillsDocTypes);
        setDocumentFiles({});
        setEmailOtp('');
        setEmailOtpSent(false);
        setOtpSentAt(null);
        setStep(1);
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || 'Failed to load re-entry form');
        }
      } finally {
        if (!cancelled) setLoadingReentryData(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [urlReentryToken]);

  useEffect(() => {
    if (sameAsName) setTradeName(name);
  }, [sameAsName, name]);

  // Auto-send OTP when user reaches step 4 and has email (no "Send OTP" click needed)
  useEffect(() => {
    if (step !== 4 || !requiresEmailOtp || emailOtpSent || sendingOtp) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) return;
    let cancelled = false;
    (async () => {
      setSendingOtp(true);
      setError('');
      try {
        const { data, error } = await api.registration.sendEmailOTP(
          normalizedEmail,
          reentryMode && reentryToken ? { reentry_token: reentryToken } : {}
        );
        if (cancelled) return;
        if (error) {
          setError(error.message || 'Failed to send OTP');
          setSendingOtp(false);
          return;
        }
        if (data?.success) {
          setEmailOtpSent(true);
          setOtpSentAt(Date.now());
          setError('');
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to send OTP');
      } finally {
        if (!cancelled) setSendingOtp(false);
      }
    })();
    return () => { cancelled = true; };
  }, [step, normalizedEmail, requiresEmailOtp, reentryMode, reentryToken, emailOtpSent, sendingOtp]);

  const fetchDocumentOptions = async () => {
    try {
      const { data, error } = await api.registration.getDocumentOptions(userType || 'farmer');
      if (error) {
        setError(error.message || 'Failed to fetch document options');
        return;
      }
      if (data?.success && data?.document_options) {
        setDocumentOptions(data.document_options);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch document options');
    }
  };

  const validateAndSetFile = (file: File, docType: string) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      setError('Invalid file type. Only JPEG, PNG, and PDF are allowed.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }
    setDocumentFiles(prev => ({ ...prev, [docType]: file }));
    setDocumentFile(file);
    setError('');
  };

  const handleDocumentUpload = (e: React.ChangeEvent<HTMLInputElement>, docType: string) => {
    const file = e.target.files?.[0];
    if (file) validateAndSetFile(file, docType);
  };

  const handleDrop = (e: React.DragEvent, docType: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingOver(null);
    const file = e.dataTransfer.files?.[0];
    if (file) validateAndSetFile(file, docType);
  };

  const toggleDocType = (value: string) => {
    setSelectedDocTypes(prev => {
      if (prev.includes(value)) {
        const next = prev.filter(t => t !== value);
        setDocumentFiles(f => {
          const out = { ...f };
          delete out[value];
          return out;
        });
        return next;
      }
      return [...prev, value];
    });
    setError('');
  };

  const handleSendEmailOTP = async () => {
    if (!requiresEmailOtp) {
      return;
    }

    if (!normalizedEmail) {
      setError('Please enter your email address');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      setError('Please enter a valid email address');
      return;
    }

    setSendingOtp(true);
    setError('');

    try {
      const { data, error } = await api.registration.sendEmailOTP(
        normalizedEmail,
        reentryMode && reentryToken ? { reentry_token: reentryToken } : {}
      );
      if (error) {
        setError(error.message || 'Failed to send Email OTP');
        setSendingOtp(false);
        return;
      }
      
      if (data?.success) {
        setEmailOtpSent(true);
        setOtpSentAt(Date.now());
        setError('');
        await showAlert({
          title: 'OTP Sent',
          message: 'OTP sent to your email!',
          tone: 'success',
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to send Email OTP');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleNext = async () => {
    setError('');
    
    if (step === 1) {
      // Validate Step 1: User Details & User Type
      if (!name.trim()) {
        setError('Please enter your full name');
        return;
      }
      const mobile = mobileNumber.replace(/\D/g, '').trim();
      if (!mobile || mobile.length !== 10) {
        setError('Please enter a valid 10-digit mobile number');
        return;
      }
      if (!password || password.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }
      if (!userType) {
        setError('Please select who you are');
        return;
      }
      if (reentryMode) {
        setStep(2);
        return;
      }
      setError('');
      setCheckingMobile(true);
      try {
        const payload: { mobile_number: string; email?: string } = { mobile_number: mobile };
        if (email?.trim()) payload.email = email.trim();
        const { data } = await api.registration.checkUser(payload);
        if (data?.mobileExists) {
          setError('This mobile number is already registered. Please use a different number or log in.');
          setCheckingMobile(false);
          return;
        }
        if (data?.emailExists) {
          setError('This email is already registered. Please use a different email or log in.');
          setCheckingMobile(false);
          return;
        }
      } catch (err: any) {
        setError(err.message || 'Could not verify. Please try again.');
        setCheckingMobile(false);
        return;
      }
      setCheckingMobile(false);
      setStep(2);
    } else if (step === 2) {
      if (selectedDocTypes.length === 0) {
        setError('Select at least one document type (you can select multiple)');
        return;
      }
      if (selectedDocTypes.includes('other') && !otherDocumentLabel.trim()) {
        setError('Please specify what type of document you are adding under "Other"');
        return;
      }
      setStep(3);
    } else if (step === 3) {
      const missing = selectedDocTypes.filter(t => !documentFiles[t]);
      if (missing.length) {
        setError(`Please upload a file for: ${missing.map(d => d.replace(/_/g, ' ')).join(', ')}`);
        return;
      }
      setStep(4);
    } else if (step === 4) {
      // OTP verification step - handled in handleSubmit
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    const cleanEmailOtp = emailOtp.trim();
    if (requiresEmailOtp && !cleanEmailOtp) {
      setError('Please enter Email OTP');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('trade_name', sameAsName ? name.trim() : tradeName.trim());
      formData.append('same_as_name', String(sameAsName));
      formData.append('mobile_number', mobileNumber);
      if (normalizedEmail) {
        formData.append('email', normalizedEmail);
        if (requiresEmailOtp && cleanEmailOtp) {
          formData.append('email_otp', cleanEmailOtp);
        }
      }
      formData.append('password', password);
      formData.append('user_type', userType);
      if (addressLine1.trim()) formData.append('address_line1', addressLine1.trim());
      if (addressLine2.trim()) formData.append('address_line2', addressLine2.trim());
      if (district.trim()) formData.append('district', district.trim());
      if (state.trim()) formData.append('state', state.trim());
      if (country.trim()) formData.append('country', country.trim());
      if (pincode.trim()) formData.append('pincode', pincode.trim());
      if (selectedDocTypes.includes('other') && otherDocumentLabel.trim()) {
        formData.append('other_document_label', otherDocumentLabel.trim());
      }
      formData.append('document_types', JSON.stringify(selectedDocTypes));
      selectedDocTypes.forEach(docType => {
        const file = documentFiles[docType];
        if (file) formData.append('documents', file);
      });

      const { data, error } = reentryMode
        ? await api.registration.registerReentry(reentryToken, formData)
        : await api.registration.register(formData);
      
      if (error) {
        setError(error.message || error.error || 'Registration failed');
        setLoading(false);
        return;
      }

      if (data?.success) {
        // Do NOT store token - user must wait for admin approval before login
        setSuccess(true);
        // No redirect to dashboard; user sees "Wait for approval" message
      }
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
      setError('');
    }
  };

  if (loadingReentryData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Loading Re-Entry Form</h2>
          <p className="text-gray-600">Please wait while we fetch your rejected registration details.</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            {reentryMode ? 'Re-Submission Received' : 'Registration Received'}
          </h2>
          <p className="text-gray-600 mb-4">
            {reentryMode
              ? 'Your corrected details have been submitted. Please wait for Super Admin approval before login.'
              : 'Please wait for admin approval. You will receive an email when your account is approved. Until then, you cannot log in.'}
          </p>
          {email && (
            <p className="text-sm text-gray-500 mb-4">We have sent a confirmation to your email. You will get another email once an admin approves your account.</p>
          )}
          <button
            onClick={() => navigate('/login')}
            className="w-full py-3 px-6 bg-green-600 text-white rounded-xl hover:bg-green-700 font-semibold"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />
      <div className="flex flex-1">
        {/* Left Side - Welcome Section */}
        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-green-600 via-emerald-600 to-teal-600 relative overflow-hidden">
          {/* Decorative Pattern Overlay */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0" style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}></div>
          </div>
        
          {/* Content */}
          <div className="relative z-10 flex flex-col justify-center items-center text-white p-12 w-full">
            <div className="max-w-md">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl mb-8 shadow-xl">
                <Sprout className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-5xl font-bold mb-4 leading-tight">Welcome to Grainology</h1>
              <p className="text-xl text-white/90 mb-6 leading-relaxed">
                Your Digital Agri-Marketplace for seamless trading and market insights
              </p>
              <div className="space-y-4 mt-8">
                <div className="flex items-center gap-3 text-white/90">
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                  <span>Real-time Mandi prices and market trends</span>
                </div>
                <div className="flex items-center gap-3 text-white/90">
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                  <span>Secure document verification</span>
                </div>
                <div className="flex items-center gap-3 text-white/90">
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                  <span>Direct trading between farmers and traders</span>
                </div>
              </div>
            </div>
          </div>

          {/* Floating Elements */}
          <div className="absolute top-20 right-20 w-32 h-32 bg-white/10 rounded-full blur-2xl animate-pulse" />
          <div className="absolute bottom-20 left-20 w-40 h-40 bg-white/10 rounded-full blur-3xl animate-pulse delay-1000" />
        </div>

        {/* Right Side - Form Section */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-3 sm:p-4 md:p-6 lg:p-8 bg-gray-50">
          <div className="w-full max-w-md">
            {/* Mobile Logo */}
            <div className="lg:hidden text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-600 rounded-2xl mb-4 shadow-lg">
                <Sprout className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">Grainology</h1>
              <p className="text-gray-600">Digital Agri-Marketplace</p>
            </div>

            <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 md:p-10 border border-gray-100">
              {/* Tab Switcher */}
              <div className="flex gap-2 mb-6 sm:mb-8 bg-gray-100 p-1 rounded-xl">
                <button
                  onClick={() => navigate('/login')}
                  className="flex-1 py-3 px-4 rounded-lg text-sm sm:text-base font-semibold transition-all duration-200 text-gray-600 hover:text-gray-800"
                >
                  Login
                </button>
                <button
                  className="flex-1 py-3 px-4 rounded-lg text-sm sm:text-base font-semibold transition-all duration-200 bg-white text-green-600 shadow-md"
                >
                  Register
                </button>
              </div>

              {/* Progress Steps */}
              <div className="mb-6 flex justify-between gap-1">
                <div className={`flex-1 h-1.5 rounded-full transition-all duration-300 ${step >= 1 ? 'bg-green-600' : 'bg-gray-200'}`}></div>
                <div className={`flex-1 h-1.5 rounded-full transition-all duration-300 ${step >= 2 ? 'bg-green-600' : 'bg-gray-200'}`}></div>
                <div className={`flex-1 h-1.5 rounded-full transition-all duration-300 ${step >= 3 ? 'bg-green-600' : 'bg-gray-200'}`}></div>
                <div className={`flex-1 h-1.5 rounded-full transition-all duration-300 ${step >= 4 ? 'bg-green-600' : 'bg-gray-200'}`}></div>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              {reentryMode && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm font-semibold text-amber-900">Rejected Registration Re-Entry</p>
                  <p className="text-xs text-amber-800 mt-1">
                    Update details and submit again. It will go back to Super Admin approval.
                  </p>
                  {reentryDeclineReason && (
                    <p className="text-xs text-red-700 mt-2">Reason: {reentryDeclineReason}</p>
                  )}
                </div>
              )}

              {/* Step 1: User Details & User Type Selection */}
              {step === 1 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">
                      {reentryMode ? 'Step 1: Review Details' : 'Step 1: Who Are You?'}
                    </h3>
                    <p className="text-sm text-gray-600 mb-4">
                      {reentryMode ? 'Correct your details and continue for re-submission.' : 'Select your role to get started.'}
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      I am a <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <select
                        value={userType}
                        onChange={(e) => {
                          setUserType(e.target.value);
                          setError('');
                        }}
                        className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent appearance-none bg-white"
                        required
                      >
                        <option value="">I am a --</option>
                        {USER_TYPES.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="Enter your full name"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Trade Name
                    </label>
                    <label className="flex items-center gap-2 mb-2">
                      <input
                        type="checkbox"
                        checked={sameAsName}
                        onChange={(e) => {
                          setSameAsName(e.target.checked);
                          if (e.target.checked) setTradeName(name);
                        }}
                        className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                      <span className="text-sm text-gray-700">Same as Full Name</span>
                    </label>
                    <input
                      type="text"
                      value={sameAsName ? name : tradeName}
                      onChange={(e) => setTradeName(e.target.value)}
                      disabled={sameAsName}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-600"
                      placeholder="Enter trade name (or use Same as Full Name)"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      WhatsApp Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={mobileNumber}
                      onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="9876543210"
                      maxLength={10}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email ID <span className="text-gray-500 text-xs">(Optional)</span>
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="your.email@example.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-4 py-3 pr-11 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        placeholder="At least 6 characters"
                        minLength={6}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute inset-y-0 right-0 px-3 text-gray-500 hover:text-gray-700"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        title={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 pt-4 mt-4">
                    <h4 className="text-sm font-semibold text-gray-800 mb-3">Address Information</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1</label>
                        <input
                          type="text"
                          value={addressLine1}
                          onChange={(e) => setAddressLine1(e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                          placeholder="Street, area, landmark"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
                        <input
                          type="text"
                          value={addressLine2}
                          onChange={(e) => setAddressLine2(e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                          placeholder="Building, block (optional)"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">District</label>
                          <input
                            type="text"
                            value={district}
                            onChange={(e) => setDistrict(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            placeholder="District"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                          <input
                            type="text"
                            value={state}
                            onChange={(e) => setState(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            placeholder="State"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                          <input
                            type="text"
                            value={country}
                            onChange={(e) => setCountry(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            placeholder="Country"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Pincode</label>
                          <input
                            type="text"
                            value={pincode}
                            onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            placeholder="Pincode"
                            maxLength={6}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Document Type Selection – checkboxes, at least one required */}
              {step === 2 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Step 2: Choose Verification Documents</h3>
                  <p className="text-sm text-gray-600 mb-4">Select at least one document type. You can select multiple – a file will be required for each selected type.</p>
                  {documentOptions.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">Loading document options...</div>
                  ) : (
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Document types <span className="text-red-500">*</span> (min 1, select all that apply)
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-2">
                        {documentOptions.map((doc) => (
                          <label key={doc.value} className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedDocTypes.includes(doc.value)}
                              onChange={() => toggleDocType(doc.value)}
                              className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                            />
                            <span className="text-sm text-gray-800">{doc.label}</span>
                          </label>
                        ))}
                      </div>
                      {selectedDocTypes.includes('other') && (
                        <div className="mt-3">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Specify document type (for &quot;Other&quot;) <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={otherDocumentLabel}
                            onChange={(e) => { setOtherDocumentLabel(e.target.value); setError(''); }}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            placeholder="e.g. Ration Card, School ID, Company ID"
                          />
                        </div>
                      )}
                      {selectedDocTypes.length > 0 && (
                        <p className="text-xs text-green-700 mt-2">
                          {selectedDocTypes.length} selected. You will need to upload a file for each in the next step.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Document Upload – one per selected type */}
              {step === 3 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">Step 3: Upload Documents</h3>
                    <p className="text-sm text-gray-600 mb-4">Upload a file for each document type you selected. All are required.</p>
                  </div>
                  <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                    {selectedDocTypes.map((docType) => (
                      <div key={docType} className="border border-gray-200 rounded-xl p-4 bg-gray-50/50">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {docType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} <span className="text-red-500">*</span>
                        </label>
                        <div
                          className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors bg-white cursor-pointer ${
                            draggingOver === docType
                              ? 'border-green-500 bg-green-50'
                              : 'border-gray-300 hover:border-green-500'
                          }`}
                          onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDraggingOver(docType); }}
                          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                          onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDraggingOver(null); }}
                          onDrop={(e) => handleDrop(e, docType)}
                          onClick={() => document.getElementById(`doc-${docType}`)?.click()}
                        >
                          <input
                            type="file"
                            id={`doc-${docType}`}
                            onChange={(e) => handleDocumentUpload(e, docType)}
                            accept="image/jpeg,image/jpg,image/png,application/pdf"
                            className="hidden"
                          />
                          <div className="pointer-events-none flex flex-col items-center">
                            <Upload className="w-10 h-10 text-gray-400 mb-1" />
                            <span className="text-sm text-gray-600">
                              {documentFiles[docType] ? documentFiles[docType].name : 'Click or drag and drop PDF or Image'}
                            </span>
                            <span className="text-xs text-gray-500">Max 10MB</span>
                          </div>
                        </div>
                        {documentFiles[docType] && (
                          <p className="text-xs text-green-700 mt-1">✓ File selected</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 4: OTP Verification (only when email provided) or Confirm */}
              {step === 4 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">Step 4: {requiresEmailOtp ? 'Verify Email OTP' : 'Confirm & Register'}</h3>
                    {requiresEmailOtp ? (
                      <p className="text-sm text-gray-600 mb-4">Enter the OTP sent to your email for verification.</p>
                    ) : (
                      <p className="text-sm text-gray-600 mb-4">
                        Click Register to submit. Your account will remain locked until approval.
                      </p>
                    )}
                  </div>
                  
                  {requiresEmailOtp ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email OTP <span className="text-red-500">*</span>
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={emailOtp}
                          onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                          placeholder="Enter 6-digit OTP"
                          maxLength={6}
                        />
                      </div>
                      {sendingOtp && !emailOtpSent && (
                        <p className="text-sm text-gray-600 mt-1">Sending OTP to your email...</p>
                      )}
                      {emailOtpSent && (
                        <>
                          <p className="text-xs text-green-600 mt-1">✓ OTP sent to {email}. Valid for 10 minutes.</p>
                          <ResendOtpButton
                            otpSentAt={otpSentAt}
                            onResend={handleSendEmailOTP}
                            sendingOtp={sendingOtp}
                            cooldownSeconds={60}
                          />
                        </>
                      )}
                    </div>
                  ) : null}
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="mt-6">
                <button
                  onClick={handleNext}
                  disabled={loading || checkingMobile}
                  className="w-full py-3 px-6 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-all duration-200"
                >
                  {step === 4 ? (
                    loading ? (reentryMode ? 'Resubmitting...' : 'Registering...') : (reentryMode ? 'Resubmit' : 'Register')
                  ) : step === 1 && checkingMobile ? (
                    'Checking...'
                  ) : (
                    'Continue'
                  )}
                </button>
                {step > 1 && (
                  <button
                    onClick={handleBack}
                    className="w-full mt-3 py-3 px-6 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-semibold transition-all duration-200"
                  >
                    Back
                  </button>
                )}
              </div>

              {/* Getting Started Info */}
              {step === 1 && (
                <div className="mt-6 p-4 bg-gray-50 rounded-xl">
                  <h4 className="text-sm font-semibold text-gray-800 mb-2">Getting Started:</h4>
                  <ul className="text-xs text-gray-600 space-y-1">
                    <li>1. Click "Register" to create a new account</li>
                    <li>2. Choose your role: Farmer, Trader, FPO, Corporate, Miller, Financer</li>
                    <li>3. Use any email address (confirmation not required)</li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
