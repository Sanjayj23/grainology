import mongoose from 'mongoose';

const saleOrderSchema = new mongoose.Schema({
  seller_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  commodity: {
    type: String,
    required: true
  },
  variety: String,
  quantity_mt: {
    type: Number,
    required: true
  },
  price_per_quintal: {
    type: Number,
    required: true
  },
  quality_report: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  delivery_location: {
    type: String,
    required: true
  },
  sauda_confirmation_date: String,
  delivery_timeline_days: Number,
  payment_terms: {
    type: String,
    enum: ['Advance', 'T+3 Days', 'Against Delivery'],
    default: 'Against Delivery'
  },
  status: {
    type: String,
    enum: ['Open', 'In Negotiation', 'Confirmed', 'Completed', 'Cancelled'],
    default: 'Open'
  },
  notes: String
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

saleOrderSchema.index({ updatedAt: -1 });

const SaleOrder = mongoose.model('SaleOrder', saleOrderSchema);

export default SaleOrder;
