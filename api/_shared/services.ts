// Simple types for the API
export interface PropertyAnalysis {
  id: string;
  coordinates: number[][];
  area: number;
  orientation: number;
  frontageCount: number;
  center: { lat: number; lng: number };
  amenities: any[];
  infrastructure: any;
  marketData: any;
  aiAnalysis: any;
  risks: any[];
  propertyType: string | null;
  valuation: number | null;
  askingPrice: number | null;
  notes: string | null;
  createdAt: Date;
}

export interface InsertPropertyAnalysis {
  coordinates: number[][];
  area: number;
  orientation: number;
  frontageCount: number;
  center: { lat: number; lng: number };
  amenities: any[];
  infrastructure: any;
  marketData: any;
  aiAnalysis: any;
  risks: any[];
  propertyType: string | null;
  valuation: number | null;
  askingPrice: number | null;
  notes: string | null;
}

// Geospatial calculations
import { polygon, center, length, area } from '@turf/turf';
import { point } from '@turf/helpers';

export function calculatePropertyMetrics(coordinates: number[][]) {
  const poly = polygon([coordinates]);
  const centroid = center(poly);
  const [lng, lat] = centroid.geometry.coordinates;

  // Calculate area in square meters
  const areaInSquareMeters = area(poly);

  // Calculate perimeter
  let perimeter = 0;
  for (let i = 0; i < coordinates.length; i++) {
    const current = coordinates[i];
    const next = coordinates[(i + 1) % coordinates.length];
    const distance = length(
      {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [current, next]
        },
        properties: {}
      },
      { units: 'meters' }
    );
    perimeter += distance;
  }

  // Count frontages (roads touching the property)
  let frontageCount = 0;
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

  return {
    area: Math.round(areaInSquareMeters),
    orientation: calculateOrientation(coordinates),
    frontageCount,
    center: { lat, lng },
    perimeter: Math.round(perimeter)
  };
}

function calculateOrientation(coordinates: number[][]): number {
  if (coordinates.length < 2) return 0;

  let totalAngle = 0;
  let count = 0;

  for (let i = 0; i < coordinates.length; i++) {
    const p1 = coordinates[i];
    const p2 = coordinates[(i + 1) % coordinates.length];

    const angle = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]) * (180 / Math.PI);
    totalAngle += angle;
    count++;
  }

  return Math.round((totalAngle / count + 360) % 360);
}

export function assessRisks(center: { lat: number; lng: number }, infrastructure: any) {
  const risks = [];
  let overallRiskLevel = 'low';

  // Check for flood risk (simplified)
  if (infrastructure.water && infrastructure.water.length > 0) {
    risks.push({
      type: 'flood',
      severity: 'medium',
      description: 'Near water bodies - potential flood risk',
      distance: infrastructure.water[0].distance || 0
    });
    overallRiskLevel = 'medium';
  }

  // Check for industrial proximity
  if (infrastructure.industrial && infrastructure.industrial.length > 0) {
    const nearestIndustrial = infrastructure.industrial[0];
    if (nearestIndustrial.distance && nearestIndustrial.distance < 500) {
      risks.push({
        type: 'industrial',
        severity: 'high',
        description: 'Close to industrial area - air/noise pollution risk',
        distance: nearestIndustrial.distance
      });
      overallRiskLevel = 'high';
    }
  }

  return { risks, overallRiskLevel };
}

// Simplified implementations for other services
export async function scrapeMarketPrices(lat: number, lng: number, radius: number) {
  // Mock implementation - in production this would scrape real estate websites
  return {
    min: 30000000,
    avg: 45000000,
    max: 60000000,
    median: 42000000,
    currency: 'VND',
    area: 'm2',
    lastUpdated: new Date(),
    sampleSize: 25
  };
}

export async function analyzeProperty(data: any) {
  // Mock AI analysis
  return {
    score: 7.5,
    recommendations: [
      'Good location for residential development',
      'Consider flood mitigation measures',
      'Access to transportation is adequate'
    ],
    marketValue: 45000000,
    pricePerSqm: 15000000,
    investmentPotential: 'medium'
  };
}

