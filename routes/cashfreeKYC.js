import express from 'express';
import axios from 'axios';
import multer from 'multer';
import FormDataLib from 'form-data';
import Cashfree from '../lib/cashfree.js';
import { generateCashfreeSignature, getCashfreeHeaders, verifyPublicKey } from '../utils/cashfreeSignature.js';

const router = express.Router();

// Cashfree Configuration (for fallback methods)
const CASHFREE_CLIENT_ID = process.env.CASHFREE_CLIENT_ID || '';
const CASHFREE_CLIENT_SECRET = process.env.CASHFREE_CLIENT_SECRET || '';
// Normalize base URL to avoid double slashes
const CASHFREE_BASE_URL = (process.env.CASHFREE_BASE_URL || 'https://api.cashfree.com').replace(/\/$/, '');
const CASHFREE_API_VERSION = '2023-12-18';
// Using IP whitelisting instead of public key signature
// Set CASHFREE_USE_SIGNATURE=true if you want to use public key signature instead
const CASHFREE_USE_SIGNATURE = process.env.CASHFREE_USE_SIGNATURE === 'true';

// Helper function to handle Cashfree authentication errors
function handleCashfreeAuthError(status, data) {
git   // Check for IP not whitelisted error
  const isIpNotWhitelisted = data.code === 'ip_validation_failed' ||
                            data.message?.toLowerCase().includes('ip not whitelisted') ||
                            data.message?.toLowerCase().includes('ip validation failed');
  
  // Extract IP from error message if available
  let currentIp = null;
  if (isIpNotWhitelisted && data.message) {
    const ipMatch = data.message.match(/\d+\.\d+\.\d+\.\d+/);
    if (ipMatch) {
      currentIp = ipMatch[0];
    }
  }
  
  // Check for "x-cf-signature missing" error (means dashboard is still in Public Key mode)
  const isSignatureMissing = data.message?.toLowerCase().includes('x-cf-signature missing') ||
                            data.message?.toLowerCase().includes('signature missing');
  
  // Check for signature mismatch errors
  const isSignatureMismatch = (data.code === 'authentication_failed' && 
                               data.message?.toLowerCase().includes('signature mismatch')) ||
                               (data.type === 'authentication_error' && 
                               data.message?.toLowerCase().includes('signature mismatch'));
  
  if (isIpNotWhitelisted) {
    return {
      error: 'IP Not Whitelisted',
      message: currentIp 
        ? `Your server IP address (${currentIp}) is not whitelisted in Cashfree dashboard. Please add this IP to the whitelist.`
        : 'Your server IP address is not whitelisted in Cashfree dashboard.',
      currentIp: currentIp,
      fix: {
        step1: 'Go to Cashfree Dashboard: Developers → Two-Factor Authentication',
        step2: 'Make sure "IP Whitelisting" method is selected (not Public Key)',
        step3: currentIp ? `Click "Add IP Address" and enter: ${currentIp}` : 'Click "Add IP Address" and enter your server IP',
        step4: 'Save the configuration',
        step5: 'Wait 2-3 minutes for changes to take effect',
      },
      important: [
        '⚠️ IP whitelisting requires the EXACT IP address that makes the API call',
        '⚠️ Render.com services may have dynamic IPs - you may need to add multiple IPs',
        '⚠️ If IP changes frequently, consider using Public Key signature instead',
      ],
      alternative: 'If IP keeps changing, you can use Public Key signature by setting CASHFREE_USE_SIGNATURE=true',
    };
  }
  
  if (isSignatureMissing) {
    return {
      error: '2FA Method Mismatch',
      message: 'Cashfree dashboard is still set to "Public Key" mode, but the code is using IP Whitelisting. You need to switch the 2FA method in Cashfree dashboard.',
      fix: {
        step1: 'Go to Cashfree Dashboard: Developers → Two-Factor Authentication',
        step2: 'Click "Switch Method" button',
        step3: 'Select "IP Whitelisting" (not Public Key)',
        step4: 'Add your server IP address to the whitelist',
        step5: 'Save the configuration',
      },
      alternative: 'Alternatively, set CASHFREE_USE_SIGNATURE=true and configure the public key file',
      troubleshooting: [
        '1. Verify you switched to IP Whitelisting in Cashfree dashboard (not just added IP while in Public Key mode)',
        '2. Make sure you clicked "Switch Method" and selected "IP Whitelisting"',
        '3. Ensure your server IP is added to the whitelist',
        '4. Wait a few minutes for the change to propagate',
        '5. Check the diagnostic endpoint: /api/cashfree/diagnostics',
      ],
    };
  }
  
  if (isSignatureMismatch) {
    return {
      error: 'Authentication failed',
      message: 'Signature mismatch detected. Please verify: 1) Public key file exists at keys/cashfree_public_key.pem, 2) Public key matches your Cashfree account, 3) Client ID in signature matches x-client-id header.',
      troubleshooting: [
        '1. Verify public key file exists: keys/cashfree_public_key.pem',
        '2. Ensure public key matches your Cashfree account (download fresh key if needed)',
        '3. Check that CASHFREE_CLIENT_ID matches the one in Cashfree dashboard',
        '4. Verify public key format (should be PKCS#1 or PKCS#8)',
        '5. Alternative: Switch to IP Whitelisting in Cashfree dashboard',
      ],
    };
  }
  
  return {
    error: 'Authentication failed',
    message: 'Verification service authentication failed. Please check Cashfree credentials or IP whitelisting configuration.',
    troubleshooting: [
      '1. Check CASHFREE_CLIENT_ID and CASHFREE_CLIENT_SECRET are correct',
      '2. Verify credentials match your Cashfree account environment (sandbox/production)',
      '3. If using IP Whitelisting: Ensure you switched the 2FA method in Cashfree dashboard to "IP Whitelisting"',
      '4. If using Public Key: Ensure public key file exists and matches dashboard',
    ],
  };
}

// Helper function to get Cashfree headers (using IP whitelisting by default)
function getCashfreeHeadersWithConfig() {
  // Log configuration on first call
  if (!getCashfreeHeadersWithConfig._initialized) {
    if (CASHFREE_USE_SIGNATURE) {
      const keyStatus = verifyPublicKey();
      console.log('🔍 Using Public Key Signature Mode');
      console.log('🔍 Public Key Status:', {
        exists: keyStatus.exists,
        format: keyStatus.format,
        valid: keyStatus.valid,
        error: keyStatus.error,
      });
      
      if (!keyStatus.exists || !keyStatus.valid) {
        console.warn('⚠️  Public key not available. Falling back to IP whitelisting mode.');
        console.warn('   To use IP whitelisting: Ensure your server IP is whitelisted in Cashfree dashboard.');
      }
    } else {
      console.log('✅ Using IP Whitelisting Mode (signature disabled)');
      console.log('ℹ️  Make sure your server IP is whitelisted in Cashfree dashboard:');
      console.log('   Developers → Two-Factor Authentication → Switch Method → IP Whitelisting');
    }
    
    getCashfreeHeadersWithConfig._initialized = true;
  }
  
  // Use signature only if explicitly enabled, otherwise use IP whitelisting
  return getCashfreeHeaders(
    CASHFREE_CLIENT_ID, 
    CASHFREE_CLIENT_SECRET, 
    CASHFREE_USE_SIGNATURE, // includeSignature - only true if explicitly enabled
    !CASHFREE_USE_SIGNATURE // forceNoSignature - true when using IP whitelisting
  );
}

// Multer configuration for document uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and PDF are allowed.'));
    }
  }
});

