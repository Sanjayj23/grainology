// Weather service using Open-Meteo Weather API (free, no API key required)
// Optional: Google Maps Geocoding API for location lookup (falls back to coordinates database if not available)
import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Google Maps API key for geocoding (optional - will use fallback coordinates if not provided)
const GOOGLE_API_KEY = (process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY || process.env.WEATHER_API_KEY || '').trim();

// Open-Meteo Weather API base URL (free, no API key required)
const OPEN_METEO_BASE_URL = 'https://api.open-meteo.com/v1';

// Fallback coordinates for major Indian cities and districts (when Geocoding API fails)
// Includes all major districts from all states and all Bihar districts
const INDIAN_CITY_COORDINATES = {
  // Maharashtra
  'Mumbai': { lat: 19.0760, lon: 72.8777 },
  'Pune': { lat: 18.5204, lon: 73.8567 },
  'Nagpur': { lat: 21.1458, lon: 79.0882 },
  'Nashik': { lat: 19.9975, lon: 73.7898 },
  'Aurangabad': { lat: 19.8762, lon: 75.3433 },
  'Solapur': { lat: 17.6599, lon: 75.9064 },
  'Amravati': { lat: 20.9374, lon: 77.7796 },
  'Kolhapur': { lat: 16.7050, lon: 74.2433 },
  'Sangli': { lat: 16.8524, lon: 74.5815 },
  'Jalgaon': { lat: 21.0486, lon: 75.5685 },
  
  // Bihar - All Districts
  'Patna': { lat: 25.5941, lon: 85.1376 },
  'Gaya': { lat: 24.7969, lon: 84.9924 },
  'Bhagalpur': { lat: 25.2445, lon: 86.9718 },
  'Muzaffarpur': { lat: 26.1209, lon: 85.3647 },
  'Purnia': { lat: 25.7777, lon: 87.4750 },
  'Darbhanga': { lat: 26.1526, lon: 85.8970 },
  'Arrah': { lat: 25.5560, lon: 84.6633 },
  'Begusarai': { lat: 25.4180, lon: 86.1289 },
  'Katihar': { lat: 25.5333, lon: 87.5833 },
  'Munger': { lat: 25.3750, lon: 86.4667 },
  'Sitamarhi': { lat: 26.6000, lon: 85.4833 },
  'Saharsa': { lat: 25.8833, lon: 86.6000 },
  'Samastipur': { lat: 25.8500, lon: 85.7833 },
  'Madhubani': { lat: 26.3500, lon: 86.0833 },
  'Siwan': { lat: 26.2167, lon: 84.3667 },
  'Bettiah': { lat: 26.8000, lon: 84.5000 },
  'Motihari': { lat: 26.6500, lon: 84.9167 },
  'Chapra': { lat: 25.7833, lon: 84.7500 },
  'Hajipur': { lat: 25.6833, lon: 85.2167 },
  'Buxar': { lat: 25.5667, lon: 83.9833 },
  'Jehanabad': { lat: 25.2167, lon: 84.9833 },
  'Aurangabad': { lat: 24.7500, lon: 84.3667 },
  'Nawada': { lat: 24.8833, lon: 85.5333 },
  'Jamui': { lat: 24.9167, lon: 86.2167 },
  'Lakhisarai': { lat: 25.1833, lon: 86.0833 },
  'Sheikhpura': { lat: 25.1333, lon: 85.8333 },
  'Nalanda': { lat: 25.1333, lon: 85.4333 },
  'Vaishali': { lat: 25.9833, lon: 85.1333 },
  'Saran': { lat: 25.7833, lon: 84.7500 },
  'Gopalganj': { lat: 26.4667, lon: 84.4333 },
  'East Champaran': { lat: 26.6500, lon: 84.9167 },
  'West Champaran': { lat: 26.8000, lon: 84.5000 },
  'Sheohar': { lat: 26.5167, lon: 85.2833 },
  'Supaul': { lat: 26.1167, lon: 86.6000 },
  'Madhepura': { lat: 25.9167, lon: 86.7833 },
  'Kishanganj': { lat: 26.0833, lon: 87.9500 },
  'Araria': { lat: 26.1500, lon: 87.5167 },
  'Purba Champaran': { lat: 26.6500, lon: 84.9167 },
  'Pashchim Champaran': { lat: 26.8000, lon: 84.5000 },
  
  // Delhi & NCR
  'Delhi': { lat: 28.6139, lon: 77.2090 },
  'Gurgaon': { lat: 28.4089, lon: 77.0378 },
  'Faridabad': { lat: 28.4089, lon: 77.3178 },
  'Noida': { lat: 28.5355, lon: 77.3910 },
  'Ghaziabad': { lat: 28.6692, lon: 77.4538 },
  'Meerut': { lat: 28.9845, lon: 77.7064 },
  
  // Karnataka
  'Bangalore': { lat: 12.9716, lon: 77.5946 },
  'Mysore': { lat: 12.2958, lon: 76.6394 },
  'Hubli': { lat: 15.3647, lon: 75.1240 },
  'Mangalore': { lat: 12.9141, lon: 74.8560 },
  'Belagavi': { lat: 15.8497, lon: 74.4977 },
  'Davangere': { lat: 14.4644, lon: 75.9218 },
  'Ballari': { lat: 15.1394, lon: 76.9214 },
  'Tumkur': { lat: 13.3409, lon: 77.1010 },
  'Shimoga': { lat: 13.9299, lon: 75.5681 },
  'Ramanagara': { lat: 12.7150, lon: 77.2817 },
  
  // Telangana
  'Hyderabad': { lat: 17.3850, lon: 78.4867 },
  'Warangal': { lat: 18.0000, lon: 79.5833 },
  'Nizamabad': { lat: 18.6667, lon: 78.1167 },
  'Karimnagar': { lat: 18.4333, lon: 79.1500 },
  'Ramagundam': { lat: 18.8000, lon: 79.4500 },
  'Khammam': { lat: 17.2500, lon: 80.1500 },
  'Mahbubnagar': { lat: 16.7333, lon: 78.0000 },
  'Nalgonda': { lat: 17.0500, lon: 79.2667 },
  'Adilabad': { lat: 19.6667, lon: 78.5333 },
  'Siddipet': { lat: 18.1000, lon: 78.8500 },
  
  // Tamil Nadu
  'Chennai': { lat: 13.0827, lon: 80.2707 },
  'Coimbatore': { lat: 11.0168, lon: 76.9558 },
  'Madurai': { lat: 9.9252, lon: 78.1198 },
  'Tiruchirappalli': { lat: 10.7905, lon: 78.7047 },
  'Salem': { lat: 11.6643, lon: 78.1460 },
  'Tirunelveli': { lat: 8.7139, lon: 77.7567 },
  'Erode': { lat: 11.3410, lon: 77.7172 },
  'Vellore': { lat: 12.9165, lon: 79.1325 },
  'Thoothukudi': { lat: 8.7642, lon: 78.1348 },
  'Dindigul': { lat: 10.3629, lon: 77.9754 },
  
  // West Bengal
  'Kolkata': { lat: 22.5726, lon: 88.3639 },
  'Howrah': { lat: 22.5958, lon: 88.2636 },
  'Durgapur': { lat: 23.5204, lon: 87.3119 },
  'Asansol': { lat: 23.6881, lon: 86.9750 },
  'Siliguri': { lat: 26.7271, lon: 88.3953 },
  'Bardhaman': { lat: 23.2400, lon: 87.8700 },
  'Malda': { lat: 25.0167, lon: 88.1333 },
  'Krishnanagar': { lat: 23.4000, lon: 88.5000 },
  'Jalpaiguri': { lat: 26.5167, lon: 88.7333 },
  'Raiganj': { lat: 25.6167, lon: 88.1167 },
  
  // Gujarat
  'Ahmedabad': { lat: 23.0225, lon: 72.5714 },
  'Surat': { lat: 21.1702, lon: 72.8311 },
  'Vadodara': { lat: 22.3072, lon: 73.1812 },
  'Rajkot': { lat: 22.3039, lon: 70.8022 },
  'Bhavnagar': { lat: 21.7645, lon: 72.1519 },
  'Jamnagar': { lat: 22.4707, lon: 70.0586 },
  'Gandhinagar': { lat: 23.2156, lon: 72.6369 },
  'Anand': { lat: 22.5645, lon: 72.9289 },
  'Bharuch': { lat: 21.7051, lon: 72.9959 },
  'Junagadh': { lat: 21.5222, lon: 70.4579 },
  
  // Rajasthan
  'Jaipur': { lat: 26.9124, lon: 75.7873 },
  'Jodhpur': { lat: 26.2389, lon: 73.0243 },
  'Kota': { lat: 25.2138, lon: 75.8648 },
  'Bikaner': { lat: 28.0229, lon: 73.3119 },
  'Ajmer': { lat: 26.4499, lon: 74.6399 },
  'Udaipur': { lat: 24.5854, lon: 73.7125 },
  'Alwar': { lat: 27.5665, lon: 76.6100 },
  'Bharatpur': { lat: 27.2156, lon: 77.4928 },
  'Sikar': { lat: 27.6119, lon: 75.1397 },
  'Pali': { lat: 25.7713, lon: 73.3238 },
  
  // Uttar Pradesh
  'Lucknow': { lat: 26.8467, lon: 80.9462 },
  'Kanpur': { lat: 26.4499, lon: 80.3319 },
  'Agra': { lat: 27.1767, lon: 78.0081 },
  'Varanasi': { lat: 25.3176, lon: 82.9739 },
  'Allahabad': { lat: 25.4358, lon: 81.8463 },
  'Bareilly': { lat: 28.3670, lon: 79.4304 },
  'Moradabad': { lat: 28.8389, lon: 78.7768 },
  'Aligarh': { lat: 27.8974, lon: 78.0880 },
  'Gorakhpur': { lat: 26.7588, lon: 83.3697 },
  'Saharanpur': { lat: 29.9675, lon: 77.5451 },
  
  // Madhya Pradesh
  'Indore': { lat: 22.7196, lon: 75.8577 },
  'Bhopal': { lat: 23.2599, lon: 77.4126 },
  'Gwalior': { lat: 26.2183, lon: 78.1828 },
  'Jabalpur': { lat: 23.1815, lon: 79.9864 },
  'Ujjain': { lat: 23.1765, lon: 75.7885 },
  'Sagar': { lat: 23.8388, lon: 78.7381 },
  'Ratlam': { lat: 23.3315, lon: 75.0367 },
  'Satna': { lat: 24.5833, lon: 80.8333 },
  'Dewas': { lat: 22.9667, lon: 76.0667 },
  
  // Andhra Pradesh
  'Visakhapatnam': { lat: 17.6868, lon: 83.2185 },
  'Vijayawada': { lat: 16.5062, lon: 80.6480 },
  'Guntur': { lat: 16.3067, lon: 80.4365 },
  'Nellore': { lat: 14.4426, lon: 79.9865 },
  'Kurnool': { lat: 15.8281, lon: 78.0373 },
  'Rajahmundry': { lat: 17.0005, lon: 81.8040 },
  'Kakinada': { lat: 16.9604, lon: 82.2381 },
  'Tirupati': { lat: 13.6288, lon: 79.4192 },
  'Anantapur': { lat: 14.6819, lon: 77.6006 },
  'Eluru': { lat: 16.7050, lon: 81.1039 },
  
  // Kerala
  'Thiruvananthapuram': { lat: 8.5241, lon: 76.9366 },
  'Kochi': { lat: 9.9312, lon: 76.2673 },
  'Kozhikode': { lat: 11.2588, lon: 75.7804 },
  'Thrissur': { lat: 10.5276, lon: 76.2144 },
  'Kollam': { lat: 8.8932, lon: 76.6141 },
  'Alappuzha': { lat: 9.4981, lon: 76.3388 },
  'Kannur': { lat: 11.8745, lon: 75.3704 },
  'Kottayam': { lat: 9.5916, lon: 76.5222 },
  'Palakkad': { lat: 10.7867, lon: 76.6548 },
  'Malappuram': { lat: 11.0404, lon: 76.0810 },
  
  // Odisha
  'Bhubaneswar': { lat: 20.2961, lon: 85.8245 },
  'Cuttack': { lat: 20.4625, lon: 85.8830 },
  'Rourkela': { lat: 22.2604, lon: 84.8536 },
  'Berhampur': { lat: 19.3142, lon: 84.7941 },
  'Sambalpur': { lat: 21.4702, lon: 83.9701 },
  'Puri': { lat: 19.8135, lon: 85.8312 },
  'Baleshwar': { lat: 21.4944, lon: 86.9336 },
  'Bhadrak': { lat: 21.0544, lon: 86.5156 },
  'Baripada': { lat: 21.7333, lon: 86.7167 },
  'Jharsuguda': { lat: 21.8500, lon: 84.0167 },
  
  // Punjab
  'Ludhiana': { lat: 30.9010, lon: 75.8573 },
  'Amritsar': { lat: 31.6340, lon: 74.8723 },
  'Jalandhar': { lat: 31.3260, lon: 75.5762 },
  'Patiala': { lat: 30.3398, lon: 76.3869 },
  'Bathinda': { lat: 30.2070, lon: 74.9459 },
  'Pathankot': { lat: 32.2748, lon: 75.6527 },
  'Hoshiarpur': { lat: 31.5320, lon: 75.9170 },
  'Batala': { lat: 31.8186, lon: 75.2027 },
  'Moga': { lat: 30.8154, lon: 75.1710 },
  'Abohar': { lat: 30.1441, lon: 74.1995 },
  
  // Haryana
  'Panipat': { lat: 29.3909, lon: 76.9635 },
  'Ambala': { lat: 30.3782, lon: 76.7767 },
  'Yamunanagar': { lat: 30.1290, lon: 77.2883 },
  'Rohtak': { lat: 28.8955, lon: 76.6066 },
  'Hisar': { lat: 29.1492, lon: 75.7217 },
  'Karnal': { lat: 29.6857, lon: 76.9905 },
  'Sonipat': { lat: 28.9931, lon: 77.0151 },
  'Panchkula': { lat: 30.6942, lon: 76.8606 },
  
  // Jharkhand
  'Ranchi': { lat: 23.3441, lon: 85.3096 },
  'Jamshedpur': { lat: 22.8046, lon: 86.2029 },
  'Dhanbad': { lat: 23.7956, lon: 86.4304 },
  'Bokaro': { lat: 23.6693, lon: 86.1511 },
  'Hazaribagh': { lat: 23.9924, lon: 85.3616 },
  'Deoghar': { lat: 24.4823, lon: 86.6958 },
  'Giridih': { lat: 24.1858, lon: 86.3075 },
  'Dumka': { lat: 24.2679, lon: 87.2500 },
  'Phusro': { lat: 23.7833, lon: 85.9833 },
  'Adityapur': { lat: 22.7833, lon: 86.1667 },
  
  // Chhattisgarh
  'Raipur': { lat: 21.2514, lon: 81.6296 },
  'Bhilai': { lat: 21.2092, lon: 81.4285 },
  'Bilaspur': { lat: 22.0796, lon: 82.1391 },
  'Durg': { lat: 21.1900, lon: 81.2800 },
  'Korba': { lat: 22.3500, lon: 82.6833 },
  'Rajnandgaon': { lat: 21.1000, lon: 81.0333 },
  'Raigarh': { lat: 21.9000, lon: 83.4000 },
  'Jagdalpur': { lat: 19.0667, lon: 82.0333 },
  'Ambikapur': { lat: 23.1167, lon: 83.2000 },
  'Chirmiri': { lat: 23.2000, lon: 82.3500 },
  
  // Assam
  'Guwahati': { lat: 26.1445, lon: 91.7362 },
  'Silchar': { lat: 24.8333, lon: 92.8000 },
  'Dibrugarh': { lat: 27.4833, lon: 95.0000 },
  'Jorhat': { lat: 26.7500, lon: 94.2167 },
  'Nagaon': { lat: 26.3500, lon: 92.6833 },
  'Tinsukia': { lat: 27.5000, lon: 95.3500 },
  'Tezpur': { lat: 26.6333, lon: 92.8000 },
  'Sivasagar': { lat: 26.9833, lon: 94.6333 },
  'Goalpara': { lat: 26.1667, lon: 90.6167 },
  'Barpeta': { lat: 26.3167, lon: 91.0000 },
  
  // Himachal Pradesh
  'Shimla': { lat: 31.1048, lon: 77.1734 },
  'Mandi': { lat: 31.7167, lon: 76.9167 },
  'Solan': { lat: 30.9167, lon: 77.1167 },
  'Dharamshala': { lat: 32.2200, lon: 76.3200 },
  'Bilaspur': { lat: 31.3333, lon: 76.7500 },
  'Kullu': { lat: 31.9667, lon: 77.1000 },
  'Chamba': { lat: 32.5667, lon: 76.1333 },
  'Hamirpur': { lat: 31.6833, lon: 76.5167 },
  'Una': { lat: 31.4667, lon: 76.2667 },
  'Kangra': { lat: 32.1000, lon: 76.2667 },
  
  // Uttarakhand
  'Dehradun': { lat: 30.3165, lon: 78.0322 },
  'Haridwar': { lat: 29.9457, lon: 78.1642 },
  'Roorkee': { lat: 29.8667, lon: 77.8833 },
  'Haldwani': { lat: 29.2167, lon: 79.5167 },
  'Rudrapur': { lat: 28.9833, lon: 79.4000 },
  'Kashipur': { lat: 29.2167, lon: 78.9667 },
  'Rishikesh': { lat: 30.0869, lon: 78.2676 },
  'Nainital': { lat: 29.3919, lon: 79.4542 },
  'Almora': { lat: 29.6167, lon: 79.6667 },
  'Pithoragarh': { lat: 29.5833, lon: 80.2167 },
  
  // Jammu & Kashmir
  'Srinagar': { lat: 34.0837, lon: 74.7973 },
  'Jammu': { lat: 32.7266, lon: 74.8570 },
  
  // Other States
  'Chandigarh': { lat: 30.7333, lon: 76.7794 },
  'Panaji': { lat: 15.4909, lon: 73.8278 },
  'Margao': { lat: 15.2733, lon: 73.9583 },
  'Vasco da Gama': { lat: 15.3983, lon: 73.8156 },
  'Itanagar': { lat: 27.1000, lon: 93.6167 },
  'Imphal': { lat: 24.8167, lon: 93.9500 },
  'Shillong': { lat: 25.5744, lon: 91.8789 },
  'Aizawl': { lat: 23.7271, lon: 92.7176 },
  'Kohima': { lat: 25.6667, lon: 94.1167 },
  'Gangtok': { lat: 27.3389, lon: 88.6065 },
  'Agartala': { lat: 23.8361, lon: 91.2794 },
};

