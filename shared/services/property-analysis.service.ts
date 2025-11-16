import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { type PropertyAnalysis } from '../schema.js';
import { FileStorageService } from './file-storage.service.js';

// Extended interface for property analysis with duplicate detection info
export interface PropertyAnalysisExtended {
  // Base PropertyAnalysis fields
  id: string;
  coordinates: number[][];
  area: number;
  orientation: string;
  frontageCount: number;
  center: { lat: number; lng: number };
  amenities?: any[];
  infrastructure?: any;
  marketData?: any;
  aiAnalysis?: any;
  risks?: any[];
  propertyType?: string | null;
  valuation?: number | null;
  askingPrice?: number | null;
  notes?: string | null;
  createdAt: Date;

  // Extended fields for duplicate detection
  duplicateOf?: string; // ID of the original property if this is a duplicate
  locationHash?: string; // Hash for location-based duplicate detection
  propertyHash?: string; // Hash for property characteristics duplicate detection
  analysisCount?: number; // Number of times this property has been analyzed
  lastAnalyzedAt?: Date; // Last time this property was analyzed
}

export interface DuplicateDetectionConfig {
  locationThreshold: number; // Distance in meters (default: 50m)
  areaSimilarityThreshold: number; // Percentage difference (default: 10%)
  requireSameOrientation: boolean; // Whether orientation must match (default: false)
}

export interface DuplicateResult {
  isDuplicate: boolean;
  originalId?: string;
  confidence: number; // 0-1, how confident we are it's a duplicate
  reason: string;
  distance?: number; // Distance in meters if location-based duplicate
}

export interface AnalysisMergeResult {
  analysis: PropertyAnalysisExtended;
  wasMerged: boolean;
  originalId?: string;
  mergedFields: string[];
}

export class PropertyAnalysisService {
  private static readonly DATA_DIR = process.env.DATA_DIR ||
    (process.env.NODE_ENV === 'production' ? '/tmp/data' : './data');
  private static readonly ANALYSES_DIR = path.join(this.DATA_DIR, 'analyses');

  // Default duplicate detection configuration
  private static readonly DEFAULT_CONFIG: DuplicateDetectionConfig = {
    locationThreshold: 50, // 50 meters
    areaSimilarityThreshold: 0.1, // 10% difference
    requireSameOrientation: false
  };

  // Initialize data directory structure
  private static ensureDataDir() {
    try {
      if (!fs.existsSync(this.ANALYSES_DIR)) {
        fs.mkdirSync(this.ANALYSES_DIR, { recursive: true });
      }
    } catch (error) {
      console.warn(`Warning: Could not create analyses directory ${this.ANALYSES_DIR}:`, error);
    }
  }

  /**
   * Calculate distance between two coordinates in meters
   */
  private static calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Generate a location hash based on coordinates and area
   */
  private static generateLocationHash(center: { lat: number; lng: number }, area: number): string {
    // Round coordinates to 5 decimal places (~1m precision) and area to nearest square meter
    const latRounded = Math.round(center.lat * 100000) / 100000;
    const lngRounded = Math.round(center.lng * 100000) / 100000;
    const areaRounded = Math.round(area);

    return `${latRounded},${lngRounded},${areaRounded}`;
  }

  /**
   * Generate a property hash based on characteristics
   */
  private static generatePropertyHash(
    area: number,
    orientation: string,
    frontageCount: number,
    coordinates: number[][]
  ): string {
    // Create a normalized hash of property characteristics
    const areaRounded = Math.round(area);
    const orientationNorm = orientation.toLowerCase().trim();
    const frontageNorm = frontageCount;

    // For coordinates, use the bounding box to reduce variance from drawing differences
    const lats = coordinates.map(coord => coord[1]);
    const lngs = coordinates.map(coord => coord[0]);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const bboxNorm = `${Math.round(minLat * 100000)},${Math.round(maxLat * 100000)},${Math.round(minLng * 100000)},${Math.round(maxLng * 100000)}`;

    return `${areaRounded}-${orientationNorm}-${frontageNorm}-${bboxNorm}`;
  }

  /**
   * Check if a property analysis is a duplicate of existing ones
   */
  static async detectDuplicate(
    analysis: PropertyAnalysis,
    config: Partial<DuplicateDetectionConfig> = {}
  ): Promise<DuplicateResult> {
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };

    // Generate hashes for the new analysis
    const locationHash = this.generateLocationHash(analysis.center, analysis.area);
    const propertyHash = this.generatePropertyHash(
      analysis.area,
      analysis.orientation,
      analysis.frontageCount,
      analysis.coordinates
    );

    try {
      // Get all existing analyses
      const existingAnalyses = await this.getAllAnalyses();

      for (const existing of existingAnalyses) {
        const existingLocationHash = this.generateLocationHash(existing.center, existing.area);

        // Check for exact location hash match
        if (existingLocationHash === locationHash) {
          return {
            isDuplicate: true,
            originalId: existing.id,
            confidence: 0.95,
            reason: 'Exact location match (same center and area)'
          };
        }

        // Check for property characteristics match
        const existingPropertyHash = this.generatePropertyHash(
          existing.area,
          existing.orientation,
          existing.frontageCount,
          existing.coordinates
        );

        if (existingPropertyHash === propertyHash) {
          return {
            isDuplicate: true,
            originalId: existing.id,
            confidence: 0.90,
            reason: 'Exact property characteristics match'
          };
        }

        // Check for location proximity
        const distance = this.calculateDistance(
          analysis.center.lat,
          analysis.center.lng,
          existing.center.lat,
          existing.center.lng
        );

        if (distance <= finalConfig.locationThreshold) {
          // Check area similarity
          const areaDiff = Math.abs(analysis.area - existing.area) / existing.area;
          const areaSimilar = areaDiff <= finalConfig.areaSimilarityThreshold;

          // Check orientation if required
          const orientationMatch = !finalConfig.requireSameOrientation ||
                                 analysis.orientation === existing.orientation;

          if (areaSimilar && orientationMatch) {
            const confidence = Math.max(0.5, 1 - (distance / finalConfig.locationThreshold));
            return {
              isDuplicate: true,
              originalId: existing.id,
              confidence,
              reason: `Location proximity (${Math.round(distance)}m) with similar characteristics`,
              distance
            };
          }
        }
      }
    } catch (error) {
      console.error('Error checking for duplicates:', error);
    }

