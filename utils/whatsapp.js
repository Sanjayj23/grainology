import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL || '';
const WHATSAPP_API_KEY = process.env.WHATSAPP_API_KEY || '';
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';

/**
 * Send WhatsApp message
 * @param {String} to - Recipient phone number (with country code, e.g., 919876543210)
 * @param {String} message - Message text
 * @returns {Promise<Object>} API response
 */
export async function sendWhatsAppMessage(to, message) {
  try {
    if (!WHATSAPP_API_URL || !WHATSAPP_API_KEY || !WHATSAPP_PHONE_NUMBER_ID) {
      console.warn('WhatsApp API not configured. Message would be sent to:', to);
      console.warn('Message:', message);
      return { success: false, message: 'WhatsApp API not configured', id: 'mock-' + Date.now() };
    }

    // Clean phone number (remove + and spaces)
    const cleanPhone = to.replace(/[+\s]/g, '');

    const response = await axios.post(
      `${WHATSAPP_API_URL}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to: cleanPhone,
        type: 'text',
        text: {
          body: message,
        },
      },
      {
        headers: {
          'Authorization': `Bearer ${WHATSAPP_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('WhatsApp message sent successfully:', response.data);
    return { success: true, ...response.data };
  } catch (error) {
    console.error('Error sending WhatsApp message:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Send OTP via WhatsApp
 * @param {String} phoneNumber - Recipient phone number (with country code)
 * @param {String} otp - 6-digit OTP
 * @returns {Promise<Object>} API response
 */
export async function sendWhatsAppOTP(phoneNumber, otp) {
  const message = `Your Grainology verification OTP is: *${otp}*\n\nThis OTP is valid for 10 minutes. Please do not share this OTP with anyone.\n\nIf you didn't request this OTP, please ignore this message.\n\n- Grainology Team`;
  
  return sendWhatsAppMessage(phoneNumber, message);
}

export default {
  sendWhatsAppMessage,
  sendWhatsAppOTP,
};
