import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { calculatePropertyMetrics, assessRisks } from "./services/geospatial";
import { fetchAmenities, fetchInfrastructure } from "./services/overpass";
import { scrapeMarketPrices } from "./services/scraper";
import { analyzeProperty } from "./services/ai";
import { searchLocations } from "./services/provinces";
import { geocodeLocationCached, suggestLocations, retrieveLocation, searchCategory } from "./services/geocoding";
import { optimizeAnalysisResponse, createCompressedResponse } from "./utils/responseOptimizer";
import { prefetchForAnalysis } from "./services/prefetch";
import { z } from "zod";
import type { InsertPropertyAnalysis, InsertPropertyComparison, InsertPropertyNote, InsertSavedSearch } from "@shared/schema";
import type { SearchCriteria } from "./storage";

const analyzePropertySchema = z.object({
  coordinates: z.array(z.array(z.number())),
  radius: z.number().min(100).max(30000),
  categories: z.array(z.string()),
  layers: z.array(z.string())
});

const updateSchema = z.object({
  propertyType: z.string().optional(),
  valuation: z.number().optional().nullable(),
  askingPrice: z.number().optional().nullable(),
  notes: z.string().optional().nullable()
});

const searchSchema = z.object({
  query: z.string().optional(),
  minScore: z.number().optional(),
  maxScore: z.number().optional(),
  minPrice: z.number().optional(),
  maxPrice: z.number().optional(),
  minArea: z.number().optional(),
  maxArea: z.number().optional(),
  propertyType: z.string().optional(),
  sortBy: z.enum(['date', 'score', 'price', 'area']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  limit: z.number().optional(),
  offset: z.number().optional(),
});

const comparisonSchema = z.object({
  userId: z.string(),
  propertyIds: z.array(z.string()),
  comparisonResult: z.any(),
});

const noteSchema = z.object({
  propertyId: z.string(),
  userId: z.string(),
  content: z.string(),
});

const savedSearchSchema = z.object({
  userId: z.string(),
  name: z.string(),
  searchCriteria: z.any(),
});

export async function registerRoutes(app: Express): Promise<Server> {
  app.all('/api/app', async (req, res) => {
    try {
      const action = (req.query.action as string) || (req.body && (req.body as any).action);
      if (!action) return res.status(400).json({ message: 'action required' });

      if (req.method === 'POST' && action === 'analyze-property') {
        const input = analyzePropertySchema.parse(req.body);
        const metrics = calculatePropertyMetrics(input.coordinates);

        // Schedule prefetch for nearby areas (don't wait for it)
        const prefetchEnabled = req.query.prefetch !== 'false'; // Enable by default
        prefetchForAnalysis(
          metrics.center.lat,
          metrics.center.lng,
          input.radius,
          input.categories,
          input.layers,
          prefetchEnabled
        );

        // Fetch current data
        const amenities = await fetchAmenities(metrics.center.lat, metrics.center.lng, input.radius, input.categories);
        const infrastructure = await fetchInfrastructure(metrics.center.lat, metrics.center.lng, input.radius, input.layers);
        const riskAssessment = assessRisks(metrics.center, infrastructure);
        const marketData = await scrapeMarketPrices(metrics.center.lat, metrics.center.lng, input.radius);
        const aiAnalysis = await analyzeProperty({
          area: metrics.area,
          orientation: metrics.orientation,
          frontageCount: metrics.frontageCount,
          amenities,
          infrastructure,
          marketData,
          risks: riskAssessment.risks
        });
        const payload = {
          coordinates: input.coordinates,
          area: metrics.area,
          orientation: metrics.orientation,
          frontageCount: metrics.frontageCount,
          center: metrics.center,
          amenities: amenities as any[],
          infrastructure: infrastructure as any,
          marketData: marketData as any,
          aiAnalysis: aiAnalysis as any,
          risks: riskAssessment.risks as any[],
        } as unknown as InsertPropertyAnalysis;
        const analysis = await storage.createPropertyAnalysis(payload);

        const responseData = {
          id: analysis.id,
          ...metrics,
          amenities,
          infrastructure,
          marketData,
          aiAnalysis,
          risks: riskAssessment.risks,
          overallRiskLevel: riskAssessment.overallRiskLevel,
          createdAt: analysis.createdAt
        };

        // Optimize response unless client explicitly requests full data
        if (req.query.full === 'true') {
          return res.json(responseData);
        } else {
          const optimizedResponse = createCompressedResponse(responseData, {
            maxAmenities: 100,
            maxInfrastructureItems: 50,
            includeAmenityDetails: true,
            includeInfrastructureDetails: true,
            includeMarketDetails: true
          });
          return res.json(optimizedResponse);
        }
      }

      if (req.method === 'GET' && action === 'analysis') {
        const id = req.query.id as string;
        if (!id) return res.status(400).json({ message: 'id required' });
        const analysis = await storage.getPropertyAnalysis(id);
        if (!analysis) return res.status(404).json({ message: 'not found' });
        return res.json(analysis);
      }

      if (req.method === 'GET' && action === 'recent-analyses') {
        const limit = parseInt((req.query.limit as string) || '10', 10);
        const analyses = await storage.getRecentAnalyses(limit);
        return res.json(analyses);
      }

      if (req.method === 'GET' && action === 'properties') {
        const properties = await storage.listPropertyAnalyses();
        return res.json(properties);
      }

      if (req.method === 'PUT' && action === 'properties') {
        const id = req.query.id as string;
        if (!id) return res.status(400).json({ message: 'id required' });
        const parseResult = updateSchema.safeParse(req.body);
        if (!parseResult.success) {
          return res.status(400).json({ 
            error: 'Invalid request data',
            details: parseResult.error.issues 
          });
        }
        const validatedData = parseResult.data;
        const cleanedData = Object.fromEntries(
          Object.entries(validatedData).filter(([_, v]) => v !== undefined)
        );
        const updated = await storage.updatePropertyAnalysis(id, cleanedData);
        if (!updated) return res.status(404).json({ error: 'Property not found' });
        return res.json(updated);
      }

      if (req.method === 'DELETE' && action === 'properties') {
        const id = req.query.id as string;
        if (!id) return res.status(400).json({ message: 'id required' });
        const deleted = await storage.deletePropertyAnalysis(id);
        if (!deleted) return res.status(404).json({ error: 'Property not found' });
        return res.json({ success: true });
      }

      if (req.method === 'GET' && action === 'locations-search') {
        const q = req.query.q as string;
        if (!q || q.length < 2) return res.json([]);
        const sessionToken = (req.query.sessionToken as string) || undefined;
        const proximity = (req.query.proximity as string) || undefined;
        const types = (req.query.types as string) || 'address,place,poi,locality,neighborhood,region,postcode,district';
        const [mapboxSuggestions, vnAdmin] = await Promise.all([
          suggestLocations(q, { limit: 20, sessionToken, types, proximity }).catch(() => []),
          searchLocations(q, 20).catch(() => [])
        ]);
        const combined = [...mapboxSuggestions, ...vnAdmin].slice(0, 20);
        return res.json(combined);
      }

      if (req.method === 'GET' && action === 'locations-suggest') {
        const q = req.query.q as string;
        if (!q || q.length < 2) return res.json([]);
        const limit = parseInt((req.query.limit as string) || '10', 10);
        const sessionToken = (req.query.sessionToken as string) || undefined;
        const types = (req.query.types as string) || 'address,place,poi,locality,neighborhood,region,postcode,district';
        const proximity = (req.query.proximity as string) || undefined;
        const suggestions = await suggestLocations(q, { limit, sessionToken, types, proximity });
        return res.json(suggestions);
      }

      if (req.method === 'GET' && action === 'locations-retrieve') {
        const id = req.query.id as string;
        if (!id) return res.status(400).json({ error: 'id required' });
        const sessionToken = (req.query.sessionToken as string) || undefined;
        const result = await retrieveLocation(id, sessionToken);
        if (!result) return res.status(404).json({ error: 'Location not found' });
        return res.json(result);
      }

      if (req.method === 'GET' && action === 'locations-category') {
        const category = req.query.category as string;
        if (!category) return res.status(400).json({ error: 'category required' });
        const lat = req.query.lat ? parseFloat(req.query.lat as string) : undefined;
        const lng = req.query.lng ? parseFloat(req.query.lng as string) : undefined;
        const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
        const proximity = (req.query.proximity as string) || (lat != null && lng != null ? `${lng},${lat}` : undefined);
        const bbox = (req.query.bbox as string) || undefined;
        const sessionToken = (req.query.sessionToken as string) || undefined;
        const results = await searchCategory(category, { lat, lng, limit, bbox, proximity, sessionToken });
        return res.json(results);
      }

      if (req.method === 'POST' && action === 'locations-geocode') {
        const { query } = req.body;
        if (!query || typeof query !== 'string') {
          return res.status(400).json({ error: 'Query parameter is required' });
        }
        const result = await geocodeLocationCached(query);
        if (!result) return res.status(404).json({ error: 'Location not found' });
        return res.json(result);
      }

      return res.status(405).json({ message: 'method or action not supported' });
    } catch (error: any) {
      console.error('Core API error:', error);
      return res.status(500).json({ message: error.message || 'Internal Server Error' });
    }
  });
  app.post("/api/analyze-property", async (req, res) => {
    try {
      const input = analyzePropertySchema.parse(req.body);
      
      const metrics = calculatePropertyMetrics(input.coordinates);
      
      console.log('Fetching amenities from OSM...');
      const amenities = await fetchAmenities(
        metrics.center.lat,
        metrics.center.lng,
        input.radius,
        input.categories
      );

      console.log('Fetching infrastructure from OSM...');
      const infrastructure = await fetchInfrastructure(
        metrics.center.lat,
        metrics.center.lng,
        input.radius,
        input.layers
      );

      console.log('Assessing risks...');
      const riskAssessment = assessRisks(metrics.center, infrastructure);

      console.log('Scraping market prices...');
      const marketData = await scrapeMarketPrices(
        metrics.center.lat,
        metrics.center.lng,
        input.radius
      );

      console.log('Performing AI analysis...');
      const aiAnalysis = await analyzeProperty({
        area: metrics.area,
        orientation: metrics.orientation,
        frontageCount: metrics.frontageCount,
        amenities,
        infrastructure,
        marketData,
        risks: riskAssessment.risks
      });

      const payload = {
        coordinates: input.coordinates,
        area: metrics.area,
        orientation: metrics.orientation,
        frontageCount: metrics.frontageCount,
        center: metrics.center,
        amenities: amenities as any[],
        infrastructure: infrastructure as any,
        marketData: marketData as any,
        aiAnalysis: aiAnalysis as any,
        risks: riskAssessment.risks as any[],
      } as unknown as InsertPropertyAnalysis;
      const analysis = await storage.createPropertyAnalysis(payload);

      res.json({
        id: analysis.id,
        ...metrics,
        amenities,
        infrastructure,
        marketData,
        aiAnalysis,
        risks: riskAssessment.risks,
        overallRiskLevel: riskAssessment.overallRiskLevel
      });
    } catch (error: any) {
      console.error('Error analyzing property:', error);
      res.status(500).json({ 
        error: 'Failed to analyze property',
        message: error.message 
      });
    }
  });

  app.get("/api/analysis/:id", async (req, res) => {
    try {
      const analysis = await storage.getPropertyAnalysis(req.params.id);
      if (!analysis) {
        return res.status(404).json({ error: 'Analysis not found' });
      }
      res.json(analysis);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/recent-analyses", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const analyses = await storage.getRecentAnalyses(limit);
      res.json(analyses);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/properties", async (req, res) => {
    try {
      const properties = await storage.listPropertyAnalyses();
      res.json(properties);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/properties/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updateSchema = z.object({
        propertyType: z.string().optional(),
        valuation: z.number().optional().nullable(),
        askingPrice: z.number().optional().nullable(),
        notes: z.string().optional().nullable()
      });
      
      const parseResult = updateSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          error: 'Invalid request data',
          details: parseResult.error.issues 
        });
      }

      const validatedData = parseResult.data;
      const cleanedData = Object.fromEntries(
        Object.entries(validatedData).filter(([_, v]) => v !== undefined)
      );
      
      const updated = await storage.updatePropertyAnalysis(id, cleanedData);
      if (!updated) {
        return res.status(404).json({ error: 'Property not found' });
      }
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/locations/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query || query.length < 2) {
        return res.json([]);
      }
      
      const results = await searchLocations(query, 10);
      res.json(results);
    } catch (error: any) {
      console.error('Location search error:', error);
      res.status(500).json({ 
        error: 'Failed to search locations',
        message: error.message 
      });
    }
  });

  app.post("/api/locations/geocode", async (req, res) => {
    try {
      const { query } = req.body;
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'Query parameter is required' });
      }
      
      const result = await geocodeLocationCached(query);
      
      if (!result) {
        return res.status(404).json({ error: 'Location not found' });
      }
      
      res.json(result);
    } catch (error: any) {
      console.error('Geocoding error:', error);
      res.status(500).json({ 
        error: 'Failed to geocode location',
        message: error.message 
      });
    }
  });

  app.delete("/api/properties/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deletePropertyAnalysis(id);
      if (!deleted) {
        return res.status(404).json({ error: 'Property not found' });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Advanced search endpoint
  app.post("/api/properties/search", async (req, res) => {
    try {
      const searchCriteria = searchSchema.parse(req.body) as SearchCriteria;
      const properties = await storage.searchPropertyAnalyses(searchCriteria);
      res.json(properties);
    } catch (error: any) {
      console.error('Search error:', error);
      res.status(500).json({
        error: 'Failed to search properties',
        message: error.message
      });
    }
  });

  // Property comparisons endpoints
  app.post("/api/comparisons", async (req, res) => {
    try {
      const comparisonData = comparisonSchema.parse(req.body) as InsertPropertyComparison;
      const comparison = await storage.createPropertyComparison(comparisonData);
      res.json(comparison);
    } catch (error: any) {
      console.error('Comparison creation error:', error);
      res.status(500).json({
        error: 'Failed to create comparison',
        message: error.message
      });
    }
  });

  app.get("/api/comparisons/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const comparisons = await storage.getPropertyComparisons(userId);
      res.json(comparisons);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/comparisons/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deletePropertyComparison(id);
      if (!deleted) {
        return res.status(404).json({ error: 'Comparison not found' });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Property notes endpoints
  app.post("/api/notes", async (req, res) => {
    try {
      const noteData = noteSchema.parse(req.body) as InsertPropertyNote;
      const note = await storage.createPropertyNote(noteData);
      res.json(note);
    } catch (error: any) {
      console.error('Note creation error:', error);
      res.status(500).json({
        error: 'Failed to create note',
        message: error.message
      });
    }
  });

  app.get("/api/notes/:propertyId", async (req, res) => {
    try {
      const { propertyId } = req.params;
      const notes = await storage.getPropertyNotes(propertyId);
      res.json(notes);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/notes/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deletePropertyNote(id);
      if (!deleted) {
        return res.status(404).json({ error: 'Note not found' });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Saved searches endpoints
  app.post("/api/saved-searches", async (req, res) => {
    try {
      const searchData = savedSearchSchema.parse(req.body) as InsertSavedSearch;
      const savedSearch = await storage.createSavedSearch(searchData);
      res.json(savedSearch);
    } catch (error: any) {
      console.error('Saved search creation error:', error);
      res.status(500).json({
        error: 'Failed to create saved search',
        message: error.message
      });
    }
  });

  app.get("/api/saved-searches/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const savedSearches = await storage.getSavedSearches(userId);
      res.json(savedSearches);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/saved-searches/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteSavedSearch(id);
      if (!deleted) {
        return res.status(404).json({ error: 'Saved search not found' });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Import/export endpoints
  app.post("/api/properties/import", async (req, res) => {
    try {
      const { properties } = req.body;

      if (!Array.isArray(properties)) {
        return res.status(400).json({ error: 'Properties must be an array' });
      }

      const importedProperties = [];

      for (const propertyData of properties) {
        try {
          const validatedData = {
            coordinates: propertyData.coordinates,
            area: propertyData.area,
            orientation: propertyData.orientation,
            frontageCount: propertyData.frontageCount,
            center: propertyData.center,
            amenities: propertyData.amenities || [],
            infrastructure: propertyData.infrastructure || {},
            marketData: propertyData.marketData || {},
            aiAnalysis: propertyData.aiAnalysis || {},
            risks: propertyData.risks || [],
            propertyType: propertyData.propertyType || null,
            valuation: propertyData.valuation || null,
            askingPrice: propertyData.askingPrice || null,
            notes: propertyData.notes || null,
          };

          const imported = await storage.createPropertyAnalysis(validatedData);
          importedProperties.push(imported);
        } catch (error) {
          console.error('Failed to import property:', error);
          // Continue with other properties even if one fails
        }
      }

      res.json({
        success: true,
        imported: importedProperties.length,
        total: properties.length,
        properties: importedProperties
      });
    } catch (error: any) {
      console.error('Import error:', error);
      res.status(500).json({
        error: 'Failed to import properties',
        message: error.message
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