// Verify GSTIN (public route)
router.post('/verify-gstin', async (req, res) => {
  try {
    const { GSTIN, business_name } = req.body;

    // Basic validation
    if (!GSTIN || typeof GSTIN !== 'string' || GSTIN.length !== 15) {
      return res.status(400).json({
        success: false,
        error: 'Invalid GSTIN',
        message: 'GSTIN is required and must be 15 characters.',
      });
    }

    // Validate GSTIN format (alphanumeric, 15 chars)
    const gstRegex = /^[0-9A-Z]{15}$/;
    if (!gstRegex.test(GSTIN.toUpperCase())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid GSTIN format',
        message: 'GSTIN must be 15 alphanumeric uppercase characters.',
      });
    }

    // Check credentials
    if (!CASHFREE_CLIENT_ID || !CASHFREE_CLIENT_SECRET) {
      console.error('Cashfree credentials not configured for GSTIN verification');
      return res.status(500).json({
        success: false,
        error: 'Verification service not configured',
        message: 'Cashfree credentials are missing. Please contact support.',
      });
    }

    // Call Cashfree GSTIN verification API (V2)
    const gstBody = {
      GSTIN: GSTIN.toUpperCase(),
      ...(business_name ? { business_name } : {}),
    };

    console.log('Calling Cashfree GSTIN verification...', {
      url: `${CASHFREE_BASE_URL}/verification/gstin`,
      hasClientId: !!CASHFREE_CLIENT_ID,
      hasClientSecret: !!CASHFREE_CLIENT_SECRET,
      apiVersion: CASHFREE_API_VERSION,
      gstin: `${GSTIN.substring(0, 3)}******${GSTIN.substring(GSTIN.length - 3)}`,
    });

    const gstResponse = await axios.post(
      `${CASHFREE_BASE_URL}/verification/gstin`,
      gstBody,
      {
        headers: getCashfreeHeadersWithConfig(),
        timeout: 10000,
      }
    );

    const data = gstResponse.data || {};

    if (data.valid === true || data.gst_in_status === 'Active') {
      return res.json({
        success: true,
        verified: true,
        gstin: GSTIN.toUpperCase(),
        business_name: data.legal_name_of_business || data.trade_name_of_business || business_name,
        status: data.gst_in_status || 'Active',
        details: data,
      });
    }

    // If not valid, return 400 with details
    return res.status(400).json({
      success: false,
      verified: false,
      error: data.message || 'GSTIN verification failed',
      message: data.message || 'GSTIN could not be verified. Please check the GSTIN and business name.',
      details: data,
    });
  } catch (error) {
    console.error('GSTIN verification error:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
    });

    if (error.response) {
      const status = error.response.status;
      const data = error.response.data || {};

      if (status === 401 || status === 403 || status === 400) {
        const errorInfo = handleCashfreeAuthError(status, data);
        return res.status(500).json({
          success: false,
          ...errorInfo,
          details: data,
        });
      }

      return res.status(status).json({
        success: false,
        error: data.message || 'Verification service error',
        message: data.message || 'An error occurred during GSTIN verification. Please try again.',
        details: data,
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Failed to verify GSTIN',
      message: 'Unable to connect to verification service. Please try again later.',
      details: error.message,
    });
  }
});

// Verify CIN (public route)
router.post('/verify-cin', async (req, res) => {
  try {
    const { cin } = req.body;

    // Basic validation
    if (!cin || typeof cin !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Invalid CIN',
        message: 'CIN is required.',
      });
    }

    const trimmedCin = cin.trim().toUpperCase();

    // CIN format: alphanumeric, typically 21 characters, but we mainly enforce allowed chars
    const cinRegex = /^[A-Z0-9]+$/;
    if (!cinRegex.test(trimmedCin)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid CIN format',
        message: 'CIN must be alphanumeric (A–Z, 0–9).',
      });
    }

    // Check credentials
    if (!CASHFREE_CLIENT_ID || !CASHFREE_CLIENT_SECRET) {
      console.error('Cashfree credentials not configured for CIN verification');
      return res.status(500).json({
        success: false,
        error: 'Verification service not configured',
        message: 'Cashfree credentials are missing. Please contact support.',
      });
    }

    // Build request body as per Cashfree docs:
    // POST {CASHFREE_BASE_URL}/verification/cin
    // { "verification_id": "ABC00123", "cin": "U72900KA2015PTC082988" }
    const verification_id = `cin_${trimmedCin}_${Date.now()}`;

    const cinBody = {
      verification_id,
      cin: trimmedCin,
    };

    console.log('Calling Cashfree CIN verification...', {
      url: `${CASHFREE_BASE_URL}/verification/cin`,
      hasClientId: !!CASHFREE_CLIENT_ID,
      hasClientSecret: !!CASHFREE_CLIENT_SECRET,
      apiVersion: CASHFREE_API_VERSION,
      cin: trimmedCin,
    });

    const cinResponse = await axios.post(
      `${CASHFREE_BASE_URL}/verification/cin`,
      cinBody,
      {
        headers: getCashfreeHeadersWithConfig(),
        timeout: 10000,
      }
    );

    const data = cinResponse.data || {};

    const isValidCin =
      data.status === 'VALID' ||
      data.cin_status === 'ACTIVE';

    if (isValidCin) {
      return res.json({
        success: true,
        verified: true,
        verification_id: data.verification_id || verification_id,
        cin: data.cin || trimmedCin,
        company_name: data.company_name,
        registration_number: data.registration_number,
        incorporation_date: data.incorporation_date,
        cin_status: data.cin_status,
        email: data.email,
        incorporation_country: data.incorporation_country,
        director_details: data.director_details,
        details: data,
      });
    }

    // If not valid, return 400 with details
    return res.status(400).json({
      success: false,
      verified: false,
      error: data.message || 'CIN verification failed',
      message: data.message || 'CIN could not be verified. Please check the CIN.',
      details: data,
    });
  } catch (error) {
    console.error('CIN verification error:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
    });

    if (error.response) {
      const status = error.response.status;
      const data = error.response.data || {};

      if (status === 401 || status === 403 || status === 400) {
        const errorInfo = handleCashfreeAuthError(status, data);
        return res.status(500).json({
          success: false,
          ...errorInfo,
          details: data,
        });
      }

      return res.status(status).json({
        success: false,
        error: data.message || 'Verification service error',
        message: data.message || 'An error occurred during CIN verification. Please try again.',
        details: data,
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Failed to verify CIN',
      message: 'Unable to connect to verification service. Please try again later.',
      details: error.message,
    });
  }
});

