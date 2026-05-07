import mongoose from 'mongoose';

const locationMasterSchema = new mongoose.Schema({
  state: {
    type: String,
    default: '',
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },
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

locationMasterSchema.index({ state: 1, name: 1 }, { unique: true, sparse: true });
locationMasterSchema.index({ updatedAt: -1 });

const LocationMaster = mongoose.model('LocationMaster', locationMasterSchema);

export default LocationMaster;
