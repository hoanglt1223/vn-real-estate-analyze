import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

// Create axios instance
export const authApi = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Types
export interface User {
  id: string;
  email: string;
  name: string;
  image?: string;
  phone?: string;
  role: 'user' | 'agent' | 'admin';
  isVerified: boolean;
  subscriptionType: 'free' | 'basic' | 'premium';
  createdAt: string;
  lastLogin?: string;
  reputation: number;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
  role?: 'user' | 'agent';
  phone?: string;
}

export interface AuthResponse {
  message: string;
  data: {
    user: User;
    token: string;
  };
}

export interface ProfileResponse {
  message: string;
  data: {
    user: User;
  };
}

export interface AuthError {
  error: string;
  details?: string;
}

// Auth service methods
export const authService = {
  // Register new user
  async register(input: RegisterInput): Promise<AuthResponse> {
    try {
      const response = await authApi.post('/auth/register', input);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw error.response?.data as AuthError;
      }
      throw { error: 'Registration failed' } as AuthError;
    }
  },

  // Login user
  async login(input: LoginInput): Promise<AuthResponse> {
    try {
      const response = await authApi.post('/auth/login', input);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw error.response?.data as AuthError;
      }
      throw { error: 'Login failed' } as AuthError;
    }
  },

  // Verify token
  async verifyToken(): Promise<ProfileResponse> {
    try {
      const response = await authApi.get('/auth/verify');
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw error.response?.data as AuthError;
      }
      throw { error: 'Token verification failed' } as AuthError;
    }
  },

  // Get user profile
  async getProfile(): Promise<ProfileResponse> {
    try {
      const response = await authApi.get('/auth/profile');
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw error.response?.data as AuthError;
      }
      throw { error: 'Failed to get profile' } as AuthError;
    }
  },

  // Update user profile
  async updateProfile(updates: Partial<User>): Promise<ProfileResponse> {
    try {
      const response = await authApi.put('/auth/profile', updates);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw error.response?.data as AuthError;
      }
      throw { error: 'Profile update failed' } as AuthError;
    }
  },

  // Change password
  async changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
    try {
      const response = await authApi.put('/auth/change-password', {
        currentPassword,
        newPassword
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw error.response?.data as AuthError;
      }
      throw { error: 'Password change failed' } as AuthError;
    }
  },

  // OAuth login methods
  loginWithGoogle() {
    window.location.href = `${API_BASE_URL}/oauth/google`;
  },

  loginWithFacebook() {
    window.location.href = `${API_BASE_URL}/oauth/facebook`;
  }
};

// Set up axios interceptor to include auth token
authApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle token expiration
authApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        // Token expired or invalid
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);