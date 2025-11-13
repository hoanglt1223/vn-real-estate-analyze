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
  }
};

const INFRASTRUCTURE_QUERIES = {
  roads: '(way["highway"~"motorway|trunk|primary|secondary"]["name"];);',
  metro: '(node["railway"="station"]["station"="subway"];way["railway"="subway"];);',
  industrial: '(way["landuse"="industrial"];);',
  power: '(node["power"="tower"];node["power"="substation"];);',
  cemetery: '(way["landuse"="cemetery"];);',
  water: '(way["waterway"~"river|canal|stream"]["name"];);'
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
    const query = INFRASTRUCTURE_QUERIES[layer as keyof typeof INFRASTRUCTURE_QUERIES];
    if (!query) continue;

    try {
      const overpassQuery = `
        [out:json][timeout:25];
        ${query}
        (around:${radius},${lat},${lng});
        out center;
      `;

      const response = await fetch(OVERPASS_API, {
        method: 'POST',
        body: overpassQuery,
        headers: { 'Content-Type': 'text/plain' }
      });

      if (!response.ok) continue;

      const data = await response.json();
      infrastructure[layer] = (data.elements || []).map((element: any) => ({
        id: element.id,
        name: element.tags?.name || element.tags?.['name:vi'] || layer,
        type: element.type,
        lat: element.lat || element.center?.lat,
        lng: element.lon || element.center?.lon,
        tags: element.tags
      }));
    } catch (error) {
      console.error(`Error fetching ${layer} infrastructure:`, error);
    }
  }

  return infrastructure;
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
  const type = tags?.amenity || tags?.shop || tags?.leisure;
  const categoryNames: Record<string, string> = {
    education: 'Trường học',
    healthcare: 'Cơ sở y tế',
    shopping: 'Cửa hàng',
    entertainment: 'Giải trí'
  };
  return categoryNames[category] || 'Địa điểm';
}
