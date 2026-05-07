/**
 * Generate a 6-digit OTP
 * @returns {String} 6-digit OTP
 */
export function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Store OTP in memory (in production, use Redis or database)
 * Format: { phone/email: { otp, expiresAt, attempts } }
 */
const otpStore = new Map();

/**
 * Store OTP
 * @param {String} identifier - Phone number or email
 * @param {String} otp - OTP code
 * @param {Number} expiryMinutes - Expiry time in minutes (default: 10)
 */
export function storeOTP(identifier, otp, expiryMinutes = 10) {
  const expiresAt = Date.now() + expiryMinutes * 60 * 1000;
  otpStore.set(identifier, {
    otp,
    expiresAt,
    attempts: 0,
    maxAttempts: 5,
  });

  // Clean up expired OTPs after expiry
  setTimeout(() => {
    otpStore.delete(identifier);
  }, expiryMinutes * 60 * 1000);
}

/**
 * Verify OTP
 * @param {String} identifier - Phone number or email
 * @param {String} inputOTP - OTP to verify
 * @returns {Object} { valid: boolean, message: string }
 */
export function verifyOTP(identifier, inputOTP) {
  const stored = otpStore.get(identifier);

  if (!stored) {
    return { valid: false, message: 'OTP not found or expired. Please request a new OTP.' };
  }

  if (Date.now() > stored.expiresAt) {
    otpStore.delete(identifier);
    return { valid: false, message: 'OTP has expired. Please request a new OTP.' };
  }

  if (stored.attempts >= stored.maxAttempts) {
    otpStore.delete(identifier);
    return { valid: false, message: 'Maximum attempts exceeded. Please request a new OTP.' };
  }

  stored.attempts += 1;

  if (stored.otp !== inputOTP) {
    const remainingAttempts = stored.maxAttempts - stored.attempts;
    return {
      valid: false,
      message: `Invalid OTP. ${remainingAttempts > 0 ? `${remainingAttempts} attempts remaining.` : 'Maximum attempts exceeded.'}`,
    };
  }

  // OTP verified successfully, remove it
  otpStore.delete(identifier);
  return { valid: true, message: 'OTP verified successfully.' };
}

/**
 * Clear OTP for identifier
 * @param {String} identifier - Phone number or email
 */
export function clearOTP(identifier) {
  otpStore.delete(identifier);
}

/**
 * Get OTP info (for debugging)
 * @param {String} identifier - Phone number or email
 * @returns {Object|null} OTP info or null
 */
export function getOTPInfo(identifier) {
  const stored = otpStore.get(identifier);
  if (!stored) return null;

  return {
    expiresAt: new Date(stored.expiresAt),
    attempts: stored.attempts,
    maxAttempts: stored.maxAttempts,
    isExpired: Date.now() > stored.expiresAt,
  };
}
