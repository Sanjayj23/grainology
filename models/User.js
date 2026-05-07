import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { encryptPassword, decryptPassword } from '../utils/passwordVault.js';

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: false, // Made optional - users can register without email
    // Note: unique index is created separately below with sparse: true
    // Do NOT use 'unique: true' here as it creates a non-sparse index
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  password_encrypted: {
    type: String,
    default: null,
    select: false
  },
  name: {
    type: String,
    required: true
  },
  trade_name: {
    type: String,
    trim: true
  },
  mobile_number: {
    type: String,
    required: true, // Now required for registration
    unique: true,
    trim: true
  },
  preferred_language: {
    type: String,
    default: 'English'
  },
  address_line1: String,
  address_line2: String,
  district: String,
  state: String,
  country: {
    type: String,
    default: 'India'
  },
  pincode: String,
  role: {
    type: String,
    required: true,
    enum: ['admin', 'super_admin', 'farmer', 'trader', 'fpo', 'corporate', 'miller', 'financer'],
    default: 'farmer'
  },
  approval_status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  approved_at: Date,
  declined_reason: { type: String, trim: true, default: '' },
  reentry_token_hash: { type: String, default: null, select: false },
  reentry_token_expires_at: { type: Date, default: null },
  reentry_link_generated_at: { type: Date, default: null },
  reentry_last_submitted_at: { type: Date, default: null },
  entity_type: {
    type: String,
    enum: ['individual', 'company'],
    default: 'individual'
  },
  kyc_status: {
    type: String,
    enum: ['not_started', 'pending', 'verified', 'rejected'],
    default: 'not_started'
  },
  kyc_verified_at: Date,
  kyc_data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  // Verification document IDs for uniqueness checking (indexes defined via schema.index() below)
  verification_documents: {
    aadhaar_number: { type: String, trim: true },
    pan_number: { type: String, trim: true, uppercase: true },
    gstin: { type: String, trim: true, uppercase: true },
    cin: { type: String, trim: true, uppercase: true }
  },
  // Uploaded verification document (for simple registration) – single, kept for backward compat
  uploaded_document: {
    document_type: {
      type: String,
      enum: ['aadhaar', 'pan', 'driving_license', 'voter_id', 'passport', 'gstin', 'cin', 'other'],
    },
    document_type_label: String, // when document_type is 'other', user can specify e.g. "Ration Card"
    cloudinary_url: String,
    cloudinary_public_id: String,
    view_url: String,
    download_url: String,
    file_name: String,
    file_size: Number,
    uploaded_at: Date,
  },
  // Multiple uploaded documents (user can choose multiple types; all selected must be uploaded)
  uploaded_documents: [{
    document_type: {
      type: String,
      enum: ['aadhaar', 'pan', 'driving_license', 'voter_id', 'passport', 'gstin', 'cin', 'other'],
    },
    document_type_label: String, // when document_type is 'other'
    cloudinary_url: String,
    cloudinary_public_id: String,
    view_url: String,
    download_url: String,
    file_name: String,
    file_size: Number,
    uploaded_at: Date,
  }],
  business_name: String,
  business_type: {
    type: String,
    enum: ['private_limited', 'partnership', 'proprietorship', 'llp']
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;
      delete ret.password;
      delete ret.password_encrypted;
      return ret;
    }
  }
});

// Create indexes for verification documents to ensure uniqueness
userSchema.index({ email: 1 }, { unique: true, sparse: true }); // sparse allows multiple null/undefined
userSchema.index({ 'verification_documents.aadhaar_number': 1 }, { unique: true, sparse: true });
userSchema.index({ 'verification_documents.pan_number': 1 }, { unique: true, sparse: true });
userSchema.index({ 'verification_documents.gstin': 1 }, { unique: true, sparse: true });
userSchema.index({ 'verification_documents.cin': 1 }, { unique: true, sparse: true });
userSchema.index({ reentry_token_hash: 1 }, { sparse: true });
userSchema.index({ updatedAt: -1 });
// mobile_number: unique index is created by schema field option above, do not duplicate here

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  try {
    const plainPassword = this.password;
    this.password_encrypted = encryptPassword(plainPassword);
    this.password = await bcrypt.hash(plainPassword, 10);
    next();
  } catch (error) {
    next(error);
  }
});

// Hash + encrypt password on findOneAndUpdate / findByIdAndUpdate
userSchema.pre('findOneAndUpdate', async function(next) {
  const update = this.getUpdate() || {};
  const directPassword = typeof update.password === 'string' ? update.password : null;
  const setPassword = typeof update.$set?.password === 'string' ? update.$set.password : null;
  const plainPassword = directPassword || setPassword;

  if (!plainPassword || /^\$2[aby]\$/.test(plainPassword)) {
    return next();
  }

  try {
    const hashedPassword = await bcrypt.hash(plainPassword, 10);
    const encryptedPassword = encryptPassword(plainPassword);

    if (directPassword) {
      update.password = hashedPassword;
      update.password_encrypted = encryptedPassword;
    } else {
      update.$set = update.$set || {};
      update.$set.password = hashedPassword;
      update.$set.password_encrypted = encryptedPassword;
    }

    this.setUpdate(update);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Return stored original password when available (for super-admin support flows)
userSchema.methods.getDecryptedPassword = function() {
  return decryptPassword(this.password_encrypted);
};

const User = mongoose.model('User', userSchema);

export default User;
