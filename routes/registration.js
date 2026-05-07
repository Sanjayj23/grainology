import express from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import User from '../models/User.js';
import { uploadToCloudinary } from '../utils/cloudinary.js';
// WhatsApp OTP disabled - OTP only via email when user provides email
// import { sendWhatsAppOTP, sendWhatsAppMessage } from '../utils/whatsapp.js';
import { sendOTPEmail, sendWaitingForApprovalEmail } from '../utils/brevo.js';
import { generateOTP, storeOTP, verifyOTP } from '../utils/otp.js';
import { hashReentryToken } from '../utils/reentryToken.js';

const router = express.Router();

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

// Helper function to check DB connection
const checkDB = (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ 
      error: 'Database not connected',
      message: 'Please check your MongoDB connection.'
    });
  }
  return null;
};

// All document types available for any user (FPO, Farmer, Corporate, etc.) – user selects via checkboxes
const ALL_DOCUMENT_OPTIONS = [
  'aadhaar', 'pan', 'driving_license', 'voter_id', 'passport',
  'gstin', 'cin', 'other'
];
const DOCUMENT_OPTIONS = {
  farmer: ['aadhaar', 'pan', 'driving_license', 'voter_id'],
  trader: ['aadhaar', 'pan', 'gstin', 'driving_license'],
  fpo: ['aadhaar', 'pan', 'gstin', 'cin'],
  corporate: ['gstin', 'cin', 'pan'],
  miller: ['aadhaar', 'pan', 'gstin', 'driving_license'],
  financer: ['aadhaar', 'pan', 'gstin', 'driving_license'],
};

// Step 1: Send WhatsApp OTP - DISABLED (OTP only via email when user provides email)
// router.post('/send-whatsapp-otp', async (req, res) => {
//   try {
//     const dbError = checkDB(req, res);
//     if (dbError) return;
//     const { mobile_number } = req.body;
//     if (!mobile_number) {
//       return res.status(400).json({ error: 'Mobile number is required' });
//     }
//     const cleanMobile = mobile_number.trim().replace(/\D/g, '');
//     if (cleanMobile.length !== 10) {
//       return res.status(400).json({ error: 'Mobile number must be 10 digits' });
//     }
//     const existingUser = await User.findOne({ mobile_number: cleanMobile });
//     if (existingUser) {
//       return res.status(400).json({ error: 'User with this mobile number already exists' });
//     }
//     const otp = generateOTP();
//     storeOTP(`whatsapp_${cleanMobile}`, otp, 10);
//     const phoneWithCountryCode = `91${cleanMobile}`;
//     try {
//       await sendWhatsAppOTP(phoneWithCountryCode, otp);
//       console.log(`WhatsApp OTP sent to ${cleanMobile}`);
//     } catch (whatsappError) {
//       console.error('WhatsApp OTP send error:', whatsappError);
//     }
//     res.json({
//       success: true,
//       message: 'OTP sent to WhatsApp number',
//       mobile_number: cleanMobile,
//     });
//   } catch (error) {
//     console.error('Send WhatsApp OTP error:', error);
//     res.status(500).json({ error: 'Failed to send OTP' });
//   }
// });

