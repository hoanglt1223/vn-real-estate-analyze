import { useEffect, useRef } from 'react';
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

    // Filter amenities by selected categories
    const filteredAmenities = amenities.filter(amenity =>
      selectedCategories.length === 0 || selectedCategories.includes(amenity.category)
    );

    if (filteredAmenities.length === 0) {
      return;
    }

    // Create heatmap data
    const heatmapData = createHeatmapData(filteredAmenities, radius, intensity);

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

    // Add heatmap layer
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
        // Adjust the heatmap radius by zoom level
        'heatmap-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          0,
          5,
          15,
          30
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

  }, [map, amenities, selectedCategories, radius, intensity, visible]);

  return null;
}

function createHeatmapData(amenities: Amenity[], radius: number, intensity: number) {
  // Create a grid of weighted points for heatmap
  const features: any[] = [];
  const gridSize = radius / 2; // Half the radius for grid density

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

    // Add surrounding points with decreasing weight for smoother gradient
    const numSurrounding = 4;
    for (let i = 0; i < numSurrounding; i++) {
      const angle = (i / numSurrounding) * 2 * Math.PI;
      const distance = gridSize / 2; // Half grid spacing

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
          weight: 0.5 * intensity,
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