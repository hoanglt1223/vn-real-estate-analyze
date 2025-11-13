// Vietnam Provinces API integration
// Uses provinces.open-api.vn - free, no authentication required

export interface Province {
  code: number;
  name: string;
  codename: string;
  division_type: string;
  phone_code: number;
  districts?: District[];
}

export interface District {
  code: number;
  name: string;
  codename: string;
  division_type: string;
  province_code: number;
  wards?: Ward[];
}

export interface Ward {
  code: number;
  name: string;
  codename: string;
  division_type: string;
  district_code: number;
}

export interface SearchResult {
  name: string;
  fullName: string;
  type: 'province' | 'district' | 'ward';
  province?: string;
  district?: string;
  code: number;
}

const PROVINCES_API_BASE = 'https://provinces.open-api.vn/api';

let provincesCache: Province[] | null = null;

export async function getAllProvinces(): Promise<Province[]> {
  // Use cache if available
  if (provincesCache) {
    return provincesCache;
  }

  try {
    const response = await fetch(`${PROVINCES_API_BASE}/p/?depth=2`);
    if (!response.ok) {
      throw new Error(`Vietnam Provinces API error: ${response.status}`);
    }
    
    const provinces: Province[] = await response.json();
    provincesCache = provinces;
    return provinces;
  } catch (error) {
    console.error('Failed to fetch provinces:', error);
    throw new Error('Unable to load Vietnam location data. Please try again later.');
  }
}

export async function searchLocations(query: string, limit: number = 10): Promise<SearchResult[]> {
  if (!query || query.trim().length < 2) {
    return [];
  }

  const provinces = await getAllProvinces();
  const results: SearchResult[] = [];
  const queryLower = query.toLowerCase().trim();
  
  // Remove Vietnamese diacritics for better matching
  const normalizeVietnamese = (str: string): string => {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D');
  };
  
  const queryNormalized = normalizeVietnamese(query);

  // Search provinces
  for (const province of provinces) {
    const provinceName = province.name.toLowerCase();
    const provinceNormalized = normalizeVietnamese(province.name);
    
    if (provinceName.includes(queryLower) || provinceNormalized.includes(queryNormalized)) {
      results.push({
        name: province.name,
        fullName: province.name,
        type: 'province',
        code: province.code
      });
    }

    // Search districts within this province
    if (province.districts) {
      for (const district of province.districts) {
        const districtName = district.name.toLowerCase();
        const districtNormalized = normalizeVietnamese(district.name);
        
        if (districtName.includes(queryLower) || districtNormalized.includes(queryNormalized)) {
          results.push({
            name: district.name,
            fullName: `${district.name}, ${province.name}`,
            type: 'district',
            province: province.name,
            code: district.code
          });
        }
      }
    }
    
    // Stop if we have enough results
    if (results.length >= limit * 2) {
      break;
    }
  }

  // Sort by relevance (exact matches first, then partial)
  results.sort((a, b) => {
    const aExact = a.name.toLowerCase() === queryLower;
    const bExact = b.name.toLowerCase() === queryLower;
    if (aExact && !bExact) return -1;
    if (!aExact && bExact) return 1;
    
    const aStarts = a.name.toLowerCase().startsWith(queryLower);
    const bStarts = b.name.toLowerCase().startsWith(queryLower);
    if (aStarts && !bStarts) return -1;
    if (!aStarts && bStarts) return 1;
    
    // Prefer provinces over districts
    if (a.type === 'province' && b.type !== 'province') return -1;
    if (a.type !== 'province' && b.type === 'province') return 1;
    
    return 0;
  });

  return results.slice(0, limit);
}

export async function getProvinceByCode(code: number): Promise<Province | null> {
  const provinces = await getAllProvinces();
  return provinces.find(p => p.code === code) || null;
}
