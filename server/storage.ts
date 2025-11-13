import {
  type PropertyAnalysis,
  type InsertPropertyAnalysis,
  type UpdatePropertyAnalysis,
  propertyAnalyses,
  type PropertyComparison,
  type InsertPropertyComparison,
  propertyComparisons,
  type PropertyNote,
  type InsertPropertyNote,
  propertyNotes,
  type SavedSearch,
  type InsertSavedSearch,
  savedSearches
} from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from './db';
import { eq, and, or, gte, lte, like, desc } from 'drizzle-orm';

export interface SearchCriteria {
  query?: string;
  minScore?: number;
  maxScore?: number;
  minPrice?: number;
  maxPrice?: number;
  minArea?: number;
  maxArea?: number;
  propertyType?: string;
  sortBy?: 'date' | 'score' | 'price' | 'area';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

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

  // Property comparisons
  createPropertyComparison(comparison: InsertPropertyComparison): Promise<PropertyComparison>;
  getPropertyComparisons(userId: string): Promise<PropertyComparison[]>;
  deletePropertyComparison(id: string): Promise<boolean>;

  // Property notes
  createPropertyNote(note: InsertPropertyNote): Promise<PropertyNote>;
  getPropertyNotes(propertyId: string): Promise<PropertyNote[]>;
  deletePropertyNote(id: string): Promise<boolean>;

  // Saved searches
  createSavedSearch(search: InsertSavedSearch): Promise<SavedSearch>;
  getSavedSearches(userId: string): Promise<SavedSearch[]>;
  deleteSavedSearch(id: string): Promise<boolean>;

  // Advanced search and filtering
  searchPropertyAnalyses(criteria: SearchCriteria): Promise<PropertyAnalysis[]>;
}

export class MemStorage implements IStorage {
  private propertyAnalyses: Map<string, PropertyAnalysis>;
  private amenitiesCache: Map<string, { data: any[], fetchedAt: Date }>;
  private marketDataCache: Map<string, { data: any, fetchedAt: Date }>;
  private propertyComparisons: Map<string, PropertyComparison>;
  private propertyNotes: Map<string, PropertyNote>;
  private savedSearches: Map<string, SavedSearch>;

  constructor() {
    this.propertyAnalyses = new Map();
    this.amenitiesCache = new Map();
    this.marketDataCache = new Map();
    this.propertyComparisons = new Map();
    this.propertyNotes = new Map();
    this.savedSearches = new Map();
  }