export async function searchLocations(query: string, limit: number = 10) {
  // COMPREHENSIVE SEARCH: Use ALL Mapbox APIs for maximum results
  const token = process.env.MAPBOX_TOKEN || process.env.VITE_MAPBOX_TOKEN;
  if (!token) {
    console.error('Mapbox token not found');
    return [];
  }

  console.log(`🚀 COMPREHENSIVE SEARCH for: "${query}" with limit ${limit}`);

  try {
    // API 1: Places API (highest priority for POIs) - 40% of results
    const placesPromise = fetchMapboxPlaces(query, Math.ceil(limit * 0.4), token);

    // API 2: Geocoding API (reliable for addresses) - 35% of results
    const geocodingPromise = fetchMapboxGeocoding(query, Math.ceil(limit * 0.35), token);

    // API 3: Searchbox API (general search) - 25% of results
    const searchboxPromise = fetchMapboxSearchbox(query, Math.ceil(limit * 0.25), token);

    // Execute all APIs in parallel
    const [geocodingResults, searchboxResults, placesResults] = await Promise.allSettled([
      geocodingPromise,
      searchboxPromise,
      placesPromise
    ]);

    const geocoding = geocodingResults.status === 'fulfilled' ? geocodingResults.value : [];
    const searchbox = searchboxResults.status === 'fulfilled' ? searchboxResults.value : [];
    const places = placesResults.status === 'fulfilled' ? placesResults.value : [];

    console.log(`📊 API Results - Places: ${places.length}, Geocoding: ${geocoding.length}, Searchbox: ${searchbox.length}`);

    // Combine all results - POIs first for priority processing
    const allResults = [...places, ...geocoding, ...searchbox];

    // Deduplicate by name/location
    const deduplicated = deduplicateResults(allResults);

    // Sort by relevance (exact matches first, then starts with, then contains)
    const sorted = sortResultsByRelevance(deduplicated, query);

    const finalResults = sorted.slice(0, limit);

    console.log(`🎯 FINAL RESULTS: ${finalResults.length} unique locations`);
    console.log('Sample results:', finalResults.slice(0, 3).map((r: any) => `${r.name} (${r.type})`));

    return finalResults;
  } catch (error) {
    console.error('Error in comprehensive search:', error);
    return [];
  }
}

export async function suggestLocations(query: string, options: any = {}) {
  // Real suggestions with options support
  return searchLocations(query, options.limit || 10);
}

export async function retrieveLocation(id: string, sessionToken?: string) {
  // Use real Mapbox API for location retrieval
  const token = process.env.MAPBOX_TOKEN || process.env.VITE_MAPBOX_TOKEN;
  if (!token) return null;

  const base = 'https://api.mapbox.com/search/searchbox/v1/retrieve';
  const url = `${base}/${encodeURIComponent(id)}?access_token=${token}${sessionToken ? `&session_token=${sessionToken}` : ''}`;

  try {
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
  } catch (error) {
    console.error('Error retrieving location:', error);
    return null;
  }
}

export async function geocodeLocationCached(query: string) {
  // Real geocoding using Mapbox Geocoding API
  const token = process.env.MAPBOX_TOKEN || process.env.VITE_MAPBOX_TOKEN;
  if (!token) {
    console.error('Mapbox token not found for geocoding');
    return null;
  }

  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${token}&country=VN&language=vi&limit=1`;

  try {
    console.log(`🗺️ Geocoding location: "${query}"`);
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Geocoding API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();

    if (!data.features || !Array.isArray(data.features) || data.features.length === 0) {
      console.error('No geocoding results found for:', query);
      return null;
    }

    const feature = data.features[0];
    const [lng, lat] = feature.geometry.coordinates;

    console.log(`✅ Geocoded "${query}" to [${lat}, ${lng}]`);

    return {
      coordinates: [lng, lat], // [lng, lat] format
      placeName: feature.place_name || query,
      placeType: Array.isArray(feature.place_type) && feature.place_type.length > 0 ? feature.place_type[0] : 'location',
      context: feature.text || undefined,
      bbox: feature.bbox
    };
  } catch (error) {
    console.error('Error in geocodeLocationCached:', error);
    return null;
  }
}

export async function searchCategory(category: string, options: any = {}) {
  // Mock category search
  return [];
}

// ============ HELPER FUNCTIONS FOR COMPREHENSIVE SEARCH ============

// API 1: Mapbox Geocoding (forward geocoding)
async function fetchMapboxGeocoding(query: string, limit: number, token: string): Promise<any[]> {
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${token}&limit=${limit}&country=VN&language=vi&types=address,place,poi,locality`;

  try {
    console.log(`🔍 Geocoding API: ${query}`);
    const response = await fetch(url);
    if (!response.ok) return [];
    const data = await response.json();

    if (!data.features || !Array.isArray(data.features)) return [];

    return data.features.map((feature: any, i: number) => {
      const firstType = Array.isArray(feature.place_type) && feature.place_type.length > 0 ? feature.place_type[0] : 'place';
      const fullName = feature.place_name || feature.text || query;
      const name = feature.text || fullName;
      const [lng, lat] = feature.geometry.coordinates;

      return {
        name,
        fullName,
        type: mapMapboxType(firstType),
        code: 200000 + i,
        geocodeQuery: fullName,
        mapboxId: feature.id,
        source: 'geocoding',
        relevance: feature.relevance || 0.5,
        province: feature.context?.find((c: any) => c.id.startsWith('region'))?.text,
        district: feature.context?.find((c: any) => c.id.startsWith('district'))?.text,
        // Include coordinates directly for faster selection
        lat,
        lng
      };
    });
  } catch (error) {
    console.error('Geocoding API error:', error);
    return [];
  }
}

