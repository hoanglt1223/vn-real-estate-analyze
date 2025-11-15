import { point } from '@turf/helpers';
import * as turf from '@turf/turf';
import { OverpassClient } from '../../shared/services/httpClient';

// Create HTTP client for Overpass API
const overpassClient = new OverpassClient();

// Local cache implementation to avoid shared dependency issues
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class LocalMemoryCache {
  private cache: Map<string, CacheEntry<any>> = new Map();

  set<T>(key: string, data: T, ttl?: number): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || 300000 // 5 minutes default
    };
    this.cache.set(key, entry);
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if entry has expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    for (const [key, entry] of Array.from(this.cache.entries())) {
      if (now - entry.timestamp > entry.ttl) {
        keysToDelete.push(key);
      }
    }
    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
  }
}

// Local cache instance
const localCache = new LocalMemoryCache();

// Cache TTL constants
const CACHE_TTL = {
  AMENITIES: 10 * 60 * 1000, // 10 minutes
  INFRASTRUCTURE: 30 * 60 * 1000, // 30 minutes
};

// Generate cache key function
function generateCacheKey(
  type: 'amenities' | 'infrastructure',
  params: Record<string, any>
): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}:${params[key]}`)
    .join('|');
  return `${type}:${sortedParams}`;
}

// Cleanup expired entries every 10 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    localCache.cleanup();
  }, 10 * 60 * 1000);
}

interface AmenityQuery {
  category: string;
  tags: Record<string, string | string[]>;
}

const AMENITY_QUERIES: Record<string, AmenityQuery> = {
  education: {
    category: 'education',
    tags: {
      amenity: ['school', 'college', 'university', 'kindergarten', 'library'],
    }
  },
  healthcare: {
    category: 'healthcare',
    tags: {
      amenity: ['hospital', 'clinic', 'doctors', 'pharmacy', 'dentist'],
    }
  },
  shopping: {
    category: 'shopping',
    tags: {
      shop: ['supermarket', 'mall', 'department_store', 'convenience', 'electronics', 'mobile_phone', 'furniture', 'clothing', 'shoes', 'bakery', 'butcher', 'greengrocer', 'beverages'],
      amenity: ['bank', 'atm', 'post_office'],
    }
  },
  entertainment: {
    category: 'entertainment',
    tags: {
      amenity: ['cinema', 'theatre', 'restaurant', 'cafe', 'fast_food', 'food_court', 'bar', 'pub'],
      leisure: ['fitness_centre', 'sports_centre', 'stadium', 'park', 'garden'],
      tourism: ['hotel', 'museum', 'artwork', 'gallery'],
    }
  },
  transport: {
    category: 'transport',
    tags: {
      aeroway: ['aerodrome'],
      railway: ['station', 'halt', 'tram_stop'],
      amenity: ['bus_station', 'bus_stop', 'taxi', 'car_sharing', 'bicycle_rental'],
      highway: ['bus_stop'],
    }
  }
};

const INFRASTRUCTURE_QUERIES = {
  roads: { query: '(way["highway"~"motorway|trunk|primary|secondary"]["name"];);', type: 'point' },
  metro: { query: '(node["railway"="station"]["station"="subway"];way["railway"="subway"];);', type: 'point' },
  bus_routes: { query: '(relation["route"="bus"]["name"];);', type: 'line' },
  metro_lines: { query: '(relation["route"="subway"]["name"];);', type: 'line' },
  industrial: { query: '(way["landuse"="industrial"];);', type: 'point' },
  power: { query: '(node["power"="tower"];node["power"="substation"];);', type: 'point' },
  cemetery: { query: '(way["landuse"="cemetery"];);', type: 'point' },
  water: { query: '(way["waterway"~"river|canal|stream"]["name"];);', type: 'point' }
};

export async function fetchAmenities(
  lat: number,
  lng: number,
  radius: number,
  categories: string[],
  includeSmallShops: boolean = false
): Promise<any[]> {
  // Generate cache key based on location, radius, categories, and includeSmallShops setting
  const cacheKey = generateCacheKey('amenities', {
    lat: lat.toFixed(4),
    lng: lng.toFixed(4),
    radius,
    categories: categories.sort().join(','),
    includeSmallShops
  });

  // Try to get from cache first
  const cachedResult = localCache.get(cacheKey);
  if (cachedResult) {
    console.log(`Cache hit for amenities: ${cacheKey}`);
    return cachedResult as any[];
  }

  console.log(`Cache miss for amenities: ${cacheKey}`);
  const allAmenities: any[] = [];

  for (const category of categories) {
    const query = AMENITY_QUERIES[category];
    if (!query) continue;

    // Try to get individual category from cache
    const categoryCacheKey = generateCacheKey('amenities', {
      lat: lat.toFixed(4),
      lng: lng.toFixed(4),
      radius,
      category,
      includeSmallShops
    });

    let categoryAmenities = localCache.get(categoryCacheKey) as any[] || [];

    if (categoryAmenities.length === 0) {
      // Fetch from Overpass API
      try {
        const overpassQuery = buildOverpassQuery(lat, lng, radius, query.tags);
        const response = await overpassClient.query(overpassQuery);

        if (!response.data) continue;

        const data = response.data;
        const elements = data.elements || [];

        categoryAmenities = [];

        for (const element of elements) {
          const elementLat = element.lat || element.center?.lat;
          const elementLng = element.lon || element.center?.lon;

          if (!elementLat || !elementLng) continue;

          if (!isNotablePlace(element.tags, category, includeSmallShops)) continue;

          const distanceValue = turf.distance(
            point([lng, lat]),
            point([elementLng, elementLat]),
            { units: 'meters' }
          );

          const name = element.tags?.name || element.tags?.['name:vi'] || getDefaultName(element.tags, category);

          const amenityType = element.tags?.aeroway || element.tags?.railway || element.tags?.amenity || element.tags?.shop || element.tags?.leisure || element.tags?.highway;

          const subtype = category === 'education'
            ? (element.tags?.['school:type'] || element.tags?.['isced:level'] || element.tags?.operator_type)
            : null;

          // Check if this is a Vietnamese chain
          const isChain = isVietnameseChain(element.tags);

          categoryAmenities.push({
            id: element.id.toString(),
            name,
            category,
            distance: Math.round(distanceValue),
            walkTime: Math.round(distanceValue / 80),
            lat: elementLat,
            lng: elementLng,
            type: amenityType,
            subtype: subtype,
            isChain,
            tags: {
              amenity: element.tags?.amenity,
              shop: element.tags?.shop,
              brand: element.tags?.brand,
              operator: element.tags?.operator,
              name: element.tags?.name,
              name_vi: element.tags?.['name:vi'],
              name_en: element.tags?.['name:en'],
              school_type: element.tags?.['school:type'],
              isced_level: element.tags?.['isced:level'],
              operator_type: element.tags?.operator_type
            }
          });
        }

        // Cache individual category results for longer TTL since amenities change slowly
        localCache.set(categoryCacheKey, categoryAmenities, CACHE_TTL.AMENITIES);

      } catch (error) {
        console.error(`Error fetching ${category} amenities:`, error);
        continue;
      }
    }

    allAmenities.push(...categoryAmenities);
  }

  const sortedAmenities = allAmenities.sort((a, b) => a.distance - b.distance);

  // Cache the combined result
  localCache.set(cacheKey, sortedAmenities, CACHE_TTL.AMENITIES);

  return sortedAmenities;
}

export async function fetchInfrastructure(
  lat: number,
  lng: number,
  radius: number,
  layers: string[]
): Promise<any> {
  // Generate cache key for infrastructure
  const cacheKey = generateCacheKey('infrastructure', {
    lat: lat.toFixed(4),
    lng: lng.toFixed(4),
    radius,
    layers: layers.sort().join(',')
  });

  // Try to get from cache first
  const cachedResult = localCache.get(cacheKey);
  if (cachedResult) {
    console.log(`Cache hit for infrastructure: ${cacheKey}`);
    return cachedResult;
  }

  console.log(`Cache miss for infrastructure: ${cacheKey}`);
  const infrastructure: any = {};

  for (const layer of layers) {
    const queryConfig = INFRASTRUCTURE_QUERIES[layer as keyof typeof INFRASTRUCTURE_QUERIES];
    if (!queryConfig) continue;

    // Try to get individual layer from cache
    const layerCacheKey = generateCacheKey('infrastructure', {
      lat: lat.toFixed(4),
      lng: lng.toFixed(4),
      radius,
      layer
    });

    let layerData = localCache.get(layerCacheKey);

    if (!layerData) {
      try {
        const isLineLayer = queryConfig.type === 'line';
        const overpassQuery = `
          [out:json][timeout:25];
          ${queryConfig.query}
          (around:${radius},${lat},${lng});
          ${isLineLayer ? '>;out geom;' : 'out center;'}
        `;

        const response = await overpassClient.query(overpassQuery);

        if (!response.data) continue;

        const data = response.data;

        if (isLineLayer) {
          const relations = data.elements.filter((e: any) => e.type === 'relation');
          layerData = relations.map((relation: any) => ({
            id: relation.id,
            name: relation.tags?.name || relation.tags?.['name:vi'] || layer,
            type: 'line',
            geometry: extractLineGeometry(data.elements, relation),
            tags: relation.tags
          }));
        } else {
          layerData = (data.elements || []).map((element: any) => ({
            id: element.id,
            name: element.tags?.name || element.tags?.['name:vi'] || layer,
            type: element.type,
            lat: element.lat || element.center?.lat,
            lng: element.lon || element.center?.lon,
            tags: element.tags
          }));
        }

        // Cache individual layer results for longer TTL since infrastructure changes slowly
        localCache.set(layerCacheKey, layerData, CACHE_TTL.INFRASTRUCTURE);

      } catch (error) {
        console.error(`Error fetching ${layer} infrastructure:`, error);
        continue;
      }
    }

    infrastructure[layer] = layerData;
  }

  // Cache the combined result
  localCache.set(cacheKey, infrastructure, CACHE_TTL.INFRASTRUCTURE);

  return infrastructure;
}

function extractLineGeometry(elements: any[], relation: any): number[][][] {
  const members = relation.members || [];
  const wayIds = members.filter((m: any) => m.type === 'way').map((m: any) => m.ref);
  const ways = elements.filter((e: any) => e.type === 'way' && wayIds.includes(e.id));
  
  const lines: number[][][] = [];
  for (const way of ways) {
    if (way.geometry && Array.isArray(way.geometry) && way.geometry.length > 0) {
      const coords = way.geometry.map((node: any) => [node.lon, node.lat]);
      if (coords.length > 1) {
        lines.push(coords);
      }
    }
  }
  
  return lines;
}

function buildOverpassQuery(lat: number, lng: number, radius: number, tags: Record<string, string | string[]>): string {
  const conditions: string[] = [];
  
  for (const [key, value] of Object.entries(tags)) {
    if (Array.isArray(value)) {
      conditions.push(`node["${key}"~"${value.join('|')}"](around:${radius},${lat},${lng});`);
      conditions.push(`way["${key}"~"${value.join('|')}"](around:${radius},${lat},${lng});`);
    } else {
      conditions.push(`node["${key}"="${value}"](around:${radius},${lat},${lng});`);
      conditions.push(`way["${key}"="${value}"](around:${radius},${lat},${lng});`);
    }
  }

  return `
    [out:json][timeout:25];
    (
      ${conditions.join('\n      ')}
    );
    out center;
  `;
}

// Vietnamese chains and notable places
const VIETNAMESE_CHAINS = {
  electronics: ['thế giới di động', 'tgdd', 'fpt shop', 'viettel store', 'vinpro', 'nguyen kim', 'dien may xanh', 'mediamart', 'pico'],
  pharmacy: ['pharmacity', 'long chau', 'an khang', 'fpt long chau', 'nhathuocan khang'],
  supermarket: ['co.opmart', 'coopmart', 'big c', 'go!', 'lotte mart', 'emart', 'aeon mall', 'vinmart', 'winmart', 'bach hoa xanh'],
  convenience: ['circle k', '7-eleven', 'familymart', 'gs25', 'vinmart+', 'winmart+'],
  banking: ['vietcombank', 'vcb', 'techcombank', 'tcb', 'acb', 'sacombank', 'stb', 'bidv', 'vietinbank', 'mb bank', 'agribank', 'vpbank', 'tienphongbank'],
  coffee: ['highlands coffee', 'starbucks', 'the coffee house', 'phúc long', 'trung nguyên', 'cafe den da', 'katinat'],
  fashion: ['zara', 'h&m', 'uniqlo', 'mango', 'pull&bear', 'bershka', 'stradivarius', 'massimo dutti', 'adidas', 'nike', 'puma', 'new balance'],
  restaurants: ['kfc', 'mcdonald\'s', 'pizza hut', 'domino\'s pizza', 'lotteria', 'jollibee', 'subway', 'highlands coffee'],
  entertainment: ['cgv', 'lotte cinema', 'bhd star', 'cinestar', 'galaxy cinema', 'mega gs', 'platinum'],
  education: ['vinschool', 'vinschool', 'apollo english', 'ila', 'british council', 'wall street english']
};

function isVietnameseChain(tags: any): boolean {
  if (!tags) return false;

  const name = (tags.name || tags['name:vi'] || tags['name:en'] || '').toLowerCase();
  const brand = (tags.brand || tags['brand:vi'] || '').toLowerCase();
  const operator = (tags.operator || tags['operator:vi'] || '').toLowerCase();

  for (const [category, chains] of Object.entries(VIETNAMESE_CHAINS)) {
    for (const chain of chains) {
      if (name.includes(chain) || brand.includes(chain) || operator.includes(chain)) {
        return true;
      }
    }
  }

  return false;
}

function isNotablePlace(tags: any, category: string, includeSmallShops: boolean = false): boolean {
  if (!tags) return false;

  // Always include places with names
  if (tags.name || tags['name:vi'] || tags['name:en']) {
    return true;
  }

  // Always include branded places and Vietnamese chains
  if (tags.brand || tags['brand:wikidata'] || isVietnameseChain(tags)) {
    return true;
  }

  // Always include places with wikidata or wikipedia
  if (tags.wikidata || tags.wikipedia) {
    return true;
  }

  // Transport hubs are always notable
  if (category === 'transport') {
    if (tags.aeroway === 'aerodrome') return true;
    if (tags.railway === 'station') return true;
    if (tags.amenity === 'bus_station') return true;
    if (tags.highway === 'bus_stop' && (tags.name || tags.operator)) return true;
    if (tags.operator) return true;
  }

  // Shopping - include major retailers and chains
  if (category === 'shopping') {
    if (tags.shop === 'mall' || tags.shop === 'supermarket' || tags.shop === 'department_store') return true;
    if (tags.shop === 'convenience' && isVietnameseChain(tags)) return true;
    if (tags.amenity === 'bank' || tags.amenity === 'atm') return true;
    if (includeSmallShops && tags.shop) return true; // Include all shops if requested
  }

  // Healthcare - include all medical facilities
  if (category === 'healthcare') {
    if (tags.amenity === 'hospital' || tags.healthcare === 'hospital') return true;
    if (tags.amenity === 'clinic' || tags.amenity === 'doctors' || tags.amenity === 'dentist') return true;
    if (tags.amenity === 'pharmacy') return true; // Include all pharmacies
  }

  // Education - include all educational institutions
  if (category === 'education') {
    if (tags.amenity === 'university' || tags.amenity === 'college') return true;
    if (tags.amenity === 'school' || tags.amenity === 'kindergarten' || tags.amenity === 'library') return true;
  }

  // Entertainment and food
  if (category === 'entertainment') {
    if (tags.amenity === 'cinema' || tags.amenity === 'theatre' || tags.amenity === 'restaurant' || tags.amenity === 'cafe' || tags.amenity === 'fast_food') return true;
    if (tags.leisure === 'stadium' || tags.leisure === 'sports_centre' || tags.leisure === 'fitness_centre') return true;
    if (tags.leisure === 'park' || tags.leisure === 'garden') return true;
    if (tags.tourism === 'hotel' || tags.tourism === 'museum' || tags.tourism === 'gallery') return true;
    if (includeSmallShops && (tags.amenity === 'restaurant' || tags.amenity === 'cafe' || tags.amenity === 'fast_food')) return true;
  }

  return false;
}

function getDefaultName(tags: any, category: string): string {
  const type = tags?.amenity || tags?.shop || tags?.leisure || tags?.aeroway || tags?.railway || tags?.highway;
  const categoryNames: Record<string, string> = {
    education: 'Trường học',
    shopping: 'Cửa hàng',
    entertainment: 'Giải trí',
    transport: 'Điểm giao thông'
  };

  if (category === 'healthcare') {
    if (tags?.amenity === 'hospital' || tags?.healthcare === 'hospital') return 'Bệnh viện';
    if (tags?.amenity === 'clinic') return 'Phòng khám';
    if (tags?.amenity === 'doctors') return 'Phòng khám bác sĩ';
    if (tags?.amenity === 'dentist') return 'Phòng khám nha khoa';
    if (tags?.amenity === 'pharmacy') return 'Nhà thuốc';
    return 'Cơ sở y tế';
  }

  if (category === 'transport') {
    if (tags?.aeroway === 'aerodrome') return 'Sân bay';
    if (tags?.railway === 'station') return 'Nhà ga';
    if (tags?.amenity === 'bus_station') return 'Bến xe buýt';
    if (tags?.highway === 'bus_stop') return 'Trạm xe buýt';
  }

  return categoryNames[category] || 'Địa điểm';
}
