import fs from 'fs';
import path from 'path';
import { kv } from '@vercel/kv';

// Interfaces
export interface PropertyDetails {
  id: string;
  userId: string;
  propertyType: string;
  transactionType: string;
  title: string;
  description: string;
  area: number;
  price: number;
  address: string;
  province: string;
  district: string;
  ward?: string;
  street?: string;
  coordinates?: { lat: number; lng: number };
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
  images: Array<{
    url: string;
    filename: string;
    size: number;
    caption?: string;
    isPrimary: boolean;
  }>;
  status: 'draft' | 'active' | 'expired' | 'sold' | 'rented';
  createdAt: Date;
  updatedAt: Date;
  views: number;
  contactClicks: number;
  favoriteCount: number;
}

export interface CreatePropertyParams {
  propertyType: string;
  transactionType: string;
  title: string;
  description: string;
  area: number;
  price: number;
  address: string;
  province: string;
  district: string;
  ward?: string;
  street?: string;
  coordinates?: { lat: number; lng: number };
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
  images: Array<{
    url: string;
    filename: string;
    size: number;
    caption?: string;
    isPrimary: boolean;
  }>;
  status: 'draft' | 'active' | 'expired' | 'sold' | 'rented';
}

export interface PropertyFilters {
  propertyType?: string[];
  transactionType?: string;
  minPrice?: number;
  maxPrice?: number;
  minArea?: number;
  maxArea?: number;
  location?: string;
  province?: string;
  district?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'price' | 'area' | 'views';
  sortOrder?: 'asc' | 'desc';
}

export interface SearchQuery {
  text?: string;
  filters: PropertyFilters;
  coordinates?: { lat: number; lng: number };
  radius?: number; // in km
}

export interface SearchResult {
  properties: PropertyDetails[];
  total: number;
  page: number;
  totalPages: number;
}

export class FileStorageService {
  private static readonly DATA_DIR = process.env.DATA_DIR ||
    (process.env.NODE_ENV === 'production' ? '/tmp/data' : './data');
  private static readonly CACHE_TTL = 300; // 5 minutes in seconds

  // Initialize data directory structure
  private static ensureDataDir() {
    const dirs = [
      path.join(this.DATA_DIR, 'properties'),
      path.join(this.DATA_DIR, 'users'),
      path.join(this.DATA_DIR, 'analytics'),
      path.join(this.DATA_DIR, 'searches')
    ];

    dirs.forEach(dir => {
      try {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
      } catch (error) {
        // In Vercel serverless, we might not be able to create directories
        // This is expected behavior for read-only filesystem
        console.warn(`Warning: Could not create directory ${dir}:`, error);
      }
    });
  }

  // Properties CRUD operations
  static async createProperty(property: CreatePropertyParams & { userId: string }): Promise<PropertyDetails> {
    this.ensureDataDir();

    const id = crypto.randomUUID();
    const createdAt = new Date();
    const updatedAt = new Date();

    const newProperty = {
      ...property,
      id,
      createdAt,
      updatedAt,
      views: 0,
      contactClicks: 0,
      favoriteCount: 0
    };

    try {
      // Save to file
      const filePath = path.join(this.DATA_DIR, 'properties', `${id}.json`);
      fs.writeFileSync(filePath, JSON.stringify(newProperty, null, 2));

      // Update search index
      try {
        await this.updateSearchIndex(newProperty);
      } catch (error) {
        console.warn('Warning: Could not update search index (KV may not be available):', error);
      }
    } catch (error) {
      console.warn('Warning: Could not save property to file (expected in serverless):', error);
      // In serverless, we'll store in memory or skip persistence
    }

    return newProperty;
  }

  static async getProperty(id: string): Promise<PropertyDetails | null> {
    this.ensureDataDir();

    const filePath = path.join(this.DATA_DIR, 'properties', `${id}.json`);

    try {
      if (!fs.existsSync(filePath)) {
        return null;
      }

      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error reading property:', error);
      return null;
    }
  }

  static async updateProperty(id: string, updates: Partial<PropertyDetails>): Promise<PropertyDetails> {
    this.ensureDataDir();

    const existing = await this.getProperty(id);
    if (!existing) {
      throw new Error('Property not found');
    }

    const updatedProperty = {
      ...existing,
      ...updates,
      updatedAt: new Date()
    };

    try {
      const filePath = path.join(this.DATA_DIR, 'properties', `${id}.json`);
      fs.writeFileSync(filePath, JSON.stringify(updatedProperty, null, 2));
    } catch (error) {
      console.warn('Warning: Could not update property file (expected in serverless):', error);
      // In serverless, we'll continue without file persistence
    }

    // Update search index
    try {
      await this.updateSearchIndex(updatedProperty);
    } catch (error) {
      console.warn('Warning: Could not update search index (KV may not be available):', error);
    }

    return updatedProperty;
  }