// Step 2: Send Email OTP (if email provided)
router.post('/send-email-otp', async (req, res) => {
  try {
    const dbError = checkDB(req, res);
    if (dbError) return;

    const { email, reentry_token } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const cleanEmail = email.trim().toLowerCase();
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Check if user already exists. Allow only if this is a valid rejected re-entry for the same email.
    const existingUser = await User.findOne({ email: cleanEmail }).select('_id email approval_status reentry_token_hash reentry_token_expires_at');
    if (existingUser) {
      if (!reentry_token) {
        return res.status(400).json({ error: 'User with this email already exists' });
      }

      const tokenHash = hashReentryToken(reentry_token);
      const isValidReentryUser = existingUser.approval_status === 'rejected'
        && existingUser.reentry_token_hash === tokenHash
        && existingUser.reentry_token_expires_at
        && new Date(existingUser.reentry_token_expires_at).getTime() > Date.now();

      if (!isValidReentryUser) {
        return res.status(400).json({ error: 'User with this email already exists' });
      }
    }

    // Generate and store OTP
    const otp = generateOTP();
    storeOTP(`email_${cleanEmail}`, otp, 10); // 10 minutes expiry

    // Send OTP via Email
    try {
      await sendOTPEmail(cleanEmail, otp);
      console.log(`Email OTP sent to ${cleanEmail}`);
    } catch (emailError) {
      console.error('Email OTP send error:', emailError);
      // Still return success if email fails (for development)
    }

    res.json({
      success: true,
      message: 'OTP sent to email',
      email: cleanEmail,
    });
  } catch (error) {
    console.error('Send Email OTP error:', error);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

const DOCUMENT_TYPE_LABELS = {
  cin: 'Incorporation Certificate',
  aadhaar: 'Aadhaar',
  pan: 'PAN',
  driving_license: 'Driving License',
  voter_id: 'Voter ID',
  passport: 'Passport',
  gstin: 'GSTIN',
  other: 'Other',
};

const INVALID_REENTRY_LINK_MESSAGE = 'Invalid or expired re-entry link. Ask Admin for a fresh link.';

function parseDocumentTypes(documentTypesRaw, singleDocumentType) {
  let docTypes = [];
  if (documentTypesRaw) {
    if (typeof documentTypesRaw === 'string') {
      docTypes = JSON.parse(documentTypesRaw);
    } else if (Array.isArray(documentTypesRaw)) {
      docTypes = documentTypesRaw;
    }
  }
  if (docTypes.length === 0 && singleDocumentType) docTypes = [singleDocumentType];
  return docTypes;
}

function getRequestFiles(req) {
  return req.files && req.files.length ? req.files : (req.file ? [req.file] : []);
}

async function uploadVerificationDocuments(files, docTypes, userType, otherDocumentLabel) {
  const otherLabel = (otherDocumentLabel && String(otherDocumentLabel).trim()) || '';
  const uploadedDocs = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const docType = docTypes[i] || 'other';
    const uploadResult = await uploadToCloudinary(
      file.buffer,
      file.originalname,
      `grainology/verification/${userType}/${docType}`
    );

    const docEntry = {
      document_type: docType,
      cloudinary_url: uploadResult.url,
      cloudinary_public_id: uploadResult.public_id,
      view_url: uploadResult.view_url,
      download_url: uploadResult.download_url,
      file_name: file.originalname,
      file_size: uploadResult.bytes,
      uploaded_at: new Date(),
    };
    if (docType === 'other' && otherLabel) docEntry.document_type_label = otherLabel;
    uploadedDocs.push(docEntry);
  }

  return uploadedDocs;
}

// Step 3: Get ALL document options (same list for every role – user picks multiple via checkboxes)
router.post('/get-document-options', async (req, res) => {
  try {
    res.json({
      success: true,
      document_options: ALL_DOCUMENT_OPTIONS.map(doc => ({
        value: doc,
        label: DOCUMENT_TYPE_LABELS[doc] || doc.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      })),
    });
  } catch (error) {
    console.error('Get document options error:', error);
    res.status(500).json({ error: 'Failed to get document options' });
  }
});

// Re-entry: fetch prefill data for rejected registration
router.get('/reentry/:token', async (req, res) => {
  try {
    const dbError = checkDB(req, res);
    if (dbError) return;

    const rawToken = String(req.params.token || '').trim();
    if (!rawToken) {
      return res.status(400).json({ error: INVALID_REENTRY_LINK_MESSAGE });
    }

    const tokenHash = hashReentryToken(rawToken);
    const user = await User.findOne({
      approval_status: 'rejected',
      reentry_token_hash: tokenHash,
      reentry_token_expires_at: { $gt: new Date() },
    }).select(
      'name trade_name mobile_number email role address_line1 address_line2 district state country pincode declined_reason uploaded_documents uploaded_document reentry_token_expires_at'
    );

    if (!user) {
      return res.status(404).json({ error: INVALID_REENTRY_LINK_MESSAGE });
    }

    const documentTypes = Array.from(new Set(
      (Array.isArray(user.uploaded_documents) && user.uploaded_documents.length
        ? user.uploaded_documents
        : (user.uploaded_document ? [user.uploaded_document] : [])
      )
        .map((doc) => doc?.document_type)
        .filter(Boolean)
    ));

    return res.json({
      success: true,
      prefill: {
        name: user.name || '',
        trade_name: user.trade_name || '',
        mobile_number: user.mobile_number || '',
        email: user.email || '',
        user_type: user.role || '',
        address_line1: user.address_line1 || '',
        address_line2: user.address_line2 || '',
        district: user.district || '',
        state: user.state || '',
        country: user.country || 'India',
        pincode: user.pincode || '',
        document_types: documentTypes,
        declined_reason: user.declined_reason || '',
        reentry_expires_at: user.reentry_token_expires_at || null,
      }
    });
  } catch (error) {
    console.error('Get re-entry data error:', error);
    return res.status(500).json({ error: error.message || 'Failed to load re-entry form' });
  }
});

// Re-entry: submit corrected registration and send back to Super Admin approval queue
router.post('/reentry/:token', upload.array('documents', 10), async (req, res) => {
  try {
    const dbError = checkDB(req, res);
    if (dbError) return;

    const rawToken = String(req.params.token || '').trim();
    if (!rawToken) {
      return res.status(400).json({ error: INVALID_REENTRY_LINK_MESSAGE });
    }

    const tokenHash = hashReentryToken(rawToken);
    const existingRejectedUser = await User.findOne({
      approval_status: 'rejected',
      reentry_token_hash: tokenHash,
      reentry_token_expires_at: { $gt: new Date() },
    }).select('_id email');

    if (!existingRejectedUser) {
      return res.status(404).json({ error: INVALID_REENTRY_LINK_MESSAGE });
    }

    const {
      name,
      trade_name,
      same_as_name,
      mobile_number,
      email,
      password,
      user_type,
      document_types,
      document_type,
      email_otp,
      address_line1,
      address_line2,
      district,
      state,
      country,
      pincode,
      other_document_label,
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    if (!mobile_number) {
      return res.status(400).json({ error: 'Mobile number is required' });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password is required and must be at least 6 characters' });
    }

    if (!user_type) {
      return res.status(400).json({ error: 'User type is required' });
    }

    let docTypes = [];
    try {
      docTypes = parseDocumentTypes(document_types, document_type);
    } catch (_) {
      return res.status(400).json({ error: 'Invalid document_types format' });
    }
    if (docTypes.length === 0) {
      return res.status(400).json({ error: 'Select at least one document type to upload' });
    }

    const files = getRequestFiles(req);
    if (files.length !== docTypes.length) {
      return res.status(400).json({ error: `Upload a file for each selected document (${docTypes.length} selected, ${files.length} received)` });
    }

    const cleanMobile = mobile_number.trim().replace(/\D/g, '');
    if (cleanMobile.length !== 10) {
      return res.status(400).json({ error: 'Mobile number must be 10 digits' });
    }

    let cleanEmail = null;
    if (email) {
      cleanEmail = email.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanEmail)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }
      const existingEmail = String(existingRejectedUser.email || '').toLowerCase();
      const sameEmailAsCurrentRecord = existingEmail && cleanEmail === existingEmail;
      if (!sameEmailAsCurrentRecord) {
        if (!email_otp) {
          return res.status(400).json({ error: 'Email OTP is required when email is provided' });
        }
        const emailOTPResult = verifyOTP(`email_${cleanEmail}`, email_otp);
        if (!emailOTPResult.valid) {
          return res.status(400).json({ error: emailOTPResult.message });
        }
      }
    }

    const duplicateMobileUser = await User.findOne({
      mobile_number: cleanMobile,
      _id: { $ne: existingRejectedUser._id }
    });
    if (duplicateMobileUser) {
      return res.status(400).json({ error: 'User with this mobile number already exists' });
    }

    if (cleanEmail) {
      const duplicateEmailUser = await User.findOne({
        email: cleanEmail,
        _id: { $ne: existingRejectedUser._id }
      });
      if (duplicateEmailUser) {
        return res.status(400).json({ error: 'User with this email already exists' });
      }
    }

    let uploadedDocs = [];
    try {
      uploadedDocs = await uploadVerificationDocuments(files, docTypes, user_type, other_document_label);
    } catch (uploadError) {
      console.error('Cloudinary upload error:', uploadError);
      return res.status(500).json({ error: 'Failed to upload documents. Please try again.' });
    }

    const finalTradeName = same_as_name === 'true' || same_as_name === true
      ? name.trim()
      : (trade_name && trade_name.trim()) || undefined;

    const setPayload = {
      name: name.trim(),
      mobile_number: cleanMobile,
      password,
      role: user_type,
      entity_type: 'individual',
      kyc_status: 'pending',
      approval_status: 'pending',
      approved_at: null,
      declined_reason: '',
      uploaded_documents: uploadedDocs,
      uploaded_document: uploadedDocs[0] || null,
      reentry_token_hash: null,
      reentry_token_expires_at: null,
      reentry_link_generated_at: null,
      reentry_last_submitted_at: new Date(),
      address_line1: address_line1 && address_line1.trim() ? address_line1.trim() : undefined,
      address_line2: address_line2 && address_line2.trim() ? address_line2.trim() : undefined,
      district: district && district.trim() ? district.trim() : undefined,
      state: state && state.trim() ? state.trim() : undefined,
      country: country && country.trim() ? country.trim() : 'India',
      pincode: pincode && String(pincode).trim() ? String(pincode).trim() : undefined,
      trade_name: finalTradeName || undefined,
    };
    if (cleanEmail) {
      setPayload.email = cleanEmail;
    }

    const updatePayload = { $set: setPayload };
    if (!cleanEmail) {
      updatePayload.$unset = { email: 1 };
    }

    const user = await User.findByIdAndUpdate(existingRejectedUser._id, updatePayload, {
      new: true,
      runValidators: true,
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (cleanEmail) {
      try {
        const loginId = cleanEmail || cleanMobile;
        const passwordNote = `Password: ${password}`;
        await sendWaitingForApprovalEmail(cleanEmail, name.trim(), loginId, passwordNote);
        console.log(`Re-entry waiting-for-approval email sent to ${cleanEmail}`);
      } catch (emailError) {
        console.error('Re-entry waiting-for-approval email error:', emailError);
      }
    }

    const userObj = user.toJSON();
    return res.status(200).json({
      success: true,
      message: 'Registration re-submitted successfully. Please wait for Super Admin approval.',
      requires_approval: true,
      user: {
        id: user._id.toString(),
        mobile_number: user.mobile_number,
        email: user.email || null,
        approval_status: 'pending',
        ...userObj
      }
    });
  } catch (error) {
    console.error('Re-entry registration error:', error);

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.join(', '),
      });
    }

    if (error.code === 11000) {
      if (error.keyPattern?.mobile_number) {
        return res.status(400).json({ error: 'User with this mobile number already exists' });
      }
      if (error.keyPattern?.email) {
        return res.status(400).json({ error: 'User with this email already exists' });
      }
    }

    return res.status(500).json({ error: error.message || 'Failed to re-submit registration' });
  }
});

