import { randomBytes } from 'node:crypto';
import { FileStorageService, PropertyDetails } from './file-storage.service.js';

export interface PropertyComparison {
  id: string;
  name: string;
  userId: string;
  propertyIds: string[];
  properties: PropertyDetails[];
  createdAt: Date;
  updatedAt: Date;
  isPublic: boolean;
  shareToken?: string;
  notes?: string;
}

export interface ComparisonMetrics {
  // Price metrics
  priceRange: {
    min: number;
    max: number;
    average: number;
    median: number;
  };
  pricePerSqmRange: {
    min: number;
    max: number;
    average: number;
    median: number;
  };

  // Area metrics
  areaRange: {
    min: number;
    max: number;
    average: number;
    median: number;
  };

  // Location metrics
  locationSpread: {
    maxDistance: number; // km
    centerPoint: { lat: number; lng: number };
    properties: Array<{
      id: string;
      address: string;
      distanceFromCenter: number;
    }>;
  };

  // Feature analysis
  features: {
    propertyTypes: Record<string, number>;
    transactionTypes: Record<string, number>;
    provinces: Record<string, number>;
    districts: Record<string, number>;
    averageImages: number;
    averageViews: number;
  };

  // Value indicators
  valueScores: Array<{
    propertyId: string;
    score: number; // 0-100
    factors: {
      priceCompetitiveness: number;
      locationScore: number;
      sizeEfficiency: number;
      marketDemand: number;
    };
  }>;
}

export interface ComparisonChart {
  type: 'bar' | 'line' | 'scatter' | 'pie' | 'radar';
  title: string;
  data: any[];
  config?: any;
}

export class PropertyComparisonService {
  /**
   * Create new property comparison
   */
  static async createComparison(
    userId: string,
    name: string,
    propertyIds: string[],
    options?: {
      isPublic?: boolean;
      notes?: string;
    }
  ): Promise<PropertyComparison> {
    // Validate property IDs
    const properties: PropertyDetails[] = [];
    for (const id of propertyIds) {
      const property = await FileStorageService.getProperty(id);
      if (property) {
        properties.push(property);
      }
    }

    if (properties.length < 2) {
      throw new Error('At least 2 valid properties are required for comparison');
    }

    const id = crypto.randomUUID();
    const now = new Date();

    const comparison: PropertyComparison = {
      id,
      name,
      userId,
      propertyIds: properties.map(p => p.id),
      properties,
      createdAt: now,
      updatedAt: now,
      isPublic: options?.isPublic || false,
      notes: options?.notes
    };

    // TODO: Save to storage
    console.log('Create comparison:', comparison);

    return comparison;
  }

  /**
   * Get comparison by ID
   */
  static async getComparison(id: string, userId?: string): Promise<PropertyComparison | null> {
    // TODO: Implement retrieval from storage
    console.log('Get comparison:', id, 'for user:', userId);
    return null;
  }

