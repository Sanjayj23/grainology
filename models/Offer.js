import mongoose from 'mongoose';

const offerSchema = new mongoose.Schema({
  seller_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  commodity: {
    type: String,
    required: true
  },
  variety: {
    type: String,
    required: true
  },
  quantity_mt: {
    type: Number,
    required: true
  },
  price_per_quintal: {
    type: Number,
    required: true
  },
  location: {
    type: String,
    required: true
  },
  quality_report: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  status: {
    type: String,
    enum: ['Active', 'Sold', 'Inactive'],
    default: 'Active'
  },
  min_trade_quantity_mt: {
    type: Number,
    default: 0
  },
  payment_terms: {
    type: String,
    enum: ['Advance', 'T+3 Days', 'Against Delivery'],
    default: 'Against Delivery'
  },
  offer_validity_days: {
    type: Number,
    default: 30
  },
  delivery_location: {
    type: String,
    required: true
  },
  sauda_confirmation_date: String,
  logistics_option: {
    type: String,
    enum: ['Seller Arranged', 'Buyer Arranged', 'Platform Arranged'],
    default: 'Platform Arranged'
  },
  delivery_timeline_days: {
    type: Number,
    default: 7
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

const Offer = mongoose.model('Offer', offerSchema);

export default Offer;

