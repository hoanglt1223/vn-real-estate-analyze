import { fetchAmenities, fetchInfrastructure } from './overpass';
import { scrapeMarketPrices } from './scraper';
import { cache, generateCacheKey, CACHE_TTL } from '../../shared/services/cache';

interface PrefetchOptions {
  radius: number;
  prefetchRadius: number; // Larger radius for prefetching
  categories: string[];
  layers: string[];
  enabled: boolean;
}

interface PrefetchTask {
  lat: number;
  lng: number;
  options: PrefetchOptions;
  timestamp: number;
}

class PrefetchService {
  private prefetchQueue: PrefetchTask[] = [];
  private isProcessing = false;
  private prefetchRadiusMultiplier = 1.5; // Prefetch for 1.5x the requested radius
  private nearbyRadiusMultiplier = 2.0; // Prefetch for nearby areas
  private maxQueueSize = 50;

  constructor() {
    // Process prefetch queue every 30 seconds
    setInterval(() => {
      this.processPrefetchQueue();
    }, 30000);

    // Cleanup old prefetch tasks every 5 minutes
    setInterval(() => {
      this.cleanupPrefetchQueue();
    }, 300000);
  }

  public async schedulePrefetch(
    lat: number,
    lng: number,
    options: PrefetchOptions
  ): Promise<void> {
    if (!options.enabled) {
      return;
    }

    // Add main area to prefetch queue with larger radius
    const prefetchTask: PrefetchTask = {
      lat,
      lng,
      options: {
        ...options,
        prefetchRadius: options.radius * this.prefetchRadiusMultiplier
      },
      timestamp: Date.now()
    };

    // Add nearby areas to prefetch queue
    const nearbyAreas = this.generateNearbyAreas(lat, lng, options.radius);
    for (const nearbyArea of nearbyAreas) {
      const nearbyTask: PrefetchTask = {
        lat: nearbyArea.lat,
        lng: nearbyArea.lng,
        options: {
          ...options,
          prefetchRadius: options.radius * this.nearbyRadiusMultiplier
        },
        timestamp: Date.now()
      };

      this.addToQueue(nearbyTask);
    }

    this.addToQueue(prefetchTask);
  }

  private addToQueue(task: PrefetchTask): void {
    // Check if task already exists in queue (avoid duplicates)
    const exists = this.prefetchQueue.some(existingTask =>
      Math.abs(existingTask.lat - task.lat) < 0.001 &&
      Math.abs(existingTask.lng - task.lng) < 0.001 &&
      existingTask.options.prefetchRadius === task.options.prefetchRadius
    );

    if (!exists && this.prefetchQueue.length < this.maxQueueSize) {
      this.prefetchQueue.push(task);
    }
  }

  private generateNearbyAreas(lat: number, lng: number, radius: number): Array<{ lat: number; lng: number }> {
    const nearbyAreas: Array<{ lat: number; lng: number }> = [];
    const radiusKm = radius / 1000;

    // Generate nearby points in different directions
    // North, South, East, West, and diagonal directions
    const directions = [
      { bearing: 0, distance: radiusKm * 0.7 },    // North
      { bearing: 45, distance: radiusKm * 0.5 },  // Northeast
      { bearing: 90, distance: radiusKm * 0.7 },  // East
      { bearing: 135, distance: radiusKm * 0.5 }, // Southeast
      { bearing: 180, distance: radiusKm * 0.7 }, // South
      { bearing: 225, distance: radiusKm * 0.5 }, // Southwest
      { bearing: 270, distance: radiusKm * 0.7 }, // West
      { bearing: 315, distance: radiusKm * 0.5 }  // Northwest
    ];

    for (const direction of directions) {
      const nearbyPoint = this.calculateDestination(lat, lng, direction.bearing, direction.distance);
      nearbyAreas.push(nearbyPoint);
    }

    return nearbyAreas;
  }

