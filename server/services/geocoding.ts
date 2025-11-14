import { cache, generateCacheKey, CACHE_TTL } from '../../shared/services/cache';
import { fetchWithCache, generateGeocodingKey, generateLocationSuggestionsKey } from '../../shared/services/geocoding';
import { MapboxClient } from '../../shared/services/httpClient';

export interface GeocodingResult {
  coordinates: [number, number]; // [lng, lat]
  placeName: string;
  placeType: string;
  context?: string;
}
// Create Mapbox client instance
let mapboxClient: MapboxClient | null = null;

function getMapboxClient(): MapboxClient {
  if (!mapboxClient) {
    const token = process.env.MAPBOX_TOKEN || process.env.VITE_MAPBOX_TOKEN;
    if (!token) {
      throw new Error('MAPBOX_TOKEN or VITE_MAPBOX_TOKEN is required for geocoding');
    }
    mapboxClient = new MapboxClient(token);
  }
  return mapboxClient;
}

export async function geocodeLocation(query: string): Promise<GeocodingResult | null> {
  const client = getMapboxClient();

  return fetchWithCache('geocoding', { query: query.toLowerCase().trim() }, async () => {
    try {
      const response = await client.geocode(query, {
        country: 'VN',
        language: 'vi',
        limit: 1
      });

      const data = response.data;
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
      console.error('Geocoding error:', error);
      return null;
    }
  }, CACHE_TTL.GEOCODING);
}

export interface LocationSuggestion {
  name: string;
  fullName: string;
  type: 'province' | 'district' | 'ward' | 'address' | 'place' | 'poi' | 'locality' | 'neighborhood' | 'region' | 'postcode' | 'country';
  province?: string;
  district?: string;
  code: number;
  geocodeQuery: string;
  mapboxId?: string;
}

export async function suggestLocations(query: string, options?: { limit?: number; sessionToken?: string; types?: string; proximity?: string; country?: string; language?: string }): Promise<LocationSuggestion[]> {
  // Generate cache key for location suggestions (excluding sessionToken)
  const cacheKey = generateCacheKey('locationSuggestions', {
    query: query.toLowerCase().trim(),
    limit: options?.limit ?? 10,
    types: options?.types ?? 'address,place,poi,locality,neighborhood,region,postcode,district,country',
    proximity: options?.proximity,
    country: options?.country ?? 'VN',
    language: options?.language ?? 'vi'
  });

  // Try to get from cache first (skip caching if sessionToken is provided as it's session-specific)
  if (!options?.sessionToken) {
    const cachedResult = cache.get(cacheKey);
    if (cachedResult) {
      console.log(`Cache hit for location suggestions: ${query}`);
      return cachedResult;
    }
  }

  const token = process.env.MAPBOX_TOKEN || process.env.VITE_MAPBOX_TOKEN;
  if (!token) return [];
  const limit = options?.limit ?? 10;
  const sessionToken = options?.sessionToken ?? undefined;
  const types = options?.types ?? 'address,place,poi,locality,neighborhood,region,postcode,district,country';
  const proximity = options?.proximity ? `&proximity=${options?.proximity}` : '';
  const country = options?.country ?? 'VN';
  const language = options?.language ?? 'vi';

  console.log(`Cache miss for location suggestions: ${query}`);

  const base = 'https://api.mapbox.com/search/searchbox/v1/suggest';
  const url = `${base}?q=${encodeURIComponent(query)}&access_token=${token}&limit=${limit}&country=${country}&language=${language}&types=${types}${proximity}${sessionToken ? `&session_token=${sessionToken}` : ''}`;
  const response = await fetch(url);
  if (!response.ok) return [];
  const data = await response.json();
  const suggestions: LocationSuggestion[] = Array.isArray(data.suggestions) ? data.suggestions.map((s: any, i: number) => {
    // Map Mapbox feature types to our interface types
    let mappedType: LocationSuggestion['type'] = 'place';
    const featureType = s.feature_type || '';

    switch (featureType) {
      case 'address': mappedType = 'address'; break;
      case 'poi': mappedType = 'poi'; break;
      case 'locality': mappedType = 'locality'; break;
      case 'neighborhood': mappedType = 'neighborhood'; break;
      case 'region': mappedType = 'province'; break;
      case 'postcode': mappedType = 'postcode'; break;
      case 'district': mappedType = 'district'; break;
      case 'country': mappedType = 'country'; break;
      case 'place':
      default:
        mappedType = 'place';
        break;
    }

    return {
      name: s.name || s.feature_name || query,
      fullName: s.place_formatted || s.name || query,
      type: mappedType,
      province: s.context?.find((c: any) => c.id.startsWith('region'))?.text,
      district: s.context?.find((c: any) => c.id.startsWith('district'))?.text,
      code: 100000 + i,
      geocodeQuery: s.place_formatted || s.name || query,
      mapboxId: s.mapbox_id || s.id
    };
  }) : [];

  // Cache only if no sessionToken is provided
  if (!options?.sessionToken) {
    cache.set(cacheKey, suggestions, CACHE_TTL.LOCATION_SUGGESTIONS);
  }

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

// Cached version using unified cache system
export async function geocodeLocationCached(query: string): Promise<GeocodingResult | null> {
  // Generate cache key for geocoding
  const cacheKey = generateCacheKey('geocoding', { query: query.toLowerCase().trim() });

  // Try to get from cache first
  const cachedResult = cache.get(cacheKey);
  if (cachedResult !== null) {
    return cachedResult;
  }

  // Cache miss - call the main geocodeLocation function (which also caches)
  return await geocodeLocation(query);
}
