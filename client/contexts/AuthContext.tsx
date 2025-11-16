import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService, User, LoginInput, RegisterInput } from '../services/auth.service';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => void;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  loginWithGoogle: () => void;
  loginWithFacebook: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: localStorage.getItem('token'),
    isLoading: true,
    isAuthenticated: false,
  });

  // Initialize auth on mount
  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');

    if (token && savedUser) {
      try {
        // Verify token with server
        const { data } = await authService.verifyToken();
        setState({
          user: data.user,
          token,
          isLoading: false,
          isAuthenticated: true,
        });
      } catch (error) {
        // Token is invalid, clear storage
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setState({
          user: null,
          token: null,
          isLoading: false,
          isAuthenticated: false,
        });
      }
    } else {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const { data } = await authService.login({ email, password });

      // Store token and user
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      setState({
        user: data.user,
        token: data.token,
        isLoading: false,
        isAuthenticated: true,
      });
    } catch (error) {
      throw error;
    }
  };

  const register = async (input: RegisterInput) => {
    try {
      const { data } = await authService.register(input);

      // Store token and user
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      setState({
        user: data.user,
        token: data.token,
        isLoading: false,
        isAuthenticated: true,
      });
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');

    setState({
      user: null,
      token: null,
      isLoading: false,
      isAuthenticated: false,
    });
  };

  const updateProfile = async (updates: Partial<User>) => {
    try {
      const { data } = await authService.updateProfile(updates);

      // Update stored user
      localStorage.setItem('user', JSON.stringify(data.user));

      setState(prev => ({
        ...prev,
        user: data.user,
      }));
    } catch (error) {
      throw error;
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    try {
      await authService.changePassword(currentPassword, newPassword);
    } catch (error) {
      throw error;
    }
  };

  const refreshUser = async () => {
    try {
      const { data } = await authService.getProfile();

      localStorage.setItem('user', JSON.stringify(data.user));

      setState(prev => ({
        ...prev,
        user: data.user,
      }));
    } catch (error) {
      // If refresh fails, user might need to re-login
      logout();
    }
  };

  const loginWithGoogle = () => {
    // Check if OAuth is enabled
    const isOAuthEnabled = import.meta.env.VITE_ENABLE_OAUTH !== 'false';
    if (!isOAuthEnabled) {
      throw new Error('OAuth login is currently disabled');
    }

    authService.loginWithGoogle();
  };

  const loginWithFacebook = () => {
    // Check if OAuth is enabled
    const isOAuthEnabled = import.meta.env.VITE_ENABLE_OAUTH !== 'false';
    if (!isOAuthEnabled) {
      throw new Error('OAuth login is currently disabled');
    }

    authService.loginWithFacebook();
  };

  const value: AuthContextType = {
    ...state,
    login,
    register,
    logout,
    updateProfile,
    changePassword,
    loginWithGoogle,
    loginWithFacebook,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};