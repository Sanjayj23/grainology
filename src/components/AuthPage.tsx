import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Sprout, Shield, CheckCircle, ChevronDown } from 'lucide-react';
import Navigation from './Navigation';
import Footer from './Footer';
// @ts-ignore - JS module without types
import { api } from '../lib/api';

interface AuthPageProps {
  initialMode?: 'login' | 'register';
}

export default function AuthPage({ initialMode = 'login' }: AuthPageProps = {}) {
  const [isLogin, setIsLogin] = useState(initialMode === 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState('English');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [district, setDistrict] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('India');
  const [pincode, setPincode] = useState('');
  const [role, setRole] = useState<'' | 'farmer' | 'trader' | 'fpo' | 'corporate' | 'miller' | 'financer' | 'admin'>('');
  const [entityType, setEntityType] = useState<'individual' | 'company'>('individual');
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState<'private_limited' | 'partnership' | 'proprietorship' | 'llp'>('private_limited');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [loginId, setLoginId] = useState(''); // Mobile number OR email for login

  // KYC Verification state
  const [verificationMethod, setVerificationMethod] = useState<'pan' | 'aadhaar' | 'gst' | 'cin' | ''>('');
  const [panNumber, setPanNumber] = useState('');
  const [panName, setPanName] = useState('');
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [cinNumber, setCinNumber] = useState('');
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentPreview, setDocumentPreview] = useState<string | null>(null);
  const [kycVerifying, setKycVerifying] = useState(false);
  const [kycVerified, setKycVerified] = useState(false);
  const [kycVerificationData, setKycVerificationData] = useState<any>(null);
  const [autoFilledData, setAutoFilledData] = useState<any>(null);
  
  // Sandbox Aadhaar verification state
  const [aadhaarOtpSent, setAadhaarOtpSent] = useState(false);
  const [aadhaarReferenceId, setAadhaarReferenceId] = useState<string | null>(null);
  const [aadhaarOtp, setAadhaarOtp] = useState('');
  
  // Cashfree Digilocker polling refs (commented out but kept for reference)
  // const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // const pollingStartTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // const pollingMaxTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { signIn } = useAuth();
  const navigate = useNavigate();

  // Cleanup polling on unmount (commented out - was for Cashfree Digilocker)
  // useEffect(() => {
  //   return () => {
  //     if (pollingIntervalRef.current) {
  //       clearInterval(pollingIntervalRef.current);
  //     }
  //     if (pollingStartTimeoutRef.current) {
  //       clearTimeout(pollingStartTimeoutRef.current);
  //     }
  //     if (pollingMaxTimeoutRef.current) {
  //       clearTimeout(pollingMaxTimeoutRef.current);
  //     }
  //   };
  // }, []);

  const handleDocumentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setDocumentFile(file);
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setDocumentPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Handle navigation between steps for registration
    if (!isLogin && step < 4) {
      if (step === 1) {
        // Step 1: Validate role selection
        if (!role) {
          setError('Please select your role to continue');
          return;
        }
        setStep(2);
        return;
      } else if (step === 2) {
        // Step 2: Validate verification method selection
        if (!verificationMethod) {
          setError('Please select a verification method to continue');
          return;
        }
        setStep(3);
        return;
      } else if (step === 3) {
        // Step 3: Document verification - validation will be done in the verification function
        // Just proceed to next step after verification is complete
        return;
      }
      return;
    }

    // If on step 4 (final step) or login, proceed with account creation/sign in
    if (!isLogin && step !== 4) {
      return; // Don't proceed if not on final step
    }

    // Login validation: need mobile number OR email, and password
    if (isLogin) {
      const trimmed = loginId.trim();
      if (!trimmed) {
        setError('Enter your mobile number or email address');
        return;
      }
      if (!password) {
        setError('Password is required');
        return;
      }
      const isEmail = trimmed.includes('@');
      if (!isEmail) {
        const digits = trimmed.replace(/\D/g, '');
        if (digits.length !== 10) {
          setError('Mobile number must be 10 digits');
          return;
        }
      }
    }

    // Final validation for step 4 (final step - create account)
    if (!isLogin && step === 4) {
      if (!password || password.length < 6) {
        setError('Password is required and must be at least 6 characters');
        setLoading(false);
        return;
      }
      // Ensure name is available (from auto-filled data or manual input)
      const finalName = autoFilledData?.name || name;
      if (!finalName || !finalName.trim()) {
        setError('Name is required. Please complete KYC verification or enter your name manually.');
        setLoading(false);
        return;
      }
      if (!mobileNumber || mobileNumber.length !== 10) {
        setError('Please enter a valid 10-digit mobile number');
        setLoading(false);
        return;
      }
    }

    setLoading(true);

    try {
      if (isLogin) {
        const trimmed = loginId.trim();
        const isEmail = trimmed.includes('@');
        const credentials = isEmail
          ? { email: trimmed.toLowerCase(), password }
          : { mobile_number: trimmed.replace(/\D/g, '').slice(0, 10), password };
        await signIn(credentials);
        navigate('/dashboard');
      } else {
        // Complete signup with verified KYC data
        // Ensure we have a valid name
        const finalName = autoFilledData?.name || name;
        if (!finalName || !finalName.trim()) {
          setError('Name is required. Please complete KYC verification or enter your name manually.');
          setLoading(false);
          return;
        }

        const isCompany = entityType === 'company';

        const signUpPayload: any = {
          password,
          name: finalName.trim(),
          mobile_number: mobileNumber?.trim() || undefined,
          preferred_language: preferredLanguage || 'English',
          address_line1: autoFilledData?.address || addressLine1 || undefined,
          address_line2: addressLine2 || undefined,
          district: district || undefined,
          state: state || undefined,
          country: country || 'India',
          pincode: pincode || undefined,
          role: role || 'farmer',
          entity_type: entityType || 'individual',
          // For company accounts, prefer verified business/trade name from GSTIN/CIN data when available
          business_name: isCompany
            ? (autoFilledData?.documentType === 'GSTIN' || autoFilledData?.documentType === 'CIN'
                ? (autoFilledData?.name || businessName)
                : businessName)
            : undefined,
          business_type: isCompany ? businessType : undefined,
        };

        // Only add email if it's provided and not empty - don't send empty strings
        const cleanEmail = email && typeof email === 'string' ? email.trim() : '';
        if (cleanEmail && cleanEmail.length > 0) {
          signUpPayload.email = cleanEmail;
        }

        // Add KYC data if verified
        if (kycVerified && kycVerificationData) {
          const kycData: any = {
            verificationMethod: verificationMethod,
            verification_id: kycVerificationData.verification_id,
            ...kycVerificationData,
            autoFilledData: autoFilledData,
          };

          // Aadhaar-specific structured data
          if (verificationMethod === 'aadhaar') {
            kycData.aadhaar_data = {
              name: autoFilledData?.name,
              date_of_birth: autoFilledData?.dateOfBirth,
              gender: autoFilledData?.gender || kycVerificationData.gender,
              address: autoFilledData?.address,
              aadhaar_number: autoFilledData?.aadhaarNumber,
              father_name: autoFilledData?.father_name || kycVerificationData.father_name,
              verified_at: autoFilledData?.verifiedAt || new Date().toISOString(),
            };
          }

          // GSTIN-specific data
          if (verificationMethod === 'gst') {
            kycData.gstin_data = {
              gstin: autoFilledData?.documentNumber,
              business_name:
                autoFilledData?.name ||
                kycVerificationData.business_name ||
                kycVerificationData.details?.trade_name_of_business ||
                kycVerificationData.details?.legal_name_of_business,
              details: kycVerificationData.details || kycVerificationData,
            };
          }

          // CIN-specific data
          if (verificationMethod === 'cin') {
            kycData.cin_data = {
              cin: autoFilledData?.documentNumber,
              company_name:
                autoFilledData?.name ||
                kycVerificationData.company_name,
              details: kycVerificationData.details || kycVerificationData,
            };
          }

          // PAN-specific data
          if (verificationMethod === 'pan') {
            kycData.pan_data = {
              pan: autoFilledData?.documentNumber,
              name: autoFilledData?.name,
              details: kycVerificationData.details || kycVerificationData,
            };
          }

          signUpPayload.kyc_verification_data = kycData;
        }

        console.log('Signup payload:', { ...signUpPayload, password: '***' }); // Log without password

        // Call signup with timeout protection (handled in api.js)
        console.log('🚀 Starting signup request...');
        const startTime = Date.now();
        
        const { data: authData, error: signUpError } = await api.auth.signUp(signUpPayload);
        
        const elapsedTime = Date.now() - startTime;
        console.log(`⏱️ Signup request completed in ${elapsedTime}ms`);

        if (signUpError) {
          // Extract error message from signup error
          const errorMessage = signUpError.message || 
                               signUpError.error?.message || 
                               signUpError.error ||
                               signUpError.details || 
                               'An error occurred while creating an account';
          console.error('❌ Signup error:', signUpError);
          setError(errorMessage);
          setLoading(false);
          return;
        }
        
        if (!authData?.user) {
          console.error('❌ Signup failed: No user data returned');
          setError('Failed to create user. Please try again.');
          setLoading(false);
          return;
        }
        
        console.log('✅ Signup successful, user created:', authData.user.id);
        
        // Show success message
        console.log('✅ Account created successfully with Aadhaar verification!');
        console.log('Aadhaar data stored:', kycVerificationData);
        
        // Automatically sign in the user after successful registration
        try {
          await signIn(mobileNumber, password);
          // Redirect to dashboard after successful sign in
          console.log('✅ Sign in successful, redirecting to dashboard...');
          navigate('/dashboard');
        } catch (signInError: any) {
          console.error('Sign in error after signup:', signInError);
          // Even if sign in fails, redirect to dashboard (user is already created)
          // The dashboard will handle authentication state
          navigate('/dashboard');
        }
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      const rawMessage = typeof err === 'string' ? err : (err?.message || err?.error?.message || err?.error || err?.details);
      const isRejected = rawMessage && (
        (typeof rawMessage === 'string' && /account rejected|not approved/i.test(rawMessage)) ||
        err?.error === 'Account rejected'
      );
      const isPendingApproval = rawMessage && !isRejected && (
        (typeof rawMessage === 'string' && /pending approval|under review/i.test(rawMessage)) ||
        err?.error === 'Account pending approval'
      );
      const errorMessage = isRejected
        ? 'Your account was not approved. Please contact Admin/Super Admin for re-entry link.'
        : isPendingApproval
          ? 'Your account is not approved. Please wait for approval.'
          : (rawMessage || 'An error occurred. Please try again.');
      setError(errorMessage);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />
      <div className="flex flex-1">
        {/* Left Side - Image/Branding Section */}
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
                <span>Secure KYC verification with DigiLocker</span>
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
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-3 px-4 rounded-lg text-sm sm:text-base font-semibold transition-all duration-200 ${
                isLogin
                  ? 'bg-white text-green-600 shadow-md'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Login
            </button>
            <Link
              to="/register"
              className={`flex-1 py-3 px-4 rounded-lg text-sm sm:text-base font-semibold transition-all duration-200 text-center block ${
                !isLogin
                  ? 'bg-white text-green-600 shadow-md'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Register
            </Link>
          </div>

          {!isLogin && step <= 4 && (
            <div className="mb-6 flex justify-between gap-1">
              <div className={`flex-1 h-1.5 rounded-full transition-all duration-300 ${step >= 1 ? 'bg-green-600' : 'bg-gray-200'}`}></div>
              <div className={`flex-1 h-1.5 rounded-full transition-all duration-300 ${step >= 2 ? 'bg-green-600' : 'bg-gray-200'}`}></div>
              <div className={`flex-1 h-1.5 rounded-full transition-all duration-300 ${step >= 3 ? 'bg-green-600' : 'bg-gray-200'}`}></div>
              <div className={`flex-1 h-1.5 rounded-full transition-all duration-300 ${step >= 4 ? 'bg-green-600' : 'bg-gray-200'}`}></div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
            {!isLogin && step === 1 && (
              <>
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5 mb-6">
                  <p className="text-base font-semibold text-blue-900 mb-1">Step 1: Who Are You?</p>
                  <p className="text-sm text-blue-700">Select your role to get started</p>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    I am a <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={role}
                      onChange={(e) => {
                        const newRole = e.target.value as any;
                        setRole(newRole);
                        // Auto-set entity_type based on role
                        if (newRole === 'farmer' || newRole === 'trader') {
                          setEntityType('individual');
                        } else if (newRole === 'fpo' || newRole === 'corporate' || newRole === 'miller' || newRole === 'financer') {
                          setEntityType('company');
                        }
                      }}
                      className="w-full px-4 py-3 pr-10 text-sm sm:text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all appearance-none bg-white"
                    >
                      <option value="">I am a --</option>
                      <option value="farmer">Farmer</option>
                      <option value="trader">Trader</option>
                      <option value="fpo">FPO (Farmer Producer Organization)</option>
                      <option value="corporate">Corporate</option>
                      <option value="miller">Miller/Processor</option>
                      <option value="financer">Financer</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  </div>
                </div>
              </>
            )}

            {!isLogin && step === 2 && (
              <>
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5 mb-6">
                  <div className="flex items-center gap-2 mb-1">
                    <Shield className="w-5 h-5 text-blue-600" />
                    <p className="text-base font-semibold text-blue-900">Step 2: Choose Verification Method</p>
                  </div>
                  <p className="text-sm text-blue-700">Select how you want to verify your identity</p>
                </div>

                {entityType === 'individual' ? (
                  <>
                    <div className="mb-4">
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                        Select Verification Method <span className="text-red-500">*</span>
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setVerificationMethod('pan')}
                          className={`p-5 border-2 rounded-xl text-center transition-all duration-200 ${
                            verificationMethod === 'pan'
                              ? 'border-green-600 bg-green-50 text-green-700 shadow-md scale-105'
                              : 'border-gray-300 hover:border-green-300 hover:bg-green-50/50'
                          }`}
                        >
                          <div className="font-semibold text-sm mb-1">PAN Card</div>
                          <div className="text-xs text-gray-600">Verify with PAN</div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setVerificationMethod('aadhaar')}
                          className={`p-5 border-2 rounded-xl text-center transition-all duration-200 ${
                            verificationMethod === 'aadhaar'
                              ? 'border-green-600 bg-green-50 text-green-700 shadow-md scale-105'
                              : 'border-gray-300 hover:border-green-300 hover:bg-green-50/50'
                          }`}
                        >
                          <div className="font-semibold text-sm mb-1">Aadhaar Card</div>
                          <div className="text-xs text-gray-600">Verify with Aadhaar</div>
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mb-4">
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                        Select Verification Method <span className="text-red-500">*</span>
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setVerificationMethod('gst')}
                          className={`p-4 border-2 rounded-lg text-center transition-colors ${
                            verificationMethod === 'gst'
                              ? 'border-green-600 bg-green-50 text-green-700'
                              : 'border-gray-300 hover:border-gray-400'
                          }`}
                        >
                          <div className="font-medium text-sm">GST Number</div>
                          <div className="text-xs text-gray-600 mt-1">Verify with GST</div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setVerificationMethod('cin')}
                          className={`p-4 border-2 rounded-lg text-center transition-colors ${
                            verificationMethod === 'cin'
                              ? 'border-green-600 bg-green-50 text-green-700'
                              : 'border-gray-300 hover:border-gray-400'
                          }`}
                        >
                          <div className="font-medium text-sm">CIN Number</div>
                          <div className="text-xs text-gray-600 mt-1">Verify with CIN</div>
                        </button>
                      </div>
                    </div>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 px-4 rounded-xl transition-all duration-200"
                >
                  Back
                </button>
              </>
            )}

            {!isLogin && step === 3 && (
              <>
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5 mb-6">
                  <div className="flex items-center gap-2 mb-1">
                    <Shield className="w-5 h-5 text-blue-600" />
                    <p className="text-base font-semibold text-blue-900">Step 3: Document Verification</p>
                  </div>
                  <p className="text-sm text-blue-700">Enter your document details and verify. We'll check if an account already exists with this document.</p>
                </div>

                {verificationMethod === 'pan' && (
                  <>
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                        PAN Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={panNumber}
                        onChange={(e) => setPanNumber(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))}
                        className="w-full px-4 py-3 text-sm sm:text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                        placeholder="ABCDE1234F"
                        maxLength={10}
                      />
                      <p className="text-xs text-gray-500 mt-1">Format: ABCDE1234F</p>
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                        Full Name (as on PAN) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={panName}
                        onChange={(e) => setPanName(e.target.value)}
                        className="w-full px-4 py-3 text-sm sm:text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                        placeholder="Enter your full name"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!panNumber || !panName) {
                          setError('Please enter PAN number and name');
                          return;
                        }
                        setKycVerifying(true);
                        setError('');
                        try {
                          // First check if user already exists with this PAN
                          const checkResponse = await fetch(
                            `${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/auth/check-verification-document`,
                            {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                verification_method: 'pan',
                                document_id: panNumber.trim().toUpperCase()
                              })
                            }
                          );

                          const checkResult = await checkResponse.json();

                          if (checkResult.exists) {
                            setError(checkResult.message || 'An account already exists with this PAN number');
                            setKycVerifying(false);
                            return;
                          }

                          // If account doesn't exist, proceed with verification
                          const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/cashfree/kyc/verify-pan`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ pan: panNumber.trim().toUpperCase(), name: panName.trim() }),
                          });
                          
                          const result = await response.json();
                          
                          if (!response.ok) {
                            // Handle error responses
                            const errorMessage = result.message || result.error || 'PAN verification failed';
                            setError(errorMessage);
                            console.error('PAN verification error:', result);
                            return;
                          }
                          
                          if (result.success && result.verified) {
                            setKycVerified(true);
                            setKycVerificationData(result);
                            setAutoFilledData({
                              name: result.name || panName,
                              documentNumber: panNumber.toUpperCase(),
                              documentType: 'PAN',
                              verifiedDetails: result,
                            });
                            setStep(4); // Go to review and password step
                          } else {
                            const errorMessage = result.message || result.error || 'PAN verification failed. Please check your PAN number and name.';
                            setError(errorMessage);
                          }
                        } catch (err: any) {
                          console.error('PAN verification network error:', err);
                          setError(err.message || 'Network error. Please check your connection and try again.');
                        } finally {
                          setKycVerifying(false);
                        }
                      }}
                      disabled={kycVerifying || !panNumber || !panName}
                      className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold py-3 px-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {kycVerifying ? 'Verifying...' : 'Verify PAN'}
                    </button>
                  </>
                )}

                {verificationMethod === 'aadhaar' && (
                  <>
                    {/* ========== SANDBOX AADHAAR VERIFICATION (NEW) ========== */}
                    {!aadhaarOtpSent ? (
                  <>
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                        Aadhaar Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={aadhaarNumber}
                        onChange={(e) => setAadhaarNumber(e.target.value.replace(/\D/g, '').slice(0, 12))}
                            disabled={kycVerifying}
                            className="w-full px-4 py-3 text-sm sm:text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all disabled:bg-gray-100"
                        placeholder="Enter 12-digit Aadhaar number"
                        maxLength={12}
                      />
                      <p className="text-xs text-gray-500 mt-1">Enter your 12-digit Aadhaar number</p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!aadhaarNumber || aadhaarNumber.length !== 12) {
                          setError('Please enter a valid 12-digit Aadhaar number');
                          return;
                        }

                            // Additional validation: Aadhaar should not start with 0 or 1
                            if (aadhaarNumber.startsWith('0') || aadhaarNumber.startsWith('1')) {
                              setError('Invalid Aadhaar number. Aadhaar cannot start with 0 or 1.');
                              return;
                            }

                        setKycVerifying(true);
                        setError('');

                            try {
                              // First check if user already exists with this Aadhaar
                              const checkResponse = await fetch(
                                `${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/auth/check-verification-document`,
                                {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    verification_method: 'aadhaar',
                                    document_id: aadhaarNumber
                                  })
                                }
                              );

                              const checkResult = await checkResponse.json();

                              if (checkResult.exists) {
                                setError(checkResult.message || 'An account already exists with this Aadhaar number');
                                setKycVerifying(false);
                                return;
                              }

                              // If account doesn't exist, proceed with OTP generation
                              const response = await fetch(
                                `${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/sandbox/kyc/aadhaar/generate-otp`,
                                {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    aadhaar_number: aadhaarNumber,
                                    reason: 'KYC verification for account registration'
                                  })
                                }
                              );

                              const result = await response.json();

                              if (!response.ok) {
                                throw new Error(result.error || 'Failed to generate OTP');
                              }

                              if (result.success && result.reference_id) {
                                setAadhaarReferenceId(result.reference_id);
                                setAadhaarOtpSent(true);
                                setError('');
                                // Show success message
                                console.log('✅ OTP sent successfully. Reference ID:', result.reference_id);
                              } else {
                                throw new Error(result.error || 'Failed to generate OTP');
                              }
                            } catch (err: any) {
                              console.error('Aadhaar OTP generation error:', err);
                              setError(err.message || 'Failed to send OTP. Please try again.');
                            } finally {
                              setKycVerifying(false);
                            }
                          }}
                          disabled={kycVerifying || !aadhaarNumber || aadhaarNumber.length !== 12}
                          className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold py-3 px-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {kycVerifying ? 'Sending OTP...' : 'Send OTP'}
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
                          <p className="text-sm text-blue-800">
                            OTP has been sent to your registered mobile number linked with Aadhaar. Please enter the OTP below.
                          </p>
                        </div>
                        <div>
                          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                            Enter OTP <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={aadhaarOtp}
                            onChange={(e) => setAadhaarOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            disabled={kycVerifying}
                            className="w-full px-4 py-3 text-sm sm:text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all disabled:bg-gray-100 text-center text-2xl tracking-widest"
                            placeholder="000000"
                            maxLength={6}
                          />
                          <p className="text-xs text-gray-500 mt-1">Enter the 6-digit OTP received on your mobile</p>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!aadhaarOtp || aadhaarOtp.length !== 6) {
                              setError('Please enter a valid 6-digit OTP');
                              return;
                            }

                            if (!aadhaarReferenceId) {
                              setError('Reference ID missing. Please start verification again.');
                              return;
                            }

                            setKycVerifying(true);
                            setError('');

                            try {
                              // Validate inputs before sending
                              if (!aadhaarReferenceId || !aadhaarOtp) {
                                setError('Reference ID and OTP are required');
                                setKycVerifying(false);
                                return;
                              }

                              const response = await fetch(
                                `${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/sandbox/kyc/aadhaar/verify-otp`,
                                {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    reference_id: String(aadhaarReferenceId).trim(),
                                    otp: String(aadhaarOtp).trim()
                                  })
                                }
                              );

                              const result = await response.json();

                              if (!response.ok) {
                                // Log full error for debugging
                                console.error('OTP verification failed:', {
                                  status: response.status,
                                  error: result.error,
                                  details: result.details
                                });
                                throw new Error(result.error || result.message || 'Failed to verify OTP');
                              }

                              if (result.success && result.verified) {
                                // Extract Aadhaar details
                                const address = result.address || {};
                                const fullAddress = address.full_address || [
                                  address.house,
                                  address.street,
                                  address.landmark,
                                  address.vtc,
                                  address.post_office,
                                  address.district,
                                  address.state,
                                  address.pincode
                                ].filter(Boolean).join(', ');

                                const aadhaarData = {
                                  name: result.name || '',
                                  dateOfBirth: result.date_of_birth || result.year_of_birth || '',
                                  gender: result.gender || '',
                                  address: fullAddress,
                                  aadhaarNumber: result.aadhaar_number || aadhaarNumber,
                                  care_of: result.care_of || '',
                                  documentType: 'Aadhaar',
                                  verification_method: 'sandbox',
                                  reference_id: result.reference_id,
                                  verifiedDetails: result,
                                  verifiedAt: new Date().toISOString()
                                };

                                setKycVerified(true);
                                setKycVerificationData(result);
                                setAutoFilledData(aadhaarData);
                                setKycVerifying(false);
                                setError('');

                                console.log('✅ Aadhaar verification successful!', aadhaarData);

                                // Proceed to next step (review and password)
                                setStep(4);
                              } else {
                                throw new Error(result.error || 'Aadhaar verification failed');
                              }
                            } catch (err: any) {
                              console.error('Aadhaar OTP verification error:', err);
                              setError(err.message || 'Failed to verify OTP. Please check the OTP and try again.');
                            } finally {
                              setKycVerifying(false);
                            }
                          }}
                          disabled={kycVerifying || !aadhaarOtp || aadhaarOtp.length !== 6}
                          className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold py-3 px-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {kycVerifying ? 'Verifying...' : 'Verify OTP'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAadhaarOtpSent(false);
                            setAadhaarReferenceId(null);
                            setAadhaarOtp('');
                            setAadhaarNumber('');
                            setError('');
                          }}
                          className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-lg transition-colors mt-2"
                        >
                          Change Aadhaar Number
                        </button>
                      </>
                    )}
                    {/* ========== END SANDBOX AADHAAR VERIFICATION ========== */}

                    {/* ========== CASHFREE DIGILOCKER VERIFICATION (COMMENTED OUT) ========== */}
                    {/* 
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                        Aadhaar Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={aadhaarNumber}
                        onChange={(e) => setAadhaarNumber(e.target.value.replace(/\D/g, '').slice(0, 12))}
                        className="w-full px-4 py-3 text-sm sm:text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                        placeholder="Enter 12-digit Aadhaar number"
                        maxLength={12}
                      />
                      <p className="text-xs text-gray-500 mt-1">Enter your 12-digit Aadhaar number</p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        // Cashfree Digilocker verification code commented out - replaced with Sandbox Aadhaar OTP verification
                        if (!aadhaarNumber || aadhaarNumber.length !== 12) {
                          setError('Please enter a valid 12-digit Aadhaar number');
                          return;
                        }
                        
                        // Clear any existing polling
                        if (pollingIntervalRef.current) {
                          clearInterval(pollingIntervalRef.current);
                          pollingIntervalRef.current = null;
                        }
                        if (pollingStartTimeoutRef.current) {
                          clearTimeout(pollingStartTimeoutRef.current);
                          pollingStartTimeoutRef.current = null;
                        }
                        if (pollingMaxTimeoutRef.current) {
                          clearTimeout(pollingMaxTimeoutRef.current);
                          pollingMaxTimeoutRef.current = null;
                        }
                        
                        setKycVerifying(true);
                        setError('');
                        let timeoutId: NodeJS.Timeout | null = null;
                        const controller = new AbortController();
                        
                        try {
                          // Increase timeout to 60 seconds for initial request (backend might be slow)
                          timeoutId = setTimeout(() => {
                            if (!controller.signal.aborted) {
                              controller.abort();
                            }
                          }, 60000);
                          
                          const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/cashfree/kyc/verify-aadhaar-number`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ aadhaar_number: aadhaarNumber }),
                            signal: controller.signal
                          });
                          
                          // Clear timeout immediately after fetch completes
                          if (timeoutId) {
                            clearTimeout(timeoutId);
                            timeoutId = null;
                          }
                          
                          // Check if response is OK before parsing JSON
                          if (!response.ok) {
                            const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
                            throw new Error(errorData.error || `Server error: ${response.status}`);
                          }
                          
                          const result = await response.json();
                          console.log('Aadhaar verification response:', result);
                          
                          if (result.success) {
                            // If DigiLocker verification URL is provided, open it
                            if (result.verification_url && !result.verified) {
                              console.log('Opening DigiLocker URL:', result.verification_url);
                              
                              // IMPORTANT: Use verification_id (not reference_id) for status checks
                              // Cashfree requires verification_id for status API calls
                              const verificationId = result.verification_id || result.reference_id;
                              const referenceId = result.reference_id; // Keep for reference
                              
                              if (!verificationId) {
                                setError('Missing verification ID. Please try again.');
                                setKycVerifying(false);
                                return;
                              }
                              
                              // Store verification_id for polling (this is what Cashfree needs)
                              const storedVerificationId = verificationId;
                              
                              // Open popup immediately (must be in direct response to user action)
                              // Use window.open synchronously - don't wrap in setTimeout
                              let digilockerWindow: Window | null = null;
                              
                              try {
                                // Open popup with proper features
                                digilockerWindow = window.open(
                                result.verification_url,
                                'digilocker_verification',
                                  'width=900,height=700,scrollbars=yes,resizable=yes,menubar=no,toolbar=no,location=yes,status=yes'
                              );
                                
                                // Check if popup was blocked (must check immediately)
                                if (!digilockerWindow || digilockerWindow.closed) {
                                  console.warn('Popup was blocked, trying new tab...');
                                  // Popup blocked - try new tab
                                  const newTab = window.open(result.verification_url, '_blank');
                                  if (newTab) {
                                    setError('Popup was blocked. Opened DigiLocker verification in a new tab. Please complete it there, we will automatically fetch your details once verified.');
                                    digilockerWindow = newTab;
                                  } else {
                                    // Even new tab was blocked - show URL with copy option
                                    navigator.clipboard?.writeText(result.verification_url).then(() => {
                                      setError(`Popup blocked. Verification URL copied to clipboard. Please paste it in a new browser tab/window.`);
                                    }).catch(() => {
                                      setError(`Popup blocked. Please manually open this URL: ${result.verification_url}`);
                                    });
                                  }
                                } else {
                                  console.log('Popup opened successfully');
                                  setError('Please complete verification in the popup window. We will automatically fetch your details once verified.');
                                }
                              } catch (openError) {
                                console.error('Error opening popup:', openError);
                                // Fallback: try new tab
                                const newTab = window.open(result.verification_url, '_blank');
                                if (newTab) {
                                  setError('Opened DigiLocker verification in a new tab. Please complete it there.');
                                  digilockerWindow = newTab;
                                } else {
                                  setError(`Please manually open this URL: ${result.verification_url}`);
                                }
                              }

                              let pollCount = 0;
                              const maxPolls = 120; // Poll for up to 6 minutes (120 * 3 seconds = 6 minutes)
                              
                              // Poll for verification status
                              const checkStatus = async () => {
                                try {
                                  pollCount++;
                                  console.log(`Checking DigiLocker status (poll ${pollCount}/${maxPolls})...`);
                                  
                                  // Use verification_id in query parameter (required by Cashfree)
                                  const statusResponse = await fetch(
                                    `${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/cashfree/kyc/digilocker-status/${storedVerificationId}?aadhaar=${aadhaarNumber}&verification_id=${storedVerificationId}`
                                  );
                                  
                                  if (!statusResponse.ok) {
                                    throw new Error(`Status check failed: ${statusResponse.status}`);
                                  }
                                  
                                  const statusResult = await statusResponse.json();
                                  console.log('DigiLocker status result:', statusResult);
                                  
                                  // Handle statuses according to Cashfree documentation:
                                  // PENDING, AUTHENTICATED, EXPIRED, CONSENT_DENIED
                                  const currentStatus = statusResult.status || statusResult.verification_status || 'PENDING';
                                  
                                  if (currentStatus === 'AUTHENTICATED' || statusResult.verified === true) {
                                    // User has authenticated and given consent - fetch document
                                    if (statusResult.name) {
                                    // Verification successful with details
                                      if (pollingIntervalRef.current) {
                                        clearInterval(pollingIntervalRef.current);
                                        pollingIntervalRef.current = null;
                                      }
                                      if (pollingStartTimeoutRef.current) {
                                        clearTimeout(pollingStartTimeoutRef.current);
                                        pollingStartTimeoutRef.current = null;
                                      }
                                      if (pollingMaxTimeoutRef.current) {
                                        clearTimeout(pollingMaxTimeoutRef.current);
                                        pollingMaxTimeoutRef.current = null;
                                      }
                                      
                                      // Store complete Aadhaar verification data
                                      const aadhaarData = {
                                      name: statusResult.name,
                                        dateOfBirth: statusResult.date_of_birth || statusResult.dob,
                                        gender: statusResult.gender,
                                        address: statusResult.address || statusResult.full_address,
                                      aadhaarNumber: statusResult.aadhaar_number || aadhaarNumber,
                                        father_name: statusResult.father_name,
                                      documentType: 'Aadhaar',
                                      verification_method: 'digilocker',
                                        verification_id: storedVerificationId,
                                      verifiedDetails: statusResult,
                                        verifiedAt: new Date().toISOString(),
                                      };
                                      
                                      setKycVerified(true);
                                      setKycVerificationData({
                                        ...statusResult,
                                        verification_id: storedVerificationId,
                                      });
                                      setAutoFilledData(aadhaarData);
                                      
                                      if (digilockerWindow && !digilockerWindow.closed) {
                                        digilockerWindow.close();
                                      }
                                      setKycVerifying(false);
                                      setError('');
                                      
                                      // Show success message
                                      console.log('✅ Aadhaar verification successful!', aadhaarData);
                                      
                                      // Proceed to next step (review and account creation)
                                    setStep(4);
                                      return;
                                    } else if (statusResult.error === 'eaadhaar_not_available') {
                                      // Aadhaar document not available in DigiLocker
                                      if (pollingIntervalRef.current) {
                                        clearInterval(pollingIntervalRef.current);
                                        pollingIntervalRef.current = null;
                                      }
                                      if (pollingStartTimeoutRef.current) {
                                        clearTimeout(pollingStartTimeoutRef.current);
                                        pollingStartTimeoutRef.current = null;
                                      }
                                      if (pollingMaxTimeoutRef.current) {
                                        clearTimeout(pollingMaxTimeoutRef.current);
                                        pollingMaxTimeoutRef.current = null;
                                      }
                                      setError('Aadhaar document not available in DigiLocker. Please log in to DigiLocker and link your Aadhaar document, then try again.');
                                      setKycVerifying(false);
                                      if (digilockerWindow && !digilockerWindow.closed) {
                                        digilockerWindow.close();
                                      }
                                      return;
                                    }
                                    // Status is AUTHENTICATED but no name yet - continue polling
                                  } else if (currentStatus === 'EXPIRED') {
                                    // Link expired
                                    if (pollingIntervalRef.current) {
                                      clearInterval(pollingIntervalRef.current);
                                      pollingIntervalRef.current = null;
                                    }
                                    if (pollingStartTimeoutRef.current) {
                                      clearTimeout(pollingStartTimeoutRef.current);
                                      pollingStartTimeoutRef.current = null;
                                    }
                                    if (pollingMaxTimeoutRef.current) {
                                      clearTimeout(pollingMaxTimeoutRef.current);
                                      pollingMaxTimeoutRef.current = null;
                                    }
                                    setError('DigiLocker verification link has expired. Please start the verification process again.');
                                    setKycVerifying(false);
                                    if (digilockerWindow && !digilockerWindow.closed) {
                                      digilockerWindow.close();
                                    }
                                    return;
                                  } else if (currentStatus === 'CONSENT_DENIED') {
                                    // User denied consent
                                    if (pollingIntervalRef.current) {
                                      clearInterval(pollingIntervalRef.current);
                                      pollingIntervalRef.current = null;
                                    }
                                    if (pollingStartTimeoutRef.current) {
                                      clearTimeout(pollingStartTimeoutRef.current);
                                      pollingStartTimeoutRef.current = null;
                                    }
                                    if (pollingMaxTimeoutRef.current) {
                                      clearTimeout(pollingMaxTimeoutRef.current);
                                      pollingMaxTimeoutRef.current = null;
                                    }
                                    setError('You denied consent to share documents. Please try again and provide consent to complete verification.');
                                    setKycVerifying(false);
                                    if (digilockerWindow && !digilockerWindow.closed) {
                                      digilockerWindow.close();
                                    }
                                    return;
                                  } else if (currentStatus === 'PENDING') {
                                    // Still pending - continue polling
                                    console.log('Verification still pending, continuing to poll...');
                                  } else if (pollCount >= maxPolls) {
                                    // Max polls reached - stop polling
                                    if (pollingIntervalRef.current) {
                                      clearInterval(pollingIntervalRef.current);
                                      pollingIntervalRef.current = null;
                                    }
                                    if (pollingStartTimeoutRef.current) {
                                      clearTimeout(pollingStartTimeoutRef.current);
                                      pollingStartTimeoutRef.current = null;
                                    }
                                    if (pollingMaxTimeoutRef.current) {
                                      clearTimeout(pollingMaxTimeoutRef.current);
                                      pollingMaxTimeoutRef.current = null;
                                    }
                                    setError('Verification is taking longer than expected. Please check if you completed the DigiLocker process or try again later.');
                                    setKycVerifying(false);
                                    if (digilockerWindow && !digilockerWindow.closed) {
                                      digilockerWindow.close();
                                  }
                                    return;
                                  }
                                  // Otherwise continue polling (status is still PENDING)
                                } catch (err) {
                                  console.error('Status check error:', err);
                                  // Continue polling on error unless we've reached max polls
                                  if (pollCount >= maxPolls) {
                                    if (pollingIntervalRef.current) {
                                      clearInterval(pollingIntervalRef.current);
                                      pollingIntervalRef.current = null;
                                    }
                                    if (pollingStartTimeoutRef.current) {
                                      clearTimeout(pollingStartTimeoutRef.current);
                                      pollingStartTimeoutRef.current = null;
                                    }
                                    if (pollingMaxTimeoutRef.current) {
                                      clearTimeout(pollingMaxTimeoutRef.current);
                                      pollingMaxTimeoutRef.current = null;
                                    }
                                    setError('Error checking verification status. Please try again.');
                                    setKycVerifying(false);
                                  }
                                }
                              };
                              
                              // Start polling after 3 seconds, then every 3 seconds
                              pollingStartTimeoutRef.current = setTimeout(() => {
                                checkStatus(); // First check
                                pollingIntervalRef.current = setInterval(checkStatus, 3000); // Then every 3 seconds
                              }, 3000);
                              
                              // Set max polling duration (6 minutes total)
                              pollingMaxTimeoutRef.current = setTimeout(() => {
                                if (pollingIntervalRef.current) {
                                  clearInterval(pollingIntervalRef.current);
                                  pollingIntervalRef.current = null;
                                }
                                setError('Verification timeout. Please check if you completed the DigiLocker process or try again.');
                                setKycVerifying(false);
                                if (digilockerWindow && !digilockerWindow.closed) {
                                  digilockerWindow.close();
                                }
                              }, 360000); // 6 minutes
                              
                              // Keep kycVerifying true while polling
                              return;
                            }
                            
                            // If already verified with details
                            if (result.verified && result.name) {
                              setKycVerified(true);
                              setKycVerificationData(result);
                              setAutoFilledData({
                                name: result.name,
                                dateOfBirth: result.date_of_birth,
                                address: result.address,
                                aadhaarNumber: result.aadhaar_number,
                                documentType: 'Aadhaar',
                                verification_method: result.verification_method || 'digilocker',
                                verifiedDetails: result,
                              });
                              setKycVerifying(false);
                              setStep(4);
                            } else {
                              // Format validation only - NOT verified
                              setError(result.error || result.message || 'Aadhaar format validated, but full verification is required. Please complete DigiLocker verification to fetch your details.');
                              setKycVerifying(false);
                            }
                          } else {
                            setError(result.error || 'Aadhaar verification failed');
                            setKycVerifying(false);
                          }
                        } catch (err: any) {
                          // Always clear timeout in catch block
                          if (timeoutId) {
                            clearTimeout(timeoutId);
                            timeoutId = null;
                          }
                          
                          // Handle different error types
                          if (err.name === 'AbortError' || err.message?.includes('aborted') || controller.signal.aborted) {
                            setError('Verification request timed out (60s). The server may be slow. Please try again.');
                          } else if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
                            setError('Network error. Please check your internet connection and try again.');
                          } else {
                            setError(err.message || 'Verification failed. Please try again.');
                          }
                          console.error('Aadhaar verification error:', err);
                          setKycVerifying(false);
                        } finally {
                          // Ensure timeout is always cleared
                          if (timeoutId) {
                            clearTimeout(timeoutId);
                            timeoutId = null;
                          }
                        }
                      }}
                      disabled={kycVerifying || !aadhaarNumber}
                      className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold py-3 px-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {kycVerifying ? 'Verifying...' : 'Verify Aadhaar'}
                    </button>
                    */}
                    {/* ========== END CASHFREE DIGILOCKER VERIFICATION ========== */}
                  </>
                )}

                {verificationMethod === 'gst' && (
                  <>
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                        GSTIN Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={gstNumber}
                        onChange={(e) =>
                          setGstNumber(
                            e.target.value
                              .toUpperCase()
                              .replace(/[^0-9A-Z]/g, '')
                              .slice(0, 15)
                          )
                        }
                        className="w-full px-4 py-3 text-sm sm:text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                        placeholder="29AAICP2912R1ZR"
                        maxLength={15}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        GSTIN must be 15 characters (A–Z, 0–9).
                    </p>
                  </div>

                    <div className="mt-3">
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                        Business Name (optional)
                      </label>
                      <input
                        type="text"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        className="w-full px-4 py-3 text-sm sm:text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                        placeholder="Legal / trade name of business"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={async () => {
                        const gstin = gstNumber.trim().toUpperCase();
                        if (!gstin || gstin.length !== 15) {
                          setError('Please enter a valid 15-character GSTIN');
                          return;
                        }

                        setKycVerifying(true);
                        setError('');
                        try {
                          const response = await fetch(
                            `${
                              import.meta.env.VITE_API_URL ||
                              'http://localhost:3001/api'
                            }/cashfree/kyc/verify-gstin`,
                            {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                GSTIN: gstin,
                                business_name: businessName || undefined,
                              }),
                            }
                          );

                          const result = await response.json();

                          if (!response.ok) {
                            const errorMessage =
                              result.message ||
                              result.error ||
                              'GSTIN verification failed';
                            setError(errorMessage);
                            console.error('GSTIN verification error:', result);
                            return;
                          }

                          if (result.success && result.verified) {
                            setKycVerified(true);
                            setKycVerificationData(result);
                            setAutoFilledData({
                              name:
                                result.business_name ||
                                result.details?.legal_name_of_business ||
                                result.details?.trade_name_of_business ||
                                businessName,
                              documentNumber: result.gstin || gstin,
                              documentType: 'GSTIN',
                              verifiedDetails: result,
                            });
                            setStep(4);
                          } else {
                            const errorMessage =
                              result.message ||
                              result.error ||
                              'GSTIN verification failed. Please check your GSTIN.';
                            setError(errorMessage);
                          }
                        } catch (err: any) {
                          console.error('GSTIN verification network error:', err);
                          setError(
                            err.message ||
                              'Network error. Please check your connection and try again.'
                          );
                        } finally {
                          setKycVerifying(false);
                        }
                      }}
                      disabled={kycVerifying || !gstNumber}
                      className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold py-3 px-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                    >
                      {kycVerifying ? 'Verifying...' : 'Verify GSTIN'}
                    </button>
                  </>
                )}

                {verificationMethod === 'cin' && (
                  <>
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                        CIN Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={panNumber}
                        onChange={(e) =>
                          setPanNumber(
                            e.target.value
                              .toUpperCase()
                              .replace(/[^A-Z0-9]/g, '')
                          )
                        }
                        className="w-full px-4 py-3 text-sm sm:text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                        placeholder="U72900KA2015PTC082988"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Example format: U72900KA2015PTC082988
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        const cin = panNumber.trim().toUpperCase();
                        if (!cin) {
                          setError('Please enter CIN number');
                          return;
                        }

                        setKycVerifying(true);
                        setError('');
                        try {
                          const response = await fetch(
                            `${
                              import.meta.env.VITE_API_URL ||
                              'http://localhost:3001/api'
                            }/cashfree/kyc/verify-cin`,
                            {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ cin }),
                            }
                          );

                          const result = await response.json();

                          if (!response.ok) {
                            const errorMessage =
                              result.message ||
                              result.error ||
                              'CIN verification failed';
                            setError(errorMessage);
                            console.error('CIN verification error:', result);
                            return;
                          }

                          if (result.success && result.verified) {
                            setKycVerified(true);
                            setKycVerificationData(result);
                            setAutoFilledData({
                              name: result.company_name || '',
                              documentNumber: result.cin || cin,
                              documentType: 'CIN',
                              verifiedDetails: result,
                            });
                            setStep(4);
                          } else {
                            const errorMessage =
                              result.message ||
                              result.error ||
                              'CIN verification failed. Please check your CIN number.';
                            setError(errorMessage);
                          }
                        } catch (err: any) {
                          console.error('CIN verification network error:', err);
                          setError(
                            err.message ||
                              'Network error. Please check your connection and try again.'
                          );
                        } finally {
                          setKycVerifying(false);
                        }
                      }}
                      disabled={kycVerifying || !panNumber}
                      className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold py-3 px-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {kycVerifying ? 'Verifying...' : 'Verify CIN'}
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setStep(3);
                    setKycVerified(false);
                    setKycVerificationData(null);
                    setAutoFilledData(null);
                  }}
                  className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-lg transition-colors mt-4"
                >
                  Back
                </button>
              </>
            )}

            {!isLogin && step === 4 && (
              <>
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5 mb-6">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle className="w-5 h-5 text-blue-600" />
                    <p className="text-base font-semibold text-blue-900">Step 4: Review & Set Password</p>
                  </div>
                  <p className="text-sm text-blue-700">Review your information and set your password</p>
                </div>

                {autoFilledData && (
                  <div className="space-y-4 mb-6">
                    {autoFilledData.name ? (
                      <>
                        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-500 rounded-xl p-5 mb-6 shadow-md">
                          <div className="flex items-center gap-2 text-green-800 mb-2">
                            <CheckCircle className="w-6 h-6 text-green-600" />
                            <p className="font-bold text-lg">✅ Verification Successful!</p>
                          </div>
                          <p className="text-sm text-green-700 mb-2">
                            Your document has been successfully verified. Your details have been automatically extracted and will be saved when you create your account.
                          </p>
                        </div>

                        <div>
                          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                            {entityType === 'company' ? 'Business / Trade Name' : 'Full Name'} <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={autoFilledData.name || ''}
                            readOnly
                            className="w-full px-4 py-3 text-sm sm:text-base border border-gray-300 rounded-xl bg-gray-50 text-gray-700 cursor-not-allowed"
                          />
                        </div>
                      </>
                    ) : (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 text-yellow-800 mb-2">
                          <Shield className="w-5 h-5" />
                          <p className="font-medium">Verification Not Complete</p>
                        </div>
                        <p className="text-xs text-yellow-700 mb-3">
                          Document number format validated, but full verification is required to fetch your details automatically.
                        </p>
                        <p className="text-xs text-yellow-600">
                          Please go back and complete DigiLocker verification to auto-fill your details.
                        </p>
                      </div>
                    )}

                    {autoFilledData.dateOfBirth && (
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                          Date of Birth
                        </label>
                        <input
                          type="text"
                          value={autoFilledData.dateOfBirth || ''}
                          readOnly
                          className="w-full px-4 py-3 text-sm sm:text-base border border-gray-300 rounded-xl bg-gray-50 text-gray-700 cursor-not-allowed"
                        />
                      </div>
                    )}

                    {autoFilledData.address && (
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                          Address (from document)
                        </label>
                        <textarea
                          value={autoFilledData.address || ''}
                          readOnly
                          rows={3}
                          className="w-full px-4 py-3 text-sm sm:text-base border border-gray-300 rounded-xl bg-gray-50 text-gray-700 cursor-not-allowed"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                        Document Type
                      </label>
                      <input
                        type="text"
                        value={autoFilledData.documentType || ''}
                        readOnly
                        className="w-full px-4 py-3 text-sm sm:text-base border border-gray-300 rounded-xl bg-gray-50 text-gray-700 cursor-not-allowed"
                      />
                    </div>

                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                        Document Number
                      </label>
                      <input
                        type="text"
                        value={autoFilledData.documentNumber || autoFilledData.aadhaarNumber || ''}
                        readOnly
                        className="w-full px-4 py-3 text-sm sm:text-base border border-gray-300 rounded-xl bg-gray-50 text-gray-700 cursor-not-allowed"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 rounded-xl p-5 shadow-sm">
                    <h3 className="font-semibold text-gray-900 mb-4 text-lg">Account Information</h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between py-2 border-b border-gray-200"><span className="font-medium text-gray-600">Role:</span> <span className="capitalize text-gray-900 font-semibold">{role}</span></div>
                      <div className="flex justify-between py-2 border-b border-gray-200"><span className="font-medium text-gray-600">Name:</span> <span className="text-gray-900 font-semibold">{autoFilledData?.name || name || 'N/A'}</span></div>
                      <div className="flex justify-between py-2 border-b border-gray-200"><span className="font-medium text-gray-600">Mobile:</span> <span className="text-gray-900 font-semibold">{mobileNumber || 'N/A'}</span></div>
                      {autoFilledData?.documentType && (
                        <div className="flex justify-between py-2"><span className="font-medium text-gray-600">Verified Document:</span> <span className="text-green-600 font-semibold">{autoFilledData.documentType}</span></div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-6">
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                      Mobile Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={mobileNumber}
                    onChange={async (e) => {
                      const newMobile = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setMobileNumber(newMobile);
                      // Clear error when user starts typing
                      if (error && error.includes('mobile number')) {
                        setError('');
                      }
                      // Check if mobile number already exists when user enters 10 digits
                      if (newMobile.length === 10) {
                        try {
                          const checkResponse = await fetch(
                            `${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/auth/check-user`,
                            {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ mobile_number: newMobile })
                            }
                          );
                          const checkResult = await checkResponse.json();
                          if (checkResult.exists && checkResult.mobileExists) {
                            setError('User with this mobile number already exists');
                          }
                        } catch (err) {
                          // Silently fail - don't show error for check failures
                        }
                      }
                    }}
                    className={`w-full px-4 py-3 text-sm sm:text-base border rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all ${
                      error && error.includes('mobile number') ? 'border-red-500' : 'border-gray-300'
                    }`}
                      placeholder="Enter 10-digit mobile number"
                      maxLength={10}
                      required
                    />
                  {error && error.includes('mobile number') && (
                    <p className="text-xs text-red-600 mt-1">{error}</p>
                  )}
                  </div>

                <div className="mt-4">
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                      Password <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 text-sm sm:text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                    placeholder="Create a password (min. 6 characters)"
                      required
                    />
                  <p className="text-xs text-gray-500 mt-1">Password must be at least 6 characters long</p>
                </div>

                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-lg transition-colors mt-4"
                >
                  Back
                </button>
              </>
            )}

            {/* Login: Mobile number OR Email, and Password */}
            {isLogin && (
              <>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    Mobile Number or Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={loginId}
                    onChange={(e) => {
                      setLoginId(e.target.value);
                      if (error) setError('');
                    }}
                    required
                    className="w-full px-4 py-3 text-sm sm:text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                    placeholder="Enter 10-digit mobile number or email"
                    autoComplete="username"
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError('');
                    }}
                    required
                    className="w-full px-4 py-3 text-sm sm:text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                    placeholder="Enter your password"
                    autoComplete="current-password"
                  />
                </div>
              </>
            )}

            {error && (
              <div className={`border px-4 py-3 rounded-lg ${
                error.includes('skip') || 
                error.includes('Skip') || 
                error.includes('unavailable') || 
                error.includes('DigiLocker')
                  ? 'bg-yellow-50 border-yellow-200 text-yellow-800' 
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}>
                <div className="flex items-start gap-2">
                  <span className="text-sm font-medium">{error}</span>
                </div>
                {(error.includes('unavailable') || 
                  error.includes('DigiLocker') ||
                  error.includes('verification')) && (
                  <div className="mt-3 text-xs space-y-2">
                    <div className="flex items-center gap-2 text-yellow-900">
                      <span>💡</span>
                      <span><strong>Tip:</strong> Please try again. If DigiLocker verification is unavailable, you can skip verification for now and complete it later from your profile settings.</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Continue buttons for steps 1, 2, and 3 */}
            {!isLogin && (step === 1 || step === 2 || step === 3) && (
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold py-3 px-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue
              </button>
            )}

            {/* Submit button for login or step 4 (final step - create account) */}
            {(isLogin || step === 4) && (
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold py-3 px-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Please wait...' : isLogin ? 'Login' : 'Create Account'}
              </button>
            )}
          </form>

          <div className="mt-6 p-5 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl">
            <p className="text-sm font-semibold text-blue-900 mb-3">Getting Started:</p>
            <ol className="text-xs text-blue-800 space-y-2 list-decimal list-inside">
              <li>Click "Register" to create a new account</li>
              <li>Choose your role: Farmer, Trader, FPO, Corporate, Miller, Financer, or Admin</li>
              <li>Use any email address (confirmation not required)</li>
            </ol>
          </div>
        </div>
      </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
