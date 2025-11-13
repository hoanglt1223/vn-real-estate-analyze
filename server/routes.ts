import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { calculatePropertyMetrics, assessRisks } from "./services/geospatial";
import { fetchAmenities, fetchInfrastructure } from "./services/overpass";
import { scrapeMarketPrices } from "./services/scraper";
import { analyzeProperty } from "./services/ai";
import { z } from "zod";

const analyzePropertySchema = z.object({
  coordinates: z.array(z.array(z.number())),
  radius: z.number().min(100).max(5000),
  categories: z.array(z.string()),
  layers: z.array(z.string())
});

export async function registerRoutes(app: Express): Promise<Server> {
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

  const httpServer = createServer(app);
  return httpServer;
}
