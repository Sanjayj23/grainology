import mongoose from 'mongoose';

const logisticsLocationMasterSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
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
    default: '',
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
  last_seen_at: {
    type: Date,
    default: Date.now
  }
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

logisticsLocationMasterSchema.index({ district: 1, state: 1, country: 1, pincode: 1 });
logisticsLocationMasterSchema.index({ updatedAt: -1 });

const LogisticsLocationMaster = mongoose.model('LogisticsLocationMaster', logisticsLocationMasterSchema);

export default LogisticsLocationMaster;
