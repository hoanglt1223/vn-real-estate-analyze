const API_BASE = '/api/app';

export const API_ENDPOINTS = {
  analyzeProperty: `${API_BASE}?action=analyze-property`,
  analysis: (id: string) => `${API_BASE}?action=analysis&id=${id}`,
  recentAnalyses: (limit: number = 10) => `${API_BASE}?action=recent-analyses&limit=${limit}`,
  propertiesList: `${API_BASE}?action=properties`,
  propertiesUpdate: (id: string) => `${API_BASE}?action=properties&id=${id}`,
  propertiesDelete: (id: string) => `${API_BASE}?action=properties&id=${id}`,
  locationsSearch: (q: string) => `${API_BASE}?action=locations-search&q=${encodeURIComponent(q)}`,
  locationsGeocode: `${API_BASE}?action=locations-geocode`,

  // New REST API endpoints
  searchProperties: '/api/properties/search',
  createComparison: '/api/comparisons',
  getComparisons: (userId: string) => `/api/comparisons/${userId}`,
  deleteComparison: (id: string) => `/api/comparisons/${id}`,
  createNote: '/api/notes',
  getNotes: (propertyId: string) => `/api/notes/${propertyId}`,
  deleteNote: (id: string) => `/api/notes/${id}`,
  createSavedSearch: '/api/saved-searches',
  getSavedSearches: (userId: string) => `/api/saved-searches/${userId}`,
  deleteSavedSearch: (id: string) => `/api/saved-searches/${id}`,
  importProperties: '/api/properties/import',
  locationsSuggest: (q: string, opts?: { limit?: number; types?: string; sessionToken?: string; proximity?: string }) => {
    const params = new URLSearchParams({ q });
    if (opts?.limit) params.set('limit', String(opts.limit));
    if (opts?.types) params.set('types', opts.types);
    if (opts?.sessionToken) params.set('sessionToken', opts.sessionToken);
    if (opts?.proximity) params.set('proximity', opts.proximity);
    return `${API_BASE}?action=locations-suggest&${params.toString()}`;
  },
  locationsRetrieve: (id: string, sessionToken?: string) => {
    const params = new URLSearchParams({ id });
    if (sessionToken) params.set('sessionToken', sessionToken);
    return `${API_BASE}?action=locations-retrieve&${params.toString()}`;
  },
  locationsCategory: (categoryCsv: string, opts: { lat?: number; lng?: number; limit?: number; bbox?: string; proximity?: string; sessionToken?: string }) => {
    const params = new URLSearchParams({ category: categoryCsv });
    if (opts.lat != null) params.set('lat', String(opts.lat));
    if (opts.lng != null) params.set('lng', String(opts.lng));
    if (opts.limit != null) params.set('limit', String(opts.limit));
    if (opts.bbox) params.set('bbox', opts.bbox);
    if (opts.proximity) params.set('proximity', opts.proximity);
    if (opts.sessionToken) params.set('sessionToken', opts.sessionToken);
    return `${API_BASE}?action=locations-category&${params.toString()}`;
  },
} as const;

export async function analyzeProperty(data: {
  coordinates: number[][];
  radius: number;
  categories: string[];
  layers: string[];
  includeSmallShops?: boolean;
  signal?: AbortSignal;
}) {
  const response = await fetch(API_ENDPOINTS.analyzeProperty, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      coordinates: data.coordinates,
      radius: data.radius,
      categories: data.categories,
      layers: data.layers,
      includeSmallShops: data.includeSmallShops || false
    }),
    signal: data.signal,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to analyze property');
  }

  return response.json();
}

export async function getAnalysis(id: string) {
  const response = await fetch(API_ENDPOINTS.analysis(id));
  if (!response.ok) throw new Error('Failed to fetch analysis');
  return response.json();
}

export async function getRecentAnalyses(limit: number = 10) {
  const response = await fetch(API_ENDPOINTS.recentAnalyses(limit));
  if (!response.ok) throw new Error('Failed to fetch recent analyses');
  return response.json();
}

export async function listProperties() {
  const response = await fetch(API_ENDPOINTS.propertiesList);
  if (!response.ok) throw new Error('Failed to fetch properties');
  return response.json();
}

export async function updateProperty(id: string, updates: any) {
  const response = await fetch(API_ENDPOINTS.propertiesUpdate(id), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update property');
  }
  return response.json();
}