// Get Cashfree access token (for Payout APIs)
async function getCashfreeAccessToken() {
  try {
    // Generate 2FA signature if public key is available
    const signature = generateCashfreeSignature(CASHFREE_CLIENT_ID);
    
    // Try method 1: Using x-client-id and x-client-secret headers (Verification API style)
    try {
      const headers = {
        'x-client-id': CASHFREE_CLIENT_ID,
        'x-client-secret': CASHFREE_CLIENT_SECRET,
        'Content-Type': 'application/json',
      };
      
      // Add 2FA signature if available
      if (signature) {
        headers['x-cf-signature'] = signature;
      }
      
    const response = await axios.post(
      `${CASHFREE_BASE_URL}/payout/v1/authorize`,
        {},
        { headers }
      );
      if (response.data.data?.token || response.data.token) {
        return response.data.data?.token || response.data.token;
      }
    } catch (headerError) {
      console.log('Header-based auth failed, trying body-based...');
    }

    // Try method 2: Using body with clientId and clientSecret (Payout API style)
    const headers = {
      'Content-Type': 'application/json',
    };
    
    // Add 2FA signature if available
    if (signature) {
      headers['x-cf-signature'] = signature;
    }
    
    const response = await axios.post(
      `${CASHFREE_BASE_URL}/payout/v1/authorize`,
      {
        client_id: CASHFREE_CLIENT_ID,
        client_secret: CASHFREE_CLIENT_SECRET,
      },
      { headers }
    );
    return response.data.data?.token || response.data.token;
  } catch (error) {
    console.error('Cashfree token error:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });
    // Return null instead of throwing - verification APIs use client credentials directly
    return null;
  }
}

// Verify PAN (pre-signup - public route)
router.post('/verify-pan', async (req, res) => {
  try {
    const { pan, name } = req.body;

    // Log incoming request for debugging
    console.log('PAN verification request:', { pan: pan ? pan.substring(0, 3) + '***' : 'missing', name: name ? name.substring(0, 3) + '***' : 'missing' });

    if (!pan || !name) {
      return res.status(400).json({
        success: false,
        error: 'PAN number and name are required',
        message: 'Please provide both PAN number and name',
      });
    }

    // Trim whitespace
    const cleanPan = pan.trim().toUpperCase();
    const cleanName = name.trim();

    if (!cleanPan || !cleanName) {
      return res.status(400).json({
        success: false,
        error: 'PAN number and name cannot be empty',
        message: 'Please provide valid PAN number and name',
      });
    }

    // PAN format validation
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    if (!panRegex.test(cleanPan)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid PAN format. PAN should be in format: ABCDE1234F',
        message: 'PAN must be 10 characters: 5 letters, 4 numbers, 1 letter (e.g., ABCDE1234F)',
      });
    }

    // Check if Cashfree credentials are configured
    if (!CASHFREE_CLIENT_ID || !CASHFREE_CLIENT_SECRET) {
      console.error('Cashfree credentials not configured');
      return res.status(500).json({
        success: false,
        error: 'Verification service not configured',
        message: 'Cashfree credentials are missing. Please contact support.',
      });
    }

    // Method 1: Try using Cashfree Verification SDK (explicit API version)
    try {
      console.log('Trying Cashfree Verification SDK for PAN...');
      const panRequest = {
        pan: cleanPan,
        name: cleanName
      };

      const verifyResponse = await Cashfree.VrsPanVerification(
        panRequest,
        Cashfree.XApiVersion || '2023-12-18', // ensure version is sent
        undefined,
        { timeout: 10000 }
      );
      
      if (verifyResponse.data?.status === 'SUCCESS' || verifyResponse.data?.status === 'VALID') {
        return res.json({
          success: true,
          verified: true,
          pan: cleanPan,
          name: verifyResponse.data.name || cleanName,
          type: verifyResponse.data.type || 'Individual',
          details: verifyResponse.data,
        });
      } else if (verifyResponse.data?.status === 'INVALID_PAN') {
        return res.status(400).json({
          success: false,
          verified: false,
          error: 'Invalid PAN',
          message: 'The PAN number or name does not match. Please check and try again.',
          details: verifyResponse.data,
        });
      } else {
        console.log('SDK PAN response not successful:', verifyResponse.data);
      }
    } catch (verifyError) {
      console.log('SDK verification failed, trying fallback...', verifyError.response?.data || verifyError.message);
    }

    // Method 2: Direct Verification API (without payout token)
    try {
      console.log('Trying Cashfree Verification API direct call for PAN...', {
        url: `${CASHFREE_BASE_URL}/verification/pan`,
        hasClientId: !!CASHFREE_CLIENT_ID,
        hasClientSecret: !!CASHFREE_CLIENT_SECRET,
        apiVersion: '2023-12-18'
      });
      const directResponse = await axios.post(
        `${CASHFREE_BASE_URL}/verification/pan`,
        { pan: cleanPan, name: cleanName },
      {
        headers: getCashfreeHeadersWithConfig(),
          timeout: 10000,
      }
    );

      const data = directResponse.data;

      // Cashfree PAN response can have multiple success indicators:
      // - status === 'SUCCESS' or 'VALID'
      // - valid === true
      // - pan_status === 'VALID'
      const isValidPan =
        data?.status === 'SUCCESS' ||
        data?.status === 'VALID' ||
        data?.valid === true ||
        data?.pan_status === 'VALID';

      if (isValidPan) {
      return res.json({
        success: true,
        verified: true,
          pan: cleanPan,
          // Prefer registered_name / name_pan_card / name if available, else fallback to provided name
          name:
            data.registered_name ||
            data.name_pan_card ||
            data.name ||
            cleanName,
          type: data.type || 'Individual',
          details: data,
      });
    } else {
        console.log('Direct verification API returned non-success:', data);
      }
    } catch (directError) {
      console.log('Direct verification API failed, moving to payout fallback', directError.response?.data || directError.message);
    }

    // If SDK and direct API did not verify, return a clear failure (avoid payout fallback)
      return res.status(400).json({
        success: false,
        verified: false,
        error: 'PAN verification failed',
      message: 'The PAN number or name does not match. Please check and try again.',
      });
  } catch (error) {
    console.error('PAN verification error:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
    });

    // Handle specific error cases
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;

      if (status === 401 || status === 403) {
        // Check for specific signature mismatch error
        const isSignatureMismatch = data.code === 'authentication_failed' || 
                                   data.message?.toLowerCase().includes('signature') ||
                                   data.type === 'authentication_error';
        
        return res.status(500).json({
          success: false,
          error: 'Authentication failed',
          message: isSignatureMismatch 
            ? 'Signature mismatch detected. Please verify: 1) Public key file exists at keys/cashfree_public_key.pem, 2) Public key matches your Cashfree account, 3) Client ID in signature matches x-client-id header. Alternatively, whitelist your server IP in Cashfree dashboard.'
            : 'Verification service authentication failed. Please check Cashfree credentials or IP whitelisting.',
          details: data,
          troubleshooting: isSignatureMismatch ? [
            '1. Verify public key file exists: keys/cashfree_public_key.pem',
            '2. Ensure public key matches your Cashfree account (download fresh key if needed)',
            '3. Check that CASHFREE_CLIENT_ID matches the one in Cashfree dashboard',
            '4. Verify public key format (should be PKCS#1 or PKCS#8)',
            '5. Alternative: Whitelist your server IP in Cashfree dashboard to skip signature requirement'
          ] : [
            '1. Check CASHFREE_CLIENT_ID and CASHFREE_CLIENT_SECRET are correct',
            '2. Verify credentials match your Cashfree account environment (sandbox/production)',
            '3. Whitelist your server IP in Cashfree dashboard',
            '4. Ensure public key file exists if using 2FA signature'
          ],
        });
      }

      if (status === 400) {
        return res.status(400).json({
          success: false,
          verified: false,
          error: data.message || 'Invalid PAN details',
          message: data.message || 'The provided PAN number or name is invalid. Please check and try again.',
          details: data,
        });
      }

      return res.status(status).json({
        success: false,
        error: 'Verification service error',
        message: data.message || 'An error occurred during PAN verification. Please try again.',
        details: data,
      });
    }

    // Network or other errors
    return res.status(500).json({
      success: false,
      error: 'Failed to verify PAN',
      message: 'Unable to connect to verification service. Please try again later.',
      details: error.message,
    });
  }
});

// Step 1: Verify DigiLocker Account (check if Aadhaar is linked with DigiLocker)
router.post('/digilocker/verify-account', async (req, res) => {
  try {
    const { aadhaar_number, mobile_number, verification_id } = req.body;

    if (!aadhaar_number && !mobile_number) {
      return res.status(400).json({
        success: false,
        error: 'Either Aadhaar number or mobile number is required',
      });
    }

    if (!verification_id) {
      return res.status(400).json({
        success: false,
        error: 'Verification ID is required',
      });
    }

    try {
      // Use Cashfree Verification SDK to verify account
      const verifyAccountRequest = {
        verification_id: verification_id,
        ...(aadhaar_number && { aadhaar_number: aadhaar_number.replace(/\s/g, '') }),
        ...(mobile_number && { mobile_number: mobile_number.replace(/\s/g, '') }),
      };

      // Call Verify Account API via SDK or direct API
      const verifyResponse = await axios.post(
        `${CASHFREE_BASE_URL}/verification/digilocker/verify-account`,
        verifyAccountRequest,
        {
          headers: getCashfreeHeadersWithConfig(),
          timeout: 15000,
        }
      );

      return res.json({
        success: true,
        ...verifyResponse.data,
      });
    } catch (error) {
      console.error('DigiLocker verify account error:', error.response?.data || error.message);
      return res.status(error.response?.status || 500).json({
        success: false,
        error: 'Failed to verify DigiLocker account',
      details: error.response?.data || error.message,
      });
    }
  } catch (error) {
    console.error('Verify account error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to verify DigiLocker account',
      details: error.message,
    });
  }
});

