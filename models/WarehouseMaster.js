import mongoose from 'mongoose';

const warehouseMasterSchema = new mongoose.Schema({
  location_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LocationMaster',
    default: null
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

warehouseMasterSchema.index({ location_id: 1, name: 1 }, { unique: true, sparse: true });
warehouseMasterSchema.index({ updatedAt: -1 });

const WarehouseMaster = mongoose.model('WarehouseMaster', warehouseMasterSchema);

export default WarehouseMaster;
