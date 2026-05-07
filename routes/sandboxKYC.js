import express from 'express';
import axios from 'axios';

const router = express.Router();

// Sandbox API Configuration
const SANDBOX_API_KEY = process.env.SANDBOX_API_KEY;
const SANDBOX_API_SECRET = process.env.SANDBOX_API_SECRET;
const SANDBOX_BASE_URL = process.env.SANDBOX_BASE_URL || 'https://api.sandbox.co.in';
const SANDBOX_API_VERSION = process.env.SANDBOX_API_VERSION || '1.0';

// Validate required environment variables
if (!SANDBOX_API_KEY || !SANDBOX_API_SECRET) {
  console.error('❌ ERROR: SANDBOX_API_KEY and SANDBOX_API_SECRET must be set in .env file');
  console.error('💡 Please add the following to your .env file:');
  console.error('   SANDBOX_API_KEY=your_api_key_here');
  console.error('   SANDBOX_API_SECRET=your_api_secret_here');
}

// Cache for access token (valid for 24 hours)
let accessTokenCache = {
  token: null,
  expiresAt: null
};

/**
 * Authenticate with Sandbox API to get access token
 * Token is valid for 24 hours
 */
async function getSandboxAccessToken() {
  try {
    // Check if we have a valid cached token
    if (accessTokenCache.token && accessTokenCache.expiresAt && Date.now() < accessTokenCache.expiresAt) {
      return accessTokenCache.token;
    }

    const response = await axios.post(
      `${SANDBOX_BASE_URL}/authenticate`,
      {},
      {
        headers: {
          'x-api-key': SANDBOX_API_KEY,
          'x-api-secret': SANDBOX_API_SECRET,
          'x-api-version': SANDBOX_API_VERSION,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    if (response.data.code === 200 && response.data.data?.access_token) {
      const token = response.data.data.access_token;
      // Cache token for 23 hours (to be safe, as it's valid for 24 hours)
      accessTokenCache = {
        token: token,
        expiresAt: Date.now() + (23 * 60 * 60 * 1000)
      };
      return token;
    }

    throw new Error('Failed to get access token from Sandbox');
  } catch (error) {
    console.error('Sandbox authentication error:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    throw error;
  }
}

/**
 * Generate OTP for Aadhaar verification
 * POST /kyc/aadhaar/okyc/otp
 */
router.post('/aadhaar/generate-otp', async (req, res) => {
  try {
    const { aadhaar_number, reason } = req.body;

    // Validate Aadhaar number
    if (!aadhaar_number) {
      return res.status(400).json({
        success: false,
        error: 'Aadhaar number is required'
      });
    }

    // Aadhaar format validation (12 digits)
    const cleanAadhaar = aadhaar_number.replace(/\s/g, '');
    const aadhaarRegex = /^[0-9]{12}$/;
    
    if (!aadhaarRegex.test(cleanAadhaar)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Aadhaar format. Aadhaar should be 12 digits.'
      });
    }

    // Additional validation: Aadhaar should not start with 0 or 1
    if (cleanAadhaar.startsWith('0') || cleanAadhaar.startsWith('1')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Aadhaar number. Aadhaar cannot start with 0 or 1.'
      });
    }

    // Get access token
    const accessToken = await getSandboxAccessToken();

    // Generate OTP
    const response = await axios.post(
      `${SANDBOX_BASE_URL}/kyc/aadhaar/okyc/otp`,
      {
        '@entity': 'in.co.sandbox.kyc.aadhaar.okyc.otp.request',
        aadhaar_number: cleanAadhaar,
        consent: 'Y',
        reason: reason || 'KYC verification for account registration'
      },
      {
        headers: {
          'Authorization': accessToken, // Note: NOT Bearer token, just the token
          'x-api-key': SANDBOX_API_KEY,
          'x-api-version': SANDBOX_API_VERSION,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );

    if (response.data.code === 200 && response.data.data) {
      return res.json({
        success: true,
        reference_id: response.data.data.reference_id,
        message: response.data.data.message || 'OTP sent successfully',
        transaction_id: response.data.transaction_id
      });
    }

    return res.status(400).json({
      success: false,
      error: 'Failed to generate OTP',
      details: response.data
    });
  } catch (error) {
    console.error('Sandbox Aadhaar OTP generation error:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });

    if (error.response) {
      return res.status(error.response.status || 500).json({
        success: false,
        error: error.response.data?.message || 'Failed to generate OTP',
        details: error.response.data
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Failed to generate OTP',
      details: error.message
    });
  }
});

/**
 * Verify OTP and get Aadhaar details
 * POST /kyc/aadhaar/okyc/otp/verify
 */
router.post('/aadhaar/verify-otp', async (req, res) => {
  try {
    // Log incoming request for debugging
    console.log('OTP verification request received:', {
      hasReferenceId: !!req.body.reference_id,
      hasOtp: !!req.body.otp,
      referenceIdType: typeof req.body.reference_id,
      otpType: typeof req.body.otp
    });

    const { reference_id, otp } = req.body;

    // Validate and clean reference_id
    if (!reference_id) {
      return res.status(400).json({
        success: false,
        error: 'Reference ID is required',
        verified: false
      });
    }
    const cleanReferenceId = String(reference_id).trim();
    if (cleanReferenceId === '') {
      return res.status(400).json({
        success: false,
        error: 'Reference ID cannot be empty',
        verified: false
      });
    }

    // Validate and clean OTP
    if (!otp) {
      return res.status(400).json({
        success: false,
        error: 'OTP is required',
        verified: false
      });
    }
    const otpString = String(otp).trim();
    if (otpString.length !== 6 || !/^\d{6}$/.test(otpString)) {
      return res.status(400).json({
        success: false,
        error: 'OTP must be exactly 6 digits',
        verified: false
      });
    }

    // Get access token
    const accessToken = await getSandboxAccessToken();

    // Verify OTP
    const response = await axios.post(
      `${SANDBOX_BASE_URL}/kyc/aadhaar/okyc/otp/verify`,
      {
        '@entity': 'in.co.sandbox.kyc.aadhaar.okyc.request',
        reference_id: cleanReferenceId,
        otp: otpString
      },
      {
        headers: {
          'Authorization': accessToken, // Note: NOT Bearer token, just the token
          'x-api-key': SANDBOX_API_KEY,
          'x-api-version': SANDBOX_API_VERSION,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );

    if (response.data.code === 200 && response.data.data) {
      const data = response.data.data;

      // Check if Aadhaar is valid
      if (data.status === 'VALID' && data.message === 'Aadhaar Card Exists') {
        // Extract Aadhaar details
        const address = data.address || {};
        
        return res.json({
          success: true,
          verified: true,
          status: data.status,
          message: data.message,
          aadhaar_number: data.aadhaar_number || data.aadhaar || '',
          name: data.name || '',
          care_of: data.care_of || '',
          date_of_birth: data.date_of_birth || data.year_of_birth || '',
          year_of_birth: data.year_of_birth || '',
          gender: data.gender || '',
          address: {
            house: address.house || '',
            street: address.street || '',
            landmark: address.landmark || '',
            vtc: address.vtc || '',
            post_office: address.post_office || '',
            district: address.district || '',
            subdistrict: address.subdistrict || '',
            state: address.state || '',
            pincode: address.pincode || '',
            country: address.country || 'India',
            full_address: [
              address.house,
              address.street,
              address.landmark,
              address.vtc,
              address.post_office,
              address.district,
              address.state,
              address.pincode
            ].filter(Boolean).join(', ')
          },
          mobile_hash: data.mobile_hash || '',
          photo: data.photo || '',
          share_code: data.share_code || '',
          reference_id: data.reference_id || cleanReferenceId,
          transaction_id: response.data.transaction_id,
          details: data
        });
      }

      return res.status(400).json({
        success: false,
        verified: false,
        error: data.message || 'Aadhaar verification failed',
        status: data.status,
        details: data
      });
    }

    return res.status(400).json({
      success: false,
      verified: false,
      error: 'Failed to verify OTP',
      details: response.data
    });
  } catch (error) {
    console.error('Sandbox Aadhaar OTP verification error:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });

    if (error.response) {
      return res.status(error.response.status || 500).json({
        success: false,
        verified: false,
        error: error.response.data?.message || 'Failed to verify OTP',
        details: error.response.data
      });
    }

    return res.status(500).json({
      success: false,
      verified: false,
      error: 'Failed to verify OTP',
      details: error.message
    });
  }
});

export default router;