  /**
   * Get user's comparisons
   */
  static async getUserComparisons(
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
      includePublic?: boolean;
    }
  ): Promise<PropertyComparison[]> {
    // TODO: Implement retrieval from storage
    console.log('Get user comparisons:', userId, options);
    return [];
  }

  /**
   * Delete comparison
   */
  static async deleteComparison(id: string, userId: string): Promise<void> {
    // TODO: Implement deletion from storage
    console.log('Delete comparison:', id, 'for user:', userId);
  }

  /**
   * Generate detailed comparison metrics
   */
  static generateComparisonMetrics(properties: PropertyDetails[]): ComparisonMetrics {
    if (properties.length === 0) {
      throw new Error('No properties to compare');
    }

    const prices = properties.map(p => p.price);
    const pricesPerSqm = properties.map(p => p.price / p.area);
    const areas = properties.map(p => p.area);

    // Calculate price metrics
    const priceRange = this.calculateRange(prices);
    const pricePerSqmRange = this.calculateRange(pricesPerSqm);
    const areaRange = this.calculateRange(areas);

    // Calculate location spread
    const locationSpread = this.calculateLocationSpread(properties);

    // Analyze features
    const features = this.analyzeFeatures(properties);

    // Calculate value scores
    const valueScores = this.calculateValueScores(properties);

    return {
      priceRange,
      pricePerSqmRange,
      areaRange,
      locationSpread,
      features,
      valueScores
    };
  }

  /**
   * Generate comparison charts
   */
  static generateComparisonCharts(properties: PropertyDetails[], metrics: ComparisonMetrics): ComparisonChart[] {
    const charts: ComparisonChart[] = [];

    // Price comparison chart
    charts.push({
      type: 'bar',
      title: 'Giá so sánh',
      data: properties.map(p => ({
        name: p.title,
        value: p.price,
        pricePerSqm: Math.round(p.price / p.area)
      })),
      config: {
        yAxis: 'Giá (VNĐ)',
        secondaryYAxis: 'Giá/m² (VNĐ)'
      }
    });

    // Area comparison chart
    charts.push({
      type: 'bar',
      title: 'Diện tích so sánh',
      data: properties.map(p => ({
        name: p.title,
        area: p.area,
        pricePerSqm: Math.round(p.price / p.area)
      })),
      config: {
        yAxis: 'Diện tích (m²)',
        secondaryYAxis: 'Giá/m² (VNĐ)'
      }
    });

    // Property type distribution
    charts.push({
      type: 'pie',
      title: 'Phân loại bất động sản',
      data: Object.entries(metrics.features.propertyTypes).map(([type, count]) => ({
        name: type,
        value: count
      }))
    });

    // Price per square meter scatter plot
    charts.push({
      type: 'scatter',
      title: 'Giá/m² so với Diện tích',
      data: properties.map(p => ({
        x: p.area,
        y: Math.round(p.price / p.area),
        name: p.title,
        address: p.address
      })),
      config: {
        xAxis: 'Diện tích (m²)',
        yAxis: 'Giá/m² (VNĐ)'
      }
    });

    // Value scores radar chart
    charts.push({
      type: 'radar',
      title: 'Điểm số giá trị',
      data: metrics.valueScores.map(score => ({
        name: properties.find(p => p.id === score.propertyId)?.title || 'Unknown',
        priceCompetitiveness: score.factors.priceCompetitiveness,
        locationScore: score.factors.locationScore,
        sizeEfficiency: score.factors.sizeEfficiency,
        marketDemand: score.factors.marketDemand
      }))
    });

    return charts;
  }

  /**
   * Generate comparison recommendations
   */
  static generateRecommendations(
    properties: PropertyDetails[],
    metrics: ComparisonMetrics
  ): string[] {
    const recommendations: string[] = [];

    // Price recommendations
    const bestValueProperty = metrics.valueScores.reduce((best, current) =>
      current.score > best.score ? current : best
    );

    const bestValueProp = properties.find(p => p.id === bestValueProperty.propertyId);
    if (bestValueProp) {
      recommendations.push(
        `💰 **Giá trị tốt nhất**: ${bestValueProp.title} với điểm số ${bestValueProperty.score}/100`
      );
    }

    // Location recommendations
    if (metrics.locationSpread.maxDistance > 20) {
      recommendations.push(
        '📍 **Lưu ý vị trí**: Các bất động sản cách nhau quá xa, hãy xem xét yếu tố di chuyển'
      );
    }

    // Price range recommendations
    const priceVariance = metrics.priceRange.max / metrics.priceRange.min;
    if (priceVariance > 3) {
      recommendations.push(
        '💡 **Phân tích giá**: Có sự chênh lệch lớn về giá, hãy xem xét kỹ các yếu tố khác nhau'
      );
    }

    // Area recommendations
    if (metrics.features.averageImages < 3) {
      recommendations.push(
        '📸 **Hình ảnh**: Một số bất động sản có ít hình ảnh, hãy yêu cầu thêm thông tin'
      );
    }

    // Market recommendations
    const mostCommonType = Object.entries(metrics.features.propertyTypes)
      .sort(([,a], [,b]) => b - a)[0];

    if (mostCommonType) {
      recommendations.push(
        `🏠 **Xu hướng thị trường**: Loại hình phổ biến nhất là ${mostCommonType[0]} (${mostCommonType[1]} bất động sản)`
      );
    }

    return recommendations;
  }

  /**
   * Export comparison to PDF-friendly format
   */
  static exportToPDF(
    comparison: PropertyComparison,
    metrics: ComparisonMetrics,
    charts: ComparisonChart[],
    recommendations: string[]
  ): any {
    return {
      title: `Báo cáo so sánh: ${comparison.name}`,
      createdAt: comparison.createdAt,
      properties: comparison.properties.map(p => ({
        title: p.title,
        address: p.address,
        price: this.formatCurrency(p.price),
        area: `${p.area} m²`,
        pricePerSqm: this.formatCurrency(Math.round(p.price / p.area)),
        propertyType: p.propertyType,
        transactionType: p.transactionType,
        contact: p.contactPhone
      })),
      summary: {
        totalProperties: comparison.properties.length,
        priceRange: `${this.formatCurrency(metrics.priceRange.min)} - ${this.formatCurrency(metrics.priceRange.max)}`,
        averagePrice: this.formatCurrency(metrics.priceRange.average),
        areaRange: `${metrics.areaRange.min} - ${metrics.areaRange.max} m²`,
        locationSpread: `${Math.round(metrics.locationSpread.maxDistance)} km`
      },
      charts,
      recommendations,
      notes: comparison.notes
    };
  }

  /**
   * Calculate range statistics
   */
  private static calculateRange(values: number[]): {
    min: number;
    max: number;
    average: number;
    median: number;
  } {
    const sorted = [...values].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const average = sorted.reduce((sum, val) => sum + val, 0) / sorted.length;
    const median = sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];

    return { min, max, average, median };
  }

  /**
   * Calculate location spread
   */
  private static calculateLocationSpread(properties: PropertyDetails[]): {
    maxDistance: number;
    centerPoint: { lat: number; lng: number };
    properties: Array<{
      id: string;
      address: string;
      distanceFromCenter: number;
    }>;
  } {
    const validProperties = properties.filter(p => p.coordinates);

    if (validProperties.length === 0) {
      return {
        maxDistance: 0,
        centerPoint: { lat: 0, lng: 0 },
        properties: []
      };
    }

    // Calculate center point
    const avgLat = validProperties.reduce((sum, p) => sum + p.coordinates!.lat, 0) / validProperties.length;
    const avgLng = validProperties.reduce((sum, p) => sum + p.coordinates!.lng, 0) / validProperties.length;
    const centerPoint = { lat: avgLat, lng: avgLng };

    // Calculate distances from center
    const propertiesWithDistance = validProperties.map(p => ({
      id: p.id,
      address: p.address,
      distanceFromCenter: this.calculateDistance(
        centerPoint.lat,
        centerPoint.lng,
        p.coordinates!.lat,
        p.coordinates!.lng
      )
    }));

    const maxDistance = Math.max(...propertiesWithDistance.map(p => p.distanceFromCenter));

    return {
      maxDistance,
      centerPoint,
      properties: propertiesWithDistance
    };
  }

  /**
   * Analyze features
   */
  private static analyzeFeatures(properties: PropertyDetails[]): {
    propertyTypes: Record<string, number>;
    transactionTypes: Record<string, number>;
    provinces: Record<string, number>;
    districts: Record<string, number>;
    averageImages: number;
    averageViews: number;
  } {
    const propertyTypes: Record<string, number> = {};
    const transactionTypes: Record<string, number> = {};
    const provinces: Record<string, number> = {};
    const districts: Record<string, number> = {};

    let totalImages = 0;
    let totalViews = 0;

    properties.forEach(p => {
      // Count property types
      propertyTypes[p.propertyType] = (propertyTypes[p.propertyType] || 0) + 1;

      // Count transaction types
      transactionTypes[p.transactionType] = (transactionTypes[p.transactionType] || 0) + 1;

      // Count provinces
      provinces[p.province] = (provinces[p.province] || 0) + 1;

      // Count districts
      if (p.district) {
        districts[p.district] = (districts[p.district] || 0) + 1;
      }

      // Sum images and views
      totalImages += p.images?.length || 0;
      totalViews += p.views || 0;
    });

    return {
      propertyTypes,
      transactionTypes,
      provinces,
      districts,
      averageImages: properties.length > 0 ? totalImages / properties.length : 0,
      averageViews: properties.length > 0 ? totalViews / properties.length : 0
    };
  }

  /**
   * Calculate value scores
   */
  private static calculateValueScores(properties: PropertyDetails[]): Array<{
    propertyId: string;
    score: number;
    factors: {
      priceCompetitiveness: number;
      locationScore: number;
      sizeEfficiency: number;
      marketDemand: number;
    };
  }> {
    const prices = properties.map(p => p.price);
    const areas = properties.map(p => p.area);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const avgArea = areas.reduce((sum, a) => sum + a, 0) / areas.length;

    return properties.map(property => {
      // Price competitiveness (lower is better)
      const priceCompetitiveness = maxPrice > minPrice
        ? ((maxPrice - property.price) / (maxPrice - minPrice)) * 100
        : 50;

      // Size efficiency (price per sqm vs average)
      const pricePerSqm = property.price / property.area;
      const avgPricePerSqm = avgPrice / avgArea;
      const sizeEfficiency = Math.max(0, Math.min(100,
        (1 - (pricePerSqm - avgPricePerSqm) / avgPricePerSqm) * 100 + 50
      ));

      // Location score (based on views and contact clicks)
      const locationScore = Math.min(100,
        ((property.views || 0) / 10) * 50 + ((property.contactClicks || 0) / 5) * 50
      );

      // Market demand (based on favorites and status)
      const marketDemand = (property.favoriteCount || 0) * 10 +
        (property.status === 'active' ? 50 : 30);

      // Overall score
      const score = Math.round(
        (priceCompetitiveness * 0.3 +
         sizeEfficiency * 0.25 +
         locationScore * 0.25 +
         marketDemand * 0.2)
      );

      return {
        propertyId: property.id,
        score: Math.max(0, Math.min(100, score)),
        factors: {
          priceCompetitiveness: Math.round(priceCompetitiveness),
          locationScore: Math.round(locationScore),
          sizeEfficiency: Math.round(sizeEfficiency),
          marketDemand: Math.round(Math.max(0, Math.min(100, marketDemand)))
        }
      };
    });
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
   * Format currency
   */
  private static formatCurrency(amount: number): string {
    if (amount >= 1000000000) {
      return `${(amount / 1000000000).toFixed(2)} tỷ VNĐ`;
    } else if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(0)} triệu VNĐ`;
    } else {
      return `${amount.toLocaleString('vi-VN')} VNĐ`;
    }
  }

  /**
   * Generate share token for public comparisons
   */
  static generateShareToken(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Validate comparison permissions
   */
  static async validateAccess(
    comparisonId: string,
    userId?: string,
    shareToken?: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    // TODO: Implement access validation
    console.log('Validate access:', { comparisonId, userId, shareToken });
    return { allowed: true };
  }
}