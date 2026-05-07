import mongoose from 'mongoose';

const logisticsProviderSchema = new mongoose.Schema({
  company_name: {
    type: String,
    required: true,
    trim: true
  },
  mobile_number: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    default: '',
    trim: true
  },
  address: {
    type: String,
    required: true,
    trim: true
  },
  district: {
    type: String,
    default: '',
    trim: true
  },
  state: {
    type: String,
    default: '',
    trim: true
  },
  country: {
    type: String,
    default: 'India',
    trim: true
  },
  pincode: {
    type: String,
    default: '',
    trim: true
  },
  is_active: {
    type: Boolean,
    default: true
  },
  // Legacy optional fields (kept for backward compatibility)
  contact_person: String,
  pickup_city: String,
  delivery_city: String,
  service_areas: [String],
  vehicle_types: [String],
  rate_per_km: Number,
  kyc_verified: { type: Boolean, default: false },
  kyc_documents: { type: mongoose.Schema.Types.Mixed, default: {} },
  pan_number: String,
  gst_number: String,
  notes: String,
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

const LogisticsProvider = mongoose.model('LogisticsProvider', logisticsProviderSchema);

export default LogisticsProvider;
