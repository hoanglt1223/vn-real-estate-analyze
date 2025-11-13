import { type PropertyAnalysis, type InsertPropertyAnalysis, type UpdatePropertyAnalysis, propertyAnalyses } from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from './db';
import { eq } from 'drizzle-orm';

export interface IStorage {
  createPropertyAnalysis(analysis: InsertPropertyAnalysis): Promise<PropertyAnalysis>;
  getPropertyAnalysis(id: string): Promise<PropertyAnalysis | undefined>;
  getRecentAnalyses(limit: number): Promise<PropertyAnalysis[]>;
  listPropertyAnalyses(): Promise<PropertyAnalysis[]>;
  updatePropertyAnalysis(id: string, data: Partial<InsertPropertyAnalysis>): Promise<PropertyAnalysis | undefined>;
  deletePropertyAnalysis(id: string): Promise<boolean>;
  
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

  async listPropertyAnalyses(): Promise<PropertyAnalysis[]> {
    return Array.from(this.propertyAnalyses.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async updatePropertyAnalysis(id: string, data: Partial<InsertPropertyAnalysis>): Promise<PropertyAnalysis | undefined> {
    const existing = this.propertyAnalyses.get(id);
    if (!existing) return undefined;
    
    const updated: PropertyAnalysis = {
      ...existing,
      ...data,
      id,
      createdAt: existing.createdAt
    };
    this.propertyAnalyses.set(id, updated);
    return updated;
  }

  async deletePropertyAnalysis(id: string): Promise<boolean> {
    return this.propertyAnalyses.delete(id);
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

export class DbStorage implements IStorage {
  private memCache: MemStorage;

  constructor() {
    this.memCache = new MemStorage();
  }

  async createPropertyAnalysis(analysis: InsertPropertyAnalysis): Promise<PropertyAnalysis> {
    const [result] = await db.insert(propertyAnalyses).values(analysis).returning();
    return result;
  }

  async getPropertyAnalysis(id: string): Promise<PropertyAnalysis | undefined> {
    const [result] = await db.select().from(propertyAnalyses).where(eq(propertyAnalyses.id, id));
    return result;
  }

  async getRecentAnalyses(limit: number): Promise<PropertyAnalysis[]> {
    const { desc } = await import('drizzle-orm');
    return db.select().from(propertyAnalyses).orderBy(desc(propertyAnalyses.createdAt)).limit(limit);
  }

  async listPropertyAnalyses(): Promise<PropertyAnalysis[]> {
    const { desc } = await import('drizzle-orm');
    return db.select().from(propertyAnalyses).orderBy(desc(propertyAnalyses.createdAt));
  }

  async updatePropertyAnalysis(id: string, data: Partial<InsertPropertyAnalysis>): Promise<PropertyAnalysis | undefined> {
    const allowedFields = {
      propertyType: data.propertyType,
      valuation: data.valuation,
      askingPrice: data.askingPrice,
      notes: data.notes
    };
    
    const [result] = await db.update(propertyAnalyses)
      .set(allowedFields)
      .where(eq(propertyAnalyses.id, id))
      .returning();
    return result;
  }

  async deletePropertyAnalysis(id: string): Promise<boolean> {
    const result = await db.delete(propertyAnalyses).where(eq(propertyAnalyses.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async cacheAmenities(lat: number, lng: number, radius: number, category: string, data: any[]): Promise<void> {
    return this.memCache.cacheAmenities(lat, lng, radius, category, data);
  }

  async getCachedAmenities(lat: number, lng: number, radius: number, category: string): Promise<any[] | null> {
    return this.memCache.getCachedAmenities(lat, lng, radius, category);
  }

  async cacheMarketData(lat: number, lng: number, radius: number, source: string, data: any): Promise<void> {
    return this.memCache.cacheMarketData(lat, lng, radius, source, data);
  }

  async getCachedMarketData(lat: number, lng: number, radius: number, source: string): Promise<any | null> {
    return this.memCache.getCachedMarketData(lat, lng, radius, source);
  }
}

export const storage = process.env.DATABASE_URL ? new DbStorage() : new MemStorage();