// Step 2: Create DigiLocker URL (Generate consent URL)
router.post('/digilocker/create-url', async (req, res) => {
  try {
    const { verification_id, aadhaar_number, redirect_url, document_requested, user_flow } = req.body;

    if (!verification_id) {
      return res.status(400).json({
        success: false,
        error: 'Verification ID is required',
      });
    }

    if (!redirect_url) {
      return res.status(400).json({
        success: false,
        error: 'Redirect URL is required',
      });
    }

    try {
      // Use Cashfree Verification SDK
      const createUrlRequest = {
        verification_id: verification_id,
        redirect_url: redirect_url,
        document_requested: document_requested || ['AADHAAR'],
        ...(user_flow && { user_flow: user_flow }), // 'signin' or 'signup'
      };

      const response = await Cashfree.VrsDigilockerVerificationCreateUrl(createUrlRequest, undefined, { timeout: 15000 });

      const responseData = response.data?.data || response.data;
      
      if (responseData?.verification_url) {
        return res.json({
          success: true,
          verification_url: responseData.verification_url,
          verification_id: verification_id,
          reference_id: responseData.reference_id,
          status: responseData.status || 'PENDING',
          user_flow: responseData.user_flow,
          document_requested: responseData.document_requested,
          redirect_url: redirect_url,
        });
      } else {
        return res.status(400).json({
          success: false,
          error: 'Failed to create DigiLocker URL',
          details: responseData,
        });
      }
    } catch (error) {
      console.error('Create DigiLocker URL error:', error.response?.data || error.message);
      
      // Fallback to direct API call
      try {
        const fallbackResponse = await axios.post(
          `${CASHFREE_BASE_URL}/verification/v2/digilocker/create-url`,
          {
            verification_id: verification_id,
            redirect_url: redirect_url,
            document_requested: document_requested || ['AADHAAR'],
            ...(user_flow && { user_flow: user_flow }),
          },
          {
            headers: getCashfreeHeadersWithConfig(),
            timeout: 15000,
          }
        );

        const fallbackData = fallbackResponse.data?.data || fallbackResponse.data;
        if (fallbackData?.verification_url) {
          return res.json({
            success: true,
            verification_url: fallbackData.verification_url,
            verification_id: verification_id,
            reference_id: fallbackData.reference_id,
            status: fallbackData.status || 'PENDING',
            user_flow: fallbackData.user_flow,
            document_requested: fallbackData.document_requested,
            redirect_url: redirect_url,
          });
        }
      } catch (fallbackError) {
        console.error('Fallback create URL error:', fallbackError.response?.data || fallbackError.message);
      }

      return res.status(error.response?.status || 500).json({
        success: false,
        error: 'Failed to create DigiLocker URL',
        details: error.response?.data || error.message,
      });
    }
  } catch (error) {
    console.error('Create URL error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create DigiLocker URL',
      details: error.message,
    });
  }
});

