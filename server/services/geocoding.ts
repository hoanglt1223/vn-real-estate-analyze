export interface GeocodingResult {
  coordinates: [number, number]; // [lng, lat]
  placeName: string;
  placeType: string;
  context?: string;
}
const MAPBOX_API_BASE = 'https://api.mapbox.com/geocoding/v5/mapbox.places';

export async function geocodeLocation(query: string): Promise<GeocodingResult | null> {
  const token = process.env.MAPBOX_TOKEN || process.env.VITE_MAPBOX_TOKEN;
  if (!token) {
    throw new Error('MAPBOX_TOKEN or VITE_MAPBOX_TOKEN is required for geocoding');
  }

  try {
    const url = `${MAPBOX_API_BASE}/${encodeURIComponent(query)}.json?access_token=${token}&limit=1&country=VN&language=vi`;
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    if (!data.features || data.features.length === 0) {
      return null;
    }
    const feature = data.features[0];
    const [lng, lat] = feature.geometry.coordinates;
    return {
      coordinates: [lng, lat],
      placeName: feature.place_name || query,
      placeType: Array.isArray(feature.place_type) && feature.place_type.length > 0 ? feature.place_type[0] : 'location',
      context: feature.text || undefined
    };
  } catch (error) {
    throw new Error('Failed to geocode location');
  }
}

export interface LocationSuggestion {
  name: string;
  fullName: string;
  type: 'address' | 'place' | 'poi' | 'locality' | 'neighborhood';
  code: number;
  geocodeQuery: string;
}

export async function suggestLocations(query: string, limit: number = 10): Promise<LocationSuggestion[]> {
  const token = process.env.MAPBOX_TOKEN || process.env.VITE_MAPBOX_TOKEN;
  if (!token) {
    return [];
  }

  const url = `${MAPBOX_API_BASE}/${encodeURIComponent(query)}.json?access_token=${token}&limit=${limit}&country=VN&language=vi&types=address,place,poi,locality,neighborhood`;
  const response = await fetch(url);
  if (!response.ok) {
    return [];
  }
  const data = await response.json();
  const features = Array.isArray(data.features) ? data.features : [];
  const suggestions: LocationSuggestion[] = features.map((feature: any, i: number) => {
    const firstType = Array.isArray(feature.place_type) && feature.place_type.length > 0 ? feature.place_type[0] : 'place';
    const fullName = feature.place_name || feature.text || query;
    const name = feature.text || fullName;
    return {
      name,
      fullName,
      type: firstType as LocationSuggestion['type'],
      code: 100000 + i,
      geocodeQuery: fullName
    };
  });
  return suggestions;
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
