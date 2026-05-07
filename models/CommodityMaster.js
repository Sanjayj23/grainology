import mongoose from 'mongoose';

const commodityMasterSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  description: String,
  category: {
    type: String,
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

const CommodityMaster = mongoose.model('CommodityMaster', commodityMasterSchema);

export default CommodityMaster;
