import { kv } from '@vercel/kv';

export interface PricePoint {
  id: string;
  propertyId?: string; // Link to property if applicable
  location: {
    address: string;
    province: string;
    district: string;
    ward?: string;
    coordinates?: { lat: number; lng: number };
  };
  propertyType: string; // căn hộ, nhà riêng, đất, etc.
  transactionType: 'bán' | 'cho thuê';
  price: number;
  pricePerSqm: number;
  area: number;
  source: 'batdongsan' | 'chotot' | 'meeymap' | 'user_input';
  sourceUrl?: string;
  postedAt: Date;
  scrapedAt: Date;

  // Additional metadata
  bedrooms?: number;
  bathrooms?: number;
  floors?: number;
  direction?: string;
  legalStatus?: string;
  description?: string;

  // Data quality
  reliability: number; // 0-1 score based on source quality
  isActive: boolean; // tin còn active không
}

export interface PriceTrend {
  period: '1month' | '3months' | '6months' | '1year' | 'all';
  startPrice: number;
  endPrice: number;
  changePercent: number;
  changeAmount: number;
  trendDirection: 'up' | 'down' | 'stable';
  confidence: number; // 0-1 based on data points
  dataPoints: PricePoint[];
}

export interface LocationPriceStats {
  location: string;
  province: string;
  district: string;
  propertyType: string;
  transactionType: string;

  // Current stats
  currentAvgPrice: number;
  currentAvgPricePerSqm: number;
  medianPrice: number;
  priceRange: { min: number; max: number };

  // Historical trends
  trends: {
    '1month': PriceTrend;
    '3months': PriceTrend;
    '6months': PriceTrend;
    '1year': PriceTrend;
  };

  // Volume
  totalListings: number;
  activeListings: number;
  avgDaysOnMarket: number;

  // Predictions
  predictedPriceNextMonth?: number;
  predictedPriceNextQuarter?: number;
  predictionConfidence?: number;
}

export interface PriceAlert {
  id: string;
  userId: string;
  location: {
    province: string;
    district?: string;
    ward?: string;
    propertyType?: string;
  };
  criteria: {
    priceChangePercent?: number; // alert khi giá thay đổi X%
    priceRange?: { min: number; max: number };
    newListingThreshold?: number; // alert khi có listing mới
  };
  isActive: boolean;
  createdAt: Date;
  lastTriggered?: Date;
}

export class HistoricalPriceService {
  private static readonly CACHE_TTL = 3600; // 1 hour
  private static readonly DATA_RETENTION_DAYS = 365 * 2; // 2 years

