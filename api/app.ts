import type { VercelRequest, VercelResponse } from '@vercel/node';
import { setCorsHeaders, handleOptions } from './lib/cors.js';
import { handleError } from './lib/error-handler.js';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import {
  calculatePropertyMetrics,
  assessRisks,
  scrapeMarketPrices,
  analyzeProperty,
  searchLocations,
  suggestLocations,
  retrieveLocation,
  geocodeLocationCached,
  searchCategory,
  type PropertyAnalysis,
  type InsertPropertyAnalysis
} from '../shared/services/api/services.js';
import { fetchAmenities, fetchInfrastructure } from '../shared/services/api/overpass.js';
import { AuthService } from '../shared/services/auth.service';
import { FileStorageService } from '../shared/services/file-storage.service';
import { CreateUserInput, LoginInput } from '../shared/types/user.types';

const store = new Map<string, PropertyAnalysis>();

const analyzePropertySchema = z.object({
  coordinates: z.array(z.array(z.number())),
  radius: z.number().min(100).max(30000),
  categories: z.array(z.string()),
  layers: z.array(z.string()),
  includeSmallShops: z.boolean().optional().default(false),
  maxAmenities: z.number().optional().default(500) // Reduced default for performance
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

    // Auth Actions
    if (req.method === 'POST' && action === 'auth-register') {
      try {
        const input: CreateUserInput = req.body;

        // Validate input
        if (!input.email || !input.password || !input.name) {
          return res.status(400).json({
            error: 'Missing required fields',
            details: 'Email, password, and name are required'
          });
        }

        if (input.password.length < 8) {
          return res.status(400).json({
            error: 'Password too short',
            details: 'Password must be at least 8 characters long'
          });
        }

        if (!input.email.includes('@')) {
          return res.status(400).json({
            error: 'Invalid email',
            details: 'Please provide a valid email address'
          });
        }

        const result = await AuthService.register(input);
        return res.status(201).json({
          message: 'User registered successfully',
          data: result
        });
      } catch (error: any) {
        console.error('Registration error:', error);
        if (error.message === 'Email already exists') {
          return res.status(409).json({ error: error.message });
        }
        return res.status(500).json({ error: 'Registration failed' });
      }
    }

    if (req.method === 'POST' && action === 'auth-login') {
      try {
        const input: LoginInput = req.body;

        // Validate input
        if (!input.email || !input.password) {
          return res.status(400).json({
            error: 'Missing credentials',
            details: 'Email and password are required'
          });
        }

        const result = await AuthService.login(input);
        return res.json({
          message: 'Login successful',
          data: result
        });
      } catch (error: any) {
        console.error('Login error:', error);
        if (error.message === 'Invalid credentials') {
          return res.status(401).json({ error: error.message });
        }
        return res.status(500).json({ error: 'Login failed' });
      }
    }

    if (req.method === 'POST' && action === 'auth-verify') {
      try {
        const { token } = req.body;
        if (!token) {
          return res.status(400).json({ error: 'Token required' });
        }

        const user = await AuthService.verifyToken(token);
        return res.json({ user });
      } catch (error: any) {
        return res.status(401).json({ error: 'Invalid token' });
      }
    }

    if (req.method === 'GET' && action === 'auth-profile') {
      try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
          return res.status(401).json({ error: 'Access token required' });
        }

        const user = await AuthService.verifyToken(token);
        return res.json({ user });
      } catch (error: any) {
        return res.status(401).json({ error: 'Invalid token' });
      }
    }

    if (req.method === 'PUT' && action === 'auth-profile') {
      try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
          return res.status(401).json({ error: 'Access token required' });
        }

        const user = await AuthService.verifyToken(token);
        const updates = req.body;

        const updatedUser = await AuthService.updateUser(user.id, updates);
        return res.json({ user: updatedUser });
      } catch (error: any) {
        console.error('Profile update error:', error);
        return res.status(500).json({ error: 'Profile update failed' });
      }
    }

    if (req.method === 'POST' && action === 'auth-change-password') {
      try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
          return res.status(401).json({ error: 'Access token required' });
        }

        const user = await AuthService.verifyToken(token);
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
          return res.status(400).json({
            error: 'Missing passwords',
            details: 'Current password and new password are required'
          });
        }

        await AuthService.changePassword(user.id, currentPassword, newPassword);
        return res.json({ message: 'Password changed successfully' });
      } catch (error: any) {
        console.error('Password change error:', error);
        if (error.message === 'Current password is incorrect') {
          return res.status(400).json({ error: error.message });
        }
        return res.status(500).json({ error: 'Password change failed' });
      }
    }

    // Property Actions
    if (req.method === 'POST' && action === 'analyze-property') {
      const input = analyzePropertySchema.parse(req.body);
      const metrics = calculatePropertyMetrics(input.coordinates);
      const amenities = await fetchAmenities(metrics.center.lat, metrics.center.lng, input.radius, input.categories, input.includeSmallShops, input.maxAmenities);
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
      const id = req.query.id as string || (req.body as any)?.id;
      if (!id) return res.status(400).json({ message: 'id required' });
      const analysis = store.get(id);
      if (!analysis) return res.status(404).json({ message: 'not found' });
      return res.json(analysis);
    }

    if (req.method === 'GET' && action === 'recent-analyses') {
      const limit = parseInt((req.query.limit as string) || '10', 10);
      return res.json(listRecent(limit));
    }

    if (req.method === 'GET' && action === 'analysis-list') {
      return res.json(Array.from(store.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
    }

    if (req.method === 'PUT' && action === 'analysis-update') {
      const { id, ...data } = req.body as any;
      if (!id) return res.status(400).json({ message: 'id required' });
      const existing = store.get(id);
      if (!existing) return res.status(404).json({ message: 'not found' });
      const parseResult = updateSchema.safeParse(data);
      if (!parseResult.success) return res.status(400).json({ message: 'invalid data', details: parseResult.error.issues });
      const filteredData = Object.fromEntries(Object.entries(parseResult.data).filter(([_, v]) => v !== undefined));
      const updated: PropertyAnalysis = { ...existing, ...filteredData } as PropertyAnalysis;
      store.set(id, updated);
      return res.json(updated);
    }

    if (req.method === 'DELETE' && action === 'analysis-delete') {
      const { id } = req.body as any;
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

    // Property Listing Actions
    if (req.method === 'GET' && action === 'properties-list') {
      try {
        const filters = {
          propertyType: req.query.type?.toString().split(',') || undefined,
          transactionType: req.query.transactionType as string || undefined,
          minPrice: req.query.minPrice ? Number(req.query.minPrice) : undefined,
          maxPrice: req.query.maxPrice ? Number(req.query.maxPrice) : undefined,
          minArea: req.query.minArea ? Number(req.query.minArea) : undefined,
          maxArea: req.query.maxArea ? Number(req.query.maxArea) : undefined,
          location: req.query.location?.toString() || undefined,
          province: req.query.province?.toString() || undefined,
          district: req.query.district?.toString() || undefined,
          limit: req.query.limit ? Number(req.query.limit) : 20,
          offset: req.query.offset ? Number(req.query.offset) : 0,
          sortBy: (req.query.sortBy as any) || 'createdAt',
          sortOrder: (req.query.sortOrder as any) || 'desc'
        };

        const properties = await FileStorageService.listProperties(filters);
        return res.json(properties);
      } catch (error: any) {
        console.error('Property list error:', error);
        return res.status(500).json({ error: 'Failed to list properties' });
      }
    }

    if (req.method === 'POST' && action === 'properties-create') {
      try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
          return res.status(401).json({ error: 'Access token required' });
        }

        const user = await AuthService.verifyToken(token);
        const propertyData = { ...req.body, userId: user.id };

        const property = await FileStorageService.createProperty(propertyData);
        return res.status(201).json({ property });
      } catch (error: any) {
        console.error('Property creation error:', error);
        return res.status(500).json({ error: 'Failed to create property' });
      }
    }

    if (req.method === 'GET' && action === 'properties-detail') {
      try {
        const id = req.query.id as string || (req.body as any)?.id;
        if (!id) {
          return res.status(400).json({ error: 'Property ID required' });
        }

        const property = await FileStorageService.getProperty(id);
        if (!property) {
          return res.status(404).json({ error: 'Property not found' });
        }

        return res.json({ property });
      } catch (error: any) {
        console.error('Property detail error:', error);
        return res.status(500).json({ error: 'Failed to get property' });
      }
    }

    if (req.method === 'PUT' && action === 'properties-update') {
      try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
          return res.status(401).json({ error: 'Access token required' });
        }

        const user = await AuthService.verifyToken(token);
        const { id, ...updates } = req.body as any;

        if (!id) {
          return res.status(400).json({ error: 'Property ID required' });
        }

        const property = await FileStorageService.updateProperty(id, updates);
        if (!property) {
          return res.status(404).json({ error: 'Property not found' });
        }

        return res.json({ property });
      } catch (error: any) {
        console.error('Property update error:', error);
        return res.status(500).json({ error: 'Failed to update property' });
      }
    }

    if (req.method === 'DELETE' && action === 'properties-delete') {
      try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
          return res.status(401).json({ error: 'Access token required' });
        }

        const user = await AuthService.verifyToken(token);
        const { id } = req.body as any;

        if (!id) {
          return res.status(400).json({ error: 'Property ID required' });
        }

        await FileStorageService.deleteProperty(id);
        return res.json({ success: true });
      } catch (error: any) {
        console.error('Property deletion error:', error);
        return res.status(500).json({ error: 'Failed to delete property' });
      }
    }

    // Property Search
    if (req.method === 'POST' && action === 'properties-search') {
      try {
        const { query, filters: searchFilters = {} } = req.body;

        if (!query) {
          return res.status(400).json({ error: 'Search query required' });
        }

        const filters = {
          propertyType: searchFilters.propertyType || undefined,
          transactionType: searchFilters.transactionType || undefined,
          minPrice: searchFilters.minPrice || undefined,
          maxPrice: searchFilters.maxPrice || undefined,
          minArea: searchFilters.minArea || undefined,
          maxArea: searchFilters.maxArea || undefined,
          limit: searchFilters.limit || 20,
          sortBy: searchFilters.sortBy || 'createdAt',
          sortOrder: searchFilters.sortOrder || 'desc'
        };

        const results = await FileStorageService.searchProperties({
          text: query,
          filters: filters
        });
        return res.json(results);
      } catch (error: any) {
        console.error('Property search error:', error);
        return res.status(500).json({ error: 'Failed to search properties' });
      }
    }

    // File Upload Actions
    if (req.method === 'POST' && action === 'upload') {
      try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
          return res.status(401).json({ error: 'Access token required' });
        }

        const user = await AuthService.verifyToken(token);

        // Note: File upload handling would need to be adapted for Vercel's request format
        // This is a placeholder - actual implementation would depend on how files are sent
        return res.status(501).json({ error: 'File upload not implemented in action-based routing yet' });
      } catch (error: any) {
        console.error('Upload error:', error);
        return res.status(500).json({ error: 'Upload failed' });
      }
    }

    return res.status(405).json({ message: 'method or action not supported' });
  } catch (error: any) {
    return handleError(res, error, 'Core API');
  }
}

