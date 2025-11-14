// Simple types for the API
export interface PropertyAnalysis {
  id: string;
  coordinates: number[][];
  area: number;
  orientation: number;
  frontageCount: number;
  center: { lat: number; lng: number };
  amenities: any[];
  infrastructure: any;
  marketData: any;
  aiAnalysis: any;
  risks: any[];
  propertyType: string | null;
  valuation: number | null;
  askingPrice: number | null;
  notes: string | null;
  createdAt: Date;
}

export interface InsertPropertyAnalysis {
  coordinates: number[][];
  area: number;
  orientation: number;
  frontageCount: number;
  center: { lat: number; lng: number };
  amenities: any[];
  infrastructure: any;
  marketData: any;
  aiAnalysis: any;
  risks: any[];
  propertyType: string | null;
  valuation: number | null;
  askingPrice: number | null;
  notes: string | null;
}

// Geospatial calculations
import { polygon, center, length, area } from '@turf/turf';
import { point } from '@turf/helpers';

export function calculatePropertyMetrics(coordinates: number[][]) {
  const poly = polygon([coordinates]);
  const centroid = center(poly);
  const [lng, lat] = centroid.geometry.coordinates;

  // Calculate area in square meters
  const areaInSquareMeters = area(poly);

  // Calculate perimeter
  let perimeter = 0;
  for (let i = 0; i < coordinates.length; i++) {
    const current = coordinates[i];
    const next = coordinates[(i + 1) % coordinates.length];
    const distance = length(
      {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [current, next]
        },
        properties: {}
      },
      { units: 'meters' }
    );
    perimeter += distance;
  }

  // Count frontages (roads touching the property)
  let frontageCount = 0;
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

  return {
    area: Math.round(areaInSquareMeters),
    orientation: calculateOrientation(coordinates),
    frontageCount,
    center: { lat, lng },
    perimeter: Math.round(perimeter)
  };
}

function calculateOrientation(coordinates: number[][]): number {
  if (coordinates.length < 2) return 0;

  let totalAngle = 0;
  let count = 0;

  for (let i = 0; i < coordinates.length; i++) {
    const p1 = coordinates[i];
    const p2 = coordinates[(i + 1) % coordinates.length];

    const angle = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]) * (180 / Math.PI);
    totalAngle += angle;
    count++;
  }

  return Math.round((totalAngle / count + 360) % 360);
}

export function assessRisks(center: { lat: number; lng: number }, infrastructure: any) {
  const risks = [];
  let overallRiskLevel = 'low';

  // Check for flood risk (simplified)
  if (infrastructure.water && infrastructure.water.length > 0) {
    risks.push({
      type: 'flood',
      severity: 'medium',
      description: 'Near water bodies - potential flood risk',
      distance: infrastructure.water[0].distance || 0
    });
    overallRiskLevel = 'medium';
  }

  // Check for industrial proximity
  if (infrastructure.industrial && infrastructure.industrial.length > 0) {
    const nearestIndustrial = infrastructure.industrial[0];
    if (nearestIndustrial.distance && nearestIndustrial.distance < 500) {
      risks.push({
        type: 'industrial',
        severity: 'high',
        description: 'Close to industrial area - air/noise pollution risk',
        distance: nearestIndustrial.distance
      });
      overallRiskLevel = 'high';
    }
  }

  return { risks, overallRiskLevel };
}

// Simplified implementations for other services
export async function scrapeMarketPrices(lat: number, lng: number, radius: number) {
  // Mock implementation - in production this would scrape real estate websites
  return {
    min: 30000000,
    avg: 45000000,
    max: 60000000,
    median: 42000000,
    currency: 'VND',
    area: 'm2',
    lastUpdated: new Date(),
    sampleSize: 25
  };
}

export async function analyzeProperty(data: any) {
  // Mock AI analysis
  return {
    score: 7.5,
    recommendations: [
      'Good location for residential development',
      'Consider flood mitigation measures',
      'Access to transportation is adequate'
    ],
    marketValue: 45000000,
    pricePerSqm: 15000000,
    investmentPotential: 'medium'
  };
}

export async function searchLocations(query: string, limit: number = 10) {
  // Mock location search - in production this would use a real geocoding service
  const mockLocations = [
    { name: `${query}, Hà Nội`, lat: 21.0285, lng: 105.8542, type: 'city' },
    { name: `${query}, Hồ Chí Minh`, lat: 10.8231, lng: 106.6297, type: 'city' },
    { name: `${query}, Đà Nẵng`, lat: 16.0544, lng: 108.2022, type: 'city' }
  ];

  return mockLocations.slice(0, limit);
}

export async function suggestLocations(query: string, options: any = {}) {
  // Mock suggestions
  return searchLocations(query, options.limit || 10);
}

export async function retrieveLocation(id: string, sessionToken?: string) {
  // Mock location retrieval
  return {
    id,
    name: 'Mock Location',
    lat: 21.0285,
    lng: 105.8542,
    type: 'place'
  };
}

export async function geocodeLocationCached(query: string) {
  // Mock geocoding
  return {
    query,
    lat: 21.0285,
    lng: 105.8542,
    name: query,
    address: query
  };
}

export async function searchCategory(category: string, options: any = {}) {
  // Mock category search
  return [];
}