  /**
   * Scrape price data từ Batdongsan.com.vn
   */
  static async scrapeBatdongsan(
    province: string,
    district?: string,
    propertyType?: string,
    maxPages: number = 5
  ): Promise<PricePoint[]> {
    const pricePoints: PricePoint[] = [];

    try {
      // URL structure cho batdongsan
      const baseUrl = 'https://batdongsan.com.vn';
      let searchPath = `/ban-${propertyType || 'nha-rieng'}`;

      if (province) {
        const provinceSlug = this.getProvinceSlug(province);
        searchPath += `-${provinceSlug}`;

        if (district) {
          const districtSlug = this.getDistrictSlug(district);
          searchPath += `/${districtSlug}`;
        }
      }

      searchPath += '.html';

      for (let page = 1; page <= maxPages; page++) {
        const url = page === 1 ? `${baseUrl}${searchPath}` : `${baseUrl}${searchPath.replace('.html', `/p${page}.html`)}`;

        try {
          // Sử dụng fetch với headers để tránh bị block
          const response = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'vi-VN,vi;q=0.8,en-US;q=0.5,en;q=0.3',
              'Accept-Encoding': 'gzip, deflate',
              'Connection': 'keep-alive',
              'Upgrade-Insecure-Requests': '1',
            }
          });

          if (!response.ok) continue;

          const html = await response.text();
          const pageData = this.parseBatdongsanHTML(html, 'batdongsan', url);
          pricePoints.push(...pageData);

          // Delay giữa requests để không bị block
          await this.delay(1000 + Math.random() * 1000);

        } catch (error) {
          console.error(`Failed to scrape batdongsan page ${page}:`, error);
        }
      }

      return pricePoints;
    } catch (error) {
      console.error('Batdongsan scraping error:', error);
      return [];
    }
  }

  /**
   * Scrape price data từ Chotot.com
   */
  static async scrapeChotot(
    province: string,
    district?: string,
    propertyType?: string,
    maxPages: number = 5
  ): Promise<PricePoint[]> {
    const pricePoints: PricePoint[] = [];

    try {
      const baseUrl = 'https://www.chotot.com';
      let searchPath = `/mua-ban/nha-dat`;

      // Chotot uses different URL structure
      const params = new URLSearchParams();
      params.set('q', propertyType || 'nhà');

      if (province) {
        params.set('region', province);
        if (district) {
          params.set('area', district);
        }
      }

      for (let page = 1; page <= maxPages; page++) {
        if (page > 1) {
          params.set('page', page.toString());
        }

        const url = `${baseUrl}${searchPath}?${params.toString()}`;

        try {
          const response = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'vi-VN,vi;q=0.8,en-US;q=0.5,en;q=0.3',
            }
          });

          if (!response.ok) continue;

          const html = await response.text();
          const pageData = this.parseChototHTML(html, 'chotot', url);
          pricePoints.push(...pageData);

          await this.delay(1500 + Math.random() * 1000);

        } catch (error) {
          console.error(`Failed to scrape chotot page ${page}:`, error);
        }
      }

      return pricePoints;
    } catch (error) {
      console.error('Chotot scraping error:', error);
      return [];
    }
  }

  /**
   * Scrape price data từ MeeyMap.com
   */
  static async scrapeMeeyMap(
    province: string,
    district?: string,
    propertyType?: string
  ): Promise<PricePoint[]> {
    const pricePoints: PricePoint[] = [];

    try {
      // MeeyMap có API endpoint cho price data
      const baseUrl = 'https://api.meeymap.com/v2';

      // Get location data first
      const locationUrl = `${baseUrl}/location/search?q=${encodeURIComponent(province + ' ' + (district || ''))}`;

      const locationResponse = await fetch(locationUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://meeymap.com/',
          'Origin': 'https://meeymap.com',
        }
      });

      if (!locationResponse.ok) return [];

      const locationData = await locationResponse.json();
      if (!locationData.data || locationData.data.length === 0) return [];

      const location = locationData.data[0];

      // Get price data for this location
      const priceUrl = `${baseUrl}/property/price-analysis`;
      const priceParams = {
        locationId: location.id,
        propertyType: propertyType || 'nhà_riêng',
        limit: 100
      };

      const priceResponse = await fetch(`${priceUrl}?${new URLSearchParams(priceParams as any).toString()}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://meeymap.com/',
          'Origin': 'https://meeymap.com',
        }
      });

      if (!priceResponse.ok) return [];

      const priceData = await priceResponse.json();

      // Parse MeeyMap price data
      if (priceData.data && priceData.data.properties) {
        for (const prop of priceData.data.properties) {
          const pricePoint: PricePoint = {
            id: crypto.randomUUID(),
            location: {
              address: prop.address || '',
              province: location.province || province,
              district: location.district || district,
              coordinates: prop.coordinates
            },
            propertyType: prop.propertyType || propertyType || 'khác',
            transactionType: 'bán',
            price: prop.price || 0,
            pricePerSqm: prop.pricePerSqm || 0,
            area: prop.area || 0,
            source: 'meeymap',
            sourceUrl: prop.url,
            postedAt: new Date(prop.postedAt || Date.now()),
            scrapedAt: new Date(),
            reliability: 0.9, // MeeyMap has reliable data
            isActive: prop.status === 'active'
          };

          pricePoints.push(pricePoint);
        }
      }

      return pricePoints;
    } catch (error) {
      console.error('MeeyMap scraping error:', error);
      return [];
    }
  }

  /**
   * Parse HTML từ Batdongsan
   */
  private static parseBatdongsanHTML(html: string, source: string, url: string): PricePoint[] {
    const pricePoints: PricePoint[] = [];

    try {
      // Extract listings using regex patterns (simplified approach)
      const listingRegex = /<div[^>]*class="[^"]*product[^"]*"[^>]*>(.*?)<\/div>/gs;
      const listings = html.match(listingRegex);

      if (!listings) return [];

      for (const listing of listings) {
        try {
          // Extract price
          const priceMatch = listing.match(/<span[^>]*class="[^"]*price[^"]*"[^>]*>(.*?)<\/span>/s);
          const priceText = priceMatch ? priceMatch[1].replace(/[^\d]/g, '') : '0';
          const price = parseInt(priceText) * 1000000; // Convert triệu to VNĐ

          // Extract area
          const areaMatch = listing.match(/<span[^>]*class="[^"]*area[^"]*"[^>]*>(.*?)<\/span>/s);
          const areaText = areaMatch ? areaMatch[1].replace(/[^\d.]/g, '') : '0';
          const area = parseFloat(areaText);

          // Extract address
          const addressMatch = listing.match(/<h3[^>]*class="[^"]*title[^"]*"[^>]*>(.*?)<\/h3>/s);
          const address = addressMatch ? this.cleanText(addressMatch[1]) : '';

          // Extract link
          const linkMatch = listing.match(/<a[^>]*href="([^"]*)"[^>]*>/s);
          const linkUrl = linkMatch ? `https://batdongsan.com.vn${linkMatch[1]}` : url;

          // Extract date
          const dateMatch = listing.match(/<span[^>]*class="[^"]*date[^"]*"[^>]*>(.*?)<\/span>/s);
          const dateText = dateMatch ? dateMatch[1] : '';
          const postedDate = this.parseVietnameseDate(dateText);

          if (price > 0 && area > 0) {
            const pricePoint: PricePoint = {
              id: crypto.randomUUID(),
              location: {
                address,
                province: '', // Will be extracted from URL or address
                district: '',
                coordinates: undefined
              },
              propertyType: 'nhà_riêng', // Default, can be improved
              transactionType: 'bán',
              price,
              pricePerSqm: Math.round(price / area),
              area,
              source: source as 'batdongsan',
              sourceUrl: linkUrl,
              postedAt: postedDate,
              scrapedAt: new Date(),
              reliability: 0.8, // Batdongsan is generally reliable
              isActive: true
            };

            pricePoints.push(pricePoint);
          }
        } catch (error) {
          console.error('Error parsing individual listing:', error);
        }
      }
    } catch (error) {
      console.error('Error parsing Batdongsan HTML:', error);
    }

    return pricePoints;
  }

  /**
   * Parse HTML từ Chotot
   */
  private static parseChototHTML(html: string, source: string, url: string): PricePoint[] {
    const pricePoints: PricePoint[] = [];

    try {
      // Similar parsing logic for Chotot
      // This would need to be adapted based on Chotot's actual HTML structure
      const listingRegex = /<li[^>]*class="[^"]*AdItem[^"]*"[^>]*>(.*?)<\/li>/gs;
      const listings = html.match(listingRegex);

      if (!listings) return [];

      for (const listing of listings) {
        try {
          // Extract price (Chotot format)
          const priceMatch = listing.match(/<span[^>]*class="[^"]*price[^"]*"[^>]*>(.*?)<\/span>/s);
          const priceText = priceMatch ? priceMatch[1].replace(/[^\d]/g, '') : '0';
          const price = parseInt(priceText);

          // Extract area
          const areaMatch = listing.match(/(\d+(?:\.\d+)?)\s*m²/s);
          const area = areaMatch ? parseFloat(areaMatch[1]) : 0;

          // Extract title/address
          const titleMatch = listing.match(/<h3[^>]*class="[^"]*title[^"]*"[^>]*>(.*?)<\/h3>/s);
          const address = titleMatch ? this.cleanText(titleMatch[1]) : '';

          if (price > 0 && area > 0) {
            const pricePoint: PricePoint = {
              id: crypto.randomUUID(),
              location: {
                address,
                province: '',
                district: '',
                coordinates: undefined
              },
              propertyType: 'nhà_riêng',
              transactionType: 'bán',
              price,
              pricePerSqm: Math.round(price / area),
              area,
              source: source as 'chotot',
              sourceUrl: url,
              postedAt: new Date(),
              scrapedAt: new Date(),
              reliability: 0.7, // Chotot is somewhat reliable
              isActive: true
            };

            pricePoints.push(pricePoint);
          }
        } catch (error) {
          console.error('Error parsing Chotot listing:', error);
        }
      }
    } catch (error) {
      console.error('Error parsing Chotot HTML:', error);
    }

    return pricePoints;
  }

  /**
   * Store price points with caching
   */
  static async storePricePoints(pricePoints: PricePoint[]): Promise<void> {
    if (!pricePoints.length) return;

    try {
      // Store in KV cache with location-based keys
      for (const point of pricePoints) {
        const locationKey = `price:${point.location.province}:${point.location.district}:${point.propertyType}`;
        const dailyKey = `price:daily:${new Date().toISOString().split('T')[0]}`;

        // Store in location bucket
        await kv.set(locationKey, JSON.stringify(point));
        await kv.expire(locationKey, this.CACHE_TTL * 24); // 24 hours

        // Store in daily bucket
        await kv.set(dailyKey, JSON.stringify(point));
        await kv.expire(dailyKey, this.DATA_RETENTION_DAYS * 24 * 3600);

        // Store individual point for detailed queries
        const individualKey = `price:point:${point.id}`;
        await kv.set(individualKey, JSON.stringify(point));
        await kv.expire(individualKey, this.DATA_RETENTION_DAYS * 24 * 3600);
      }
    } catch (error) {
      console.error('Error storing price points:', error);
    }
  }

  /**
   * Get price trends for a location
   */
  static async getPriceTrends(
    province: string,
    district?: string,
    propertyType?: string,
    period: '1month' | '3months' | '6months' | '1year' = '3months'
  ): Promise<LocationPriceStats | null> {
    try {
      const locationKey = `price:stats:${province}:${district || 'all'}:${propertyType || 'all'}`;

      // Try to get from cache first
      const cached = await kv.get(locationKey);
      if (cached) {
        return JSON.parse(cached as string);
      }

      // Generate fresh stats
      const stats = await this.calculateLocationStats(province, district, propertyType, period);

      // Cache the result
      await kv.set(locationKey, JSON.stringify(stats));
      await kv.expire(locationKey, this.CACHE_TTL);

      return stats;
    } catch (error) {
      console.error('Error getting price trends:', error);
      return null;
    }
  }

  /**
   * Calculate location statistics
   */
  private static async calculateLocationStats(
    province: string,
    district?: string,
    propertyType?: string,
    period: '1month' | '3months' | '6months' | '1year' = '3months'
  ): Promise<LocationPriceStats> {
    // This would query stored price points and calculate statistics
    // For now, return mock data
    return {
      location: `${province}${district ? ', ' + district : ''}`,
      province,
      district: district || '',
      propertyType: propertyType || 'all',
      transactionType: 'bán',
      currentAvgPrice: 45000000000, // 45 tỷ
      currentAvgPricePerSqm: 45000000, // 45 triệu/m²
      medianPrice: 42000000000,
      priceRange: { min: 25000000000, max: 65000000000 },
      trends: {
        '1month': {
          period: '1month',
          startPrice: 44000000000,
          endPrice: 45000000000,
          changePercent: 2.27,
          changeAmount: 1000000000,
          trendDirection: 'up',
          confidence: 0.8,
          dataPoints: []
        },
        '3months': {
          period: '3months',
          startPrice: 42000000000,
          endPrice: 45000000000,
          changePercent: 7.14,
          changeAmount: 3000000000,
          trendDirection: 'up',
          confidence: 0.9,
          dataPoints: []
        },
        '6months': {
          period: '6months',
          startPrice: 40000000000,
          endPrice: 45000000000,
          changePercent: 12.5,
          changeAmount: 5000000000,
          trendDirection: 'up',
          confidence: 0.85,
          dataPoints: []
        },
        '1year': {
          period: '1year',
          startPrice: 38000000000,
          endPrice: 45000000000,
          changePercent: 18.42,
          changeAmount: 7000000000,
          trendDirection: 'up',
          confidence: 0.75,
          dataPoints: []
        }
      },
      totalListings: 156,
      activeListings: 89,
      avgDaysOnMarket: 45,
      predictedPriceNextMonth: 45600000000,
      predictedPriceNextQuarter: 47000000000,
      predictionConfidence: 0.7
    };
  }

  /**
   * Create price alert
   */
  static async createPriceAlert(alert: Omit<PriceAlert, 'id' | 'createdAt'>): Promise<PriceAlert> {
    const priceAlert: PriceAlert = {
      ...alert,
      id: crypto.randomUUID(),
      createdAt: new Date()
    };

    try {
      const alertKey = `alert:${priceAlert.id}`;
      await kv.set(alertKey, JSON.stringify(priceAlert));

      // Add to user's alerts list
      const userAlertsKey = `alerts:user:${priceAlert.userId}`;
      await kv.set(userAlertsKey, priceAlert.id);

      return priceAlert;
    } catch (error) {
      console.error('Error creating price alert:', error);
      throw error;
    }
  }

  /**
   * Check and trigger price alerts
   */
  static async checkPriceAlerts(): Promise<PriceAlert[]> {
    // Implementation for checking alerts and triggering notifications
    return [];
  }

  // Helper methods
  private static getProvinceSlug(province: string): string {
    const provinceMap: Record<string, string> = {
      'hà nội': 'ha-noi',
      'hồ chí minh': 'ho-chi-minh',
      'đà nẵng': 'da-nang',
      'bình dương': 'binh-duong',
      'đồng nai': 'dong-nai'
    };
    return provinceMap[province.toLowerCase()] || province.toLowerCase().replace(/\s+/g, '-');
  }

  private static getDistrictSlug(district: string): string {
    return district.toLowerCase().replace(/\s+/g, '-').replace(/quận|phường/gi, '').trim();
  }

  private static cleanText(text: string): string {
    return text.replace(/<[^>]*>/g, '').trim();
  }

  private static parseVietnameseDate(dateText: string): Date {
    const now = new Date();

    if (dateText.includes('hôm nay') || dateText.includes('vừa xong')) {
      return now;
    }

    if (dateText.includes('hôm qua')) {
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    if (dateText.includes('ngày')) {
      const days = parseInt(dateText) || 1;
      return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    }

    return now;
  }

  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Quick analysis for location - used in background jobs
   */
  static async analyzeLocationPrices(
    lat: number,
    lng: number,
    radius: number = 2000
  ): Promise<{
    location: string;
    province: string;
    district: string;
    quickStats: {
      avgPrice: number;
      avgPricePerSqm: number;
      totalListings: number;
      marketHeat: 'hot' | 'warm' | 'cold' | 'stable';
    };
    recommendations: string[];
    timestamp: Date;
  }> {
    try {
      // For demo purposes, return mock data quickly
      // In production, this would scrape real data

      // Simple reverse geocoding (simplified)
      const locationInfo = await this.reverseGeocode(lat, lng);

      return {
        location: locationInfo.address,
        province: locationInfo.province,
        district: locationInfo.district,
        quickStats: {
          avgPrice: 45000000000, // 45 tỷ
          avgPricePerSqm: 45000000, // 45 triệu/m²
          totalListings: 89,
          marketHeat: this.calculateQuickMarketHeat()
        },
        recommendations: [
          'Giá đang có xu hướng tăng nhẹ trong khu vực',
          'Nhiều tiện ích giáo dục và y tế trong bán kính 2km',
          'Giao thông thuận tiện, gần các trục đường chính'
        ],
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Quick location analysis error:', error);
      throw error;
    }
  }

  /**
   * Simple reverse geocoding
   */
  private static async reverseGeocode(lat: number, lng: number): Promise<{
    address: string;
    province: string;
    district: string;
  }> {
    // Simplified geocoding - in production use real geocoding service
    // This is just for demo purposes

    if (lat > 21.0 && lat < 21.1 && lng > 105.7 && lng < 105.9) {
      return {
        address: 'Cầu Giấy, Hà Nội',
        province: 'hà nội',
        district: 'cầu giấy'
      };
    } else if (lat > 10.7 && lat < 10.9 && lng > 106.6 && lng < 106.8) {
      return {
        address: 'Quận 1, TP.HCM',
        province: 'hồ chí minh',
        district: 'quận 1'
      };
    } else {
      return {
        address: 'Vị trí chưa xác định',
        province: 'unknown',
        district: 'unknown'
      };
    }
  }

  /**
   * Quick market heat calculation
   */
  private static calculateQuickMarketHeat(): 'hot' | 'warm' | 'cold' | 'stable' {
    // Simple heuristic - in production use real data
    const random = Math.random();
    if (random > 0.7) return 'hot';
    if (random > 0.4) return 'warm';
    if (random > 0.2) return 'stable';
    return 'cold';
  }
}