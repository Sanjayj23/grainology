import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

let cachedKey = null;

function getEncryptionKey() {
  if (cachedKey) return cachedKey;

  const secret =
    process.env.PASSWORD_VIEW_SECRET ||
    process.env.JWT_SECRET ||
    'grainology-password-view-secret';

  // Derive a fixed 32-byte key from configured secret
  cachedKey = crypto.createHash('sha256').update(String(secret)).digest();
  return cachedKey;
}

export function encryptPassword(plainPassword) {
  if (typeof plainPassword !== 'string' || !plainPassword.length) return null;

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plainPassword, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `v1:${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decryptPassword(encryptedPassword) {
  if (typeof encryptedPassword !== 'string' || !encryptedPassword.startsWith('v1:')) {
    return null;
  }

  const parts = encryptedPassword.split(':');
  if (parts.length !== 4) return null;

  const [, ivB64, authTagB64, dataB64] = parts;

  try {
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');
    const encryptedData = Buffer.from(dataB64, 'base64');

    const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encryptedData),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  } catch (error) {
    console.error('Password decrypt error:', error.message);
    return null;
  }
}
