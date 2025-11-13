import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { calculatePropertyMetrics, assessRisks } from "./services/geospatial";
import { fetchAmenities, fetchInfrastructure } from "./services/overpass";
import { scrapeMarketPrices } from "./services/scraper";
import { analyzeProperty } from "./services/ai";
import { searchLocations } from "./services/provinces";
import { geocodeLocationCached } from "./services/geocoding";
import { z } from "zod";

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

export async function registerRoutes(app: Express): Promise<Server> {
  app.all('/api/app', async (req, res) => {
    try {
      const action = (req.query.action as string) || (req.body && (req.body as any).action);
      if (!action) return res.status(400).json({ message: 'action required' });

      if (req.method === 'POST' && action === 'analyze-property') {
        const input = analyzePropertySchema.parse(req.body);
        const metrics = calculatePropertyMetrics(input.coordinates);
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
        const analysis = await storage.createPropertyAnalysis({
          coordinates: input.coordinates,
          area: metrics.area,
          orientation: metrics.orientation,
          frontageCount: metrics.frontageCount,
          center: metrics.center,
          amenities,
          infrastructure,
          marketData,
          aiAnalysis,
          risks: riskAssessment.risks
        });
        return res.json({
          id: analysis.id,
          ...metrics,
          amenities,
          infrastructure,
          marketData,
          aiAnalysis,
          risks: riskAssessment.risks,
          overallRiskLevel: riskAssessment.overallRiskLevel
        });
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
        const results = await searchLocations(q, 10);
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

      const analysis = await storage.createPropertyAnalysis({
        coordinates: input.coordinates,
        area: metrics.area,
        orientation: metrics.orientation,
        frontageCount: metrics.frontageCount,
        center: metrics.center,
        amenities,
        infrastructure,
        marketData,
        aiAnalysis,
        risks: riskAssessment.risks
      });

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

  const httpServer = createServer(app);
  return httpServer;
}