    return {
      isDuplicate: false,
      confidence: 0,
      reason: 'No duplicates found'
    };
  }

  /**
   * Save or merge property analysis with duplicate detection
   */
  static async saveAnalysis(
    analysis: PropertyAnalysis,
    config: Partial<DuplicateDetectionConfig> = {}
  ): Promise<AnalysisMergeResult> {
    this.ensureDataDir();

    // Check for duplicates
    const duplicateCheck = await this.detectDuplicate(analysis, config);

    if (duplicateCheck.isDuplicate && duplicateCheck.originalId) {
      // Merge with existing analysis
      const existing = await this.getAnalysis(duplicateCheck.originalId);
      if (existing) {
        return await this.mergeAnalysis(existing, analysis);
      }
    }

    // No duplicate found, save new analysis
    const extendedAnalysis: PropertyAnalysisExtended = {
      ...analysis,
      locationHash: this.generateLocationHash(analysis.center, analysis.area),
      propertyHash: this.generatePropertyHash(
        analysis.area,
        analysis.orientation,
        analysis.frontageCount,
        analysis.coordinates
      ),
      analysisCount: 1,
      lastAnalyzedAt: new Date()
    };

    try {
      const filePath = path.join(this.ANALYSES_DIR, `${extendedAnalysis.id}.json`);
      fs.writeFileSync(filePath, JSON.stringify(extendedAnalysis, null, 2));

      return {
        analysis: extendedAnalysis,
        wasMerged: false,
        mergedFields: []
      };
    } catch (error) {
      console.warn('Warning: Could not save analysis to file (expected in serverless):', error);
      // Return the analysis anyway for serverless compatibility
      return {
        analysis: extendedAnalysis,
        wasMerged: false,
        mergedFields: []
      };
    }
  }

  /**
   * Merge new analysis data with existing analysis
   */
  private static async mergeAnalysis(
    existing: PropertyAnalysisExtended,
    newAnalysis: PropertyAnalysis
  ): Promise<AnalysisMergeResult> {
    const mergedFields: string[] = [];

    // Create merged analysis
    const merged: PropertyAnalysisExtended = {
      ...existing,
      // Update with newer data if available
      amenities: newAnalysis.amenities || existing.amenities,
      infrastructure: newAnalysis.infrastructure || existing.infrastructure,
      marketData: newAnalysis.marketData || existing.marketData,
      aiAnalysis: newAnalysis.aiAnalysis || existing.aiAnalysis,
      risks: newAnalysis.risks || existing.risks,
      // Update metadata if provided
      propertyType: newAnalysis.propertyType || existing.propertyType,
      valuation: newAnalysis.valuation || existing.valuation,
      askingPrice: newAnalysis.askingPrice || existing.askingPrice,
      notes: newAnalysis.notes || existing.notes,
      // Update analysis tracking
      analysisCount: (existing.analysisCount || 1) + 1,
      lastAnalyzedAt: new Date()
    };

    // Track which fields were actually updated
    if (JSON.stringify(newAnalysis.amenities) !== JSON.stringify(existing.amenities)) {
      mergedFields.push('amenities');
    }
    if (JSON.stringify(newAnalysis.infrastructure) !== JSON.stringify(existing.infrastructure)) {
      mergedFields.push('infrastructure');
    }
    if (JSON.stringify(newAnalysis.marketData) !== JSON.stringify(existing.marketData)) {
      mergedFields.push('marketData');
    }
    if (JSON.stringify(newAnalysis.aiAnalysis) !== JSON.stringify(existing.aiAnalysis)) {
      mergedFields.push('aiAnalysis');
    }
    if (JSON.stringify(newAnalysis.risks) !== JSON.stringify(existing.risks)) {
      mergedFields.push('risks');
    }
    if (newAnalysis.propertyType !== existing.propertyType) {
      mergedFields.push('propertyType');
    }
    if (newAnalysis.valuation !== existing.valuation) {
      mergedFields.push('valuation');
    }
    if (newAnalysis.askingPrice !== existing.askingPrice) {
      mergedFields.push('askingPrice');
    }
    if (newAnalysis.notes !== existing.notes) {
      mergedFields.push('notes');
    }

    try {
      const filePath = path.join(this.ANALYSES_DIR, `${merged.id}.json`);
      fs.writeFileSync(filePath, JSON.stringify(merged, null, 2));
    } catch (error) {
      console.warn('Warning: Could not save merged analysis to file (expected in serverless):', error);
    }

    return {
      analysis: merged,
      wasMerged: true,
      originalId: existing.id,
      mergedFields
    };
  }

  /**
   * Get analysis by ID
   */
  static async getAnalysis(id: string): Promise<PropertyAnalysisExtended | null> {
    this.ensureDataDir();

    const filePath = path.join(this.ANALYSES_DIR, `${id}.json`);

    try {
      if (!fs.existsSync(filePath)) {
        return null;
      }

      const data = fs.readFileSync(filePath, 'utf-8');
      const analysis = JSON.parse(data);

      // Convert date strings back to Date objects
      if (analysis.createdAt && typeof analysis.createdAt === 'string') {
        analysis.createdAt = new Date(analysis.createdAt);
      }
      if (analysis.lastAnalyzedAt && typeof analysis.lastAnalyzedAt === 'string') {
        analysis.lastAnalyzedAt = new Date(analysis.lastAnalyzedAt);
      }

      return analysis;
    } catch (error) {
      console.error('Error reading analysis:', error);
      return null;
    }
  }

  /**
   * Get all analyses
   */
  static async getAllAnalyses(): Promise<PropertyAnalysisExtended[]> {
    this.ensureDataDir();

    try {
      const files = fs.readdirSync(this.ANALYSES_DIR);
      const analyses: PropertyAnalysisExtended[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const data = fs.readFileSync(path.join(this.ANALYSES_DIR, file), 'utf-8');
            const analysis = JSON.parse(data);

            // Convert date strings back to Date objects
            if (analysis.createdAt && typeof analysis.createdAt === 'string') {
              analysis.createdAt = new Date(analysis.createdAt);
            }
            if (analysis.lastAnalyzedAt && typeof analysis.lastAnalyzedAt === 'string') {
              analysis.lastAnalyzedAt = new Date(analysis.lastAnalyzedAt);
            }

            analyses.push(analysis);
          } catch (error) {
            console.error(`Error reading analysis file ${file}:`, error);
          }
        }
      }

      return analyses;
    } catch (error) {
      console.error('Error listing analyses:', error);
      return [];
    }
  }

  /**
   * Get recent analyses with pagination
   */
  static async getRecentAnalyses(limit: number = 10, offset: number = 0): Promise<PropertyAnalysisExtended[]> {
    const allAnalyses = await this.getAllAnalyses();

    // Sort by lastAnalyzedAt (or createdAt if lastAnalyzedAt is not available)
    allAnalyses.sort((a, b) => {
      const dateA = a.lastAnalyzedAt || a.createdAt;
      const dateB = b.lastAnalyzedAt || b.createdAt;
      return dateB.getTime() - dateA.getTime();
    });

    return allAnalyses.slice(offset, offset + limit);
  }

  /**
   * Delete analysis by ID
   */
  static async deleteAnalysis(id: string): Promise<boolean> {
    this.ensureDataDir();

    const filePath = path.join(this.ANALYSES_DIR, `${id}.json`);

    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error deleting analysis:', error);
      return false;
    }
  }

  /**
   * Update analysis metadata
   */
  static async updateAnalysis(
    id: string,
    updates: Partial<Pick<PropertyAnalysis, 'propertyType' | 'valuation' | 'askingPrice' | 'notes'>>
  ): Promise<PropertyAnalysisExtended | null> {
    const existing = await this.getAnalysis(id);
    if (!existing) {
      return null;
    }

    const updated: PropertyAnalysisExtended = {
      ...existing,
      ...updates,
      lastAnalyzedAt: new Date()
    };

    try {
      const filePath = path.join(this.ANALYSES_DIR, `${id}.json`);
      fs.writeFileSync(filePath, JSON.stringify(updated, null, 2));
      return updated;
    } catch (error) {
      console.warn('Warning: Could not update analysis file (expected in serverless):', error);
      return updated;
    }
  }

  /**
   * Search analyses by location or text
   */
  static async searchAnalyses(query: {
    text?: string;
    coordinates?: { lat: number; lng: number };
    radius?: number; // in meters
    limit?: number;
    offset?: number;
  }): Promise<{ analyses: PropertyAnalysisExtended[]; total: number }> {
    const allAnalyses = await this.getAllAnalyses();
    let filtered = [...allAnalyses];

    // Text search in AI analysis and notes
    if (query.text) {
      const searchText = query.text.toLowerCase();
      filtered = filtered.filter(analysis =>
        (analysis.aiAnalysis && JSON.stringify(analysis.aiAnalysis).toLowerCase().includes(searchText)) ||
        (analysis.notes && analysis.notes.toLowerCase().includes(searchText)) ||
        (analysis.propertyType && analysis.propertyType.toLowerCase().includes(searchText))
      );
    }

    // Location-based search
    if (query.coordinates && query.radius) {
      filtered = filtered.filter(analysis => {
        const distance = this.calculateDistance(
          query.coordinates!.lat,
          query.coordinates!.lng,
          analysis.center.lat,
          analysis.center.lng
        );
        return distance <= query.radius!;
      });
    }

    // Sort by lastAnalyzedAt (most recent first)
    filtered.sort((a, b) => {
      const dateA = a.lastAnalyzedAt || a.createdAt;
      const dateB = b.lastAnalyzedAt || b.createdAt;
      return dateB.getTime() - dateA.getTime();
    });

    const total = filtered.length;
    const limit = query.limit || 20;
    const offset = query.offset || 0;

    return {
      analyses: filtered.slice(offset, offset + limit),
      total
    };
  }

  /**
   * Get statistics about analyses
   */
  static async getStatistics(): Promise<{
    totalAnalyses: number;
    uniqueLocations: number;
    averageAnalysisCount: number;
    recentAnalyses: number; // Last 30 days
  }> {
    const allAnalyses = await this.getAllAnalyses();
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const totalAnalyses = allAnalyses.length;
    const uniqueLocations = new Set(allAnalyses.map(a => a.locationHash)).size;
    const totalAnalysisCount = allAnalyses.reduce((sum, a) => sum + (a.analysisCount || 1), 0);
    const averageAnalysisCount = totalAnalyses > 0 ? totalAnalysisCount / totalAnalyses : 0;
    const recentAnalyses = allAnalyses.filter(a => {
      const lastDate = a.lastAnalyzedAt || a.createdAt;
      return lastDate >= thirtyDaysAgo;
    }).length;

    return {
      totalAnalyses,
      uniqueLocations,
      averageAnalysisCount,
      recentAnalyses
    };
  }
}