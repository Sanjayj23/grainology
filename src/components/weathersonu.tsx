import { useState, useEffect } from "react";
import { MapPin, Thermometer, Wind, Loader2, RefreshCw, Cloud } from "lucide-react";

interface Coordinates {
  lat: number;
  lon: number;
}

interface Place {
  city: string;
  state: string;
  country: string;
}

interface Weather {
  temperature: number;
  wind: number;
}

interface GeoAddress {
  city?: string;
  town?: string;
  village?: string;
  state?: string;
  country?: string;
}

interface GeoResponse {
  address: GeoAddress;
}

interface WeatherResponse {
  current_weather: {
    temperature: number;
    windspeed: number;
  };
}

interface WeathersonuProps {
  embedded?: boolean;
  hideHeader?: boolean;
}

export default function Weathersonu({ embedded = false, hideHeader = false }: WeathersonuProps) {
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [place, setPlace] = useState<Place | null>(null);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [locationDetected, setLocationDetected] = useState<boolean>(false);

  // Auto-detect location on component mount
  useEffect(() => {
    getData();
  }, []);

  const getData = (): void => {
    setError("");
    setCoords(null);
    setPlace(null);
    setWeather(null);
    setLoading(true);

    if (!navigator.geolocation) {
      setError("Geolocation not supported");
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos: GeolocationPosition) => {
        try {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          setCoords({ lat, lon });

          // 🌍 Location Name (FREE)
          const geoRes = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`
          );
          const geo: GeoResponse = await geoRes.json();

          setPlace({
            city:
              geo.address.city ||
              geo.address.town ||
              geo.address.village ||
              "N/A",
            state: geo.address.state || "N/A",
            country: geo.address.country || "N/A",
          });

          // 🌦 Weather (FREE)
          const weatherRes = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`
          );
          const weatherData: WeatherResponse = await weatherRes.json();

          setWeather({
            temperature: weatherData.current_weather.temperature,
            wind: weatherData.current_weather.windspeed,
          });
          setLocationDetected(true);
        } catch (err) {
          setError("Failed to fetch data");
        } finally {
          setLoading(false);
        }
      },
      (err: GeolocationPositionError) => {
        setError(err.message);
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  const containerClassName = embedded
    ? "rounded-[26px] border border-emerald-100/70 bg-[linear-gradient(180deg,#fcfffd_0%,#f3fbf7_100%)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]"
    : "bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-500";

  const headerClassName = embedded ? "mb-5 flex items-center justify-between" : "mb-4 flex items-center justify-between";
  const iconWrapperClassName = embedded ? "rounded-2xl bg-emerald-100 p-3" : "bg-green-100 p-3 rounded-lg";
  const refreshButtonClassName = embedded
    ? "rounded-2xl bg-emerald-700 p-2.5 text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
    : "p-2 rounded-lg bg-green-600 hover:bg-green-700 text-white transition disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div className={containerClassName}>
      {!hideHeader && (
        <div className={headerClassName}>
          <div className="flex items-center gap-3">
            <div className={iconWrapperClassName}>
              <Cloud className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Location & Weather</h3>
              {loading && !locationDetected && (
                <p className="text-sm text-gray-600 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Detecting location...
                </p>
              )}
            </div>
          </div>
          <button
            onClick={getData}
            disabled={loading}
            className={refreshButtonClassName}
            title="Refresh Location"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-[18px] border border-red-200 bg-red-50 p-3">
          <p className="text-red-600 text-sm text-center">{error}</p>
        </div>
      )}

      {loading && !locationDetected ? (
        <div className="text-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-green-600 mx-auto mb-2" />
          <p className="text-sm text-gray-600">Detecting your location...</p>
          <p className="text-xs text-gray-500 mt-1">Please allow location access</p>
        </div>
      ) : (
        <>
          {coords && (
            <div className="mb-4 grid grid-cols-2 gap-3">
              {/* <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
                <p className="text-xs text-gray-600 mb-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  Latitude
                </p>
                <p className="text-lg font-bold text-gray-900">{coords.lat.toFixed(4)}</p>
              </div> */}
              {/* <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
                <p className="text-xs text-gray-600 mb-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  Longitude
                </p>
                <p className="text-lg font-bold text-gray-900">{coords.lon.toFixed(4)}</p>
              </div> */}
            </div>
          )}

          {place && (
            <div className="mb-4 rounded-[24px] border border-emerald-200 bg-[linear-gradient(135deg,#f2fff8_0%,#eef8ff_100%)] p-5">
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="w-4 h-4 text-green-600" />
                <p className="font-semibold text-gray-900">
                  {place.city}, {place.state}
                </p>
              </div>
              <p className="text-sm text-gray-600 ml-6">{place.country}</p>
            </div>
          )}

          {weather && (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[24px] border border-orange-200 bg-[linear-gradient(180deg,#fff8ee_0%,#fff0d7_100%)] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Thermometer className="w-4 h-4 text-orange-600" />
                  <p className="text-xs text-gray-600">Temperature</p>
                </div>
                <p className="text-3xl font-bold text-gray-900">
                  {Math.round(weather.temperature)}°C
                </p>
              </div>
              <div className="rounded-[24px] border border-blue-200 bg-[linear-gradient(180deg,#eff5ff_0%,#dbeafe_100%)] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Wind className="w-4 h-4 text-blue-600" />
                  <p className="text-xs text-gray-600">Wind Speed</p>
                </div>
                <p className="text-2xl font-bold text-gray-900">{Math.round(weather.wind)} km/h</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
