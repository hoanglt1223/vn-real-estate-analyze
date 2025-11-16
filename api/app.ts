import type { VercelRequest, VercelResponse } from '@vercel/node';
import { setCorsHeaders, handleOptions } from './_lib/cors.js';
import { handleError } from './_lib/error-handler.js';
import { applySecurity, SecurityMiddleware } from './_lib/security.middleware.js';
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
import { AuthService } from '../shared/services/auth.service.js';
import { FileStorageService } from '../shared/services/file-storage.service.js';
import { blobStorageService } from '../shared/services/blob-storage.service.js';
import { AdvancedSearchService } from '../shared/services/advanced-search.service.js';
import { PropertyComparisonService } from '../shared/services/property-comparison.service.js';
import { HistoricalPriceService } from '../shared/services/historical-price.service.js';
import { CreateUserInput, LoginInput } from '../shared/types/user.types.js';

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

// Helper functions for price formatting and analysis
function formatCurrency(amount: number): string {
  if (amount >= 1000000000) {
    return `${(amount / 1000000000).toFixed(2)} tỷ VNĐ`;
  } else if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(0)} triệu VNĐ`;
  } else {
    return `${amount.toLocaleString('vi-VN')} VNĐ`;
  }
}

function calculateMarketHeat(trends: any): 'hot' | 'warm' | 'cold' | 'stable' {
  const trend6Months = trends.trends['6months'];
  const changePercent = Math.abs(trend6Months.changePercent);
  const confidence = trend6Months.confidence;

  if (confidence > 0.8 && changePercent > 10) {
    return trend6Months.trendDirection === 'up' ? 'hot' : 'cold';
  } else if (confidence > 0.6 && changePercent > 5) {
    return trend6Months.trendDirection === 'up' ? 'warm' : 'cold';
  } else {
    return 'stable';
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Apply security middleware
    const securityResult = await applySecurity(req, res);
    if (!securityResult.success) {
      // Rate limit exceeded
      return res.status(429).json({
        error: securityResult.error,
        retryAfter: 60,
        remaining: securityResult.remaining
      });
    }

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', '100');
    res.setHeader('X-RateLimit-Remaining', (securityResult.remaining || 0).toString());
    res.setHeader('X-RateLimit-Reset', Math.ceil(Date.now() / 1000 + 60).toString());

    // Handle OPTIONS request
    if (req.method === 'OPTIONS') return handleOptions(res);

    const action = ((req.query.action as string) || (req.body && (req.body as any).action)) as string | undefined;
    if (!action) return res.status(400).json({ message: 'action required' });

    // Sanitize input data
    if (req.body && typeof req.body === 'object') {
      req.body = SecurityMiddleware.sanitizeInput(req.body);
    }

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

      // Run independent API calls in parallel to improve performance
      const [amenities, infrastructure, marketData] = await Promise.all([
        fetchAmenities(metrics.center.lat, metrics.center.lng, input.radius, input.categories, input.includeSmallShops, input.maxAmenities),
        fetchInfrastructure(metrics.center.lat, metrics.center.lng, input.radius, input.layers),
        scrapeMarketPrices(metrics.center.lat, metrics.center.lng, input.radius)
      ]);

      // Risk assessment depends on infrastructure, so it runs after infrastructure is loaded
      const riskAssessment = assessRisks(metrics.center, infrastructure);

      // AI analysis depends on all previous data, so it runs last
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

        // Query is optional - allow empty query to search with filters only

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

    // Advanced Search with Geospatial Filtering
    if (req.method === 'POST' && action === 'advanced-search') {
      try {
        const searchQuery = req.body;

        // Validate basic structure
        if (!searchQuery || typeof searchQuery !== 'object') {
          return res.status(400).json({
            error: 'Invalid search query',
            details: 'Request body must contain search query object'
          });
        }

        // Execute advanced search
        const results = await AdvancedSearchService.advancedSearch(searchQuery);

        return res.json(results);
      } catch (error: any) {
        console.error('Advanced search error:', error);
        return res.status(500).json({ error: 'Failed to perform advanced search' });
      }
    }

    // Get Popular Searches
    if (req.method === 'GET' && action === 'search-popular') {
      try {
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
        const popularSearches = await AdvancedSearchService.getPopularSearches(limit);

        return res.json({
          popularSearches,
          total: popularSearches.length
        });
      } catch (error: any) {
        console.error('Get popular searches error:', error);
        return res.status(500).json({ error: 'Failed to get popular searches' });
      }
    }

    // Save Search
    if (req.method === 'POST' && action === 'search-save') {
      try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
          return res.status(401).json({ error: 'Access token required' });
        }

        const user = await AuthService.verifyToken(token);
        const { name, query } = req.body;

        if (!name || !query) {
          return res.status(400).json({
            error: 'Missing required fields',
            details: 'Both name and query are required'
          });
        }

        const savedSearch = await AdvancedSearchService.saveSearch(user.id, name, query);

        return res.status(201).json({
          message: 'Search saved successfully',
          savedSearch
        });
      } catch (error: any) {
        console.error('Save search error:', error);
        return res.status(500).json({ error: 'Failed to save search' });
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

        // Handle different upload formats
        const contentType = req.headers['content-type'];
        let fileData: ArrayBuffer;
        let fileName: string;
        let mimeType: string;
        let propertyId: string;

        if (contentType?.includes('multipart/form-data')) {
          // Multipart form data (traditional file upload)
          return res.status(400).json({
            error: 'Multipart uploads not supported in serverless. Use base64 or direct upload.'
          });
        } else if (contentType?.includes('application/json')) {
          // JSON payload with base64 file data
          const {
            file: base64File,
            filename,
            mimeType: fileType,
            propertyId: propId
          } = req.body;

          if (!base64File || !filename || !fileType || !propId) {
            return res.status(400).json({
              error: 'Missing required fields: file, filename, mimeType, propertyId'
            });
          }

          // Validate file size (max 10MB for base64)
          const fileSize = Buffer.byteLength(base64File, 'base64');
          const validation = blobStorageService.validateFile({ type: fileType, size: fileSize });
          if (!validation.valid) {
            return res.status(400).json({ error: validation.error });
          }

          fileData = Buffer.from(base64File, 'base64');
          fileName = filename;
          mimeType = fileType;
          propertyId = propId;
        } else {
          return res.status(400).json({
            error: 'Invalid content type. Use application/json with base64 file data.'
          });
        }

        // Upload file using Blob Storage service
        const uploadResult = await blobStorageService.uploadPropertyFile(
          propertyId,
          fileData,
          fileName,
          mimeType,
          {
            isPrimary: req.body.isPrimary,
            caption: req.body.caption
          }
        );

        if (uploadResult.success && uploadResult.file) {
          return res.status(201).json({
            message: 'File uploaded successfully',
            data: uploadResult.file,
            storageInfo: blobStorageService.getStorageInfo()
          });
        } else {
          return res.status(500).json({
            error: uploadResult.error || 'Upload failed'
          });
        }
      } catch (error: any) {
        console.error('Upload error:', error);
        return res.status(500).json({ error: 'Upload failed' });
      }
    }

    // Upload management actions
    if (req.method === 'DELETE' && action === 'upload-delete') {
      try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
          return res.status(401).json({ error: 'Access token required' });
        }

        const user = await AuthService.verifyToken(token);
        const { fileUrl } = req.body;

        if (!fileUrl) {
          return res.status(400).json({ error: 'File URL required' });
        }

        const deleteResult = await blobStorageService.deleteFile(fileUrl);

        if (deleteResult.success) {
          return res.json({ message: 'File deleted successfully' });
        } else {
          return res.status(500).json({ error: deleteResult.error || 'Delete failed' });
        }
      } catch (error: any) {
        console.error('Delete file error:', error);
        return res.status(500).json({ error: 'Delete failed' });
      }
    }

    if (req.method === 'GET' && action === 'upload-list') {
      try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
          return res.status(401).json({ error: 'Access token required' });
        }

        const user = await AuthService.verifyToken(token);
        const propertyId = req.query.propertyId as string;

        if (!propertyId) {
          return res.status(400).json({ error: 'Property ID required' });
        }

        const files = await blobStorageService.listPropertyFiles(propertyId);

        return res.json({
          files,
          storageInfo: blobStorageService.getStorageInfo()
        });
      } catch (error: any) {
        console.error('List files error:', error);
        return res.status(500).json({ error: 'Failed to list files' });
      }
    }

    // Property Comparison Actions
    if (req.method === 'POST' && action === 'comparison-create') {
      try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
          return res.status(401).json({ error: 'Access token required' });
        }

        const user = await AuthService.verifyToken(token);
        const { name, propertyIds, isPublic, notes } = req.body;

        if (!name || !propertyIds || !Array.isArray(propertyIds) || propertyIds.length < 2) {
          return res.status(400).json({
            error: 'Invalid input',
            details: 'Name and at least 2 property IDs are required'
          });
        }

        const comparison = await PropertyComparisonService.createComparison(
          user.id,
          name,
          propertyIds,
          { isPublic, notes }
        );

        return res.status(201).json({
          message: 'Comparison created successfully',
          comparison
        });
      } catch (error: any) {
        console.error('Create comparison error:', error);
        return res.status(500).json({ error: error.message || 'Failed to create comparison' });
      }
    }

    if (req.method === 'GET' && action === 'comparison-detail') {
      try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];
        const comparisonId = req.query.id as string;
        const shareToken = req.query.shareToken as string;

        if (!comparisonId) {
          return res.status(400).json({ error: 'Comparison ID required' });
        }

        let userId: string | undefined;
        if (token) {
          const user = await AuthService.verifyToken(token);
          userId = user.id;
        }

        const accessValidation = await PropertyComparisonService.validateAccess(
          comparisonId,
          userId,
          shareToken
        );

        if (!accessValidation.allowed) {
          return res.status(403).json({ error: 'Access denied', reason: accessValidation.reason });
        }

        const comparison = await PropertyComparisonService.getComparison(comparisonId, userId);
        if (!comparison) {
          return res.status(404).json({ error: 'Comparison not found' });
        }

        // Generate metrics and charts
        const metrics = PropertyComparisonService.generateComparisonMetrics(comparison.properties);
        const charts = PropertyComparisonService.generateComparisonCharts(comparison.properties, metrics);
        const recommendations = PropertyComparisonService.generateRecommendations(comparison.properties, metrics);

        return res.json({
          comparison,
          metrics,
          charts,
          recommendations
        });
      } catch (error: any) {
        console.error('Get comparison error:', error);
        return res.status(500).json({ error: 'Failed to get comparison' });
      }
    }

    if (req.method === 'GET' && action === 'comparison-list') {
      try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
          return res.status(401).json({ error: 'Access token required' });
        }

        const user = await AuthService.verifyToken(token);
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
        const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
        const includePublic = req.query.includePublic === 'true';

        const comparisons = await PropertyComparisonService.getUserComparisons(user.id, {
          limit,
          offset,
          includePublic
        });

        return res.json({
          comparisons,
          total: comparisons.length,
          limit,
          offset
        });
      } catch (error: any) {
        console.error('List comparisons error:', error);
        return res.status(500).json({ error: 'Failed to list comparisons' });
      }
    }

    if (req.method === 'POST' && action === 'comparison-export') {
      try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
          return res.status(401).json({ error: 'Access token required' });
        }

        const user = await AuthService.verifyToken(token);
        const { comparisonId, format } = req.body;

        if (!comparisonId) {
          return res.status(400).json({ error: 'Comparison ID required' });
        }

        const comparison = await PropertyComparisonService.getComparison(comparisonId, user.id);
        if (!comparison) {
          return res.status(404).json({ error: 'Comparison not found' });
        }

        const metrics = PropertyComparisonService.generateComparisonMetrics(comparison.properties);
        const charts = PropertyComparisonService.generateComparisonCharts(comparison.properties, metrics);
        const recommendations = PropertyComparisonService.generateRecommendations(comparison.properties, metrics);

        const exportData = PropertyComparisonService.exportToPDF(
          comparison,
          metrics,
          charts,
          recommendations
        );

        return res.json({
          message: 'Comparison exported successfully',
          data: exportData,
          format: format || 'json'
        });
      } catch (error: any) {
        console.error('Export comparison error:', error);
        return res.status(500).json({ error: 'Failed to export comparison' });
      }
    }

    if (req.method === 'DELETE' && action === 'comparison-delete') {
      try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
          return res.status(401).json({ error: 'Access token required' });
        }

        const user = await AuthService.verifyToken(token);
        const { comparisonId } = req.body;

        if (!comparisonId) {
          return res.status(400).json({ error: 'Comparison ID required' });
        }

        await PropertyComparisonService.deleteComparison(comparisonId, user.id);

        return res.json({ message: 'Comparison deleted successfully' });
      } catch (error: any) {
        console.error('Delete comparison error:', error);
        return res.status(500).json({ error: 'Failed to delete comparison' });
      }
    }

    // Historical Price Tracking Actions
    if (req.method === 'POST' && action === 'price-scrape') {
      try {
        const { province, district, propertyType, sources, maxPages } = req.body;

        if (!province) {
          return res.status(400).json({
            error: 'Province required',
            details: 'Please provide a province for price scraping'
          });
        }

        const defaultSources = sources || ['batdongsan', 'chotot'];
        const results: any = { totalScraped: 0, sources: {} };

        // Scrape from each source
        for (const source of defaultSources) {
          try {
            let pricePoints = [];

            switch (source) {
              case 'batdongsan':
                pricePoints = await HistoricalPriceService.scrapeBatdongsan(
                  province,
                  district,
                  propertyType,
                  maxPages || 3
                );
                break;
              case 'chotot':
                pricePoints = await HistoricalPriceService.scrapeChotot(
                  province,
                  district,
                  propertyType,
                  maxPages || 3
                );
                break;
              case 'meeymap':
                pricePoints = await HistoricalPriceService.scrapeMeeyMap(
                  province,
                  district,
                  propertyType
                );
                break;
            }

            // Store the scraped data
            await HistoricalPriceService.storePricePoints(pricePoints);

            results.sources[source] = {
              scraped: pricePoints.length,
              avgPrice: pricePoints.length > 0
                ? Math.round(pricePoints.reduce((sum, p) => sum + p.price, 0) / pricePoints.length)
                : 0,
              avgPricePerSqm: pricePoints.length > 0
                ? Math.round(pricePoints.reduce((sum, p) => sum + p.pricePerSqm, 0) / pricePoints.length)
                : 0
            };

            results.totalScraped += pricePoints.length;

          } catch (error: any) {
            results.sources[source] = {
              error: error.message,
              scraped: 0
            };
          }
        }

        return res.json({
          message: 'Price scraping completed',
          province,
          district,
          propertyType,
          results,
          timestamp: new Date().toISOString()
        });
      } catch (error: any) {
        console.error('Price scrape error:', error);
        return res.status(500).json({ error: 'Failed to scrape price data' });
      }
    }

    if (req.method === 'GET' && action === 'price-trends') {
      try {
        const province = req.query.province as string;
        const district = req.query.district as string;
        const propertyType = req.query.propertyType as string;
        const period = (req.query.period as string) || '3months';

        if (!province) {
          return res.status(400).json({
            error: 'Province required',
            details: 'Please provide a province for price trends'
          });
        }

        const trends = await HistoricalPriceService.getPriceTrends(
          province,
          district,
          propertyType,
          period as any
        );

        if (!trends) {
          return res.status(404).json({ error: 'Price trends not found for this location' });
        }

        return res.json({
          trends,
          location: `${province}${district ? ', ' + district : ''}`,
          propertyType: propertyType || 'all',
          period
        });
      } catch (error: any) {
        console.error('Get price trends error:', error);
        return res.status(500).json({ error: 'Failed to get price trends' });
      }
    }

    if (req.method === 'POST' && action === 'price-alert-create') {
      try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
          return res.status(401).json({ error: 'Access token required' });
        }

        const user = await AuthService.verifyToken(token);
        const alertData = req.body;

        const alert = await HistoricalPriceService.createPriceAlert({
          ...alertData,
          userId: user.id,
          isActive: true
        });

        return res.status(201).json({
          message: 'Price alert created successfully',
          alert
        });
      } catch (error: any) {
        console.error('Create price alert error:', error);
        return res.status(500).json({ error: 'Failed to create price alert' });
      }
    }

    if (req.method === 'GET' && action === 'price-alerts') {
      try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
          return res.status(401).json({ error: 'Access token required' });
        }

        const user = await AuthService.verifyToken(token);

        // TODO: Implement get user alerts
        const alerts = await HistoricalPriceService.checkPriceAlerts();

        return res.json({
          alerts,
          total: alerts.length
        });
      } catch (error: any) {
        console.error('Get price alerts error:', error);
        return res.status(500).json({ error: 'Failed to get price alerts' });
      }
    }

    if (req.method === 'POST' && action === 'price-analysis') {
      try {
        const { coordinates, radius, propertyType } = req.body;

        if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 2) {
          return res.status(400).json({
            error: 'Coordinates required',
            details: 'Please provide valid coordinates [lat, lng]'
          });
        }

        const analysisRadius = radius || 2000; // 2km default
        const [lat, lng] = coordinates;

        // Extract province/district from coordinates (simplified)
        // In a real implementation, you'd use reverse geocoding
        const province = 'hà nội'; // Default for demo
        const district = 'cầu giấy'; // Default for demo

        // Get comprehensive price analysis
        const trends = await HistoricalPriceService.getPriceTrends(
          province,
          district,
          propertyType,
          '6months'
        );

        // Additional analysis specific to the location
        const locationAnalysis = {
          coordinates: { lat, lng },
          radius: analysisRadius,
          currentMarketStatus: trends ? {
            avgPrice: trends.currentAvgPrice,
            avgPricePerSqm: trends.currentAvgPricePerSqm,
            trendDirection: trends.trends['6months'].trendDirection,
            confidence: trends.trends['6months'].confidence
          } : null,
          recommendations: trends ? [
            trends.trends['6months'].trendDirection === 'up'
              ? 'Giá đang tăng,可以考虑 đầu tư'
              : 'Giá đang ổn định, có thể đợi cơ hội tốt hơn',
            `Giá trung bình: ${formatCurrency(trends.currentAvgPrice)}`,
            `Diện tích trung bình: ${Math.round(trends.currentAvgPrice / trends.currentAvgPricePerSqm)} m²`
          ] : [],
          marketHeat: trends ? calculateMarketHeat(trends) : 'unknown'
        };

        return res.json({
          locationAnalysis,
          priceTrends: trends,
          timestamp: new Date().toISOString()
        });
      } catch (error: any) {
        console.error('Price analysis error:', error);
        return res.status(500).json({ error: 'Failed to analyze prices' });
      }
    }

    return res.status(405).json({ message: 'method or action not supported' });
  } catch (error: any) {
    return handleError(res, error, 'Core API');
  }
}

