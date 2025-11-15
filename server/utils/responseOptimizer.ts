import { processAmenities, summarizeAmenities, processInfrastructure, summarizeInfrastructure, processMarketData } from '../../shared/services/dataProcessor';

// Utility functions to optimize API response sizes

interface OptimizationOptions {
  includeAmenityDetails?: boolean;
  includeInfrastructureDetails?: boolean;
  includeMarketDetails?: boolean;
  maxAmenities?: number;
  maxInfrastructureItems?: number;
  compressArrays?: boolean;
}

const DEFAULT_OPTIONS: OptimizationOptions = {
  includeAmenityDetails: true,
  includeInfrastructureDetails: true,
  includeMarketDetails: true,
  maxAmenities: 100,
  maxInfrastructureItems: 50,
  compressArrays: true
};

export function optimizeAnalysisResponse(
  analysisData: any,
  options: OptimizationOptions = {}
): any {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const optimized: any = {
    // Core analysis data (always include)
    id: analysisData.id,
    area: analysisData.area,
    orientation: analysisData.orientation,
    frontageCount: analysisData.frontageCount,
    center: analysisData.center,
    coordinates: analysisData.coordinates,
    aiAnalysis: analysisData.aiAnalysis,
    risks: analysisData.risks,
    overallRiskLevel: analysisData.overallRiskLevel,
    createdAt: analysisData.createdAt,
  };

  // Optimize amenities data
  if (opts.includeAmenityDetails && analysisData.amenities) {
    optimized.amenities = optimizeAmenities(analysisData.amenities, opts.maxAmenities || 100);
    optimized.amenitiesCount = analysisData.amenities.length;
  } else if (analysisData.amenities) {
    optimized.amenitiesCount = analysisData.amenities.length;
    // Include only basic counts by category
    optimized.amenitiesSummary = summarizeAmenitiesLocal(analysisData.amenities);
  }

  // Optimize infrastructure data
  if (opts.includeInfrastructureDetails && analysisData.infrastructure) {
    optimized.infrastructure = optimizeInfrastructure(analysisData.infrastructure, opts.maxInfrastructureItems || 50);
  } else if (analysisData.infrastructure) {
    optimized.infrastructureSummary = summarizeInfrastructureLocal(analysisData.infrastructure);
  }

  // Optimize market data
  if (opts.includeMarketDetails && analysisData.marketData) {
    optimized.marketData = optimizeMarketData(analysisData.marketData);
  } else if (analysisData.marketData) {
    optimized.marketDataSummary = {
      avg: analysisData.marketData.avg,
      min: analysisData.marketData.min,
      max: analysisData.marketData.max,
      pricePerSqm: analysisData.marketData.pricePerSqm,
      listingCount: analysisData.marketData.listingCount,
      trend: analysisData.marketData.trend,
      sources: analysisData.marketData.sources
    };
  }

  return optimized;
}

// Use shared data processing functions
function optimizeAmenities(amenities: any[], maxItems: number): any[] {
  return processAmenities(amenities, maxItems);
}

function summarizeAmenitiesLocal(amenities: any[]): any {
  return summarizeAmenities(amenities);
}

function optimizeInfrastructure(infrastructure: any, maxItems: number): any {
  return processInfrastructure(infrastructure, maxItems);
}

function summarizeInfrastructureLocal(infrastructure: any): any {
  return summarizeInfrastructure(infrastructure);
}

function optimizeMarketData(marketData: any): any {
  return processMarketData(marketData);
}

export function createCompressedResponse(data: any, options: OptimizationOptions = {}) {
  return {
    data: optimizeAnalysisResponse(data, options),
    _meta: {
      optimized: true,
      timestamp: new Date().toISOString(),
      version: '1.0'
    }
  };
}

// Middleware to automatically optimize responses
export function responseOptimizer(options: OptimizationOptions = {}) {
  return (req: any, res: any, next: any) => {
    // Store original json method
    const originalJson = res.json;

    // Override json method to optimize responses
    res.json = function(data: any) {
      // Check if this is an analysis response that needs optimization
      if (data && (data.amenities || data.infrastructure || data.marketData) && !req.query.skipOptimization) {
        const optimized = createCompressedResponse(data, options);
        return originalJson.call(this, optimized);
      }

      return originalJson.call(this, data);
    };

    next();
  };
}