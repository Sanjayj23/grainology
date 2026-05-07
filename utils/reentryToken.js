import crypto from 'crypto';

const DEFAULT_REENTRY_TTL_HOURS = Number(process.env.REENTRY_LINK_TTL_HOURS || 72);

function sanitizeFrontendBaseUrl(rawUrl) {
  const fallback = 'http://localhost:5173';
  const base = String(rawUrl || process.env.FRONTEND_URL || fallback).trim();
  return base.replace(/\/+$/, '');
}

export function hashReentryToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

export function generateReentryToken() {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashReentryToken(token);
  const ttlHours = Number.isFinite(DEFAULT_REENTRY_TTL_HOURS) && DEFAULT_REENTRY_TTL_HOURS > 0
    ? DEFAULT_REENTRY_TTL_HOURS
    : 72;
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

  return {
    token,
    tokenHash,
    expiresAt,
  };
}

export function buildReentryUrl(token) {
  const baseUrl = sanitizeFrontendBaseUrl(process.env.FRONTEND_URL);
  return `${baseUrl}/register?reentry_token=${encodeURIComponent(String(token))}`;
}
