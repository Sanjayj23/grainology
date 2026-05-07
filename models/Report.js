import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema({
  report_type: {
    type: String,
    required: true,
    enum: ['supplier', 'vendor', 'order_tracking', 'transaction', 'performance', 'delivery_status']
  },
  report_title: {
    type: String,
    required: true
  },
  generated_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  report_data: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  date_from: Date,
  date_to: Date
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

const Report = mongoose.model('Report', reportSchema);

export default Report;

