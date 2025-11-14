// Shared geocoding utilities
import { cache, generateCacheKey, CACHE_TTL } from './cache';

export interface GeocodingResult {
  coordinates: [number, number]; // [lng, lat]
  placeName: string;
  placeType: string;
  context?: string;
}

export interface LocationSuggestion {
  name: string;
  fullName: string;
  type: 'address' | 'place' | 'poi' | 'locality' | 'neighborhood';
  code: number;
  geocodeQuery: string;
  mapboxId?: string;
}

// Generic function to make geocoding API calls with caching
export async function fetchWithCache<T>(
  cacheType: 'geocoding' | 'locationSuggestions',
  keyParams: Record<string, any>,
  fetcher: () => Promise<T>,
  ttl?: number
): Promise<T> {
  const cacheKey = generateCacheKey(cacheType, keyParams);

  // Try to get from cache first
  const cachedResult = cache.get(cacheKey);
  if (cachedResult !== null) {
    console.log(`Cache hit for ${cacheType}:`, keyParams);
    return cachedResult;
  }

  console.log(`Cache miss for ${cacheType}:`, keyParams);

  // Fetch new data
  const result = await fetcher();

  // Cache the result (including null results to avoid repeated failed requests)
  cache.set(cacheKey, result, ttl || CACHE_TTL.GEOCODING);

  return result;
}

// Generate cache key for geocoding with consistent format
export function generateGeocodingKey(query: string): string {
  return generateCacheKey('geocoding', { query: query.toLowerCase().trim() });
}

// Generate cache key for location suggestions
export function generateLocationSuggestionsKey(
  query: string,
  options: {
    limit?: number;
    types?: string;
    proximity?: string;
    country?: string;
    language?: string;
  } = {}
): string {
  return generateCacheKey('locationSuggestions', {
    query: query.toLowerCase().trim(),
    limit: options.limit ?? 10,
    types: options.types ?? 'address,place,poi,locality,neighborhood',
    proximity: options.proximity,
    country: options.country ?? 'VN',
    language: options.language ?? 'vi'
  });
}

// Calculate distance between two coordinates in meters
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// Format coordinates consistently
export function formatCoordinates(lat: number, lng: number, precision: number = 6): string {
  return `${lat.toFixed(precision)},${lng.toFixed(precision)}`;
}

// Parse coordinate string
export function parseCoordinates(coordString: string): [number, number] | null {
  const parts = coordString.split(',').map(s => parseFloat(s.trim()));
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return [parts[1], parts[0]]; // Return as [lng, lat]
  }
  return null;
}

// Check if a point is within a given radius of another point
export function isWithinRadius(
  centerLat: number,
  centerLng: number,
  pointLat: number,
  pointLng: number,
  radiusMeters: number
): boolean {
  const distance = calculateDistance(centerLat, centerLng, pointLat, pointLng);
  return distance <= radiusMeters;
}

// Bound coordinates to Vietnam's approximate bounds
export function boundToVietnam(lat: number, lng: number): [number, number] {
  // Vietnam approximate bounds
  const MIN_LAT = 8.0;
  const MAX_LAT = 23.5;
  const MIN_LNG = 102.0;
  const MAX_LNG = 110.0;

  return [
    Math.max(MIN_LNG, Math.min(MAX_LNG, lng)),
    Math.max(MIN_LAT, Math.min(MAX_LAT, lat))
  ];
}

// Generate a bounding box around a center point
export function generateBoundingBox(
  centerLat: number,
  centerLng: number,
  radiusKm: number
): { minLat: number; maxLat: number; minLng: number; maxLng: number } {
  const latDelta = radiusKm / 111.32; // Approximate km per degree latitude
  const lngDelta = radiusKm / (111.32 * Math.cos(centerLat * Math.PI / 180));

  return {
    minLat: centerLat - latDelta,
    maxLat: centerLat + latDelta,
    minLng: centerLng - lngDelta,
    maxLng: centerLng + lngDelta
  };
}