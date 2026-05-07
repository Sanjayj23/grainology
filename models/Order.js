import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
  offer_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Offer',
    required: true
  },
  buyer_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  quantity_mt: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['Pending Approval', 'Approved', 'Approved - Awaiting Logistics', 'Completed', 'Rejected'],
    default: 'Pending Approval'
  },
  final_price_per_quintal: {
    type: Number,
    required: true
  },
  deduction_amount: {
    type: Number,
    default: 0
  },
  sauda_confirmation_date: String
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

const Order = mongoose.model('Order', orderSchema);

export default Order;