// Case-insensitive lookup for fallback coordinates
const getFallbackCoords = (location, state = '', country = 'India') => {
  const trimmed = (location || '').trim();
  if (!trimmed) return null;

  // Direct key match (case-sensitive, existing map)
  if (INDIAN_CITY_COORDINATES[trimmed]) {
    return { name: trimmed, coords: INDIAN_CITY_COORDINATES[trimmed] };
  }

  // Case-insensitive match
  const lower = trimmed.toLowerCase();
  const entry = Object.entries(INDIAN_CITY_COORDINATES).find(
    ([city]) => city.toLowerCase() === lower
  );
  if (entry) {
    return { name: entry[0], coords: entry[1] };
  }

  return null;
};

// Get coordinates (lat/lon) from location name
// First tries fallback coordinates database (no API key needed)
// Optionally uses Google Geocoding API if API key is available and fallback not found
export const geocodeLocation = async (location, state = '', country = 'India') => {
  try {
    // First, try fallback coordinates (no API key needed)
    const fallback = getFallbackCoords(location, state, country);
    if (fallback) {
      console.log(`Using fallback coordinates for ${fallback.name}`);
      const coords = fallback.coords;
      return {
        lat: coords.lat,
        lon: coords.lon,
        name: fallback.name,
        state: state || '',
        country: country,
        formatted_address: `${fallback.name}, ${state || ''}, ${country}`
      };
    }

    // If fallback not found and Google API key is available, try Google Geocoding
    if (GOOGLE_API_KEY) {
    // Build location query with state if provided
    const locationQuery = state ? `${location}, ${state}, ${country}` : `${location}, ${country}`;
    
      // Try multiple query formats for better results
      const queries = [
        locationQuery, // Full query with state
        state ? `${location}, ${state}` : `${location}, ${country}`, // Without country
        location, // Just the location name
      ];
      
      let response = null;
      let lastError = null;
      
      // Try each query format until one works
      for (const query of queries) {
        try {
          const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}&region=in`;
          response = await axios.get(geocodeUrl);
          
          // If we got results, break out of loop
    if (response.data && response.data.results && response.data.results.length > 0) {
            break;
          }
        } catch (err) {
          lastError = err;
          continue; // Try next query format
        }
      }
      
      if (response && response.data) {
        // Check for API errors
        if (response.data.error_message) {
          console.warn(`Google Geocoding API error: ${response.data.error_message}`);
        } else if (response.data.status === 'REQUEST_DENIED') {
          console.warn('Google Geocoding API request denied. Using fallback coordinates.');
        } else if (response.data.status === 'ZERO_RESULTS') {
          console.warn(`Location not found in Google Geocoding: ${locationQuery}`);
        } else if (response.data.results && response.data.results.length > 0) {
      const result = response.data.results[0];
      const location_data = result.geometry.location;
      
      // Extract city and state from address components
      let city = location;
      let state_name = state;
      
      result.address_components.forEach(component => {
        if (component.types.includes('locality') || component.types.includes('administrative_area_level_2')) {
          city = component.long_name;
        }
        if (component.types.includes('administrative_area_level_1')) {
          state_name = component.long_name;
        }
      });
      
      return {
        lat: location_data.lat,
        lon: location_data.lng,
        name: city,
        state: state_name,
        country: country,
        formatted_address: result.formatted_address
      };
        }
      }
    }
    
    // If no fallback and no Google API or Google failed, throw error
    throw new Error(`Location "${location}" not found in coordinates database. Please use a major city/district name.`);
  } catch (error) {
    console.error('Geocoding error:', error.message);
    if (error.response) {
      console.error('Geocoding API response:', error.response.data);
    }
    
    // Final fallback attempt
    const fallback = getFallbackCoords(location, state, country);
    if (fallback) {
      console.log(`Using fallback coordinates for ${fallback.name} (after error)`);
      const coords = fallback.coords;
      return {
        lat: coords.lat,
        lon: coords.lon,
        name: fallback.name,
        state: state || '',
        country: country,
        formatted_address: `${fallback.name}, ${state || ''}, ${country}`
      };
    }
    
    throw error;
  }
};

// Get current weather for a location using Open-Meteo API
export const getCurrentWeather = async (location, state = '') => {
  try {
    // Get coordinates (uses fallback database first, then optional Google Geocoding)
    const coords = await geocodeLocation(location, state);
    
    // Use Open-Meteo API for current weather (free, no API key required)
    const weatherUrl = `${OPEN_METEO_BASE_URL}/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation,weather_code&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation&timezone=auto`;
    
    try {
      const response = await axios.get(weatherUrl, {
        timeout: 10000, // 10 second timeout
        headers: {
          'User-Agent': 'Grainology-Weather-Service/1.0'
        }
      });
      const data = response.data;
      
      if (!data.current) {
        throw new Error('No current weather data available');
      }
      
      const current = data.current;
      const hourly = data.hourly;
      
      // Get today's min/max from hourly data
      const todayTemps = hourly?.temperature_2m?.slice(0, 24) || [];
      const todayHumidity = hourly?.relative_humidity_2m?.slice(0, 24) || [];
      const todayWind = hourly?.wind_speed_10m?.slice(0, 24) || [];
      const todayPrecip = hourly?.precipitation?.slice(0, 24) || [];
      
      const tempMin = todayTemps.length > 0 ? Math.min(...todayTemps) : current.temperature_2m;
      const tempMax = todayTemps.length > 0 ? Math.max(...todayTemps) : current.temperature_2m;
      const avgHumidity = todayHumidity.length > 0 ? Math.round(todayHumidity.reduce((a, b) => a + b, 0) / todayHumidity.length) : current.relative_humidity_2m;
      const avgWind = todayWind.length > 0 ? (todayWind.reduce((a, b) => a + b, 0) / todayWind.length).toFixed(1) : current.wind_speed_10m;
      const totalPrecip = todayPrecip.length > 0 ? todayPrecip.reduce((a, b) => a + b, 0).toFixed(1) : (current.precipitation || 0);
      
      // Map weather code to condition (WMO Weather interpretation codes)
      const weatherCondition = getWeatherConditionFromCode(current.weather_code);
      
      return {
        location: coords.name,
        state: coords.state,
        latitude: coords.lat,
        longitude: coords.lon,
        country: coords.country,
        formatted_address: coords.formatted_address,
        date: new Date(),
        temperature_min: tempMin,
        temperature_max: tempMax,
        humidity: avgHumidity,
        rainfall: parseFloat(totalPrecip),
        wind_speed: parseFloat(avgWind),
        weather_condition: weatherCondition,
        weather_description: weatherCondition,
        weather_icon: getWeatherIconFromCode(current.weather_code),
        pressure: null, // Not available in free tier
        visibility: null, // Not available in free tier
        forecast_data: {
          feels_like: current.temperature_2m,
          temp_min: tempMin,
          temp_max: tempMax,
          weather_icon: getWeatherIconFromCode(current.weather_code),
          weather_description: weatherCondition
        }
      };
    } catch (weatherError) {
      console.error('Open-Meteo API error:', weatherError.message);
      if (weatherError.response) {
        console.error('Open-Meteo API response status:', weatherError.response.status);
        console.error('Open-Meteo API response data:', weatherError.response.data);
        
        // Handle rate limiting (429)
        if (weatherError.response.status === 429) {
          throw new Error('Weather API rate limit exceeded. Please try again in a few minutes.');
        }
        
        // Handle other API errors
        if (weatherError.response.status >= 500) {
          throw new Error('Weather service is temporarily unavailable. Please try again later.');
        }
      }
      throw new Error(`Failed to fetch weather data: ${weatherError.message}`);
    }
  } catch (error) {
    console.error('Get current weather error:', error.message);
    throw error;
  }
};

// Get weather forecast using Open-Meteo API
export const getWeatherForecast = async (location, state = '', days = 5) => {
  try {
    // Get coordinates (uses fallback database first, then optional Google Geocoding)
    const coords = await geocodeLocation(location, state);
    
    // Use Open-Meteo API for daily forecast (supports up to 16 days, free, no API key required)
    const forecastDays = Math.min(days, 16);
    const weatherUrl = `${OPEN_METEO_BASE_URL}/forecast?latitude=${coords.lat}&longitude=${coords.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,relative_humidity_2m_max,weather_code&timezone=auto&forecast_days=${forecastDays}`;
    
    try {
      const response = await axios.get(weatherUrl, {
        timeout: 10000, // 10 second timeout
        headers: {
          'User-Agent': 'Grainology-Weather-Service/1.0'
        }
      });
      const data = response.data;
      
      if (!data.daily || !data.daily.time) {
        throw new Error('Invalid weather data format received from API');
      }
      
      const daily = data.daily;
      const forecasts = daily.time.map((dateStr, index) => {
        const date = new Date(dateStr);
        const dateKey = date.toISOString().split('T')[0];
        
        // Calculate average temperature
        const tempMin = daily.temperature_2m_min[index] || 0;
        const tempMax = daily.temperature_2m_max[index] || 0;
        const tempAvg = ((tempMin + tempMax) / 2).toFixed(1);
        
        // Map weather code to condition
        const weatherCode = daily.weather_code[index] || 0;
        const weatherCondition = getWeatherConditionFromCode(weatherCode);
        
        return {
          date: dateKey,
          date_obj: date,
          temperature_min: tempMin,
          temperature_max: tempMax,
          temperature_avg: parseFloat(tempAvg),
          humidity: daily.relative_humidity_2m_max[index] || 0,
          rainfall: daily.precipitation_sum[index] || 0,
          wind_speed: daily.wind_speed_10m_max[index] || 0,
          weather_condition: weatherCondition,
          forecast_data: {
            hourly_forecasts: [], // Can be populated with hourly data if needed
            weather_icon: getWeatherIconFromCode(weatherCode),
            weather_description: weatherCondition,
            formatted_address: coords.formatted_address
          }
        };
      });
    
    return {
      location: coords.name,
      state: coords.state,
      latitude: coords.lat,
      longitude: coords.lon,
      country: coords.country,
      formatted_address: coords.formatted_address,
        forecasts: forecasts
      };
    } catch (weatherError) {
      console.error('Open-Meteo API error:', weatherError.message);
      if (weatherError.response) {
        console.error('Open-Meteo API response status:', weatherError.response.status);
        console.error('Open-Meteo API response data:', weatherError.response.data);
        
        // Handle rate limiting (429)
        if (weatherError.response.status === 429) {
          throw new Error('Weather API rate limit exceeded. Please try again in a few minutes.');
        }
        
        // Handle other API errors
        if (weatherError.response.status >= 500) {
          throw new Error('Weather service is temporarily unavailable. Please try again later.');
        }
      }
      throw new Error(`Failed to fetch weather forecast: ${weatherError.message}`);
    }
  } catch (error) {
    console.error('Get weather forecast error:', error.message);
    throw error;
  }
};

// Helper function to convert Open-Meteo weather code to readable condition
// Based on WMO Weather interpretation codes (WW)
const getWeatherConditionFromCode = (code) => {
  if (code === 0) return 'Clear sky';
  if (code >= 1 && code <= 3) return 'Partly cloudy';
  if (code === 45 || code === 48) return 'Fog';
  if (code >= 51 && code <= 55) return 'Drizzle';
  if (code === 56 || code === 57) return 'Freezing drizzle';
  if (code >= 61 && code <= 65) return 'Rain';
  if (code === 66 || code === 67) return 'Freezing rain';
  if (code >= 71 && code <= 75) return 'Snow';
  if (code === 77) return 'Snow grains';
  if (code >= 80 && code <= 82) return 'Rain showers';
  if (code === 85 || code === 86) return 'Snow showers';
  if (code === 95) return 'Thunderstorm';
  if (code === 96 || code === 99) return 'Thunderstorm with hail';
  return 'Unknown';
};

// Helper function to get weather icon from Open-Meteo weather code
const getWeatherIconFromCode = (code) => {
  if (code === 0) return '☀️'; // Clear sky
  if (code >= 1 && code <= 3) return '⛅'; // Partly cloudy
  if (code === 45 || code === 48) return '🌫️'; // Fog
  if (code >= 51 && code <= 57) return '🌦️'; // Drizzle
  if (code >= 61 && code <= 67) return '🌧️'; // Rain
  if (code >= 71 && code <= 77) return '❄️'; // Snow
  if (code >= 80 && code <= 86) return '🌦️'; // Showers
  if (code >= 95 && code <= 99) return '⛈️'; // Thunderstorm
  return '🌤️'; // Default
};

// Transform OpenWeatherMap data to our format (legacy, kept for reference)
const transformWeatherData = (data, coords, type) => {
  return {
    location: coords.name,
    state: coords.state || '',
    latitude: coords.lat,
    longitude: coords.lon,
    country: coords.country,
    formatted_address: coords.formatted_address || '',
    date: new Date(data.dt * 1000),
    temperature_min: type === 'forecast' ? data.main.temp_min : data.main.temp,
    temperature_max: type === 'forecast' ? data.main.temp_max : data.main.temp,
    humidity: data.main.humidity,
    rainfall: data.rain ? (data.rain['3h'] || data.rain['1h'] || 0) : 0,
    wind_speed: data.wind ? (data.wind.speed * 3.6) : 0, // Convert m/s to km/h
    weather_condition: data.weather[0].main,
    weather_description: data.weather[0].description,
    weather_icon: data.weather[0].icon,
    pressure: data.main.pressure,
    visibility: data.visibility ? (data.visibility / 1000) : null, // Convert to km
    forecast_data: {
      feels_like: data.main.feels_like,
      temp_min: data.main.temp_min,
      temp_max: data.main.temp_max,
      weather_icon: data.weather[0].icon,
      weather_description: data.weather[0].description
    }
  };
};

// Group 3-hour forecasts by day
const groupForecastsByDay = (forecastList, days) => {
  const dailyForecasts = {};
  
  forecastList.slice(0, days * 8).forEach(item => {
    const date = new Date(item.dt * 1000);
    const dateKey = date.toISOString().split('T')[0];
    
    if (!dailyForecasts[dateKey]) {
      dailyForecasts[dateKey] = {
        date: dateKey,
        date_obj: date,
        temps: [],
        humidity: [],
        rainfall: [],
        wind_speed: [],
        conditions: [],
        forecasts: []
      };
    }
    
    dailyForecasts[dateKey].temps.push(item.main.temp);
    dailyForecasts[dateKey].humidity.push(item.main.humidity);
    dailyForecasts[dateKey].rainfall.push(item.rain ? (item.rain['3h'] || 0) : 0);
    dailyForecasts[dateKey].wind_speed.push(item.wind ? (item.wind.speed * 3.6) : 0);
    dailyForecasts[dateKey].conditions.push(item.weather[0].main);
    dailyForecasts[dateKey].forecasts.push({
      time: date.toISOString(),
      temp: item.main.temp,
      condition: item.weather[0].main,
      description: item.weather[0].description,
      icon: item.weather[0].icon,
      humidity: item.main.humidity,
      wind_speed: item.wind ? (item.wind.speed * 3.6) : 0,
      rainfall: item.rain ? (item.rain['3h'] || 0) : 0
    });
  });
  
  // Calculate daily averages and min/max
  return Object.values(dailyForecasts).map(day => ({
    date: day.date,
    date_obj: day.date_obj,
    temperature_min: Math.min(...day.temps),
    temperature_max: Math.max(...day.temps),
    temperature_avg: (day.temps.reduce((a, b) => a + b, 0) / day.temps.length).toFixed(1),
    humidity: Math.round(day.humidity.reduce((a, b) => a + b, 0) / day.humidity.length),
    rainfall: day.rainfall.reduce((a, b) => a + b, 0).toFixed(1),
    wind_speed: (day.wind_speed.reduce((a, b) => a + b, 0) / day.wind_speed.length).toFixed(1),
    weather_condition: getMostCommonCondition(day.conditions),
    forecast_data: {
      hourly_forecasts: day.forecasts,
      most_common_condition: getMostCommonCondition(day.conditions)
    }
  }));
};

const getMostCommonCondition = (conditions) => {
  const counts = {};
  conditions.forEach(cond => {
    counts[cond] = (counts[cond] || 0) + 1;
  });
  return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
};

