import type { VercelRequest, VercelResponse } from '@vercel/node';
import { setCorsHeaders, handleOptions } from './_shared/cors.js';
import { handleError } from './_shared/error-handler.js';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { calculatePropertyMetrics, assessRisks } from '../server/services/geospatial.js';
import { fetchAmenities, fetchInfrastructure } from '../server/services/overpass.js';
import { scrapeMarketPrices } from '../server/services/scraper.js';
import { analyzeProperty } from '../server/services/ai.js';
import { searchLocations } from '../server/services/provinces.js';
import { geocodeLocationCached, suggestLocations, retrieveLocation, searchCategory } from '../server/services/geocoding.js';
import type { PropertyAnalysis, InsertPropertyAnalysis } from '../shared/schema.js';

const store = new Map<string, PropertyAnalysis>();

const analyzePropertySchema = z.object({
  coordinates: z.array(z.array(z.number())),
  radius: z.number().min(100).max(30000),
  categories: z.array(z.string()),
  layers: z.array(z.string()),
  includeSmallShops: z.boolean().optional().default(false)
});

const updateSchema = z.object({
  propertyType: z.string().optional(),
  valuation: z.number().optional().nullable(),
  askingPrice: z.number().optional().nullable(),
  notes: z.string().optional().nullable()
});

function listRecent(limit: number): PropertyAnalysis[] {
  return Array.from(store.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return handleOptions(res);

    const action = ((req.query.action as string) || (req.body && (req.body as any).action)) as string | undefined;
    if (!action) return res.status(400).json({ message: 'action required' });

    if (req.method === 'POST' && action === 'analyze-property') {
      const input = analyzePropertySchema.parse(req.body);
      const metrics = calculatePropertyMetrics(input.coordinates);
      const amenities = await fetchAmenities(metrics.center.lat, metrics.center.lng, input.radius, input.categories, input.includeSmallShops);
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
      const id = randomUUID();
      const analysis: PropertyAnalysis = {
        id,
        coordinates: input.coordinates,
        area: metrics.area,
        orientation: metrics.orientation,
        frontageCount: metrics.frontageCount,
        center: metrics.center,
        amenities,
        infrastructure,
        marketData,
        aiAnalysis,
        risks: riskAssessment.risks,
        propertyType: null,
        valuation: null,
        askingPrice: null,
        notes: null,
        createdAt: new Date()
      } as PropertyAnalysis;
      store.set(id, analysis);
      return res.json({
        id,
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
      const analysis = store.get(id);
      if (!analysis) return res.status(404).json({ message: 'not found' });
      return res.json(analysis);
    }

    if (req.method === 'GET' && action === 'recent-analyses') {
      const limit = parseInt((req.query.limit as string) || '10', 10);
      return res.json(listRecent(limit));
    }

    if (req.method === 'GET' && action === 'properties') {
      return res.json(Array.from(store.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
    }

    if (req.method === 'PUT' && action === 'properties') {
      const id = req.query.id as string;
      if (!id) return res.status(400).json({ message: 'id required' });
      const existing = store.get(id);
      if (!existing) return res.status(404).json({ message: 'not found' });
      const parseResult = updateSchema.safeParse(req.body);
      if (!parseResult.success) return res.status(400).json({ message: 'invalid data', details: parseResult.error.issues });
      const data = Object.fromEntries(Object.entries(parseResult.data).filter(([_, v]) => v !== undefined));
      const updated: PropertyAnalysis = { ...existing, ...data } as PropertyAnalysis;
      store.set(id, updated);
      return res.json(updated);
    }

    if (req.method === 'DELETE' && action === 'properties') {
      const id = req.query.id as string;
      if (!id) return res.status(400).json({ message: 'id required' });
      const ok = store.delete(id);
      if (!ok) return res.status(404).json({ message: 'not found' });
      return res.json({ success: true });
    }

    if (req.method === 'GET' && action === 'locations-search') {
      const q = req.query.q as string;
      if (!q || q.length < 2) return res.json([]);
      const sessionToken = (req.query.sessionToken as string) || undefined;
      const proximity = (req.query.proximity as string) || undefined;
      const types = (req.query.types as string) || 'address,place,poi,locality,neighborhood';
      const [mapboxSuggestions, vnAdmin] = await Promise.all([
        suggestLocations(q, { limit: 10, sessionToken, types, proximity }).catch(() => []),
        searchLocations(q, 10).catch(() => [])
      ]);
      const combined = [...mapboxSuggestions, ...vnAdmin].slice(0, 10);
      return res.json(combined);
    }

    if (req.method === 'GET' && action === 'locations-suggest') {
      const q = req.query.q as string;
      if (!q || q.length < 2) return res.json([]);
      const limit = parseInt((req.query.limit as string) || '10', 10);
      const sessionToken = (req.query.sessionToken as string) || undefined;
      const types = (req.query.types as string) || 'address,place,poi,locality,neighborhood';
      const proximity = (req.query.proximity as string) || undefined;
      const suggestions = await suggestLocations(q, { limit, sessionToken, types, proximity });
      return res.json(suggestions);
    }

    if (req.method === 'GET' && action === 'locations-retrieve') {
      const id = req.query.id as string;
      if (!id) return res.status(400).json({ message: 'id required' });
      const sessionToken = (req.query.sessionToken as string) || undefined;
      const result = await retrieveLocation(id, sessionToken);
      if (!result) return res.status(404).json({ message: 'not found' });
      return res.json(result);
    }

    if (req.method === 'GET' && action === 'locations-category') {
      const category = req.query.category as string;
      if (!category) return res.status(400).json({ message: 'category required' });
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
      const body = req.body as any;
      const query = body?.query as string;
      if (!query || typeof query !== 'string') return res.status(400).json({ message: 'query required' });
      const result = await geocodeLocationCached(query);
      if (!result) return res.status(404).json({ message: 'not found' });
      return res.json(result);
    }

    return res.status(405).json({ message: 'method or action not supported' });
  } catch (error: any) {
    return handleError(res, error, 'Core API');
  }
}

