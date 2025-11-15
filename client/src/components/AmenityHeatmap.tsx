import { useEffect, useRef, useMemo } from 'react';
import mapboxgl from 'mapbox-gl';

interface Amenity {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  distance?: number;
  type?: string;
  subtype?: string;
  tags?: any;
}

interface HeatmapProps {
  map: mapboxgl.Map | null;
  amenities: Amenity[];
  selectedCategories: string[];
  radius?: number; // in meters
  intensity?: number; // 0-1
  visible: boolean;
}

export default function AmenityHeatmap({
  map,
  amenities,
  selectedCategories,
  radius = 50,
  intensity = 0.7,
  visible
}: HeatmapProps) {
  const heatmapLayerId = 'amenity-heatmap';
  const sourceId = 'amenity-heatmap-source';
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateRef = useRef<number>(0);

  // Memoize filtered amenities to prevent unnecessary recalculations
  const filteredAmenities = useMemo(() => {
    if (!visible) return [];
    return amenities.filter(amenity =>
      selectedCategories.length === 0 || selectedCategories.includes(amenity.category)
    );
  }, [amenities, selectedCategories, visible]);

  useEffect(() => {
    if (!map || !visible) {
      // Remove heatmap layers when not visible
      if (map) {
        try {
          if (map.getLayer(heatmapLayerId)) {
            map.removeLayer(heatmapLayerId);
          }
          if (map.getSource(sourceId)) {
            map.removeSource(sourceId);
          }
        } catch (e) {
          console.warn('Error removing heatmap layers:', e);
        }
      }
      return;
    }

    // Performance optimization: Limit amenities for heatmap
    const maxAmenities = map.getZoom() < 12 ? 100 : 500;
    const limitedAmenities = filteredAmenities.slice(0, maxAmenities);

    if (limitedAmenities.length === 0) {
      // Clear existing heatmap when no amenities
      try {
        if (map.getLayer(heatmapLayerId)) {
          map.removeLayer(heatmapLayerId);
        }
        if (map.getSource(sourceId)) {
          map.removeSource(sourceId);
        }
      } catch (e) {
        console.warn('Error clearing heatmap:', e);
      }
      return;
    }

      // Throttled heatmap update
    const updateHeatmap = () => {
      // Create optimized heatmap data with fewer surrounding points
      const heatmapData = createOptimizedHeatmapData(limitedAmenities, radius, intensity) as any;

      // Remove existing layers and source
      try {
        if (map.getLayer(heatmapLayerId)) {
          map.removeLayer(heatmapLayerId);
        }
        if (map.getSource(sourceId)) {
          map.removeSource(sourceId);
        }
      } catch (e) {
        console.warn('Error removing existing heatmap:', e);
      }

      // Add source
      map.addSource(sourceId, {
        type: 'geojson',
        data: heatmapData
      });

      // Add optimized heatmap layer
      map.addLayer({
        id: heatmapLayerId,
        type: 'heatmap',
        source: sourceId,
        paint: {
          // Increase the heatmap weight based on frequency
          'heatmap-weight': [
            'interpolate',
            ['linear'],
            ['get', 'weight'],
            0,
            0,
            6,
            1
          ],
          // Increase the heatmap color intensity
          'heatmap-intensity': intensity,
          // Color ramp for heatmap. Domain is 0 (low) to 1 (high).
          // Begin color ramp at 0-stop with a 0-transparancy color.
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0,
            'rgba(33,102,172,0)',
            0.2,
            'rgb(103,169,207)',
            0.4,
            'rgb(209,229,240)',
            0.6,
            'rgb(253,219,199)',
            0.8,
            'rgb(239,138,98)',
            1,
            'rgb(178,24,43)'
          ],
          // Adjust the heatmap radius by zoom level (optimized)
          'heatmap-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            0,
            3,  // Reduced from 5
            15,
            20  // Reduced from 30
          ],
          // Transition from heatmap to circle layer by zoom level
          'heatmap-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            7,
            1,
            15,
            0.3
          ]
        }
      }, 'waterway-label'); // Insert before waterway labels

      // Add hover effect
      map.on('mouseenter', heatmapLayerId, () => {
        map.getCanvas().style.cursor = 'crosshair';
      });

      map.on('mouseleave', heatmapLayerId, () => {
        map.getCanvas().style.cursor = '';
      });
    };

    // Throttling mechanism
    const now = Date.now();
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    const delay = map.getZoom() < 12 ? 600 : 300; // Longer delay at lower zoom

    if (now - lastUpdateRef.current > delay) {
      updateHeatmap();
      lastUpdateRef.current = now;
    } else {
      updateTimeoutRef.current = setTimeout(() => {
        updateHeatmap();
        lastUpdateRef.current = Date.now();
      }, delay);
    }

    // Cleanup function
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };

  }, [map, filteredAmenities, radius, intensity, visible]);

  return null;
}

function createOptimizedHeatmapData(amenities: Amenity[], radius: number, intensity: number) {
  // Create optimized weighted points for heatmap with fewer surrounding points
  const features: any[] = [];
  const gridSize = radius / 4; // Reduced grid size for better performance

  amenities.forEach(amenity => {
    // Add the main point with full weight
    features.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [amenity.lng, amenity.lat]
      },
      properties: {
        weight: 1,
        category: amenity.category,
        name: amenity.name
      }
    });

    // Add fewer surrounding points for better performance (reduced from 4 to 2)
    const numSurrounding = 2; // Reduced for performance
    for (let i = 0; i < numSurrounding; i++) {
      const angle = (i / numSurrounding) * 2 * Math.PI;
      const distance = gridSize / 3; // Reduced distance

      // Convert lat/lng to approximate offset
      const latOffset = (distance / 111320) * Math.cos(angle);
      const lngOffset = (distance / (111320 * Math.cos(amenity.lat * Math.PI / 180))) * Math.sin(angle);

      features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [amenity.lng + lngOffset, amenity.lat + latOffset]
        },
        properties: {
          weight: 0.3 * intensity, // Reduced weight for performance
          category: amenity.category,
          name: amenity.name
        }
      });
    }
  });

  return {
    type: 'FeatureCollection',
    features
  };
}