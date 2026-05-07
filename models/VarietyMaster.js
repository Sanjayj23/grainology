import mongoose from 'mongoose';

const varietyMasterSchema = new mongoose.Schema({
  commodity_name: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },
  variety_name: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },
  description: String,
  is_active: {
    type: Boolean,
    default: true
  },
  approval_status: {
    type: String,
    enum: ['pending', 'approved', 'declined'],
    default: 'pending'
  },
  approved_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approved_at: { type: Date, default: null },
  declined_reason: { type: String, trim: true, default: '' },
  submitted_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
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

varietyMasterSchema.index({ commodity_name: 1, variety_name: 1 }, { unique: true });

const VarietyMaster = mongoose.model('VarietyMaster', varietyMasterSchema);

export default VarietyMaster;