// API 2: Mapbox Searchbox (modern search)
async function fetchMapboxSearchbox(query: string, limit: number, token: string): Promise<any[]> {
  const url = `https://api.mapbox.com/search/searchbox/v1/suggest?q=${encodeURIComponent(query)}&access_token=${token}&limit=${limit}&country=VN&language=vi&types=address,place,poi,locality`;

  try {
    console.log(`🔍 Searchbox API: ${query}`);
    const response = await fetch(url);
    if (!response.ok) return [];
    const data = await response.json();

    if (!data.suggestions || !Array.isArray(data.suggestions)) return [];

    return data.suggestions.map((s: any, i: number) => ({
      name: s.name || s.feature_name || query,
      fullName: s.place_formatted || s.name || query,
      type: mapMapboxType(s.feature_type),
      code: 300000 + i,
      geocodeQuery: s.place_formatted || s.name || query,
      mapboxId: s.mapbox_id || s.id,
      source: 'searchbox',
      relevance: 0.7, // Searchbox typically has good relevance
      province: s.context?.find((c: any) => c.id.startsWith('region'))?.text,
      district: s.context?.find((c: any) => c.id.startsWith('district'))?.text
    }));
  } catch (error) {
    console.error('Searchbox API error:', error);
    return [];
  }
}

