import express from 'express';
import WeatherData from '../models/WeatherData.js';
import User from '../models/User.js';
import { authenticate } from '../middleware/auth.js';
import { getCurrentWeather, getWeatherForecast } from '../services/weatherService.js';

const router = express.Router();

// Get weather forecast for a location (uses Open-Meteo API - free, no API key required)
router.get('/forecast', authenticate, async (req, res) => {
  try {
    const { location, state, days = 5 } = req.query;

    if (!location) {
      return res.status(400).json({ error: 'Location parameter is required' });
    }

    // No API key required - uses fallback coordinates database and Open-Meteo (both free)
    // Optional: Google Maps API key can be added for additional location lookup support

    const forecast = await getWeatherForecast(location, state || '', parseInt(days));
    
    // Optionally save to database for caching
    // Save each day's forecast to database
    for (const dayForecast of forecast.forecasts) {
      const existing = await WeatherData.findOne({
        location: forecast.location,
        date: new Date(dayForecast.date)
      });

      if (existing) {
        await WeatherData.findByIdAndUpdate(existing._id, {
          latitude: forecast.latitude,
          longitude: forecast.longitude,
          temperature_min: dayForecast.temperature_min,
          temperature_max: dayForecast.temperature_max,
          humidity: dayForecast.humidity,
          rainfall: dayForecast.rainfall,
          wind_speed: dayForecast.wind_speed,
          weather_condition: dayForecast.weather_condition,
          forecast_data: { ...dayForecast.forecast_data, state: forecast.state }
        });
      } else {
        await WeatherData.create({
          location: forecast.location,
          latitude: forecast.latitude,
          longitude: forecast.longitude,
          date: new Date(dayForecast.date),
          temperature_min: dayForecast.temperature_min,
          temperature_max: dayForecast.temperature_max,
          humidity: dayForecast.humidity,
          rainfall: dayForecast.rainfall,
          wind_speed: dayForecast.wind_speed,
          weather_condition: dayForecast.weather_condition,
          forecast_data: { ...dayForecast.forecast_data, state: forecast.state }
        });
      }
    }

    res.json(forecast);
  } catch (error) {
    console.error('Get weather forecast error:', error.message);
    
    // Handle rate limiting (429)
    if (error.message.includes('rate limit')) {
      return res.status(429).json({ 
        error: 'Rate limit exceeded',
        message: 'Too many requests to weather service. Please wait a few minutes and try again.'
      });
    }
    
    // Handle service unavailable
    if (error.message.includes('temporarily unavailable') || error.message.includes('unavailable')) {
      return res.status(503).json({ 
        error: 'Service unavailable',
        message: 'Weather service is temporarily unavailable. Please try again later.'
      });
    }
    
    // Return user-friendly error message
    if (error.message.includes('not found in coordinates database')) {
      return res.status(404).json({ 
        error: 'Location not found',
        message: error.message + ' Optional: Add GOOGLE_MAPS_API_KEY to your .env file for additional location support.'
      });
    }
    
    res.status(500).json({ 
      error: error.message || 'Failed to fetch weather forecast',
      message: 'Unable to fetch weather data. Please check the location and try again.'
    });
  }
});

// Get current weather for a location (uses Open-Meteo API - free, no API key required)
router.get('/current', authenticate, async (req, res) => {
  try {
    const { location, state } = req.query;

    if (!location) {
      return res.status(400).json({ error: 'Location parameter is required' });
    }

    // No API key required - uses fallback coordinates database and Open-Meteo (both free)
    // Optional: Google Maps API key can be added for additional location lookup support

    const currentWeather = await getCurrentWeather(location, state || '');
    res.json(currentWeather);
  } catch (error) {
    console.error('Get current weather error:', error.message);
    
    // Handle rate limiting (429)
    if (error.message.includes('rate limit')) {
      return res.status(429).json({ 
        error: 'Rate limit exceeded',
        message: 'Too many requests to weather service. Please wait a few minutes and try again.'
      });
    }
    
    // Handle service unavailable
    if (error.message.includes('temporarily unavailable') || error.message.includes('unavailable')) {
      return res.status(503).json({ 
        error: 'Service unavailable',
        message: 'Weather service is temporarily unavailable. Please try again later.'
      });
    }
    
    // Return user-friendly error message
    if (error.message.includes('not found in coordinates database')) {
      return res.status(404).json({ 
        error: 'Location not found',
        message: error.message + ' Optional: Add GOOGLE_MAPS_API_KEY to your .env file for additional location support.'
      });
    }
    
    res.status(500).json({ 
      error: error.message || 'Failed to fetch current weather',
      message: 'Unable to fetch weather data. Please check the location and try again.'
    });
  }
});

// Get states list
router.get('/states', authenticate, async (req, res) => {
  try {
    const { states } = await import('../data/indianStatesDistricts.js');
    res.json(states);
  } catch (error) {
    console.error('Get states error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch states' });
  }
});

// Get districts for a state
router.get('/districts/:state', authenticate, async (req, res) => {
  try {
    const { indianStatesDistricts } = await import('../data/indianStatesDistricts.js');
    const state = decodeURIComponent(req.params.state);
    const districts = indianStatesDistricts[state] || [];
    res.json(districts);
  } catch (error) {
    console.error('Get districts error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch districts' });
  }
});

// Get customer's default location (state/district)
router.get('/customer-location', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      state: user.state || '',
      district: user.district || ''
    });
  } catch (error) {
    console.error('Get customer location error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch customer location' });
  }
});

// Get all weather data (from database)
router.get('/', authenticate, async (req, res) => {
  try {
    const { location, date, date__gte } = req.query;
    const query = {};

    if (location) query.location = location;
    if (date) query.date = date;
    if (date__gte) {
      query.date = { $gte: new Date(date__gte) };
    }

    const weatherData = await WeatherData.find(query).sort({ date: 1, createdAt: -1 });
    res.json(weatherData);
  } catch (error) {
    console.error('Get weather data error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch weather data' });
  }
});

// Get weather data by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const weather = await WeatherData.findById(req.params.id);
    if (!weather) {
      return res.status(404).json({ error: 'Weather data not found' });
    }
    res.json(weather);
  } catch (error) {
    console.error('Get weather data error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch weather data' });
  }
});

// Create weather data
router.post('/', authenticate, async (req, res) => {
  try {
    const weather = new WeatherData(req.body);
    await weather.save();
    res.status(201).json(weather);
  } catch (error) {
    console.error('Create weather data error:', error);
    res.status(500).json({ error: error.message || 'Failed to create weather data' });
  }
});

export default router;

