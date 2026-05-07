import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Generate Cashfree 2FA signature for Secure ID APIs
 * According to Cashfree docs: https://www.cashfree.com/docs/api-reference/vrs/getting-started
 * 
 * Signature generation steps:
 * 1. Retrieve clientId (X-Client-Id header value)
 * 2. Append with CURRENT UNIX timestamp separated by period (.)
 * 3. Encrypt using RSA with Public key (PKCS1_OAEP padding)
 * 4. Base64 encode the result
 * 
 * Signature is valid for 5 minutes
 */
export function generateCashfreeSignature(clientId) {
  try {
    // Validate and trim client ID
    if (!clientId || typeof clientId !== 'string') {
      console.error('Invalid clientId provided for signature generation');
      return null;
    }
    
    const trimmedClientId = clientId.trim();
    if (!trimmedClientId) {
      console.error('ClientId is empty after trimming');
      return null;
    }

    // Load public key from keys folder
    const publicKeyPath = path.join(__dirname, '..', 'keys', 'cashfree_public_key.pem');
    
    if (!fs.existsSync(publicKeyPath)) {
      console.warn('Cashfree public key not found at:', publicKeyPath);
      console.warn('2FA signature generation will be skipped. Make sure to whitelist IP or configure public key.');
      return null;
    }

    let publicKey = fs.readFileSync(publicKeyPath, 'utf8');
    
    // Clean up the key - remove any extra whitespace and normalize line endings
    publicKey = publicKey.trim();
    publicKey = publicKey.replace(/\r\n/g, '\n');
    publicKey = publicKey.replace(/\r/g, '\n');
    
    // Validate key format
    const isPKCS1 = publicKey.includes('BEGIN RSA PUBLIC KEY');
    const isPKCS8 = publicKey.includes('BEGIN PUBLIC KEY');
    
    if (!isPKCS1 && !isPKCS8) {
      console.error('Invalid public key format. Expected PKCS#1 (BEGIN RSA PUBLIC KEY) or PKCS#8 (BEGIN PUBLIC KEY)');
      return null;
    }

    // Step 1 & 2: Create payload: clientId + "." + current Unix timestamp
    const timestamp = Math.floor(Date.now() / 1000); // Current Unix timestamp in seconds
    const payload = `${trimmedClientId}.${timestamp}`;

    // Step 3: Encrypt using RSA with PKCS1_OAEP padding
    let encrypted;
    try {
      encrypted = crypto.publicEncrypt(
        {
          key: publicKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256', // OAEP requires a hash algorithm
        },
        Buffer.from(payload, 'utf8')
      );
    } catch (encryptError) {
      console.error('Public key encryption failed:', {
        error: encryptError.message,
        keyFormat: isPKCS1 ? 'PKCS#1' : 'PKCS#8',
        payloadLength: payload.length,
        clientIdLength: trimmedClientId.length,
      });
      // Re-throw with more context
      throw new Error(`Signature encryption failed: ${encryptError.message}. Please verify the public key format and that it matches your Cashfree account.`);
    }

    // Step 4: Base64 encode
    const signature = encrypted.toString('base64');

    // Detailed logging for debugging (but mask sensitive data)
    // Show first 8 and last 4 chars of client ID for verification
    const clientIdPreview = trimmedClientId.length > 12 
      ? `${trimmedClientId.substring(0, 8)}...${trimmedClientId.substring(trimmedClientId.length - 4)}`
      : trimmedClientId.substring(0, 10) + '...';
    
    console.log('Generated Cashfree signature:', {
      clientId: clientIdPreview,
      clientIdLength: trimmedClientId.length,
      clientIdFull: trimmedClientId, // Log full client ID for debugging (safe to log)
      timestamp,
      payload: `${trimmedClientId}.${timestamp}`,
      payloadLength: payload.length,
      signatureLength: signature.length,
      signaturePreview: signature.substring(0, 30) + '...',
      keyFormat: isPKCS1 ? 'PKCS#1' : 'PKCS#8',
      publicKeyPath: publicKeyPath,
    });

    return signature;
  } catch (error) {
    console.error('Error generating Cashfree signature:', {
      message: error.message,
      stack: error.stack,
    });
    return null;
  }
}

/**
 * Get Cashfree API headers with 2FA signature if public key is available
 * 
 * @param {string} clientId - Cashfree Client ID
 * @param {string} clientSecret - Cashfree Client Secret
 * @param {boolean} includeSignature - Whether to include 2FA signature (default: true)
 * @param {boolean} forceNoSignature - Force disable signature even if key exists (for IP whitelisting)
 */
export function getCashfreeHeaders(clientId, clientSecret, includeSignature = true, forceNoSignature = false) {
  // Validate credentials
  if (!clientId || !clientSecret) {
    console.error('Cashfree credentials are missing');
    throw new Error('Cashfree credentials (clientId and clientSecret) are required');
  }

  // Trim whitespace from credentials to ensure consistency
  const trimmedClientId = clientId.trim();
  const trimmedClientSecret = clientSecret.trim();

  if (!trimmedClientId || !trimmedClientSecret) {
    console.error('Cashfree credentials are empty after trimming');
    throw new Error('Cashfree credentials cannot be empty');
  }

  // Log the exact client ID being used (for debugging signature mismatch)
  console.log('🔑 Using Cashfree Client ID:', trimmedClientId);

  const headers = {
    'x-client-id': trimmedClientId,
    'x-client-secret': trimmedClientSecret,
    'Content-Type': 'application/json',
    'x-api-version': '2023-12-18',
  };

  // Add 2FA signature if public key is available and not forced to skip
  if (includeSignature && !forceNoSignature) {
    const signature = generateCashfreeSignature(trimmedClientId);
    if (signature) {
      headers['x-cf-signature'] = signature;
      console.log('✅ Added x-cf-signature header to Cashfree API request');
    } else {
      console.warn('⚠️  Signature generation failed or skipped. Requests may fail if IP is not whitelisted in Cashfree dashboard.');
      console.warn('   To fix: Either add your server IP to Cashfree whitelist OR ensure public key file exists at keys/cashfree_public_key.pem');
    }
  } else if (forceNoSignature) {
    console.log('ℹ️  Signature disabled (IP whitelisting mode)');
  }

  return headers;
}

/**
 * Verify public key file exists and is valid
 * @returns {Object} Verification result with details
 */
export function verifyPublicKey() {
  const publicKeyPath = path.join(__dirname, '..', 'keys', 'cashfree_public_key.pem');
  
  const result = {
    exists: false,
    path: publicKeyPath,
    format: null,
    valid: false,
    error: null,
  };

  try {
    if (!fs.existsSync(publicKeyPath)) {
      result.error = 'Public key file not found';
      return result;
    }

    result.exists = true;
    const publicKey = fs.readFileSync(publicKeyPath, 'utf8').trim();
    
    const isPKCS1 = publicKey.includes('BEGIN RSA PUBLIC KEY');
    const isPKCS8 = publicKey.includes('BEGIN PUBLIC KEY');
    
    if (isPKCS1) {
      result.format = 'PKCS#1';
      result.valid = true;
    } else if (isPKCS8) {
      result.format = 'PKCS#8';
      result.valid = true;
    } else {
      result.error = 'Invalid key format - must be PKCS#1 or PKCS#8';
    }

    // Try to create a test key object to verify it's parseable
    if (result.valid) {
      try {
        crypto.createPublicKey(publicKey);
      } catch (parseError) {
        result.valid = false;
        result.error = `Key parsing failed: ${parseError.message}`;
      }
    }
  } catch (error) {
    result.error = error.message;
  }

  return result;
}