// Verify Aadhaar via number only using DigiLocker (pre-signup - public route)
// This endpoint combines Step 1 (Verify Account) and Step 2 (Create URL) for convenience
router.post('/verify-aadhaar-number', async (req, res) => {
  try {
    const { aadhaar_number } = req.body;

    if (!aadhaar_number) {
      return res.status(400).json({
        error: 'Aadhaar number is required',
      });
    }

    // Aadhaar format validation (12 digits)
    const aadhaarRegex = /^[0-9]{12}$/;
    const cleanAadhaar = aadhaar_number.replace(/\s/g, '');
    
    if (!aadhaarRegex.test(cleanAadhaar)) {
      return res.status(400).json({
        error: 'Invalid Aadhaar format. Aadhaar should be 12 digits.',
      });
    }

    // Additional validation: Aadhaar should not start with 0 or 1
    if (cleanAadhaar.startsWith('0') || cleanAadhaar.startsWith('1')) {
      return res.status(400).json({
        error: 'Invalid Aadhaar number. Aadhaar cannot start with 0 or 1.',
      });
    }

    const verification_id = `aadhaar_${cleanAadhaar}_${Date.now()}`;
    // Fix double slash in redirect URL - remove trailing slash from FRONTEND_URL and any double slashes
    let baseUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').trim();
    baseUrl = baseUrl.replace(/\/+$/, ''); // Remove all trailing slashes
    const redirect_url = `${baseUrl}/kyc-callback?ref=${verification_id}&aadhaar=${cleanAadhaar}`;
    
    // Log the constructed redirect URL for debugging
    console.log('Constructed redirect URL:', redirect_url);
    console.log('FRONTEND_URL env value:', process.env.FRONTEND_URL);

    try {
      // Step 1: Verify DigiLocker Account (optional - can skip if you want to proceed directly)
      let accountExists = false;
      let userFlow = 'signin'; // Default to signin
      
      try {
        const verifyAccountResponse = await axios.post(
          `${CASHFREE_BASE_URL}/verification/digilocker/verify-account`,
          {
            verification_id: `verify_${verification_id}`,
            aadhaar_number: cleanAadhaar,
        },
        {
          headers: getCashfreeHeadersWithConfig(),
            timeout: 10000,
        }
      );

        if (verifyAccountResponse.data?.status === 'ACCOUNT_EXISTS') {
          accountExists = true;
          userFlow = 'signin';
        } else {
          userFlow = 'signup';
        }
      } catch (verifyError) {
        // If verify account fails, proceed with default flow
        console.log('Verify account step skipped, proceeding with default flow');
      }

      // Step 2: Create DigiLocker URL - Try direct API call first (more reliable)
      console.log('Creating DigiLocker URL with flow:', userFlow);
      
      const requestBody = {
        verification_id: verification_id,
        redirect_url: redirect_url,
        document_requested: ['AADHAAR'],
      };
      
      if (userFlow && (userFlow === 'signin' || userFlow === 'signup')) {
        requestBody.user_flow = userFlow;
      }

      console.log('DigiLocker Create URL Request:', JSON.stringify(requestBody, null, 2));
      console.log('Cashfree Config:', {
        clientId: CASHFREE_CLIENT_ID ? `${CASHFREE_CLIENT_ID.substring(0, 10)}...` : 'MISSING',
        baseUrl: CASHFREE_BASE_URL,
      });

      // Try SDK FIRST (it handles endpoints internally and is more reliable)
      console.log('Trying Cashfree SDK first...');
      let sdkSuccess = false;
      try {
        const sdkResponse = await Cashfree.VrsDigilockerVerificationCreateUrl(
          requestBody,
          '2023-12-18', // Pass API version explicitly
          { timeout: 15000 }
        );

        // Handle SDK response carefully to avoid circular structure error
        // Don't try to JSON.stringify the response - extract values directly
        let verificationUrl = null;
        let referenceId = verification_id;
        let status = 'PENDING';
        let userFlowValue = userFlow;
        
        try {
          // Extract data safely without logging the full object
          if (sdkResponse) {
            // Try different possible response structures
            const possibleData = sdkResponse.data || sdkResponse.response?.data || sdkResponse;
            
            if (possibleData) {
              // Extract verification_url from various possible locations
              verificationUrl = possibleData.verification_url || 
                              possibleData.verificationUrl || 
                              possibleData.url ||
                              possibleData.data?.verification_url ||
                              possibleData.data?.verificationUrl;
              
              // Extract other fields
              referenceId = possibleData.reference_id || 
                           possibleData.referenceId || 
                           possibleData.data?.reference_id ||
                           verification_id;
                           
              status = possibleData.status || 
                      possibleData.data?.status || 
                      'PENDING';
                      
              userFlowValue = possibleData.user_flow || 
                             possibleData.userFlow || 
                             possibleData.data?.user_flow ||
                             userFlow;
            }
          }
          
          if (verificationUrl) {
            console.log('✅ SDK returned verification_url successfully');
            sdkSuccess = true;
        return res.json({
          success: true,
              verified: false,
          verification_pending: true,
              verification_url: verificationUrl,
              verification_id: verification_id,
              reference_id: referenceId,
          aadhaar_number: cleanAadhaar,
              status: status,
              user_flow: userFlowValue,
          message: 'Please complete verification via DigiLocker',
          verification_method: 'digilocker',
        });
          } else {
            console.log('SDK response received but no verification_url found');
            // Log what we can safely log
            console.log('SDK response type:', typeof sdkResponse);
            console.log('SDK has data property:', !!sdkResponse?.data);
            if (sdkResponse?.data && typeof sdkResponse.data === 'object') {
              console.log('SDK data keys:', Object.keys(sdkResponse.data).slice(0, 10));
            }
          }
        } catch (parseError) {
          console.error('Error extracting data from SDK response:', parseError.message);
        }
      } catch (sdkError) {
        console.error('SDK Error:', {
          message: sdkError.message,
          code: sdkError.code,
          status: sdkError.response?.status,
          // Don't try to log full response to avoid circular structure
        });
      }
      
      // If SDK failed, try direct API endpoints as fallback
      if (!sdkSuccess) {
        console.log('SDK did not return verification_url, trying direct API endpoints...');
      }

      // Try different endpoint formats (404 error suggests wrong endpoint)
      // Based on Cashfree docs, the endpoint might be under /pg/ or /verification/
      const endpoints = [
        `${CASHFREE_BASE_URL}/pg/lrs/digilocker/link`, // Payout API format (older, but might work)
        `${CASHFREE_BASE_URL}/verification/digilocker/create-url`, // Verification API format
        `${CASHFREE_BASE_URL}/verification/v2/digilocker/create-url`, // V2 format
        `${CASHFREE_BASE_URL}/verification/digilocker/v2/create-url`, // Alternative V2 format
      ];

      let lastError = null;
      let successfulResponse = null;
      
      // Try each endpoint format
      for (const endpoint of endpoints) {
        try {
          console.log(`Trying endpoint: ${endpoint}`);
      
          // Adjust request body and headers based on endpoint type
          let apiRequestBody = requestBody;
          let apiHeaders = getCashfreeHeadersWithConfig();
          
          // If using Payout API format (/pg/lrs/digilocker/link), adjust request format
          if (endpoint.includes('/pg/lrs/digilocker/link')) {
            apiRequestBody = {
              reference_id: verification_id,
              document_type: 'aadhaar',
              redirect_url: redirect_url,
            };
            // Payout API uses Bearer token authentication
      try {
        const token = await getCashfreeAccessToken();
        if (token) {
                apiHeaders = {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'x-api-version': '2022-09-01',
                };
                delete apiHeaders['x-client-id'];
                delete apiHeaders['x-client-secret'];
              }
            } catch (tokenError) {
              console.log('Could not get token for Payout API, trying with client credentials');
            }
          }
          
          const directApiResponse = await axios.post(
            endpoint,
            apiRequestBody,
            {
              headers: apiHeaders,
              timeout: 15000,
            }
          );

          console.log(`Endpoint ${endpoint} - Response Status:`, directApiResponse.status);
          console.log(`Endpoint ${endpoint} - Response Data:`, JSON.stringify(directApiResponse.data, null, 2));

          // Handle different response formats
          let responseData = directApiResponse.data?.data || directApiResponse.data;
          
          // For Payout API format, the response structure might be different
          if (endpoint.includes('/pg/lrs/digilocker/link')) {
            // Payout API might return data directly or in a different structure
            if (directApiResponse.data?.status === 'SUCCESS') {
              responseData = directApiResponse.data.data || directApiResponse.data;
            }
          }
          
          const verificationUrl = responseData?.verification_url || responseData?.verificationUrl || responseData?.url;
          
          if (verificationUrl) {
            successfulResponse = {
              success: true,
              verified: false,
              verification_pending: true,
              verification_url: verificationUrl,
              verification_id: verification_id,
              reference_id: responseData.reference_id || responseData.referenceId || verification_id,
              aadhaar_number: cleanAadhaar,
              status: responseData.status || 'PENDING',
              user_flow: responseData.user_flow || responseData.userFlow || userFlow,
              message: 'Please complete verification via DigiLocker',
              verification_method: 'digilocker',
            };
            console.log(`✅ Success with endpoint: ${endpoint}`);
            break; // Success, exit loop
          } else {
            console.log(`Endpoint ${endpoint} worked but no verification_url in response:`, responseData);
            // Continue to next endpoint
            continue;
        }
        } catch (endpointError) {
          console.log(`❌ Endpoint ${endpoint} failed:`, {
            status: endpointError.response?.status,
            message: endpointError.message,
            data: endpointError.response?.data,
          });
          lastError = endpointError;
          // Try next endpoint
          continue;
        }
      }

      // If we got a successful response, return it
      if (successfulResponse) {
        return res.json(successfulResponse);
      }

      // Try SDK first (before direct API) - SDK handles endpoints internally
      console.log('Trying Cashfree SDK...');
      try {
        const sdkResponse = await Cashfree.VrsDigilockerVerificationCreateUrl(
          requestBody,
          '2023-12-18', // Pass API version explicitly
          { timeout: 15000 }
        );

        // Handle SDK response carefully to avoid circular structure error
        // Don't try to JSON.stringify the response - extract values directly
        let verificationUrl = null;
        let referenceId = verification_id;
        let status = 'PENDING';
        let userFlowValue = userFlow;
        
        try {
          // Extract data safely without logging the full object
          if (sdkResponse) {
            // Try different possible response structures
            const possibleData = sdkResponse.data || sdkResponse.response?.data || sdkResponse;
            
            if (possibleData) {
              // Extract verification_url from various possible locations
              verificationUrl = possibleData.verification_url || 
                              possibleData.verificationUrl || 
                              possibleData.url ||
                              possibleData.data?.verification_url ||
                              possibleData.data?.verificationUrl;
              
              // Extract other fields
              referenceId = possibleData.reference_id || 
                           possibleData.referenceId || 
                           possibleData.data?.reference_id ||
                           verification_id;
                           
              status = possibleData.status || 
                      possibleData.data?.status || 
                      'PENDING';
                      
              userFlowValue = possibleData.user_flow || 
                             possibleData.userFlow || 
                             possibleData.data?.user_flow ||
                             userFlow;
            }
          }
          
          if (verificationUrl) {
            console.log('✅ SDK returned verification_url successfully');
      return res.json({
        success: true,
              verified: false,
        verification_pending: true,
              verification_url: verificationUrl,
              verification_id: verification_id,
              reference_id: referenceId,
        aadhaar_number: cleanAadhaar,
              status: status,
              user_flow: userFlowValue,
              message: 'Please complete verification via DigiLocker',
              verification_method: 'digilocker',
            });
          } else {
            console.log('SDK response received but no verification_url found');
            // Log what we can safely log
            console.log('SDK response type:', typeof sdkResponse);
            console.log('SDK has data property:', !!sdkResponse?.data);
          }
        } catch (parseError) {
          console.error('Error extracting data from SDK response:', parseError.message);
        }
      } catch (sdkError) {
        console.error('SDK Error:', {
          message: sdkError.message,
          code: sdkError.code,
          status: sdkError.response?.status,
          // Don't try to log full response to avoid circular structure
        });
        // Continue to direct API attempts
      }
      
      // If SDK failed, try direct API endpoints
      console.log('SDK did not return verification_url, trying direct API endpoints...');

      // If everything failed, return detailed error
      const errorStatus = lastError?.response?.status || 400;
      const errorData = lastError?.response?.data || {};
      
      return res.status(errorStatus).json({
        success: false,
        error: 'Failed to create DigiLocker URL',
        message: errorData.message || errorData.error?.message || lastError?.message || 'All API endpoints failed',
        details: {
          tried_endpoints: endpoints,
          last_error_status: errorStatus,
          last_error_data: typeof errorData === 'string' ? errorData : (errorData.message || errorData),
          verification_id: verification_id,
          redirect_url: redirect_url,
          user_flow: userFlow,
        },
        troubleshooting: [
          '1. Check Cashfree credentials are correct (CASHFREE_CLIENT_ID, CASHFREE_CLIENT_SECRET)',
          '2. Verify DigiLocker API access is enabled in Cashfree dashboard',
          '3. Check redirect_url format (should not have double slashes)',
          '4. Verify API version 2023-12-18 is supported',
          '5. Check if you need to use sandbox vs production endpoints',
          '6. Ensure your Cashfree account has Verification API access',
        ],
      });
    } catch (verifyApiError) {
      console.error('Cashfree Verification API error:', {
        message: verifyApiError.message,
        code: verifyApiError.code,
        status: verifyApiError.response?.status,
        statusText: verifyApiError.response?.statusText,
        response: verifyApiError.response?.data,
        timeout: verifyApiError.code === 'ECONNABORTED',
        stack: verifyApiError.stack,
      });
      
      // If timeout, return error immediately
      if (verifyApiError.code === 'ECONNABORTED' || verifyApiError.message?.includes('timeout')) {
        return res.status(504).json({
          success: false,
          error: 'Verification request timed out',
          message: 'The verification service took too long to respond. Please try again.',
          aadhaar_number: cleanAadhaar,
        });
      }
      
      // Return detailed error with Cashfree response
      const errorStatus = verifyApiError.response?.status || 500;
      const errorData = verifyApiError.response?.data || {};
      
      return res.status(errorStatus).json({
        success: false,
        error: 'Failed to create DigiLocker verification URL',
        message: errorData.message || errorData.error?.message || verifyApiError.message || 'DigiLocker verification unavailable. Please try again.',
        details: errorData,
        status_code: errorStatus,
        troubleshooting: errorStatus === 401 ? 'Check your Cashfree credentials (CASHFREE_CLIENT_ID, CASHFREE_CLIENT_SECRET)' :
                      errorStatus === 403 ? 'Your Cashfree account may not have DigiLocker API access enabled' :
                      errorStatus === 400 ? 'Invalid request parameters. Check verification_id and redirect_url format' :
                      'Check Cashfree dashboard and API documentation',
      });
    }

  } catch (error) {
    console.error('Aadhaar number verification error:', error.response?.data || error.message);
    return res.status(500).json({
      error: 'Failed to verify Aadhaar number',
      details: error.response?.data || error.message,
    });
  }
});