export async function deleteProperty(id: string) {
  const response = await fetch(API_ENDPOINTS.propertiesDelete(id), { method: 'DELETE' });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to delete property');
  }
  return response.json();
}

export async function searchLocations(q: string, opts?: { limit?: number; types?: string; sessionToken?: string; proximity?: string }) {
  const params = new URLSearchParams({ q });
  if (opts?.limit) params.set('limit', String(opts.limit));
  if (opts?.types) params.set('types', opts.types);
  if (opts?.sessionToken) params.set('sessionToken', opts.sessionToken);
  if (opts?.proximity) params.set('proximity', opts.proximity);
  const response = await fetch(`${API_BASE}?action=locations-search&${params.toString()}`);
  if (!response.ok) throw new Error('Failed to search locations');
  return response.json();
}

export async function geocodeLocation(query: string) {
  const response = await fetch(API_ENDPOINTS.locationsGeocode, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!response.ok) throw new Error('Failed to geocode');
  return response.json();
}

// Advanced search
export async function searchProperties(criteria: {
  query?: string;
  minScore?: number;
  maxScore?: number;
  minPrice?: number;
  maxPrice?: number;
  minArea?: number;
  maxArea?: number;
  propertyType?: string;
  sortBy?: 'date' | 'score' | 'price' | 'area';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}) {
  const response = await fetch(API_ENDPOINTS.searchProperties, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(criteria),
  });
  if (!response.ok) throw new Error('Failed to search properties');
  return response.json();
}

// Property comparisons
export async function createPropertyComparison(data: {
  userId: string;
  propertyIds: string[];
  comparisonResult: any;
}) {
  const response = await fetch(API_ENDPOINTS.createComparison, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create comparison');
  return response.json();
}

export async function getPropertyComparisons(userId: string) {
  const response = await fetch(API_ENDPOINTS.getComparisons(userId));
  if (!response.ok) throw new Error('Failed to fetch comparisons');
  return response.json();
}

export async function deletePropertyComparison(id: string) {
  const response = await fetch(API_ENDPOINTS.deleteComparison(id), { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to delete comparison');
  return response.json();
}

// Property notes
export async function createPropertyNote(data: {
  propertyId: string;
  userId: string;
  content: string;
}) {
  const response = await fetch(API_ENDPOINTS.createNote, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create note');
  return response.json();
}

export async function getPropertyNotes(propertyId: string) {
  const response = await fetch(API_ENDPOINTS.getNotes(propertyId));
  if (!response.ok) throw new Error('Failed to fetch notes');
  return response.json();
}

export async function deletePropertyNote(id: string) {
  const response = await fetch(API_ENDPOINTS.deleteNote(id), { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to delete note');
  return response.json();
}

// Saved searches
export async function createSavedSearch(data: {
  userId: string;
  name: string;
  searchCriteria: any;
}) {
  const response = await fetch(API_ENDPOINTS.createSavedSearch, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create saved search');
  return response.json();
}

export async function getSavedSearches(userId: string) {
  const response = await fetch(API_ENDPOINTS.getSavedSearches(userId));
  if (!response.ok) throw new Error('Failed to fetch saved searches');
  return response.json();
}

export async function deleteSavedSearch(id: string) {
  const response = await fetch(API_ENDPOINTS.deleteSavedSearch(id), { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to delete saved search');
  return response.json();
}

// Import/Export
export async function importProperties(properties: any[]) {
  const response = await fetch(API_ENDPOINTS.importProperties, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ properties }),
  });
  if (!response.ok) throw new Error('Failed to import properties');
  return response.json();
}

export async function suggestLocations(q: string, opts?: { limit?: number; types?: string; sessionToken?: string; proximity?: string }) {
  const response = await fetch(API_ENDPOINTS.locationsSuggest(q, opts));
  if (!response.ok) throw new Error('Failed to suggest locations');
  return response.json();
}

export async function retrieveLocation(id: string, sessionToken?: string) {
  const response = await fetch(API_ENDPOINTS.locationsRetrieve(id, sessionToken));
  if (!response.ok) throw new Error('Failed to retrieve location');
  return response.json();
}

export async function searchCategory(categoryCsv: string, opts: { lat?: number; lng?: number; limit?: number; bbox?: string; proximity?: string; sessionToken?: string }) {
  const response = await fetch(API_ENDPOINTS.locationsCategory(categoryCsv, opts));
  if (!response.ok) throw new Error('Failed to search category');
  return response.json();
}
