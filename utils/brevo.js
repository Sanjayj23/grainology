import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

dotenv.config();

// Brevo: use either API key (REST) or SMTP key (smtp-relay.brevo.com)
const BREVO_API_KEY = process.env.BREVO_API_KEY || '';
const BREVO_SMTP_KEY = process.env.BREVO_SMTP_KEY || '';
const BREVO_SMTP_USER = process.env.BREVO_SMTP_USER || 'a1e08c001@smtp-brevo.com'; // from Brevo SMTP & API → Your SMTP Settings
const FROM_EMAIL = process.env.BREVO_FROM_EMAIL || 'noreply@grainologyagri.com';
const FROM_NAME = process.env.BREVO_FROM_NAME || 'Grainology';

// Prefer REST API when BREVO_API_KEY (xkeysib-) is set – works on Render/cloud where SMTP port 587 may be blocked
const hasRestKey = Boolean(BREVO_API_KEY && BREVO_API_KEY.startsWith('xkeysib-'));
const useSmtp = !hasRestKey && (Boolean(BREVO_SMTP_KEY) || (BREVO_API_KEY && BREVO_API_KEY.startsWith('xsmtpsib-')));
const smtpPassword = BREVO_SMTP_KEY || (BREVO_API_KEY && BREVO_API_KEY.startsWith('xsmtpsib-') ? BREVO_API_KEY : '');
const apiKeyForRest = hasRestKey ? BREVO_API_KEY : (useSmtp ? '' : BREVO_API_KEY);

let transporter = null;

function getSmtpTransporter() {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false,
    auth: {
      user: BREVO_SMTP_USER,
      pass: smtpPassword,
    },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
  });
  return transporter;
}

/**
 * Send email via Brevo (REST API or SMTP)
 * @param {String} to - Recipient email
 * @param {String} subject - Email subject
 * @param {String} html - Email HTML content
 * @param {String} text - Email text content (optional)
 * @returns {Promise<Object>} Result with messageId or similar
 */
export async function sendEmail(to, subject, html, text = null) {
  if (apiKeyForRest) {
    return sendEmailApi(to, subject, html, text);
  }
  if (useSmtp && smtpPassword) {
    return sendEmailSmtp(to, subject, html, text);
  }
  console.warn('Brevo not configured (no BREVO_API_KEY or BREVO_SMTP_KEY). Email would be sent to:', to, 'Subject:', subject);
  return { messageId: 'mock-' + Date.now() };
}

/**
 * Send via Brevo REST API (api.brevo.com/v3/smtp/email)
 */
async function sendEmailApi(to, subject, html, text) {
  const body = {
    sender: { email: FROM_EMAIL, name: FROM_NAME },
    to: [{ email: to }],
    subject,
    htmlContent: html,
  };
  if (text) body.textContent = text;

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKeyForRest,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.message || `Brevo API ${response.status}`);
  }

  const data = await response.json().catch(() => ({}));
  console.log('Brevo email sent (API):', data.messageId);
  return data;
}

/**
 * Send via Brevo SMTP (smtp-relay.brevo.com:587)
 * Uses BREVO_SMTP_USER and BREVO_SMTP_KEY (or BREVO_API_KEY if it looks like xsmtpsib-)
 */
async function sendEmailSmtp(to, subject, html, text) {
  const transport = getSmtpTransporter();
  const mailOptions = {
    from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
    to,
    subject,
    html,
    text: text || undefined,
  };
  const info = await transport.sendMail(mailOptions);
  console.log('Brevo email sent (SMTP):', info.messageId);
  return { messageId: info.messageId };
}

/**
 * Send OTP email
 */
export async function sendOTPEmail(to, otp) {
  const subject = 'Your Grainology Verification OTP';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
        .otp-box { background: white; border: 2px dashed #10b981; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
        .otp { font-size: 32px; font-weight: bold; color: #059669; letter-spacing: 5px; }
        .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Grainology</h1>
          <p>Email Verification</p>
        </div>
        <div class="content">
          <h2>Hello!</h2>
          <p>Your verification OTP for Grainology account registration is:</p>
          <div class="otp-box">
            <div class="otp">${otp}</div>
          </div>
          <p>This OTP is valid for 10 minutes. Please do not share this OTP with anyone.</p>
          <p>If you didn't request this OTP, please ignore this email.</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Grainology. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  const text = `Your Grainology verification OTP is: ${otp}. This OTP is valid for 10 minutes.`;
  return sendEmail(to, subject, html, text);
}

/**
 * Send welcome/approval email (after admin approval).
 * @param {string} to - Recipient email
 * @param {string} name - User's name
 * @param {string} loginId - Login ID (email or mobile) to show in the email
 * @param {string} [passwordNote] - Note about password (e.g. "Use the password you set during registration.")
 */
export async function sendWelcomeEmail(to, name, loginId, passwordNote) {
  const loginUrl = `${process.env.FRONTEND_URL || 'https://grainologyagri.com'}/login`;
  const subject = 'Your Grainology Account Has Been Approved';
  const credentialsHtml = loginId
    ? `
    <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin: 20px 0;">
      <p style="margin: 0 0 8px 0; font-weight: 600;">Your login details:</p>
      <p style="margin: 0 0 4px 0;"><strong>Login ID:</strong> ${loginId}</p>
      <p style="margin: 0;">${passwordNote || 'Use the password you set during registration.'}</p>
    </div>`
    : '';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; background: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: 600; }
        .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Account Approved</h1>
        </div>
        <div class="content">
          <p>Dear ${name},</p>
          <p>We are pleased to inform you that your registration has been approved. You may now log in to Grainology and access the platform.</p>
          ${credentialsHtml}
          <p style="text-align: center;">
            <a href="${loginUrl}" class="button">Login</a>
          </p>
          <p>If you have any questions, please contact our support team.</p>
          <p>Regards,<br><strong>The Grainology Team</strong></p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Grainology. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  const text = `Dear ${name}, Your Grainology account has been approved. Login ID: ${loginId || 'your registered email'}. ${passwordNote || 'Use the password you set during registration.'} Login at: ${loginUrl}`;
  return sendEmail(to, subject, html, text);
}

/**
 * Send "waiting for approval" email after registration
 */
export async function sendWaitingForApprovalEmail(to, name, loginId, passwordNote) {
  const subject = 'Grainology – Registration Received, Pending Approval';
  const credentialsHtml = loginId
    ? `
          <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <p style="margin: 0 0 8px 0; font-weight: 600;">Your login details (after approval):</p>
            <p style="margin: 0 0 4px 0;"><strong>Login ID:</strong> ${loginId}</p>
            <p style="margin: 0;">${passwordNote || 'Use the password you set during registration.'}</p>
          </div>`
    : '';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
        .notice { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 20px 0; border-radius: 4px; }
        .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Grainology</h1>
          <p>Registration Received</p>
        </div>
        <div class="content">
          <h2>Hello ${name}!</h2>
          <p>Thank you for registering with Grainology.</p>
          ${credentialsHtml}
          <div class="notice">
            <strong>Please wait for approval.</strong> Your account is under review. You will receive an email once an admin approves your account. Until then, you will not be able to log in.
          </div>
          <p>If you have any questions, contact our support team.</p>
          <p><strong>The Grainology Team</strong></p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Grainology. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  const credentialsText = loginId
    ? ` Login ID: ${loginId}. ${passwordNote || 'Use the password you set during registration.'}`
    : '';
  const text = `Hello ${name}, your Grainology registration is received.${credentialsText} Please wait for admin approval. You will get an email when your account is approved.`;
  return sendEmail(to, subject, html, text);
}