// Step 3: Get DigiLocker verification status (pre-signup - public route)
// Can use either verification_id or reference_id (both work according to Cashfree docs)
// IMPORTANT: Cashfree prefers verification_id for status checks (reference_id may not work)
router.get('/digilocker-status/:referenceId', async (req, res) => {
  try {
    const { referenceId } = req.params;
    const { aadhaar_number, verification_id } = req.query;

    // PRIORITIZE verification_id - Cashfree requires verification_id for status checks
    // reference_id (like "30905") doesn't work, must use verification_id (like "aadhaar_516827225994_1765297089033")
    const idToUse = verification_id || referenceId;
    
    console.log('Status check - verification_id:', verification_id, 'referenceId:', referenceId, 'using:', idToUse);

    if (!idToUse) {
      return res.status(400).json({
        success: false,
        error: 'Reference ID or Verification ID is required',
      });
    }

    try {
      // Method 1: Try using Cashfree Verification SDK
      // The SDK accepts either verification_id or reference_id
      console.log('Checking DigiLocker status using SDK for ID:', idToUse);
      const statusResponse = await Cashfree.VrsDigilockerVerificationFetchStatus(undefined, undefined, idToUse, { timeout: 15000 });
      
      const statusData = statusResponse.data?.data || statusResponse.data;
      const currentStatus = statusData?.verification_status || statusData?.status || 'PENDING';
      
      console.log('DigiLocker status:', currentStatus);

      // Handle different statuses according to documentation:
      // PENDING, AUTHENTICATED, EXPIRED, CONSENT_DENIED
      if (currentStatus === 'AUTHENTICATED' || currentStatus === 'SUCCESS') {
        // User has authenticated and given consent - fetch document
        try {
          console.log('Status is AUTHENTICATED, fetching document using verification_id:', idToUse);
          // Use verification_id (not reference_id) for document fetch
          const docResponse = await Cashfree.VrsDigilockerVerificationFetchDocument('AADHAAR', undefined, undefined, idToUse, { timeout: 15000 });
          
          const docData = docResponse.data?.data || docResponse.data;
          
          // Check if document has eaadhaar available
          if (docData?.eaadhaar === 'N' || !docData?.name) {
            return res.json({
              success: true,
              verified: false,
              status: 'AUTHENTICATED',
              message: 'Aadhaar document not available in DigiLocker. Please log in to DigiLocker and link your Aadhaar document.',
              aadhaar_number: aadhaar_number,
              error: 'eaadhaar_not_available',
            });
          }
          
          return res.json({
            success: true,
            verified: true,
            status: 'AUTHENTICATED',
            verification_id: idToUse, // Include verification_id in response
            aadhaar_number: aadhaar_number || docData.aadhaar_number,
            name: docData.name || docData.full_name,
            date_of_birth: docData.date_of_birth || docData.dob,
            gender: docData.gender,
            address: docData.address || docData.full_address,
            father_name: docData.father_name,
            details: docData,
          });
        } catch (docError) {
          console.error('Document fetch error:', docError.response?.data || docError.message);
          // Return authenticated status even if document fetch fails
          return res.json({
            success: true,
            verified: false,
            status: 'AUTHENTICATED',
            aadhaar_number: aadhaar_number,
            message: 'Authentication successful, but document fetch failed. Please try again.',
            error: 'document_fetch_failed',
            details: docError.response?.data || docError.message,
          });
        }
      } else if (currentStatus === 'EXPIRED') {
        return res.json({
          success: false,
          verified: false,
          status: 'EXPIRED',
          message: 'DigiLocker verification link has expired. Please start the verification process again.',
          error: 'link_expired',
        });
      } else if (currentStatus === 'CONSENT_DENIED') {
        return res.json({
          success: false,
          verified: false,
          status: 'CONSENT_DENIED',
          message: 'User denied consent to share documents. Please try again and provide consent.',
          error: 'consent_denied',
        });
      } else if (currentStatus === 'PENDING') {
        return res.json({
          success: true,
          verified: false,
          status: 'PENDING',
          message: 'Verification is pending. Please complete the DigiLocker authentication process.',
        });
      }

      // Unknown status
      return res.json({
        success: true,
        verified: false,
        status: currentStatus,
        message: `Verification status: ${currentStatus}`,
      });
    } catch (verifyApiError) {
      console.error('Verification API error:', verifyApiError.response?.data || verifyApiError.message);
      
      // Method 2: Fallback to direct API call
      try {
        const fallbackResponse = await axios.get(
          `${CASHFREE_BASE_URL}/verification/digilocker/verification-status/${idToUse}`,
        {
          headers: getCashfreeHeadersWithConfig(),
            timeout: 15000,
        }
      );

        const fallbackData = fallbackResponse.data?.data || fallbackResponse.data;
        const fallbackStatus = fallbackData?.verification_status || fallbackData?.status || 'PENDING';

        if (fallbackStatus === 'AUTHENTICATED' || fallbackStatus === 'SUCCESS') {
          // Try to fetch document
        try {
          const docResponse = await axios.get(
              `${CASHFREE_BASE_URL}/verification/digilocker/document/${idToUse}?document_requested=AADHAAR`,
            {
              headers: getCashfreeHeadersWithConfig(),
                timeout: 15000,
            }
          );

            const docData = docResponse.data?.data || docResponse.data;
          return res.json({
            success: true,
            verified: true,
              status: 'AUTHENTICATED',
            aadhaar_number: aadhaar_number || docData.aadhaar_number,
            name: docData.name || docData.full_name,
            date_of_birth: docData.date_of_birth || docData.dob,
            gender: docData.gender,
            address: docData.address || docData.full_address,
            father_name: docData.father_name,
            details: docData,
          });
        } catch (docError) {
          return res.json({
            success: true,
              verified: false,
              status: 'AUTHENTICATED',
            aadhaar_number: aadhaar_number,
              message: 'Authentication successful, but document fetch failed.',
              error: 'document_fetch_failed',
          });
        }
      }

      return res.json({
        success: true,
        verified: false,
          status: fallbackStatus,
          message: `Verification status: ${fallbackStatus}`,
      });
      } catch (fallbackError) {
        console.error('Fallback status check error:', fallbackError.response?.data || fallbackError.message);
      
        // Last resort: Try old endpoint with Bearer token
      const token = await getCashfreeAccessToken();
      if (token) {
        try {
            const oldEndpointResponse = await axios.get(
              `${CASHFREE_BASE_URL}/pg/lrs/digilocker/status/${idToUse}`,
            {
              headers: {
                'Authorization': `Bearer ${token}`,
                'x-api-version': '2022-09-01',
                },
                timeout: 15000,
            }
          );

            if (oldEndpointResponse.data.status === 'SUCCESS') {
              const data = oldEndpointResponse.data.data || {};
            const isVerified = data.verification_status === 'SUCCESS' || data.status === 'verified';
            
            if (isVerified && data.document_data) {
              const docData = data.document_data || {};
              return res.json({
                success: true,
                verified: true,
                  status: 'AUTHENTICATED',
                aadhaar_number: aadhaar_number || docData.aadhaar_number,
                name: docData.name || docData.full_name,
                date_of_birth: docData.date_of_birth || docData.dob,
                gender: docData.gender,
                address: docData.address || docData.full_address,
                father_name: docData.father_name,
                details: docData,
              });
            }
            
            return res.json({
              success: true,
              verified: isVerified,
                status: data.verification_status || data.status || 'PENDING',
              message: isVerified ? 'Verification successful' : 'Verification pending',
            });
          }
          } catch (oldEndpointError) {
            console.error('Old endpoint error:', oldEndpointError.response?.data || oldEndpointError.message);
        }
      }
      }
      
      // If all methods fail, return error
      return res.status(verifyApiError.response?.status || 500).json({
        success: false,
        error: 'Failed to get DigiLocker status',
        details: verifyApiError.response?.data || verifyApiError.message,
      });
    }
  } catch (error) {
    console.error('DigiLocker status error:', error.response?.data || error.message);
    return res.status(500).json({
      error: 'Failed to get DigiLocker status',
      details: error.response?.data || error.message,
    });
  }
});

