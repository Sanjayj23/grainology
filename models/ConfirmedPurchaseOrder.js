import mongoose from 'mongoose';

const confirmedPurchaseOrderSchema = new mongoose.Schema({
  customer_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  invoice_number: {
    type: String,
    required: true,
    unique: true
  },
  unique_id: {
    type: String,
    unique: true,
    sparse: true
  },
  trash: {
    type: Boolean,
    default: false,
    select: false
  },
  transaction_date: {
    type: String,
    required: true
  },
  state: {
    type: String,
    trim: true,
    uppercase: true
  },
  supplier_name: String, // Changed from seller_name
  location: String,
  warehouse_name: String,
  chamber_no: String,
  commodity: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },
  variety: {
    type: String,
    trim: true,
    uppercase: true
  },
  gate_pass_no: String,
  vehicle_no: {
    type: String,
    required: true
  },
  weight_slip_no: String,
  gross_weight_mt: Number, // Vehicle + Goods
  tare_weight_mt: Number, // Vehicle weight
  no_of_bags: Number,
  net_weight_mt: {
    type: Number,
    required: true
  },
  rate_per_mt: {
    type: Number,
    required: true
  },
  gross_amount: {
    type: Number,
    required: true
  },
  // Quality Parameters
  hlw_wheat: Number, // Hectolitre Weight
  excess_hlw: Number,
  deduction_amount_hlw: Number,
  moisture_moi: Number,
  excess_moisture: Number,
  bddi: Number, // Broken, Damage, Discolour, Immature (note: BDDI not BDOI)
  excess_bddi: Number,
  moi_bddi: Number,
  weight_deduction_kg: Number,
  deduction_amount_moi_bddi: Number,
  other_deductions: [{
    amount: Number,
    remarks: String
  }],
  total_deduction: Number,
  net_amount: {
    type: Number,
    required: true
  },
  quality_report: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  delivery_location: String,
  remarks: String,
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  approval_status: {
    type: String,
    enum: ['pending', 'approved', 'declined'],
    default: 'pending'
  },
  approved_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approved_at: { type: Date, default: null },
  declined_reason: { type: String, trim: true, default: '' }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;
      if (ret.trash !== undefined) delete ret.trash;
      return ret;
    }
  }
});

confirmedPurchaseOrderSchema.index({ updatedAt: -1 });

const ConfirmedPurchaseOrder = mongoose.model('ConfirmedPurchaseOrder', confirmedPurchaseOrderSchema);

export default ConfirmedPurchaseOrder;
