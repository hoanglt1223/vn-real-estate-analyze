import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { propertyService, PropertyDetails, PropertyFilters, SearchQuery } from '../services/property.service';

// Hook for listing properties
export const useProperties = (filters: PropertyFilters = {}) => {
  const queryClient = useQueryClient();

  const {
    data: properties = [],
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['properties', filters],
    queryFn: () => propertyService.listProperties(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const createMutation = useMutation({
    mutationFn: (property: Omit<PropertyDetails, 'id' | 'createdAt' | 'updatedAt'>) =>
      propertyService.createProperty(property),
    onSuccess: (newProperty) => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.setQueryData(['property', newProperty.id], newProperty);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<PropertyDetails> }) =>
      propertyService.updateProperty(id, updates),
    onSuccess: (updatedProperty) => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.setQueryData(['property', updatedProperty.id], updatedProperty);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => propertyService.deleteProperty(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
    },
  });

  return {
    properties,
    isLoading,
    error,
    refetch,
    createProperty: createMutation.mutateAsync,
    updateProperty: updateMutation.mutateAsync,
    deleteProperty: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
};

// Hook for single property
export const useProperty = (id: string) => {
  const queryClient = useQueryClient();

  const {
    data: property,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['property', id],
    queryFn: () => propertyService.getProperty(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const updateMutation = useMutation({
    mutationFn: (updates: Partial<PropertyDetails>) =>
      propertyService.updateProperty(id, updates),
    onSuccess: (updatedProperty) => {
      queryClient.setQueryData(['property', id], updatedProperty);
      queryClient.invalidateQueries({ queryKey: ['properties'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => propertyService.deleteProperty(id),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['property', id] });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
    },
  });

  return {
    property,
    isLoading,
    error,
    refetch,
    updateProperty: updateMutation.mutateAsync,
    deleteProperty: deleteMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
};

// Hook for searching properties
export const usePropertySearch = () => {
  const queryClient = useQueryClient();

  const searchMutation = useMutation({
    mutationFn: (query: SearchQuery) => propertyService.searchProperties(query),
    onSuccess: (results) => {
      // Cache search results
      results.properties.forEach(property => {
        queryClient.setQueryData(['property', property.id], property);
      });
    },
  });

  return {
    searchProperties: searchMutation.mutateAsync,
    isSearching: searchMutation.isPending,
    searchResults: searchMutation.data,
    searchError: searchMutation.error,
  };
};

// Hook for property analytics
export const usePropertyAnalytics = (propertyId: string) => {
  const queryClient = useQueryClient();

  const {
    data: analytics,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['property-analytics', propertyId],
    queryFn: async () => {
      // This would be implemented when we create the analytics API
      return {
        views: 0,
        contactClicks: 0,
        dailyViews: [],
        popularProperties: []
      };
    },
    enabled: !!propertyId,
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });

  return {
    analytics,
    isLoading,
    error,
    refetch,
  };
};

// Hook for user properties
export const useUserProperties = (userId?: string) => {
  const { user } = useAuth();
  const targetUserId = userId || user?.id;

  return useQuery({
    queryKey: ['user-properties', targetUserId],
    queryFn: () => propertyService.listProperties({ userId: targetUserId }),
    enabled: !!targetUserId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

// Import useAuth hook
import { useAuth } from '../contexts/AuthContext';