  private calculateDestination(lat: number, lng: number, bearing: number, distance: number): { lat: number; lng: number } {
    const earthRadius = 6371; // Earth's radius in kilometers
    const bearingRad = (bearing * Math.PI) / 180;
    const latRad = (lat * Math.PI) / 180;
    const lngRad = (lng * Math.PI) / 180;

    const lat2Rad = Math.asin(
      Math.sin(latRad) * Math.cos(distance / earthRadius) +
      Math.cos(latRad) * Math.sin(distance / earthRadius) * Math.cos(bearingRad)
    );

    const lng2Rad = lngRad + Math.atan2(
      Math.sin(bearingRad) * Math.sin(distance / earthRadius) * Math.cos(latRad),
      Math.cos(distance / earthRadius) - Math.sin(latRad) * Math.sin(lat2Rad)
    );

    return {
      lat: (lat2Rad * 180) / Math.PI,
      lng: (lng2Rad * 180) / Math.PI
    };
  }

  private async processPrefetchQueue(): Promise<void> {
    if (this.isProcessing || this.prefetchQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    console.log(`Processing prefetch queue with ${this.prefetchQueue.length} tasks`);

    // Process up to 5 tasks at a time
    const tasksToProcess = this.prefetchQueue.splice(0, 5);

    try {
      await Promise.allSettled(
        tasksToProcess.map(task => this.processPrefetchTask(task))
      );
    } catch (error) {
      console.error('Error processing prefetch queue:', error);
    }

    this.isProcessing = false;
  }

  private async processPrefetchTask(task: PrefetchTask): Promise<void> {
    const { lat, lng, options } = task;
    const { prefetchRadius, categories, layers } = options;

    try {
      console.log(`Prefetching data for ${lat.toFixed(4)}, ${lng.toFixed(4)} with radius ${prefetchRadius}m`);

      // Prefetch amenities data
      if (categories && categories.length > 0) {
        const amenitiesCacheKey = generateCacheKey('amenities', {
          lat: lat.toFixed(4),
          lng: lng.toFixed(4),
          radius: prefetchRadius,
          categories: categories.sort().join(','),
          includeSmallShops: false
        });

        if (!cache.has(amenitiesCacheKey)) {
          console.log(`Prefetching amenities for ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
          await fetchAmenities(lat, lng, prefetchRadius, categories, false);
        }
      }

      // Prefetch infrastructure data
      if (layers && layers.length > 0) {
        const infrastructureCacheKey = generateCacheKey('infrastructure', {
          lat: lat.toFixed(4),
          lng: lng.toFixed(4),
          radius: prefetchRadius,
          layers: layers.sort().join(',')
        });

        if (!cache.has(infrastructureCacheKey)) {
          console.log(`Prefetching infrastructure for ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
          await fetchInfrastructure(lat, lng, prefetchRadius, layers);
        }
      }

      // Prefetch market data
      const marketCacheKey = generateCacheKey('marketPrices', {
        lat: lat.toFixed(4),
        lng: lng.toFixed(4),
        radius: prefetchRadius
      });

      if (!cache.has(marketCacheKey)) {
        console.log(`Prefetching market data for ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        await scrapeMarketPrices(lat, lng, prefetchRadius);
      }

    } catch (error) {
      console.error(`Error prefetching data for ${lat.toFixed(4)}, ${lng.toFixed(4)}:`, error);
    }
  }

  private cleanupPrefetchQueue(): void {
    const now = Date.now();
    const maxAge = 10 * 60 * 1000; // 10 minutes

    this.prefetchQueue = this.prefetchQueue.filter(task =>
      now - task.timestamp < maxAge
    );

    if (this.prefetchQueue.length > this.maxQueueSize) {
      // Keep only the most recent tasks
      this.prefetchQueue = this.prefetchQueue
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, this.maxQueueSize);
    }
  }

  public getQueueStatus(): { queueSize: number; isProcessing: boolean } {
    return {
      queueSize: this.prefetchQueue.length,
      isProcessing: this.isProcessing
    };
  }

  public clearQueue(): void {
    this.prefetchQueue = [];
  }
}

// Create singleton instance
export const prefetchService = new PrefetchService();

// Helper function to prefetch data for analysis requests
export function prefetchForAnalysis(
  lat: number,
  lng: number,
  radius: number,
  categories: string[],
  layers: string[],
  enabled: boolean = true
): void {
  if (!enabled) {
    return;
  }

  // Schedule prefetch in the background (don't wait)
  prefetchService.schedulePrefetch(lat, lng, {
    radius,
    prefetchRadius: 0, // Will be calculated in service
    categories,
    layers,
    enabled
  }).catch(error => {
    console.error('Error scheduling prefetch:', error);
  });
}

export default prefetchService;