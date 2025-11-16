import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

// Create axios instance for property API
export const propertyApi = axios.create({
  baseURL: `${API_BASE_URL}/properties`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Types
export interface PropertyDetails {
  id?: string;
  userId?: string;
  propertyType: string;
  transactionType: string;
  title: string;
  description: string;
  area: number;
  price: number;
  address: string;
  province: string;
  district: string;
  ward?: string;
  street?: string;
  coordinates?: { lat: number; lng: number };
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
  images: Array<{
    url: string;
    filename: string;
    size: number;
    caption?: string;
    isPrimary: boolean;
  }>;
  status: 'draft' | 'active' | 'expired' | 'sold' | 'rented';
  createdAt?: string;
  updatedAt?: string;
  views?: number;
  contactClicks?: number;
}

export interface PropertyFilters {
  propertyType?: string[];
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
  sortBy?: 'createdAt' | 'price' | 'area' | 'views';
  sortOrder?: 'asc' | 'desc';
}

export interface SearchQuery {
  text?: string;
  filters: PropertyFilters;
  coordinates?: { lat: number; lng: number };
  radius?: number;
}

export interface SearchResult {
  properties: PropertyDetails[];
  total: number;
  page: number;
  totalPages: number;
}

export interface ContactData {
  name: string;
  email: string;
  phone?: string;
  message: string;
  userId?: string;
}

// Property service methods
export const propertyService = {
  // List properties with filters
  async listProperties(filters: PropertyFilters = {}): Promise<PropertyDetails[]> {
    try {
      const response = await propertyApi.get('', { params: filters });
      return response.data.data.properties;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw error.response?.data;
      }
      throw { error: 'Failed to fetch properties' };
    }
  },

  // Get property by ID
  async getProperty(id: string): Promise<PropertyDetails> {
    try {
      const response = await propertyApi.get(`/${id}`);
      return response.data.data.property;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw error.response?.data;
      }
      throw { error: 'Failed to fetch property' };
    }
  },

  // Create new property
  async createProperty(property: Omit<PropertyDetails, 'id' | 'createdAt' | 'updatedAt'>): Promise<PropertyDetails> {
    try {
      const response = await propertyApi.post('', property);
      return response.data.data.property;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw error.response?.data;
      }
      throw { error: 'Failed to create property' };
    }
  },

  // Update property
  async updateProperty(id: string, updates: Partial<PropertyDetails>): Promise<PropertyDetails> {
    try {
      const response = await propertyApi.put(`/${id}`, updates);
      return response.data.data.property;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw error.response?.data;
      }
      throw { error: 'Failed to update property' };
    }
  },

  // Delete property
  async deleteProperty(id: string): Promise<void> {
    try {
      await propertyApi.delete(`/${id}`);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw error.response?.data;
      }
      throw { error: 'Failed to delete property' };
    }
  },

  // Search properties
  async searchProperties(query: SearchQuery): Promise<SearchResult> {
    try {
      const response = await propertyApi.post('/search', query);
      return response.data.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw error.response?.data;
      }
      throw { error: 'Search failed' };
    }
  },

  // Contact property owner
  async contactOwner(id: string, contactData: ContactData): Promise<any> {
    try {
      const response = await axios.post(`${API_BASE_URL}/properties/${id}/contact`, contactData);
      return response.data.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw error.response?.data;
      }
      throw { error: 'Failed to send contact information' };
    }
  }
};

// Set up axios interceptor to include auth token for protected routes
propertyApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token && ['post', 'put', 'delete'].includes(config.method?.toLowerCase() || '')) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle token expiration
propertyApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      // Token expired or invalid - clear auth and redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);