import { type PropertyAnalysis, type InsertPropertyAnalysis } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  createPropertyAnalysis(analysis: InsertPropertyAnalysis): Promise<PropertyAnalysis>;
  getPropertyAnalysis(id: string): Promise<PropertyAnalysis | undefined>;
  getRecentAnalyses(limit: number): Promise<PropertyAnalysis[]>;
  
  cacheAmenities(lat: number, lng: number, radius: number, category: string, data: any[]): Promise<void>;
  getCachedAmenities(lat: number, lng: number, radius: number, category: string): Promise<any[] | null>;
  
  cacheMarketData(lat: number, lng: number, radius: number, source: string, data: any): Promise<void>;
  getCachedMarketData(lat: number, lng: number, radius: number, source: string): Promise<any | null>;
}

export class MemStorage implements IStorage {
  private propertyAnalyses: Map<string, PropertyAnalysis>;
  private amenitiesCache: Map<string, { data: any[], fetchedAt: Date }>;
  private marketDataCache: Map<string, { data: any, fetchedAt: Date }>;

  constructor() {
    this.propertyAnalyses = new Map();
    this.amenitiesCache = new Map();
    this.marketDataCache = new Map();
  }

  async createPropertyAnalysis(analysis: InsertPropertyAnalysis): Promise<PropertyAnalysis> {
    const id = randomUUID();
    const propertyAnalysis: PropertyAnalysis = {
      ...analysis,
      id,
      createdAt: new Date(),
    };
    this.propertyAnalyses.set(id, propertyAnalysis);
    return propertyAnalysis;
  }

  async getPropertyAnalysis(id: string): Promise<PropertyAnalysis | undefined> {
    return this.propertyAnalyses.get(id);
  }

  async getRecentAnalyses(limit: number): Promise<PropertyAnalysis[]> {
    return Array.from(this.propertyAnalyses.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async cacheAmenities(lat: number, lng: number, radius: number, category: string, data: any[]): Promise<void> {
    const key = `${lat.toFixed(4)}_${lng.toFixed(4)}_${radius}_${category}`;
    this.amenitiesCache.set(key, { data, fetchedAt: new Date() });
  }

  async getCachedAmenities(lat: number, lng: number, radius: number, category: string): Promise<any[] | null> {
    const key = `${lat.toFixed(4)}_${lng.toFixed(4)}_${radius}_${category}`;
    const cached = this.amenitiesCache.get(key);
    
    if (!cached) return null;
    
    const hoursSinceFetch = (Date.now() - cached.fetchedAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceFetch > 24) {
      this.amenitiesCache.delete(key);
      return null;
    }
    
    return cached.data;
  }

  async cacheMarketData(lat: number, lng: number, radius: number, source: string, data: any): Promise<void> {
    const key = `${lat.toFixed(4)}_${lng.toFixed(4)}_${radius}_${source}`;
    this.marketDataCache.set(key, { data, fetchedAt: new Date() });
  }

  async getCachedMarketData(lat: number, lng: number, radius: number, source: string): Promise<any | null> {
    const key = `${lat.toFixed(4)}_${lng.toFixed(4)}_${radius}_${source}`;
    const cached = this.marketDataCache.get(key);
    
    if (!cached) return null;
    
    const hoursSinceFetch = (Date.now() - cached.fetchedAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceFetch > 6) {
      this.marketDataCache.delete(key);
      return null;
    }
    
    return cached.data;
  }
}

export const storage = new MemStorage();
