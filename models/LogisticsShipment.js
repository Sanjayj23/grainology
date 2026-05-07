import mongoose from 'mongoose';

const logisticsShipmentSchema = new mongoose.Schema({
  order_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  transporter_name: String,
  vehicle_number: String,
  driver_name: String,
  driver_contact: String,
  pickup_location: {
    type: String,
    required: true
  },
  delivery_location: {
    type: String,
    required: true
  },
  pickup_date: Date,
  expected_delivery_date: Date,
  actual_delivery_date: Date,
  status: {
    type: String,
    enum: ['pending', 'in_transit', 'delivered', 'cancelled'],
    default: 'pending'
  },
  tracking_updates: {
    type: [mongoose.Schema.Types.Mixed],
    default: []
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

const LogisticsShipment = mongoose.model('LogisticsShipment', logisticsShipmentSchema);

export default LogisticsShipment;

