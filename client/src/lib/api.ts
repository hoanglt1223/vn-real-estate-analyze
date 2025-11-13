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
} as const;

export async function analyzeProperty(data: {
  coordinates: number[][];
  radius: number;
  categories: string[];
  layers: string[];
}) {
  const response = await fetch(API_ENDPOINTS.analyzeProperty, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
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

export async function searchLocations(q: string) {
  const response = await fetch(API_ENDPOINTS.locationsSearch(q));
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