// API 3: Mapbox Places (for comprehensive POI search)
async function fetchMapboxPlaces(query: string, limit: number, token: string): Promise<any[]> {
  // Use Geocoding with POI focus as Places API alternative
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${token}&limit=${limit}&country=VN&language=vi&types=poi,address`;

  try {
    console.log(`🔍 Places/POI API: ${query}`);
    const response = await fetch(url);
    if (!response.ok) return [];
    const data = await response.json();

    if (!data.features || !Array.isArray(data.features)) return [];

    return data.features.map((feature: any, i: number) => {
      const firstType = Array.isArray(feature.place_type) && feature.place_type.length > 0 ? feature.place_type[0] : 'poi';
      const fullName = feature.place_name || feature.text || query;
      const name = feature.text || fullName;

      return {
        name,
        fullName,
        type: firstType === 'poi' ? 'poi' : mapMapboxType(firstType),
        code: 400000 + i,
        geocodeQuery: fullName,
        mapboxId: feature.id,
        source: 'places',
        relevance: feature.relevance || 0.6,
        province: feature.context?.find((c: any) => c.id.startsWith('region'))?.text,
        district: feature.context?.find((c: any) => c.id.startsWith('district'))?.text,
        coordinates: feature.center?.reverse()
      };
    });
  } catch (error) {
    console.error('Places API error:', error);
    return [];
  }
}

// Helper: Map Mapbox types to our interface types - focus on POI > Address > Place > Locality
function mapMapboxType(mapboxType: string): string {
  switch (mapboxType) {
    case 'address': return 'address';
    case 'poi': return 'poi';
    case 'locality': return 'locality';
    case 'place':
    default:
      return 'place';
  }
}

// Helper: Deduplicate results by name and type
function deduplicateResults(results: any[]): any[] {
  const seen = new Set();
  return results.filter(result => {
    const key = `${result.name.toLowerCase()}-${result.type}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

// Helper: Sort results by relevance
function sortResultsByRelevance(results: any[], query: string): any[] {
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(' ').filter(w => w.length > 0);

  return results.sort((a, b) => {
    const aNameLower = a.name.toLowerCase();
    const bNameLower = b.name.toLowerCase();

    // Exact matches first (highest priority)
    const aExact = aNameLower === queryLower;
    const bExact = bNameLower === queryLower;
    if (aExact && !bExact) return -1;
    if (!aExact && bExact) return 1;

    // Enhanced brand name matching for known businesses
    const knownBrands = ['gearvn', 'thế giới di động', 'tgdd', 'fpt shop', 'viettel store'];
    const aIsBrand = knownBrands.some(brand => aNameLower.includes(brand) && queryLower.includes(brand));
    const bIsBrand = knownBrands.some(brand => bNameLower.includes(brand) && queryLower.includes(brand));
    if (aIsBrand && !bIsBrand) return -1;
    if (!aIsBrand && bIsBrand) return 1;

    // Calculate word overlap score for better matching
    const aWordScore = calculateWordOverlap(queryWords, aNameLower);
    const bWordScore = calculateWordOverlap(queryWords, bNameLower);
    if (aWordScore !== bWordScore) return bWordScore - aWordScore;

    // Starts with matches
    const aStarts = aNameLower.startsWith(queryLower);
    const bStarts = bNameLower.startsWith(queryLower);
    if (aStarts && !bStarts) return -1;
    if (!aStarts && bStarts) return 1;

    // Penalty for phonetic similarity but not exact (hoàng nhanh vs hòa hưng)
    const aPhoneticPenalty = calculatePhoneticPenalty(queryLower, aNameLower);
    const bPhoneticPenalty = calculatePhoneticPenalty(queryLower, bNameLower);
    if (aPhoneticPenalty !== bPhoneticPenalty) return bPhoneticPenalty - aPhoneticPenalty;

    // Use API relevance score if available
    const aRelevance = a.relevance || 0;
    const bRelevance = b.relevance || 0;
    if (aRelevance !== bRelevance) return bRelevance - aRelevance;

    // Priority order for types: POI > khu vực > địa chỉ > địa danh
    const typePriority = {
      'poi': 4,        // Highest priority - POIs (shops, businesses, restaurants)
      'locality': 3,   // High priority - khu vực (areas, zones)
      'address': 2,    // Medium priority - địa chỉ (specific addresses)
      'place': 1,      // Lower priority - địa danh (landmarks, places of interest)
      'neighborhood': 1, // địa danh
      'district': 0,    // Not in priority system
      'province': 0,    // Not in priority system
      'region': 0,      // Not in priority system
      'postcode': 0,   // Not in priority system
      'country': 0     // Not in priority system
    };

    const aPriority = typePriority[a.type] || 0;
    const bPriority = typePriority[b.type] || 0;

    if (aPriority !== bPriority) return bPriority - aPriority;

    // Finally alphabetical
    return a.name.localeCompare(b.name, 'vi');
  });
}

// Helper: Calculate word overlap score
function calculateWordOverlap(queryWords: string[], text: string): number {
  const textWords = text.split(' ').filter(w => w.length > 0);
  let overlap = 0;

  for (const queryWord of queryWords) {
    for (const textWord of textWords) {
      if (queryWord === textWord || textWord.includes(queryWord) || queryWord.includes(textWord)) {
        overlap += 1;
        break;
      }
    }
  }

  return overlap;
}

// Helper: Calculate phonetic penalty for Vietnamese words
function calculatePhoneticPenalty(query: string, text: string): number {
  // Vietnamese phonetic similar pairs that often cause confusion
  const phoneticPairs = [
    ['hoàng', 'hòa'],
    ['nhanh', 'hưng'],
    ['nguyen', 'nguyễn'],
    ['phong', 'phường'],
    ['quan', 'quận'],
    ['thanh', 'thành'],
    ['ha', 'hà'],
    ['hai', 'hai'],
    ['nam', 'năm'],
  ];

  let penalty = 0;

  for (const [word1, word2] of phoneticPairs) {
    // If query has word1 and result has word2 (or vice versa), add penalty
    if ((query.includes(word1) && text.includes(word2)) ||
        (query.includes(word2) && text.includes(word1))) {
      penalty += 10; // High penalty for phonetic confusion
    }
  }

  return penalty;
}