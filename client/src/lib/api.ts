const API_BASE = '/api/app';

export const API_ENDPOINTS = {
  // Auth endpoints
  authRegister: `${API_BASE}?action=auth-register`,
  authLogin: `${API_BASE}?action=auth-login`,
  authVerify: `${API_BASE}?action=auth-verify`,
  authProfile: `${API_BASE}?action=auth-profile`,
  authChangePassword: `${API_BASE}?action=auth-change-password`,

  // Property endpoints
  analyzeProperty: `${API_BASE}?action=analyze-property`,
  analysis: (id: string) => `${API_BASE}?action=analysis&id=${id}`,
  recentAnalyses: (limit: number = 10) => `${API_BASE}?action=recent-analyses&limit=${limit}`,
  analysisList: `${API_BASE}?action=analysis-list`,
  analysisUpdate: (id: string) => `${API_BASE}?action=analysis-update`,
  analysisDelete: (id: string) => `${API_BASE}?action=analysis-delete`,
  analysisSearch: `${API_BASE}?action=analysis-search`,
  analysisStatistics: `${API_BASE}?action=analysis-statistics`,
  propertiesList: `${API_BASE}?action=properties-list`,
  propertiesCreate: `${API_BASE}?action=properties-create`,
  propertiesDetail: (id: string) => `${API_BASE}?action=properties-detail&id=${id}`,
  propertiesUpdate: (id: string) => `${API_BASE}?action=properties-update`,
  propertiesDelete: (id: string) => `${API_BASE}?action=properties-delete`,
  propertiesSearch: `${API_BASE}?action=properties-search`,

  // Location endpoints
  locationsSearch: (q: string) => `${API_BASE}?action=locations-search&q=${encodeURIComponent(q)}`,
  locationsGeocode: `${API_BASE}?action=locations-geocode`,

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
  maxAmenities?: number;
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
      includeSmallShops: data.includeSmallShops || false,
      maxAmenities: data.maxAmenities || 500
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

export async function getAnalysisList() {
  const response = await fetch(API_ENDPOINTS.analysisList);
  if (!response.ok) throw new Error('Failed to fetch analysis list');
  return response.json();
}

export async function updateAnalysis(id: string, updates: any) {
  const response = await fetch(API_ENDPOINTS.analysisUpdate(id), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, ...updates }),
  });
  if (!response.ok) throw new Error('Failed to update analysis');
  return response.json();
}

export async function deleteAnalysis(id: string) {
  const response = await fetch(API_ENDPOINTS.analysisDelete(id), {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  });
  if (!response.ok) throw new Error('Failed to delete analysis');
  return response.json();
}

export async function searchAnalyses(criteria: {
  text?: string;
  coordinates?: { lat: number; lng: number };
  radius?: number;
  limit?: number;
  offset?: number;
}) {
  const response = await fetch(API_ENDPOINTS.analysisSearch, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(criteria),
  });
  if (!response.ok) throw new Error('Failed to search analyses');
  return response.json();
}

export async function getAnalysisStatistics() {
  const response = await fetch(API_ENDPOINTS.analysisStatistics);
  if (!response.ok) throw new Error('Failed to fetch analysis statistics');
  return response.json();
}

export async function listProperties(filters?: {
  type?: string[];
  transactionType?: string;
  minPrice?: number;
  maxPrice?: number;
  minArea?: number;
  maxArea?: number;
  location?: string;
  province?: string;
  district?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: string;
}) {
  let url = API_ENDPOINTS.propertiesList;

  if (filters) {
    const params = new URLSearchParams();
    if (filters.type) params.set('type', filters.type.join(','));
    if (filters.transactionType) params.set('transactionType', filters.transactionType);
    if (filters.minPrice) params.set('minPrice', String(filters.minPrice));
    if (filters.maxPrice) params.set('maxPrice', String(filters.maxPrice));
    if (filters.minArea) params.set('minArea', String(filters.minArea));
    if (filters.maxArea) params.set('maxArea', String(filters.maxArea));
    if (filters.location) params.set('location', filters.location);
    if (filters.province) params.set('province', filters.province);
    if (filters.district) params.set('district', filters.district);
    if (filters.limit) params.set('limit', String(filters.limit));
    if (filters.offset) params.set('offset', String(filters.offset));
    if (filters.sortBy) params.set('sortBy', filters.sortBy);
    if (filters.sortOrder) params.set('sortOrder', filters.sortOrder);

    if (params.toString()) {
      url += '&' + params.toString();
    }
  }

  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch properties');
  return response.json();
}

export async function createProperty(propertyData: any, token: string) {
  const response = await fetch(API_ENDPOINTS.propertiesCreate, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(propertyData),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create property');
  }
  return response.json();
}

export async function getProperty(id: string) {
  const response = await fetch(API_ENDPOINTS.propertiesDetail(id));
  if (!response.ok) throw new Error('Failed to fetch property');
  return response.json();
}

export async function updateProperty(id: string, updates: any, token: string) {
  const response = await fetch(API_ENDPOINTS.propertiesUpdate(id), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(updates),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update property');
  }
  return response.json();
}

export async function deleteProperty(id: string, token: string) {
  const response = await fetch(API_ENDPOINTS.propertiesDelete(id), {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete property');
  }
  return response.json();
}

export async function searchProperties(criteria: { query?: string; [key: string]: any }) {
  const response = await fetch(API_ENDPOINTS.propertiesSearch, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(criteria),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to search properties');
  }
  return response.json();
}

// Auth functions
export async function registerUser(userData: { email: string; password: string; name: string }) {
  const response = await fetch(API_ENDPOINTS.authRegister, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to register');
  }
  return response.json();
}

export async function loginUser(credentials: { email: string; password: string }) {
  const response = await fetch(API_ENDPOINTS.authLogin, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to login');
  }
  return response.json();
}

export async function verifyToken(token: string) {
  const response = await fetch(API_ENDPOINTS.authVerify, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Invalid token');
  }
  return response.json();
}

export async function getProfile(token: string) {
  const response = await fetch(API_ENDPOINTS.authProfile, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get profile');
  }
  return response.json();
}

export async function updateProfile(token: string, updates: any) {
  const response = await fetch(API_ENDPOINTS.authProfile, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(updates),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update profile');
  }
  return response.json();
}

export async function changePassword(token: string, passwords: { currentPassword: string; newPassword: string }) {
  const response = await fetch(API_ENDPOINTS.authChangePassword, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(passwords),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to change password');
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
