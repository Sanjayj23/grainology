import crypto from 'crypto';

const VIEW_TOKEN_TTL_SEC = 60 * 60; // 60 minutes (1 hour)

/**
 * Create a short-lived access token for viewing a document URL.
 * Only URLs starting with https://res.cloudinary.com/ are allowed.
 * @param {string} url - Full Cloudinary document URL
 * @returns {string} token suitable for query param
 */
export function createDocumentViewToken(url) {
  if (!url || typeof url !== 'string' || !url.startsWith('https://res.cloudinary.com/')) {
    return null;
  }
  const secret = process.env.JWT_SECRET || 'your-secret-key';
  const exp = Math.floor(Date.now() / 1000) + VIEW_TOKEN_TTL_SEC;
  const payload = `${url}\n${exp}`;
  const hmac = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `${exp}.${hmac}`;
}

/**
 * Verify document view token and return the URL if valid.
 * @param {string} url - Same URL that was signed
 * @param {string} token - Token from createDocumentViewToken
 * @returns {boolean} true if valid
 */
export function verifyDocumentViewToken(url, token) {
  if (!url || !token || typeof url !== 'string' || typeof token !== 'string') {
    return false;
  }
  if (!url.startsWith('https://res.cloudinary.com/')) {
    return false;
  }
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [expStr, hmac] = parts;
  const exp = parseInt(expStr, 10);
  if (isNaN(exp) || exp < Math.floor(Date.now() / 1000)) {
    return false; // expired
  }
  const secret = process.env.JWT_SECRET || 'your-secret-key';
  const payload = `${url}\n${exp}`;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const a = Buffer.from(hmac, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
