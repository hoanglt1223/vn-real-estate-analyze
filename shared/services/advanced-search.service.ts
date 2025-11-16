import { FileStorageService, PropertyDetails, PropertyFilters, SearchResult } from './file-storage.service.js';

export interface AdvancedSearchFilters extends PropertyFilters {
  // Geospatial filters
  coordinates?: { lat: number; lng: number };
  radius?: number; // in km
  boundingBox?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };

  // Property features
  bedrooms?: { min?: number; max?: number };
  bathrooms?: { min?: number; max?: number };
  floors?: { min?: number; max?: number };
  yearBuilt?: { min?: number; max?: number };

  // Price per m²
  pricePerSqm?: { min?: number; max?: number };

  // Special filters
  hasImages?: boolean;
  isFeatured?: boolean;
  isUrgent?: boolean;
  postedAfter?: Date;
  postedBefore?: Date;

  // Text search options
  searchMode?: 'exact' | 'fuzzy' | 'partial';
  searchFields?: string[]; // ['title', 'description', 'address']

  // Sort options
  sortBy?: 'relevance' | 'price' | 'area' | 'pricePerSqm' | 'createdAt' | 'views' | 'distance';
  sortOrder?: 'asc' | 'desc';
}

export interface AdvancedSearchQuery {
  text?: string;
  filters: AdvancedSearchFilters;
  pagination?: {
    limit?: number;
    offset?: number;
  };
}

export interface AdvancedSearchResult extends SearchResult {
  query: AdvancedSearchQuery;
  filtersApplied: string[];
  searchTime: number; // milliseconds
  suggestions?: {
    text?: string[];
    location?: string[];
    price?: string[];
  };
}

export interface SavedSearch {
  id: string;
  userId: string;
  name: string;
  query: AdvancedSearchQuery;
  createdAt: Date;
  lastUsed?: Date;
  notificationSettings?: {
    email: boolean;
    push: boolean;
    frequency: 'immediate' | 'daily' | 'weekly';
  };
}

export class AdvancedSearchService {
  private static readonly DEFAULT_LIMIT = 20;
  private static readonly MAX_LIMIT = 100;
  private static readonly SEARCH_FIELDS = ['title', 'description', 'address', 'province', 'district'];

