import mongoose from 'mongoose';

const qualityParameterSchema = new mongoose.Schema({
  commodity: {
    type: String,
    required: true
  },
  param_name: {
    type: String,
    required: true
  },
  unit: {
    type: String,
    required: true
  },
  standard: {
    type: String,
    required: true
  },
  remarks: {
    type: String,
    default: ''
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

const QualityParameter = mongoose.model('QualityParameter', qualityParameterSchema);

export default QualityParameter;

