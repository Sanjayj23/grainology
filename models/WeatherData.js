import mongoose from 'mongoose';

const weatherDataSchema = new mongoose.Schema({
  location: {
    type: String,
    required: true
  },
  latitude: Number,
  longitude: Number,
  date: {
    type: Date,
    required: true
  },
  temperature_min: Number,
  temperature_max: Number,
  humidity: Number,
  rainfall: Number,
  wind_speed: Number,
  weather_condition: String,
  forecast_data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
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

const WeatherData = mongoose.model('WeatherData', weatherDataSchema);

export default WeatherData;