  async createPropertyAnalysis(analysis: InsertPropertyAnalysis): Promise<PropertyAnalysis> {
    const id = randomUUID();
    const propertyAnalysis: PropertyAnalysis = {
      ...analysis,
      id,
      createdAt: new Date(),
      amenities: analysis.amenities ?? null,
      infrastructure: analysis.infrastructure ?? null,
      risks: analysis.risks ?? null,
      propertyType: analysis.propertyType ?? null,
      marketData: analysis.marketData ?? null,
      aiAnalysis: analysis.aiAnalysis ?? null,
      valuation: analysis.valuation ?? null,
      askingPrice: analysis.askingPrice ?? null,
      notes: analysis.notes ?? null,
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

  // Property comparisons
  async createPropertyComparison(comparison: InsertPropertyComparison): Promise<PropertyComparison> {
    const id = randomUUID();
    const propertyComparison: PropertyComparison = {
      ...comparison,
      id,
      createdAt: new Date(),
    };
    this.propertyComparisons.set(id, propertyComparison);
    return propertyComparison;
  }

  async getPropertyComparisons(userId: string): Promise<PropertyComparison[]> {
    return Array.from(this.propertyComparisons.values())
      .filter(c => c.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async deletePropertyComparison(id: string): Promise<boolean> {
    return this.propertyComparisons.delete(id);
  }

  // Property notes
  async createPropertyNote(note: InsertPropertyNote): Promise<PropertyNote> {
    const id = randomUUID();
    const propertyNote: PropertyNote = {
      ...note,
      id,
      createdAt: new Date(),
    };
    this.propertyNotes.set(id, propertyNote);
    return propertyNote;
  }

  async getPropertyNotes(propertyId: string): Promise<PropertyNote[]> {
    return Array.from(this.propertyNotes.values())
      .filter(n => n.propertyId === propertyId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async deletePropertyNote(id: string): Promise<boolean> {
    return this.propertyNotes.delete(id);
  }

  // Saved searches
  async createSavedSearch(search: InsertSavedSearch): Promise<SavedSearch> {
    const id = randomUUID();
    const savedSearch: SavedSearch = {
      ...search,
      id,
      createdAt: new Date(),
    };
    this.savedSearches.set(id, savedSearch);
    return savedSearch;
  }

  async getSavedSearches(userId: string): Promise<SavedSearch[]> {
    return Array.from(this.savedSearches.values())
      .filter(s => s.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async deleteSavedSearch(id: string): Promise<boolean> {
    return this.savedSearches.delete(id);
  }

  // Advanced search and filtering
  async searchPropertyAnalyses(criteria: SearchCriteria): Promise<PropertyAnalysis[]> {
    let filtered = Array.from(this.propertyAnalyses.values());

    // Text search
    if (criteria.query) {
      const query = criteria.query.toLowerCase();
      filtered = filtered.filter(p =>
        p.notes?.toLowerCase().includes(query) ||
        p.propertyType?.toLowerCase().includes(query) ||
        p.orientation?.toLowerCase().includes(query)
      );
    }

    // Score filtering
    if (criteria.minScore !== undefined || criteria.maxScore !== undefined) {
      filtered = filtered.filter(p => {
        const score = p.aiAnalysis?.scores?.overall || 0;
        if (criteria.minScore !== undefined && score < criteria.minScore) return false;
        if (criteria.maxScore !== undefined && score > criteria.maxScore) return false;
        return true;
      });
    }

    // Price filtering
    if (criteria.minPrice !== undefined || criteria.maxPrice !== undefined) {
      filtered = filtered.filter(p => {
        const pricePerSqm = p.marketData?.avgPricePerSqm;
        if (!pricePerSqm) return false;
        if (criteria.minPrice !== undefined && pricePerSqm < criteria.minPrice) return false;
        if (criteria.maxPrice !== undefined && pricePerSqm > criteria.maxPrice) return false;
        return true;
      });
    }

    // Area filtering
    if (criteria.minArea !== undefined || criteria.maxArea !== undefined) {
      filtered = filtered.filter(p => {
        if (criteria.minArea !== undefined && p.area < criteria.minArea) return false;
        if (criteria.maxArea !== undefined && p.area > criteria.maxArea) return false;
        return true;
      });
    }

    // Property type filtering
    if (criteria.propertyType) {
      filtered = filtered.filter(p => p.propertyType === criteria.propertyType);
    }

    // Sorting
    filtered.sort((a, b) => {
      const order = criteria.sortOrder === 'asc' ? 1 : -1;
      switch (criteria.sortBy) {
        case 'date':
          return order * (b.createdAt.getTime() - a.createdAt.getTime());
        case 'score':
          const scoreA = a.aiAnalysis?.scores?.overall || 0;
          const scoreB = b.aiAnalysis?.scores?.overall || 0;
          return order * (scoreB - scoreA);
        case 'price':
          const priceA = a.marketData?.avgPricePerSqm || 0;
          const priceB = b.marketData?.avgPricePerSqm || 0;
          return order * (priceB - priceA);
        case 'area':
          return order * (b.area - a.area);
        default:
          return order * (b.createdAt.getTime() - a.createdAt.getTime());
      }
    });

    // Pagination
    if (criteria.offset !== undefined) {
      filtered = filtered.slice(criteria.offset);
    }
    if (criteria.limit !== undefined) {
      filtered = filtered.slice(0, criteria.limit);
    }

    return filtered;
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

  // Property comparisons
  async createPropertyComparison(comparison: InsertPropertyComparison): Promise<PropertyComparison> {
    const [result] = await db.insert(propertyComparisons).values(comparison).returning();
    return result;
  }

  async getPropertyComparisons(userId: string): Promise<PropertyComparison[]> {
    const { desc } = await import('drizzle-orm');
    return db.select().from(propertyComparisons)
      .where(eq(propertyComparisons.userId, userId))
      .orderBy(desc(propertyComparisons.createdAt));
  }

  async deletePropertyComparison(id: string): Promise<boolean> {
    const result = await db.delete(propertyComparisons).where(eq(propertyComparisons.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Property notes
  async createPropertyNote(note: InsertPropertyNote): Promise<PropertyNote> {
    const [result] = await db.insert(propertyNotes).values(note).returning();
    return result;
  }

  async getPropertyNotes(propertyId: string): Promise<PropertyNote[]> {
    const { desc } = await import('drizzle-orm');
    return db.select().from(propertyNotes)
      .where(eq(propertyNotes.propertyId, propertyId))
      .orderBy(desc(propertyNotes.createdAt));
  }

  async deletePropertyNote(id: string): Promise<boolean> {
    const result = await db.delete(propertyNotes).where(eq(propertyNotes.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Saved searches
  async createSavedSearch(search: InsertSavedSearch): Promise<SavedSearch> {
    const [result] = await db.insert(savedSearches).values(search).returning();
    return result;
  }

  async getSavedSearches(userId: string): Promise<SavedSearch[]> {
    const { desc } = await import('drizzle-orm');
    return db.select().from(savedSearches)
      .where(eq(savedSearches.userId, userId))
      .orderBy(desc(savedSearches.createdAt));
  }

  async deleteSavedSearch(id: string): Promise<boolean> {
    const result = await db.delete(savedSearches).where(eq(savedSearches.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Advanced search and filtering
  async searchPropertyAnalyses(criteria: SearchCriteria): Promise<PropertyAnalysis[]> {
    const conditions = [];

    // Text search
    if (criteria.query) {
      conditions.push(
        or(
          like(propertyAnalyses.notes, `%${criteria.query}%`),
          like(propertyAnalyses.propertyType, `%${criteria.query}%`),
          like(propertyAnalyses.orientation, `%${criteria.query}%`)
        )
      );
    }

    // Score filtering - using JSON path for aiAnalysis.scores.overall
    if (criteria.minScore !== undefined) {
      // Note: This is a simplified version. In production, you might want to use
      // specialized JSON operators or extract scores to a separate column for better performance
      const allResults = await db.select().from(propertyAnalyses);
      return this.memCache.searchPropertyAnalyses(criteria);
    }

    // Price filtering
    if (criteria.minPrice !== undefined || criteria.maxPrice !== undefined) {
      // Similar to scores, price data is in JSON, so we'll use memCache for now
      const allResults = await db.select().from(propertyAnalyses);
      return this.memCache.searchPropertyAnalyses(criteria);
    }

    // Combine all conditions
    const allConditions = [...conditions];

    // Apply simple filters
    if (criteria.minArea !== undefined) {
      allConditions.push(gte(propertyAnalyses.area, criteria.minArea));
    }
    if (criteria.maxArea !== undefined) {
      allConditions.push(lte(propertyAnalyses.area, criteria.maxArea));
    }
    if (criteria.propertyType) {
      allConditions.push(eq(propertyAnalyses.propertyType, criteria.propertyType));
    }

    // Build the query with all conditions
    const { desc, asc } = await import('drizzle-orm');
    const order = criteria.sortOrder === 'asc' ? asc : desc;

    let query = db.select().from(propertyAnalyses);

    // Apply where conditions if any exist
    if (allConditions.length > 0) {
      query = query.where(and(...allConditions)) as any;
    }

    // Apply sorting
    switch (criteria.sortBy) {
      case 'date':
        query = query.orderBy(order(propertyAnalyses.createdAt)) as any;
        break;
      case 'area':
        query = query.orderBy(order(propertyAnalyses.area)) as any;
        break;
      default:
        query = query.orderBy(desc(propertyAnalyses.createdAt)) as any;
    }

    // Apply pagination
    if (criteria.limit !== undefined) {
      query = query.limit(criteria.limit) as any;
    }
    if (criteria.offset !== undefined) {
      query = query.offset(criteria.offset) as any;
    }

    const results = await query;

    // For complex JSON-based filtering, fall back to memory filtering
    if (criteria.minScore !== undefined || criteria.maxScore !== undefined ||
        criteria.minPrice !== undefined || criteria.maxPrice !== undefined ||
        criteria.sortBy === 'score' || criteria.sortBy === 'price') {
      return this.memCache.searchPropertyAnalyses(criteria);
    }

    return results;
  }
}

export const storage = process.env.DATABASE_URL ? new DbStorage() : new MemStorage();
