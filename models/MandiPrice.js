import mongoose from 'mongoose';

const mandiPriceSchema = new mongoose.Schema({
  state: {
    type: String,
    required: true
  },
  district: {
    type: String,
    required: true
  },
  market: {
    type: String,
    required: true
  },
  commodity: {
    type: String,
    required: true
  },
  variety: String,
  min_price: {
    type: Number,
    required: true
  },
  max_price: {
    type: Number,
    required: true
  },
  modal_price: {
    type: Number,
    required: true
  },
  price_date: {
    type: Date,
    required: true
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

const MandiPrice = mongoose.model('MandiPrice', mandiPriceSchema);

export default MandiPrice;

