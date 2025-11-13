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

export async function suggestLocations(query: string, options?: { limit?: number; sessionToken?: string; types?: string; proximity?: string; country?: string; language?: string }): Promise<LocationSuggestion[]> {
  const token = process.env.MAPBOX_TOKEN || process.env.VITE_MAPBOX_TOKEN;
  if (!token) return [];
  const limit = options?.limit ?? 10;
  const sessionToken = options?.sessionToken ?? undefined;
  const types = options?.types ?? 'address,place,poi,locality,neighborhood';
  const proximity = options?.proximity ? `&proximity=${options?.proximity}` : '';
  const country = options?.country ?? 'VN';
  const language = options?.language ?? 'vi';

  const base = 'https://api.mapbox.com/search/searchbox/v1/suggest';
  const url = `${base}?q=${encodeURIComponent(query)}&access_token=${token}&limit=${limit}&country=${country}&language=${language}&types=${types}${proximity}${sessionToken ? `&session_token=${sessionToken}` : ''}`;
  const response = await fetch(url);
  if (!response.ok) return [];
  const data = await response.json();
  const suggestions: LocationSuggestion[] = Array.isArray(data.suggestions) ? data.suggestions.map((s: any, i: number) => ({
    name: s.name || s.feature_name || query,
    fullName: s.place_formatted || s.name || query,
    type: (s.feature_type || 'place') as LocationSuggestion['type'],
    code: 100000 + i,
    geocodeQuery: s.place_formatted || s.name || query
  })) : [];
  return suggestions;
}

export async function retrieveLocation(id: string, sessionToken?: string): Promise<GeocodingResult | null> {
  const token = process.env.MAPBOX_TOKEN || process.env.VITE_MAPBOX_TOKEN;
  if (!token) return null;
  const base = 'https://api.mapbox.com/search/searchbox/v1/retrieve';
  const url = `${base}/${encodeURIComponent(id)}?access_token=${token}${sessionToken ? `&session_token=${sessionToken}` : ''}`;
  const response = await fetch(url);
  if (!response.ok) return null;
  const data = await response.json();
  const feature = data?.features?.[0] || data?.feature;
  if (!feature?.geometry?.coordinates) return null;
  const [lng, lat] = feature.geometry.coordinates;
  return {
    coordinates: [lng, lat],
    placeName: feature.place_name || feature.name || '',
    placeType: Array.isArray(feature.place_type) && feature.place_type.length > 0 ? feature.place_type[0] : (feature.feature_type || 'location'),
    context: feature.text || feature.name || undefined
  };
}

export async function searchCategory(poiCategoryCsv: string, params: { lat?: number; lng?: number; bbox?: string; limit?: number; country?: string; language?: string; proximity?: string; sessionToken?: string }): Promise<any[]> {
  const token = process.env.MAPBOX_TOKEN || process.env.VITE_MAPBOX_TOKEN;
  if (!token) return [];
  const base = 'https://api.mapbox.com/search/searchbox/v1/category';
  const limit = params.limit ?? 10;
  const country = params.country ?? 'VN';
  const language = params.language ?? 'vi';
  const proximity = params.proximity ?? (params.lat != null && params.lng != null ? `${params.lng},${params.lat}` : undefined);
  const bbox = params.bbox ? `&bbox=${params.bbox}` : '';
  const sessionToken = params.sessionToken ? `&session_token=${params.sessionToken}` : '';
  const proxParam = proximity ? `&proximity=${proximity}` : '';
  const url = `${base}?poi_category=${encodeURIComponent(poiCategoryCsv)}&limit=${limit}&country=${country}&language=${language}${proxParam}${bbox}${sessionToken}&access_token=${token}`;
  const response = await fetch(url);
  if (!response.ok) return [];
  const data = await response.json();
  const pois = Array.isArray(data.suggestions) ? data.suggestions : (Array.isArray(data.features) ? data.features : []);
  return pois.map((p: any) => {
    const coords = p?.geometry?.coordinates || p?.coordinates;
    const [lng, lat] = Array.isArray(coords) ? coords : [undefined, undefined];
    return {
      id: p.id || p.mapbox_id || p.external_ids?.[0] || `${p.name}-${lng}-${lat}`,
      name: p.name || p.feature_name || p.place_name,
      lat,
      lng,
      category: poiCategoryCsv,
      place_type: p.place_type || p.feature_type,
      address: p.place_formatted || p.address || p.place_name,
    };
  });
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
