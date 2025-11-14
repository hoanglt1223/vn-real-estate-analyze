// Shared data processing utilities

export interface DataProcessingOptions {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
  fields?: string[];
  filter?: Record<string, any>;
}

export interface PaginationResult<T> {
  data: T[];
  total: number;
  page?: number;
  pageSize?: number;
  hasMore: boolean;
}

// Generic function to process and paginate data
export function processData<T>(
  data: T[],
  options: DataProcessingOptions = {}
): PaginationResult<T> {
  let processedData = [...data];

  // Apply filtering
  if (options.filter) {
    processedData = processedData.filter(item => {
      return Object.entries(options.filter!).every(([key, value]) => {
        const itemValue = (item as any)[key];
        if (Array.isArray(value)) {
          return value.includes(itemValue);
        }
        return itemValue === value;
      });
    });
  }

  // Apply sorting
  if (options.sortBy) {
    processedData.sort((a, b) => {
      const aValue = (a as any)[options.sortBy!];
      const bValue = (b as any)[options.sortBy!];

      let comparison = 0;
      if (aValue < bValue) comparison = -1;
      if (aValue > bValue) comparison = 1;

      return options.sortOrder === 'desc' ? -comparison : comparison;
    });
  }

  const total = processedData.length;

  // Apply field selection
  if (options.fields && options.fields.length > 0) {
    processedData = processedData.map(item => {
      const filtered: any = {};
      options.fields!.forEach(field => {
        if ((item as any)[field] !== undefined) {
          filtered[field] = (item as any)[field];
        }
      });
      return filtered as T;
    });
  }

  // Apply pagination
  const offset = options.offset || 0;
  const limit = options.limit || processedData.length;
  const paginatedData = processedData.slice(offset, offset + limit);

  return {
    data: paginatedData,
    total,
    page: Math.floor(offset / (options.limit || 1)) + 1,
    pageSize: options.limit,
    hasMore: offset + limit < total
  };
}

// Process amenities data for optimization
export function processAmenities(amenities: any[], maxItems?: number) {
  if (!amenities || amenities.length === 0) return [];

  // Sort by distance and limit the number
  let sortedAmenities = amenities.sort((a, b) => a.distance - b.distance);
  if (maxItems) {
    sortedAmenities = sortedAmenities.slice(0, maxItems);
  }

  // Remove unnecessary fields and optimize data types
  return sortedAmenities.map(amenity => ({
    id: amenity.id,
    name: amenity.name,
    category: amenity.category,
    distance: amenity.distance,
    walkTime: amenity.walkTime,
    lat: amenity.lat,
    lng: amenity.lng,
    type: amenity.type,
    // Keep only essential tags
    tags: amenity.tags ? {
      amenity: amenity.tags.amenity,
      shop: amenity.tags.shop,
      brand: amenity.tags.brand,
      name: amenity.tags.name
    } : undefined
  }));
}

// Summarize amenities by category
export function summarizeAmenities(amenities: any[]): any {
  const summary: any = {};

  for (const amenity of amenities) {
    const category = amenity.category;
    if (!summary[category]) {
      summary[category] = {
        count: 0,
        avgDistance: 0,
        nearest: null
      };
    }

    summary[category].count++;
    summary[category].avgDistance += amenity.distance;

    if (!summary[category].nearest || amenity.distance < summary[category].nearest.distance) {
      summary[category].nearest = {
        name: amenity.name,
        distance: amenity.distance,
        walkTime: amenity.walkTime
      };
    }
  }

  // Calculate averages
  for (const category of Object.keys(summary)) {
    summary[category].avgDistance = Math.round(
      summary[category].avgDistance / summary[category].count
    );
  }

  return summary;
}

// Process infrastructure data
export function processInfrastructure(infrastructure: any, maxItems?: number): any {
  if (!infrastructure) return {};

  const optimized: any = {};

  for (const [layer, data] of Object.entries(infrastructure as any)) {
    if (!Array.isArray(data)) {
      optimized[layer] = data;
      continue;
    }

    // Limit number of items and remove unnecessary fields
    let processedData = data;
    if (maxItems) {
      processedData = data.slice(0, maxItems);
    }

    optimized[layer] = processedData.map((item: any) => {
      const optimizedItem: any = {
        id: item.id,
        name: item.name,
        type: item.type
      };

      if (item.lat && item.lng) {
        optimizedItem.lat = item.lat;
        optimizedItem.lng = item.lng;
      }

      if (item.geometry) {
        optimizedItem.geometry = item.geometry;
      }

      return optimizedItem;
    });
  }

  return optimized;
}

// Summarize infrastructure
export function summarizeInfrastructure(infrastructure: any): any {
  const summary: any = {};

  for (const [layer, data] of Object.entries(infrastructure as any)) {
    if (Array.isArray(data)) {
      summary[layer] = {
        count: data.length,
        hasGeometry: data.some((item: any) => item.geometry)
      };
    } else {
      summary[layer] = { count: 1 };
    }
  }

  return summary;
}

// Process market data
export function processMarketData(marketData: any): any {
  if (!marketData) return null;

  const optimized: any = {
    min: marketData.min,
    avg: marketData.avg,
    max: marketData.max,
    median: marketData.median,
    pricePerSqm: marketData.pricePerSqm,
    listingCount: marketData.listingCount,
    trend: marketData.trend,
    sources: marketData.sources,
    lastUpdated: marketData.lastUpdated
  };

  // Include limited listings (top 10 instead of 20)
  if (marketData.listings && marketData.listings.length > 0) {
    optimized.listings = marketData.listings
      .slice(0, 10)
      .map((listing: any) => ({
        id: listing.id,
        price: listing.price,
        pricePerSqm: listing.pricePerSqm,
        area: listing.area,
        address: listing.address,
        source: listing.source,
        postedDate: listing.postedDate
      }));
  }

  // Include price history if available (limit to last 6 months)
  if (marketData.priceHistory && marketData.priceHistory.length > 0) {
    optimized.priceHistory = marketData.priceHistory.slice(-6);
  }

  // Include trend analysis summary
  if (marketData.priceTrends) {
    optimized.priceTrends = {
      monthlyChange: marketData.priceTrends.monthlyChange,
      quarterlyChange: marketData.priceTrends.quarterlyChange,
      yearlyChange: marketData.priceTrends.yearlyChange,
      priceDirection: marketData.priceTrends.priceDirection,
      confidence: marketData.priceTrends.confidence,
      analysis: marketData.priceTrends.analysis
    };
  }

  return optimized;
}

// Group data by a specific field
export function groupBy<T>(data: T[], field: keyof T): Record<string, T[]> {
  return data.reduce((groups, item) => {
    const key = String(item[field]);
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(item);
    return groups;
  }, {} as Record<string, T[]>);
}

// Calculate statistics for numeric data
export function calculateStats(data: number[], options: { precision?: number } = {}) {
  if (data.length === 0) return null;

  const sortedData = [...data].sort((a, b) => a - b);
  const sum = data.reduce((acc, val) => acc + val, 0);
  const precision = options.precision || 2;

  return {
    min: Math.min(...data),
    max: Math.max(...data),
    avg: parseFloat((sum / data.length).toFixed(precision)),
    median: sortedData.length % 2 === 0
      ? parseFloat(((sortedData[sortedData.length / 2 - 1] + sortedData[sortedData.length / 2]) / 2).toFixed(precision))
      : sortedData[Math.floor(sortedData.length / 2)],
    count: data.length,
    sum: parseFloat(sum.toFixed(precision))
  };
}