  static async deleteProperty(id: string): Promise<void> {
    this.ensureDataDir();

    const filePath = path.join(this.DATA_DIR, 'properties', `${id}.json`);

    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      // Remove from search index
      try {
        await this.removeFromSearchIndex(id);
      } catch (error) {
        console.warn('Warning: Could not remove from search index (KV may not be available):', error);
      }
    } catch (error) {
      console.error('Error deleting property:', error);
      throw new Error('Failed to delete property');
    }
  }

  static async listProperties(filters: PropertyFilters = {}): Promise<PropertyDetails[]> {
    this.ensureDataDir();

    const {
      limit = 20,
      offset = 0,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = filters;

    const propertiesDir = path.join(this.DATA_DIR, 'properties');

    try {
      const files = fs.readdirSync(propertiesDir);
      const properties: PropertyDetails[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = fs.readFileSync(path.join(propertiesDir, file), 'utf-8');
          const property = JSON.parse(data);

          if (this.matchesFilters(property, filters)) {
            properties.push(property);
          }
        }
      }

      // Sort properties
      properties.sort((a, b) => {
        const aValue = a[sortBy as keyof PropertyDetails];
        const bValue = b[sortBy as keyof PropertyDetails];

        // Handle undefined values
        if (aValue === undefined && bValue === undefined) return 0;
        if (aValue === undefined) return 1;
        if (bValue === undefined) return -1;

        if (sortOrder === 'asc') {
          return aValue > bValue ? 1 : -1;
        } else {
          return aValue < bValue ? 1 : -1;
        }
      });

      // Apply pagination
      return properties.slice(offset, offset + limit);
    } catch (error) {
      console.error('Error listing properties:', error);
      return [];
    }
  }

  static async searchProperties(query: SearchQuery): Promise<SearchResult> {
    const { text, filters, coordinates, radius } = query;
    const { limit = 20, offset = 0 } = filters;

    let properties: PropertyDetails[] = [];

    // Get all properties matching filters
    properties = await this.listProperties(filters);

    // Text search
    if (text) {
      const searchText = text.toLowerCase();
      properties = properties.filter(property =>
        property.title.toLowerCase().includes(searchText) ||
        property.description.toLowerCase().includes(searchText) ||
        property.address.toLowerCase().includes(searchText) ||
        property.province.toLowerCase().includes(searchText) ||
        property.district.toLowerCase().includes(searchText)
      );
    }

    // Geospatial search (if coordinates and radius provided)
    if (coordinates && radius) {
      properties = properties.filter(property => {
        if (!property.coordinates) return false;

        const distance = this.calculateDistance(
          coordinates.lat,
          coordinates.lng,
          property.coordinates.lat,
          property.coordinates.lng
        );

        return distance <= radius;
      });
    }

    const total = properties.length;
    const totalPages = Math.ceil(total / limit);
    const page = Math.floor(offset / limit) + 1;

    return {
      properties: properties.slice(offset, offset + limit),
      total,
      page,
      totalPages
    };
  }

  // Analytics tracking
  static async trackView(propertyId: string, metadata?: any): Promise<void> {
    const key = `views:${propertyId}:${new Date().toISOString().split('T')[0]}`;
    await kv.incr(key);
    await kv.expire(key, 86400 * 30); // Keep for 30 days

    // Update property views count
    const property = await this.getProperty(propertyId);
    if (property) {
      await this.updateProperty(propertyId, {
        views: (property.views || 0) + 1
      });
    }
  }

  static async trackContact(propertyId: string, userId?: string): Promise<void> {
    const key = `contacts:${propertyId}:${new Date().toISOString().split('T')[0]}`;
    await kv.incr(key);
    await kv.expire(key, 86400 * 30); // Keep for 30 days

    // Update property contact clicks count
    const property = await this.getProperty(propertyId);
    if (property) {
      await this.updateProperty(propertyId, {
        contactClicks: (property.contactClicks || 0) + 1
      });
    }
  }

  // Search index management
  private static async updateSearchIndex(property: PropertyDetails): Promise<void> {
    const indexKey = 'search:index';
    const indexItem = {
      id: property.id,
      title: property.title,
      location: property.address,
      province: property.province,
      district: property.district,
      price: property.price,
      area: property.area,
      type: property.propertyType,
      transactionType: property.transactionType,
      coordinates: property.coordinates,
      keywords: [
        property.title,
        property.description,
        property.address,
        property.province,
        property.district
      ].join(' ').toLowerCase(),
      updatedAt: property.updatedAt
    };

    // Store in Redis for fast search
    await kv.hset(indexKey, property.id, JSON.stringify(indexItem));
  }

  private static async removeFromSearchIndex(propertyId: string): Promise<void> {
    const indexKey = 'search:index';
    await kv.hdel(indexKey, propertyId);
  }

  // Helper methods
  private static matchesFilters(property: PropertyDetails, filters: PropertyFilters): boolean {
    if (filters.propertyType && !Array.isArray(filters.propertyType) &&
        filters.propertyType !== 'all' && filters.propertyType !== property.propertyType) {
      return false;
    }
    if (filters.propertyType && Array.isArray(filters.propertyType) &&
        !filters.propertyType.includes(property.propertyType)) {
      return false;
    }

    if (filters.transactionType && property.transactionType !== filters.transactionType) {
      return false;
    }

    if (filters.minPrice && property.price < filters.minPrice) {
      return false;
    }

    if (filters.maxPrice && property.price > filters.maxPrice) {
      return false;
    }

    if (filters.minArea && property.area < filters.minArea) {
      return false;
    }

    if (filters.maxArea && property.area > filters.maxArea) {
      return false;
    }

    if (filters.location) {
      const searchText = filters.location.toLowerCase();
      if (!property.address.toLowerCase().includes(searchText) &&
          !property.province.toLowerCase().includes(searchText) &&
          !property.district.toLowerCase().includes(searchText)) {
        return false;
      }
    }

    if (filters.province && property.province !== filters.province) {
      return false;
    }

    if (filters.district && property.district !== filters.district) {
      return false;
    }

    return true;
  }

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
}