// Verify Aadhaar via OCR (pre-signup - public route)
router.post('/verify-aadhaar-ocr', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aadhaar document file is required' });
    }

    const { aadhaar_number } = req.body;

    if (!aadhaar_number) {
      return res.status(400).json({
        error: 'Aadhaar number is required',
      });
    }

    // Aadhaar format validation (12 digits)
    const aadhaarRegex = /^[0-9]{12}$/;
    if (!aadhaarRegex.test(aadhaar_number)) {
      return res.status(400).json({
        error: 'Invalid Aadhaar format. Aadhaar should be 12 digits.',
      });
    }

    const token = await getCashfreeAccessToken();

    // Convert file to base64
    const base64Document = req.file.buffer.toString('base64');

    // Verify Aadhaar using Cashfree Smart OCR API
    const formData = new FormDataLib();
    formData.append('file', req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
    });
    formData.append('document_type', 'aadhaar');
    formData.append('verification_level', 'level_2');

    const response = await axios.post(
      `${CASHFREE_BASE_URL}/pg/lrs/orders/ocr/verify`,
      formData,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          ...formData.getHeaders(),
          'x-api-version': '2022-09-01',
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }
    );

    if (response.data.status === 'SUCCESS') {
      const extractedData = response.data.data || {};
      
      // Verify if extracted Aadhaar matches provided number
      const extractedAadhaar = extractedData.aadhaar_number?.replace(/\s/g, '') || '';
      if (extractedAadhaar && extractedAadhaar !== aadhaar_number.replace(/\s/g, '')) {
        return res.status(400).json({
          success: false,
          verified: false,
          error: 'Aadhaar number in document does not match provided number',
        });
      }

      return res.json({
        success: true,
        verified: true,
        aadhaar_number: aadhaar_number,
        name: extractedData.name || extractedData.full_name,
        date_of_birth: extractedData.date_of_birth || extractedData.dob,
        gender: extractedData.gender,
        address: extractedData.address,
        father_name: extractedData.father_name,
        extracted_details: extractedData,
      });
    } else {
      return res.status(400).json({
        success: false,
        verified: false,
        error: 'Aadhaar verification failed',
        details: response.data,
      });
    }
  } catch (error) {
    console.error('Aadhaar OCR verification error:', error.response?.data || error.message);
    return res.status(500).json({
      error: 'Failed to verify Aadhaar',
      details: error.response?.data || error.message,
    });
  }
});

// Verify Aadhaar via number only (pre-signup - public route)
router.post('/verify-aadhaar', async (req, res) => {
  try {
    const { aadhaar_number } = req.body;

    if (!aadhaar_number) {
      return res.status(400).json({
        error: 'Aadhaar number is required',
      });
    }

    // Aadhaar format validation (12 digits)
    const aadhaarRegex = /^[0-9]{12}$/;
    if (!aadhaarRegex.test(aadhaar_number.replace(/\s/g, ''))) {
      return res.status(400).json({
        error: 'Invalid Aadhaar format. Aadhaar should be 12 digits.',
      });
    }

    const token = await getCashfreeAccessToken();
    const cleanAadhaar = aadhaar_number.replace(/\s/g, '');
    const reference_id = `aadhaar_${cleanAadhaar}_${Date.now()}`;

    // Create DigiLocker verification link for Aadhaar
    const response = await axios.post(
      `${CASHFREE_BASE_URL}/pg/lrs/digilocker/link`,
      {
        reference_id: reference_id,
        document_type: 'aadhaar',
        redirect_url: `${(process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '')}/kyc-callback`,
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'x-api-version': '2022-09-01',
        }
      }
    );

    if (response.data.status === 'SUCCESS') {
      // For now, return the verification URL and reference_id
      // The frontend will handle the DigiLocker flow
      return res.json({
        success: true,
        verification_url: response.data.data?.verification_url || response.data.verification_url,
        reference_id: reference_id,
        aadhaar_number: cleanAadhaar,
        message: 'Please complete verification via DigiLocker',
      });
    } else {
      return res.status(400).json({
        success: false,
        error: 'Failed to create verification link',
        details: response.data,
      });
    }
  } catch (error) {
    console.error('Aadhaar verification error:', error.response?.data || error.message);
    return res.status(500).json({
      error: 'Failed to verify Aadhaar',
      details: error.response?.data || error.message,
    });
  }
});

// Create DigiLocker link for Aadhaar verification (pre-signup - public route)
router.post('/create-digilocker-link', async (req, res) => {
  try {
    const { reference_id } = req.body;

    if (!reference_id) {
      return res.status(400).json({
        error: 'Reference ID is required',
      });
    }

    const token = await getCashfreeAccessToken();

    // Create DigiLocker verification link
    const response = await axios.post(
      `${CASHFREE_BASE_URL}/pg/lrs/digilocker/link`,
      {
        reference_id: reference_id,
        document_type: 'aadhaar',
        redirect_url: `${(process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '')}/kyc-callback`,
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'x-api-version': '2022-09-01',
        }
      }
    );

    if (response.data.status === 'SUCCESS') {
      return res.json({
        success: true,
        verification_url: response.data.data?.verification_url || response.data.verification_url,
        reference_id: reference_id,
      });
    } else {
      return res.status(400).json({
        error: 'Failed to create DigiLocker link',
        details: response.data,
      });
    }
  } catch (error) {
    console.error('DigiLocker link creation error:', error.response?.data || error.message);
    return res.status(500).json({
      error: 'Failed to create DigiLocker link',
      details: error.response?.data || error.message,
    });
  }
});

