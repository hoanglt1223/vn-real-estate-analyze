// TrackAsia Geocoding Service
// Uses TrackAsia Search API for geocoding Vietnamese locations

export interface GeocodingResult {
  coordinates: [number, number]; // [lng, lat]
  placeName: string;
  placeType: string;
  context?: string;
}

const TRACKASIA_API_BASE = 'https://api.trackasia.com/v1';

export async function geocodeLocation(query: string): Promise<GeocodingResult | null> {
  const TRACKASIA_API_KEY = process.env.TRACKASIA_API_KEY;
  
  if (!TRACKASIA_API_KEY) {
    throw new Error('TRACKASIA_API_KEY is required for geocoding. Please add it to Replit Secrets.');
  }

  try {
    // TrackAsia Search API endpoint
    const url = `${TRACKASIA_API_BASE}/search?key=${TRACKASIA_API_KEY}&q=${encodeURIComponent(query)}&country=VN&limit=1`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`TrackAsia geocoding error: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (!data.features || data.features.length === 0) {
      console.log(`No geocoding results for: ${query}`);
      return null;
    }
    
    const feature = data.features[0];
    const [lng, lat] = feature.geometry.coordinates;
    
    return {
      coordinates: [lng, lat],
      placeName: feature.properties.name || query,
      placeType: feature.properties.type || 'location',
      context: feature.properties.context || undefined
    };
  } catch (error) {
    console.error('Geocoding error:', error);
    throw new Error('Failed to geocode location. TrackAsia API may be unavailable.');
  }
}

// Cache for geocoding results to minimize API calls
const geocodeCache = new Map<string, { result: GeocodingResult | null; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours

export async function geocodeLocationCached(query: string): Promise<GeocodingResult | null> {
  const cached = geocodeCache.get(query);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.result;
  }
  
  const result = await geocodeLocation(query);
  geocodeCache.set(query, { result, timestamp: Date.now() });
  
  return result;
}