  /**
   * Advanced search với geospatial và nhiều filters
   */
  static async advancedSearch(query: AdvancedSearchQuery): Promise<AdvancedSearchResult> {
    const startTime = Date.now();
    const { text, filters, pagination } = query;

    let properties: PropertyDetails[] = [];
    const filtersApplied: string[] = [];

    try {
      // Bắt đầu với tất cả properties
      properties = await FileStorageService.listProperties({ limit: 1000 });

      // Apply text search
      if (text) {
        properties = this.applyTextSearch(properties, text, filters);
        filtersApplied.push('text');
      }

      // Apply property type filters
      if (filters.propertyType) {
        properties = properties.filter(p => {
          if (Array.isArray(filters.propertyType)) {
            return filters.propertyType!.includes(p.propertyType);
          }
          return p.propertyType === filters.propertyType;
        });
        filtersApplied.push('propertyType');
      }

      // Apply transaction type
      if (filters.transactionType) {
        properties = properties.filter(p => p.transactionType === filters.transactionType);
        filtersApplied.push('transactionType');
      }

      // Apply price filters
      if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
        properties = properties.filter(p => {
          if (filters.minPrice !== undefined && p.price < filters.minPrice!) return false;
          if (filters.maxPrice !== undefined && p.price > filters.maxPrice!) return false;
          return true;
        });
        filtersApplied.push('price');
      }

      // Apply price per m² filters
      if (filters.pricePerSqm) {
        properties = properties.filter(p => {
          const pricePerSqm = p.price / p.area;
          if (filters.pricePerSqm!.min !== undefined && pricePerSqm < filters.pricePerSqm!.min!) return false;
          if (filters.pricePerSqm!.max !== undefined && pricePerSqm > filters.pricePerSqm!.max!) return false;
          return true;
        });
        filtersApplied.push('pricePerSqm');
      }

      // Apply area filters
      if (filters.minArea !== undefined || filters.maxArea !== undefined) {
        properties = properties.filter(p => {
          if (filters.minArea !== undefined && p.area < filters.minArea!) return false;
          if (filters.maxArea !== undefined && p.area > filters.maxArea!) return false;
          return true;
        });
        filtersApplied.push('area');
      }

      // Apply location filters
      if (filters.location) {
        const searchText = filters.location.toLowerCase();
        properties = properties.filter(p =>
          p.address.toLowerCase().includes(searchText) ||
          p.province.toLowerCase().includes(searchText) ||
          p.district.toLowerCase().includes(searchText)
        );
        filtersApplied.push('location');
      }

      // Apply province/district filters
      if (filters.province) {
        properties = properties.filter(p => p.province === filters.province);
        filtersApplied.push('province');
      }

      if (filters.district) {
        properties = properties.filter(p => p.district === filters.district);
        filtersApplied.push('district');
      }

      // Apply geospatial filters
      if (filters.coordinates && filters.radius) {
        properties = this.applyGeospatialFilter(properties, filters.coordinates, filters.radius!);
        filtersApplied.push('geospatial');
      }

      if (filters.boundingBox) {
        properties = this.applyBoundingBoxFilter(properties, filters.boundingBox);
        filtersApplied.push('boundingBox');
      }

      // Apply feature filters (placeholder - would need extended property schema)
      if (filters.bedrooms || filters.bathrooms || filters.floors) {
        // TODO: Implement when extended schema is available
        console.log('Feature filters not yet implemented');
      }

      // Apply special filters
      if (filters.hasImages !== undefined) {
        properties = properties.filter(p =>
          filters.hasImages ? p.images.length > 0 : p.images.length === 0
        );
        filtersApplied.push('hasImages');
      }

      // Apply date filters
      if (filters.postedAfter || filters.postedBefore) {
        properties = properties.filter(p => {
          const postedDate = new Date(p.createdAt);
          if (filters.postedAfter && postedDate < filters.postedAfter!) return false;
          if (filters.postedBefore && postedDate > filters.postedBefore!) return false;
          return true;
        });
        filtersApplied.push('date');
      }

      // Apply sorting
      properties = this.applySorting(properties, filters.sortBy, filters.sortOrder, filters.coordinates);

      // Apply pagination
      const limit = Math.min(pagination?.limit || this.DEFAULT_LIMIT, this.MAX_LIMIT);
      const offset = pagination?.offset || 0;
      const paginatedProperties = properties.slice(offset, offset + limit);

      const searchTime = Date.now() - startTime;

      // Generate suggestions
      const suggestions = this.generateSuggestions(query, properties.length);

      return {
        properties: paginatedProperties,
        total: properties.length,
        page: Math.floor(offset / limit) + 1,
        totalPages: Math.ceil(properties.length / limit),
        query,
        filtersApplied,
        searchTime,
        suggestions
      };

    } catch (error: any) {
      console.error('Advanced search error:', error);
      const searchTime = Date.now() - startTime;

      return {
        properties: [],
        total: 0,
        page: 1,
        totalPages: 0,
        query,
        filtersApplied: [],
        searchTime,
        error: error.message
      };
    }
  }

  /**
   * Text search với different modes
   */
  private static applyTextSearch(
    properties: PropertyDetails[],
    text: string,
    filters: AdvancedSearchFilters
  ): PropertyDetails[] {
    const searchText = text.toLowerCase().trim();
    const searchFields = filters.searchFields || this.SEARCH_FIELDS;
    const searchMode = filters.searchMode || 'partial';

    if (!searchText) return properties;

    return properties.filter(property => {
      const searchableText = searchFields.map(field => {
        const value = (property as any)[field];
        return typeof value === 'string' ? value.toLowerCase() : '';
      }).join(' ');

      switch (searchMode) {
        case 'exact':
          return searchableText.includes(searchText);
        case 'fuzzy':
          return this.fuzzyMatch(searchableText, searchText);
        case 'partial':
        default:
          return searchFields.some(field => {
            const value = (property as any)[field];
            return typeof value === 'string' &&
                   value.toLowerCase().includes(searchText);
          });
      }
    });
  }

  /**
   * Geospatial filtering với radius
   */
  private static applyGeospatialFilter(
    properties: PropertyDetails[],
    center: { lat: number; lng: number },
    radiusKm: number
  ): PropertyDetails[] {
    return properties.filter(property => {
      if (!property.coordinates) return false;

      const distance = this.calculateDistance(
        center.lat,
        center.lng,
        property.coordinates.lat,
        property.coordinates.lng
      );

      return distance <= radiusKm;
    });
  }

  /**
   * Bounding box filtering
   */
  private static applyBoundingBoxFilter(
    properties: PropertyDetails[],
    boundingBox: { north: number; south: number; east: number; west: number }
  ): PropertyDetails[] {
    return properties.filter(property => {
      if (!property.coordinates) return false;

      const { lat, lng } = property.coordinates;
      return lat <= boundingBox.north &&
             lat >= boundingBox.south &&
             lng <= boundingBox.east &&
             lng >= boundingBox.west;
    });
  }

  /**
   * Apply sorting
   */
  private static applySorting(
    properties: PropertyDetails[],
    sortBy?: string,
    sortOrder: 'asc' | 'desc' = 'desc',
    userCoordinates?: { lat: number; lng: number }
  ): PropertyDetails[] {
    if (!sortBy || sortBy === 'relevance') {
      return properties;
    }

    return properties.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortBy) {
        case 'price':
          aValue = a.price;
          bValue = b.price;
          break;
        case 'area':
          aValue = a.area;
          bValue = b.area;
          break;
        case 'pricePerSqm':
          aValue = a.price / a.area;
          bValue = b.price / b.area;
          break;
        case 'views':
          aValue = a.views || 0;
          bValue = b.views || 0;
          break;
        case 'createdAt':
          aValue = new Date(a.createdAt);
          bValue = new Date(b.createdAt);
          break;
        case 'distance':
          if (!userCoordinates || !a.coordinates || !b.coordinates) {
            aValue = Infinity;
            bValue = Infinity;
          } else {
            aValue = this.calculateDistance(
              userCoordinates.lat, userCoordinates.lng,
              a.coordinates.lat, a.coordinates.lng
            );
            bValue = this.calculateDistance(
              userCoordinates.lat, userCoordinates.lng,
              b.coordinates.lat, b.coordinates.lng
            );
          }
          break;
        default:
          aValue = a[sortBy as keyof PropertyDetails];
          bValue = b[sortBy as keyof PropertyDetails];
      }

      // Handle undefined values
      if (aValue === undefined && bValue === undefined) return 0;
      if (aValue === undefined) return 1;
      if (bValue === undefined) return -1;

      // Compare based on sort order
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  }

  /**
   * Fuzzy string matching
   */
  private static fuzzyMatch(text: string, search: string): boolean {
    const textWords = text.split(/\s+/);
    const searchWords = search.split(/\s+/);

    let matchCount = 0;
    for (const searchWord of searchWords) {
      for (const textWord of textWords) {
        if (this.levenshteinDistance(searchWord, textWord) <= 2) {
          matchCount++;
          break;
        }
      }
    }

    return matchCount >= Math.ceil(searchWords.length * 0.6);
  }

  /**
   * Calculate Levenshtein distance
   */
  private static levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Calculate distance between two coordinates
   */
  private static calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Generate search suggestions
   */
  private static generateSuggestions(query: AdvancedSearchQuery, resultCount: number): {
    text?: string[];
    location?: string[];
    price?: string[];
  } {
    const suggestions: any = {};

    if (resultCount === 0) {
      // No results - provide alternative suggestions
      if (query.text && query.text.length > 10) {
        suggestions.text = ['Try shorter keywords', 'Check spelling', 'Use different terms'];
      }
      if (query.filters.minPrice && query.filters.maxPrice) {
        const priceRange = query.filters.maxPrice - query.filters.minPrice;
        if (priceRange < 1000000) { // Less than 1 tỷ
          suggestions.price = ['Try expanding price range', 'Check market rates'];
        }
      }
    } else if (resultCount < 5) {
      // Few results - suggest expanding filters
      suggestions.text = ['Try broader search terms', 'Remove some filters'];
    }

    return suggestions;
  }

  /**
   * Save search for user
   */
  static async saveSearch(userId: string, name: string, query: AdvancedSearchQuery): Promise<SavedSearch> {
    const id = crypto.randomUUID();
    const savedSearch: SavedSearch = {
      id,
      userId,
      name,
      query,
      createdAt: new Date()
    };

    // TODO: Implement storage for saved searches
    console.log('Save search:', savedSearch);

    return savedSearch;
  }

  /**
   * Get popular search suggestions
   */
  static async getPopularSearches(limit: number = 10): Promise<string[]> {
    // TODO: Implement based on search analytics
    return [
      'căn hộ quận 2',
      'nhà mặt phố quận 1',
      'đất nền bình dương',
      'biệt thự vinhomes',
      'chung cư cao cấp'
    ].slice(0, limit);
  }
}