// Get DigiLocker verification status (pre-signup - public route)
router.get('/digilocker-status/:referenceId', async (req, res) => {
  try {
    const { referenceId } = req.params;

    const token = await getCashfreeAccessToken();

    const response = await axios.get(
      `${CASHFREE_BASE_URL}/pg/lrs/digilocker/status/${referenceId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-api-version': '2022-09-01',
        }
      }
    );

    if (response.data.status === 'SUCCESS') {
      const data = response.data.data || {};
      return res.json({
        success: true,
        status: data.verification_status || data.status,
        verified: data.verification_status === 'SUCCESS' || data.status === 'verified',
        details: data,
      });
    } else {
      return res.json({
        success: false,
        status: 'pending',
        verified: false,
        details: response.data,
      });
    }
  } catch (error) {
    console.error('DigiLocker status error:', error.response?.data || error.message);
    return res.status(500).json({
      error: 'Failed to get DigiLocker status',
      details: error.response?.data || error.message,
    });
  }
});

// Diagnostic endpoint to check Cashfree configuration
router.get('/diagnostics', async (req, res) => {
  try {
    const keyStatus = verifyPublicKey();
    const signatureTest = CASHFREE_USE_SIGNATURE ? generateCashfreeSignature(CASHFREE_CLIENT_ID) : null;
    
    return res.json({
      success: true,
      authenticationMode: CASHFREE_USE_SIGNATURE ? 'Public Key Signature' : 'IP Whitelisting',
      configuration: {
        hasClientId: !!CASHFREE_CLIENT_ID,
        hasClientSecret: !!CASHFREE_CLIENT_SECRET,
        clientIdLength: CASHFREE_CLIENT_ID?.length || 0,
        clientIdPreview: CASHFREE_CLIENT_ID ? `${CASHFREE_CLIENT_ID.substring(0, 8)}...${CASHFREE_CLIENT_ID.substring(CASHFREE_CLIENT_ID.length - 4)}` : 'MISSING',
        baseUrl: CASHFREE_BASE_URL,
        apiVersion: CASHFREE_API_VERSION,
        usingSignature: CASHFREE_USE_SIGNATURE,
        usingIpWhitelisting: !CASHFREE_USE_SIGNATURE,
      },
      publicKey: CASHFREE_USE_SIGNATURE ? {
        exists: keyStatus.exists,
        format: keyStatus.format,
        valid: keyStatus.valid,
        path: keyStatus.path,
        error: keyStatus.error,
      } : {
        note: 'Not used - IP whitelisting mode enabled',
      },
      signature: CASHFREE_USE_SIGNATURE ? {
        canGenerate: !!signatureTest,
        length: signatureTest?.length || 0,
      } : {
        note: 'Not used - IP whitelisting mode enabled',
      },
      recommendations: [
        !CASHFREE_CLIENT_ID ? '❌ Set CASHFREE_CLIENT_ID environment variable' : '✅ Client ID configured',
        !CASHFREE_CLIENT_SECRET ? '❌ Set CASHFREE_CLIENT_SECRET environment variable' : '✅ Client Secret configured',
        CASHFREE_USE_SIGNATURE 
          ? (!keyStatus.exists ? '⚠️  Public key file not found. Add keys/cashfree_public_key.pem' : '✅ Public key file exists')
          : '✅ Using IP whitelisting (no public key needed)',
        CASHFREE_USE_SIGNATURE 
          ? (!keyStatus.valid ? '❌ Public key is invalid. Download a fresh key from Cashfree dashboard' : '✅ Public key is valid')
          : '✅ IP whitelisting mode - ensure server IP is whitelisted in Cashfree dashboard',
        !CASHFREE_USE_SIGNATURE 
          ? '✅ IP Whitelisting: Make sure your server IP is whitelisted in Cashfree dashboard (Developers → Two-Factor Authentication → IP Whitelisting)'
          : (signatureTest ? '✅ Signature generation working' : '❌ Cannot generate signature. Check public key'),
      ],
      ipWhitelisting: {
        enabled: !CASHFREE_USE_SIGNATURE,
        instructions: [
          '1. Go to Cashfree dashboard: Developers → Two-Factor Authentication',
          '2. Click "Switch Method" and select "IP Whitelisting"',
          '3. Add your server IP address',
          '4. For Render.com: Check your service logs or use a service to get your outbound IP',
        ],
      },
      troubleshooting: {
        authenticationFailed: !CASHFREE_USE_SIGNATURE ? [
          '1. Verify your server IP is whitelisted in Cashfree dashboard',
          '2. Check that CASHFREE_CLIENT_ID and CASHFREE_CLIENT_SECRET are correct',
          '3. Ensure you\'re using the correct environment (sandbox vs production)',
          '4. Check Cashfree dashboard → Developers → Two-Factor Authentication → IP Whitelisting',
        ] : [
          '1. Verify the public key in keys/cashfree_public_key.pem matches the one in Cashfree dashboard',
          '2. Ensure CASHFREE_CLIENT_ID exactly matches the Client ID in Cashfree dashboard (case-sensitive)',
          '3. Download a fresh public key from Cashfree dashboard (Two-Factor Authentication section)',
          '4. Alternative: Switch to IP whitelisting by removing CASHFREE_USE_SIGNATURE=true',
        ],
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Cashfree Webhook Endpoint
// This endpoint receives webhook notifications from Cashfree
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    // Cashfree sends webhook data in the request body
    // Handle both raw JSON and parsed JSON
    let webhookData;
    if (Buffer.isBuffer(req.body)) {
      webhookData = JSON.parse(req.body.toString());
    } else if (typeof req.body === 'string') {
      webhookData = JSON.parse(req.body);
    } else {
      webhookData = req.body;
    }
    
    console.log('Cashfree Webhook Received:', JSON.stringify(webhookData, null, 2));
    
    // Extract webhook information
    // Cashfree uses 'event_type' not 'type'
    const eventType = webhookData.event_type || webhookData.type;
    const data = webhookData.data || webhookData;
    const verification_id = data?.verification_id || webhookData.verification_id;
    const reference_id = data?.reference_id || webhookData.reference_id;
    const userDetails = data?.user_details || {};
    const status = data?.status || '';

    console.log('Webhook event_type:', eventType);
    console.log('Verification ID:', verification_id);
    console.log('Reference ID:', reference_id);
    console.log('Status:', status);
    console.log('User Details:', userDetails);

    // Handle different webhook event types
    switch (eventType) {
      case 'DIGILOCKER_VERIFICATION_SUCCESS':
      case 'VERIFICATION.SUCCESS':
      case 'verification.success':
        // Verification completed successfully
        console.log('✅ DigiLocker verification successful!');
        console.log('Verification ID:', verification_id);
        console.log('Reference ID:', reference_id);
        console.log('User Details:', JSON.stringify(userDetails, null, 2));
        
        // Store verification data temporarily (can be retrieved by verification_id)
        // In production, you might want to use Redis or a database table
        // For now, we'll return this data via the status endpoint
        // The frontend will poll the status endpoint and get this data
        
        // Log the verification data for retrieval
        console.log('✅ Verification data available for verification_id:', verification_id);
        console.log('Aadhaar data:', {
          name: userDetails.name,
          dob: userDetails.dob,
          gender: userDetails.gender,
          mobile: userDetails.mobile,
          eaadhaar: userDetails.eaadhaar,
        });
        break;
        
      case 'DIGILOCKER_VERIFICATION_FAILED':
      case 'VERIFICATION.FAILED':
      case 'verification.failed':
        // Verification failed
        console.log('❌ DigiLocker verification failed for:', verification_id || reference_id);
        break;
        
      case 'VERIFICATION.PENDING':
      case 'verification.pending':
        // Verification is pending
        console.log('⏳ Verification pending for:', verification_id || reference_id);
        break;
        
      default:
        console.log('ℹ️  Unknown webhook event_type:', eventType);
        console.log('Webhook data structure:', {
          hasEventType: !!webhookData.event_type,
          hasType: !!webhookData.type,
          hasData: !!webhookData.data,
          keys: Object.keys(webhookData).slice(0, 10),
        });
    }

    // Always return 200 OK to acknowledge receipt
    // Cashfree will retry if it doesn't receive 200
    res.status(200).json({ 
      success: true, 
      message: 'Webhook received',
      received: true,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    // Still return 200 to prevent Cashfree from retrying
    // Log the error for debugging
    res.status(200).json({ 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;

