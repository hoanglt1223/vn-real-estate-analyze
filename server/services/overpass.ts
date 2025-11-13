import * as turf from '@turf/turf';

const OVERPASS_API = 'https://overpass-api.de/api/interpreter';

interface AmenityQuery {
  category: string;
  tags: Record<string, string | string[]>;
}

const AMENITY_QUERIES: Record<string, AmenityQuery> = {
  education: {
    category: 'education',
    tags: {
      amenity: ['kindergarten', 'school', 'college', 'university'],
    }
  },
  healthcare: {
    category: 'healthcare',
    tags: {
      amenity: ['hospital', 'clinic', 'doctors', 'pharmacy'],
    }
  },
  shopping: {
    category: 'shopping',
    tags: {
      shop: ['supermarket', 'convenience', 'mall'],
    }
  },
  entertainment: {
    category: 'entertainment',
    tags: {
      amenity: ['cinema', 'theatre', 'restaurant', 'fast_food', 'cafe'],
      leisure: ['fitness_centre', 'sports_centre'],
    }
  },
  transport: {
    category: 'transport',
    tags: {
      aeroway: ['aerodrome'],
      railway: ['station', 'halt'],
      amenity: ['bus_station'],
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
  categories: string[]
): Promise<any[]> {
  const allAmenities: any[] = [];

  for (const category of categories) {
    const query = AMENITY_QUERIES[category];
    if (!query) continue;

    try {
      const overpassQuery = buildOverpassQuery(lat, lng, radius, query.tags);
      const response = await fetch(OVERPASS_API, {
        method: 'POST',
        body: overpassQuery,
        headers: { 'Content-Type': 'text/plain' }
      });

      if (!response.ok) continue;

      const data = await response.json();
      const elements = data.elements || [];

      for (const element of elements) {
        const elementLat = element.lat || element.center?.lat;
        const elementLng = element.lon || element.center?.lon;
        
        if (!elementLat || !elementLng) continue;

        const distance = turf.distance(
          turf.point([lng, lat]),
          turf.point([elementLng, elementLat]),
          { units: 'meters' }
        );

        const name = element.tags?.name || element.tags?.['name:vi'] || getDefaultName(element.tags, category);

        allAmenities.push({
          id: element.id.toString(),
          name,
          category,
          distance: Math.round(distance),
          walkTime: Math.round(distance / 80),
          lat: elementLat,
          lng: elementLng,
          type: element.tags?.amenity || element.tags?.shop || element.tags?.leisure
        });
      }
    } catch (error) {
      console.error(`Error fetching ${category} amenities:`, error);
    }
  }

  return allAmenities.sort((a, b) => a.distance - b.distance);
}

export async function fetchInfrastructure(
  lat: number,
  lng: number,
  radius: number,
  layers: string[]
): Promise<any> {
  const infrastructure: any = {};

  for (const layer of layers) {
    const queryConfig = INFRASTRUCTURE_QUERIES[layer as keyof typeof INFRASTRUCTURE_QUERIES];
    if (!queryConfig) continue;

    try {
      const isLineLayer = queryConfig.type === 'line';
      const overpassQuery = `
        [out:json][timeout:25];
        ${queryConfig.query}
        (around:${radius},${lat},${lng});
        ${isLineLayer ? '>;out geom;' : 'out center;'}
      `;

      const response = await fetch(OVERPASS_API, {
        method: 'POST',
        body: overpassQuery,
        headers: { 'Content-Type': 'text/plain' }
      });

      if (!response.ok) continue;

      const data = await response.json();
      
      if (isLineLayer) {
        const relations = data.elements.filter((e: any) => e.type === 'relation');
        infrastructure[layer] = relations.map((relation: any) => ({
          id: relation.id,
          name: relation.tags?.name || relation.tags?.['name:vi'] || layer,
          type: 'line',
          geometry: extractLineGeometry(data.elements, relation),
          tags: relation.tags
        }));
      } else {
        infrastructure[layer] = (data.elements || []).map((element: any) => ({
          id: element.id,
          name: element.tags?.name || element.tags?.['name:vi'] || layer,
          type: element.type,
          lat: element.lat || element.center?.lat,
          lng: element.lon || element.center?.lon,
          tags: element.tags
        }));
      }
    } catch (error) {
      console.error(`Error fetching ${layer} infrastructure:`, error);
    }
  }

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

function getDefaultName(tags: any, category: string): string {
  const type = tags?.amenity || tags?.shop || tags?.leisure || tags?.aeroway || tags?.railway || tags?.highway;
  const categoryNames: Record<string, string> = {
    education: 'Trường học',
    healthcare: 'Cơ sở y tế',
    shopping: 'Cửa hàng',
    entertainment: 'Giải trí',
    transport: 'Điểm giao thông'
  };
  
  if (category === 'transport') {
    if (tags?.aeroway === 'aerodrome') return 'Sân bay';
    if (tags?.railway === 'station') return 'Nhà ga';
    if (tags?.amenity === 'bus_station') return 'Bến xe buýt';
    if (tags?.highway === 'bus_stop') return 'Trạm xe buýt';
  }
  
  return categoryNames[category] || 'Địa điểm';
}