// Step 4: Complete Registration with OTP verification and document upload(s)
router.post('/register', upload.array('documents', 10), async (req, res) => {
  try {
    const dbError = checkDB(req, res);
    if (dbError) return;

    const {
      name,
      trade_name,
      same_as_name,
      mobile_number,
      email,
      password,
      user_type,
      document_types,
      document_type,
      email_otp,
      address_line1,
      address_line2,
      district,
      state,
      country,
      pincode,
      other_document_label,
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    if (!mobile_number) {
      return res.status(400).json({ error: 'Mobile number is required' });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password is required and must be at least 6 characters' });
    }

    if (!user_type) {
      return res.status(400).json({ error: 'User type is required' });
    }

    let docTypes = [];
    if (document_types) {
      try {
        docTypes = typeof document_types === 'string' ? JSON.parse(document_types) : document_types;
      } catch (_) {
        return res.status(400).json({ error: 'Invalid document_types format' });
      }
    }
    if (docTypes.length === 0 && document_type) docTypes = [document_type];
    if (docTypes.length === 0) {
      return res.status(400).json({ error: 'Select at least one document type to upload' });
    }

    const files = req.files && req.files.length ? req.files : (req.file ? [req.file] : []);
    if (files.length !== docTypes.length) {
      return res.status(400).json({ error: `Upload a file for each selected document (${docTypes.length} selected, ${files.length} received)` });
    }

    // Clean mobile number
    const cleanMobile = mobile_number.trim().replace(/\D/g, '');
    if (cleanMobile.length !== 10) {
      return res.status(400).json({ error: 'Mobile number must be 10 digits' });
    }

    // Verify Email OTP only if email was provided (OTP sent to email for verification)
    let cleanEmail = null;
    if (email) {
      cleanEmail = email.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanEmail)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }

      if (!email_otp) {
        return res.status(400).json({ error: 'Email OTP is required when email is provided' });
      }

      const emailOTPResult = verifyOTP(`email_${cleanEmail}`, email_otp);
      if (!emailOTPResult.valid) {
        return res.status(400).json({ error: emailOTPResult.message });
      }
    }

    // Check if user already exists
    const existingUserByMobile = await User.findOne({ mobile_number: cleanMobile });
    if (existingUserByMobile) {
      return res.status(400).json({ error: 'User with this mobile number already exists' });
    }

    if (cleanEmail) {
      const existingUserByEmail = await User.findOne({ email: cleanEmail });
      if (existingUserByEmail) {
        return res.status(400).json({ error: 'User with this email already exists' });
      }
    }

    const otherLabel = (other_document_label && String(other_document_label).trim()) || '';
    const uploadedDocs = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const docType = docTypes[i] || 'other';
      try {
        const uploadResult = await uploadToCloudinary(
          file.buffer,
          file.originalname,
          `grainology/verification/${user_type}/${docType}`
        );
        const docEntry = {
          document_type: docType,
          cloudinary_url: uploadResult.url,
          cloudinary_public_id: uploadResult.public_id,
          view_url: uploadResult.view_url,
          download_url: uploadResult.download_url,
          file_name: file.originalname,
          file_size: uploadResult.bytes,
          uploaded_at: new Date(),
        };
        if (docType === 'other' && otherLabel) docEntry.document_type_label = otherLabel;
        uploadedDocs.push(docEntry);
      } catch (uploadError) {
        console.error('Cloudinary upload error:', uploadError);
        return res.status(500).json({ error: `Failed to upload ${docType} document. Please try again.` });
      }
    }

    const finalTradeName = same_as_name === 'true' || same_as_name === true
      ? name.trim()
      : (trade_name && trade_name.trim()) || undefined;

    const userData = {
      name: name.trim(),
      mobile_number: cleanMobile,
      password,
      role: user_type,
      entity_type: 'individual',
      kyc_status: 'pending',
      approval_status: 'pending',
      uploaded_documents: uploadedDocs,
      uploaded_document: uploadedDocs[0] || null,
    };
    if (finalTradeName) userData.trade_name = finalTradeName;
    if (cleanEmail) userData.email = cleanEmail;
    if (address_line1 && address_line1.trim()) userData.address_line1 = address_line1.trim();
    if (address_line2 && address_line2.trim()) userData.address_line2 = address_line2.trim();
    if (district && district.trim()) userData.district = district.trim();
    if (state && state.trim()) userData.state = state.trim();
    if (country && country.trim()) userData.country = country.trim();
    if (pincode && String(pincode).trim()) userData.pincode = String(pincode).trim();

    const user = new User(userData);
    await user.save();

    // Send "waiting for approval" email if user has email (no login until admin approves)
    if (cleanEmail) {
      try {
        const loginId = cleanEmail || cleanMobile;
        const passwordNote = `Password: ${password}`;
        await sendWaitingForApprovalEmail(cleanEmail, name.trim(), loginId, passwordNote);
        console.log(`Waiting-for-approval email sent to ${cleanEmail}`);
      } catch (emailError) {
        console.error('Waiting-for-approval email error:', emailError);
      }
    }

    // Do NOT return session/token - user must wait for admin approval before they can login
    const userObj = user.toJSON();
    res.status(201).json({
      success: true,
      message: 'Registration successful. Please wait for admin approval. You will receive an email when your account is approved.',
      requires_approval: true,
      user: {
        id: user._id.toString(),
        mobile_number: user.mobile_number,
        email: user.email || null,
        approval_status: 'pending',
        ...userObj
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        error: 'Validation failed',
        details: errors.join(', '),
      });
    }
    
    if (error.code === 11000) {
      if (error.keyPattern?.mobile_number) {
        return res.status(400).json({ error: 'User with this mobile number already exists' });
      } else if (error.keyPattern?.email) {
        return res.status(400).json({ error: 'User with this email already exists' });
      }
    }
    
    res.status(500).json({ error: error.message || 'Failed to register user' });
  }
});

export default router;
