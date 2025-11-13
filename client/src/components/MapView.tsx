import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import * as turf from '@turf/turf';
import SearchAutocomplete from './SearchAutocomplete';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || 'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw';

interface Amenity {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  distance?: number;
}

interface MapViewProps {
  onPolygonChange?: (data: {
    coordinates: number[][];
    area: number;
    orientation: string;
    frontageCount: number;
    center: { lat: number; lng: number };
  }) => void;
  center?: [number, number];
  zoom?: number;
  amenities?: Amenity[];
  radius?: number;
  selectedCategories?: string[];
  selectedLayers?: string[];
  infrastructure?: any;
}

const categoryColors: Record<string, string> = {
  education: '#3B82F6',
  healthcare: '#EF4444',
  shopping: '#10B981',
  entertainment: '#F59E0B',
  transport: '#8B5CF6',
  default: '#6B7280'
};

const categoryIcons: Record<string, string> = {
  education: '🏫',
  healthcare: '🏥',
  shopping: '🛒',
  entertainment: '🎭',
  transport: '🚉',
  default: '📍'
};

const categoryVietnamese: Record<string, string> = {
  education: 'Giáo dục',
  healthcare: 'Y tế',
  shopping: 'Mua sắm',
  entertainment: 'Giải trí',
  transport: 'Giao thông',
  default: 'Khác'
};

export default function MapView({ 
  onPolygonChange, 
  center = [106.6297, 10.8231], 
  zoom = 12,
  amenities = [],
  radius = 1000,
  selectedCategories = [],
  selectedLayers = [],
  infrastructure
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const draw = useRef<MapboxDraw | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const radiusSourceRef = useRef<string>('radius-circle');
  const [currentCenter, setCurrentCenter] = useState<{ lat: number; lng: number } | null>(null);

  function getOrientation(bearing: number): string {
    const normalized = ((bearing + 360) % 360);
    if (normalized >= 337.5 || normalized < 22.5) return 'Bắc';
    if (normalized >= 22.5 && normalized < 67.5) return 'Đông Bắc';
    if (normalized >= 67.5 && normalized < 112.5) return 'Đông';
    if (normalized >= 112.5 && normalized < 157.5) return 'Đông Nam';
    if (normalized >= 157.5 && normalized < 202.5) return 'Nam';
    if (normalized >= 202.5 && normalized < 247.5) return 'Tây Nam';
    if (normalized >= 247.5 && normalized < 292.5) return 'Tây';
    return 'Tây Bắc';
  }

  const handleSearchSelect = (result: any) => {
    if (!map.current || !draw.current) return;

    const [lng, lat] = result.center;
    
    map.current.flyTo({ 
      center: [lng, lat], 
      zoom: 16,
      duration: 1500
    });

    const size = 0.0005;
    const polygon = [
      [lng - size, lat - size],
      [lng + size, lat - size],
      [lng + size, lat + size],
      [lng - size, lat + size],
      [lng - size, lat - size]
    ];

    draw.current.deleteAll();
    const feature = {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [polygon]
      },
      properties: {},
      id: undefined
    };
    draw.current.add(feature as any);

    const turfPolygon = turf.polygon([polygon]);
    const area = turf.area(turfPolygon);
    const bearing = turf.bearing(
      turf.point(polygon[0]),
      turf.point(polygon[1])
    );
    const orientation = getOrientation(bearing);
    
    setCurrentCenter({ lat, lng });
    
    onPolygonChange?.({
      coordinates: polygon,
      area: Math.round(area),
      orientation,
      frontageCount: 4,
      center: { lat, lng }
    });
  };

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center,
      zoom,
    });

    draw.current = new MapboxDraw({
      displayControlsDefault: false,
      controls: {
        polygon: true,
        trash: true
      }
    });

    map.current.addControl(draw.current);
    map.current.addControl(new mapboxgl.NavigationControl(), 'bottom-right');
    map.current.addControl(new mapboxgl.FullscreenControl(), 'bottom-right');

    const layerControl = document.createElement('div');
    layerControl.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';
    layerControl.innerHTML = `
      <button data-layer="streets" title="Streets" style="width:29px;height:29px;border:none;background:#fff;cursor:pointer;">🗺️</button>
      <button data-layer="satellite" title="Satellite" style="width:29px;height:29px;border:none;background:#fff;cursor:pointer;border-top:1px solid #ddd;">🛰️</button>
    `;
    
    layerControl.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const layer = (e.target as HTMLButtonElement).dataset.layer;
        if (layer === 'satellite') {
          map.current?.setStyle('mapbox://styles/mapbox/satellite-streets-v12');
        } else {
          map.current?.setStyle('mapbox://styles/mapbox/streets-v12');
        }
      });
    });

    const controlContainer = document.createElement('div');
    controlContainer.className = 'mapboxgl-ctrl-bottom-right';
    controlContainer.style.position = 'absolute';
    controlContainer.style.bottom = '120px';
    controlContainer.style.right = '10px';
    controlContainer.appendChild(layerControl);
    mapContainer.current?.appendChild(controlContainer);

    const addRadiusLayers = () => {
      if (!map.current || !map.current.isStyleLoaded()) return;
      
      try {
        if (map.current.getLayer('radius-circle-fill')) {
          map.current.removeLayer('radius-circle-fill');
        }
        if (map.current.getLayer('radius-circle-outline')) {
          map.current.removeLayer('radius-circle-outline');
        }
        if (map.current.getSource(radiusSourceRef.current)) {
          map.current.removeSource(radiusSourceRef.current);
        }
      } catch (e) {
        console.warn('Error removing radius layers:', e);
      }

      try {
        map.current.addSource(radiusSourceRef.current, {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: []
          }
        });

        map.current.addLayer({
          id: 'radius-circle-fill',
          type: 'fill',
          source: radiusSourceRef.current,
          paint: {
            'fill-color': '#3B82F6',
            'fill-opacity': 0.1
          }
        });

        map.current.addLayer({
          id: 'radius-circle-outline',
          type: 'line',
          source: radiusSourceRef.current,
          paint: {
            'line-color': '#3B82F6',
            'line-width': 2,
            'line-dasharray': [2, 2]
          }
        });
      } catch (e) {
        console.warn('Error adding radius layers:', e);
      }
    };

    map.current.on('load', () => {
      setIsLoaded(true);
      addRadiusLayers();
    });

    map.current.on('style.load', () => {
      addRadiusLayers();
    });

    map.current.on('draw.create', updatePolygon);
    map.current.on('draw.update', updatePolygon);
    map.current.on('draw.delete', () => {
      setCurrentCenter(null);
      onPolygonChange?.({
        coordinates: [],
        area: 0,
        orientation: '',
        frontageCount: 0,
        center: { lat: 0, lng: 0 }
      });
    });

    function updatePolygon() {
      if (!draw.current) return;
      const data = draw.current.getAll();
      if (data.features.length > 0) {
        const polygon = data.features[0];
        if (polygon.geometry.type === 'Polygon') {
          const coords = polygon.geometry.coordinates[0];
          const turfPolygon = turf.polygon([coords]);
          const area = turf.area(turfPolygon);
          const bearing = turf.bearing(
            turf.point(coords[0]),
            turf.point(coords[1])
          );
          const orientation = getOrientation(bearing);
          const centerPoint = turf.centroid(turfPolygon);
          const [lng, lat] = centerPoint.geometry.coordinates;
          
          setCurrentCenter({ lat, lng });
          
          onPolygonChange?.({
            coordinates: coords,
            area: Math.round(area),
            orientation,
            frontageCount: coords.length - 1,
            center: { lat, lng }
          });
        }
      }
    }

    return () => {
      markersRef.current.forEach(marker => marker.remove());
      map.current?.remove();
    };
  }, []);

  useEffect(() => {
    if (!map.current || !isLoaded || !currentCenter) return;

    const source = map.current.getSource(radiusSourceRef.current) as mapboxgl.GeoJSONSource;
    if (source) {
      const circle = turf.circle([currentCenter.lng, currentCenter.lat], radius / 1000, {
        steps: 64,
        units: 'kilometers'
      });

      source.setData(circle);
    }
  }, [radius, currentCenter, isLoaded]);

  useEffect(() => {
    if (!map.current || !isLoaded) return;

    const infraLayers = ['infra-roads', 'infra-metro', 'infra-bus_routes', 'infra-metro_lines', 'infra-industrial', 'infra-power', 'infra-cemetery', 'infra-water'];
    
    try {
      infraLayers.forEach(layerId => {
        if (map.current?.getLayer(layerId)) {
          map.current.removeLayer(layerId);
        }
      });
      
      infraLayers.forEach(sourceId => {
        if (map.current?.getSource(sourceId)) {
          map.current.removeSource(sourceId);
        }
      });
    } catch (e) {
      console.warn('Error removing infrastructure layers:', e);
    }

    if (!infrastructure || Object.keys(infrastructure).length === 0) return;

    Object.entries(infrastructure || {}).forEach(([layer, data]: [string, any]) => {
      if (!Array.isArray(data) || data.length === 0) return;
      if (!selectedLayers.includes(layer)) return;

      const isLineLayer = data.length > 0 && data[0].type === 'line';
      const features: any[] = [];
      
      if (isLineLayer) {
        data.forEach((item: any) => {
          if (item.geometry && Array.isArray(item.geometry) && item.geometry.length > 0) {
            item.geometry.forEach((coords: number[][], idx: number) => {
              if (coords.length > 1) {
                features.push({
                  type: 'Feature',
                  geometry: {
                    type: 'LineString',
                    coordinates: coords
                  },
                  properties: {
                    name: item.name,
                    layer,
                    segmentId: `${item.id}-${idx}`
                  }
                });
              }
            });
          }
        });
      } else {
        features.push(...data.filter((item: any) => item.lat && item.lng).map((item: any) => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [item.lng, item.lat]
          },
          properties: {
            name: item.name,
            layer
          }
        })));
      }
      
      if (features.length === 0) return;

      const sourceId = `infra-${layer}`;
      const layerId = `infra-${layer}`;

      if (!map.current?.getSource(sourceId)) {
        map.current?.addSource(sourceId, {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features
          }
        });
      }

      const layerColors: Record<string, string> = {
        roads: '#F59E0B',
        metro: '#8B5CF6',
        bus_routes: '#10B981',
        metro_lines: '#A855F7',
        industrial: '#6B7280',
        power: '#EF4444',
        cemetery: '#374151',
        water: '#3B82F6'
      };

      if (!map.current?.getLayer(layerId)) {
        if (isLineLayer) {
          map.current?.addLayer({
            id: layerId,
            type: 'line',
            source: sourceId,
            paint: {
              'line-color': layerColors[layer] || '#6B7280',
              'line-width': 3,
              'line-opacity': 0.8
            }
          });
        } else {
          map.current?.addLayer({
            id: layerId,
            type: 'circle',
            source: sourceId,
            paint: {
              'circle-radius': 6,
              'circle-color': layerColors[layer] || '#6B7280',
              'circle-stroke-width': 2,
              'circle-stroke-color': '#ffffff'
            }
          });
        }

        map.current?.on('click', layerId, (e: any) => {
          if (e.features && e.features[0]) {
            const feature = e.features[0];
            new mapboxgl.Popup()
              .setLngLat(e.lngLat)
              .setHTML(`<strong>${feature.properties.name}</strong>`)
              .addTo(map.current!);
          }
        });

        map.current?.on('mouseenter', layerId, () => {
          if (map.current) map.current.getCanvas().style.cursor = 'pointer';
        });

        map.current?.on('mouseleave', layerId, () => {
          if (map.current) map.current.getCanvas().style.cursor = '';
        });
      }
    });
  }, [infrastructure, selectedLayers, isLoaded]);

  useEffect(() => {
    if (!map.current || !isLoaded) return;

    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    const filteredAmenities = amenities.filter(amenity => 
      selectedCategories.length === 0 || selectedCategories.includes(amenity.category)
    );

    filteredAmenities.forEach(amenity => {
      const el = document.createElement('div');
      el.className = 'amenity-marker';
      el.style.width = '32px';
      el.style.height = '32px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = categoryColors[amenity.category] || categoryColors.default;
      el.style.color = 'white';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.style.fontSize = '16px';
      el.style.cursor = 'pointer';
      el.style.border = '2px solid white';
      el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
      el.textContent = categoryIcons[amenity.category] || categoryIcons.default;

      const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
        <div style="padding:8px;">
          <strong style="font-size:14px;">${amenity.name}</strong>
          <div style="margin-top:4px;font-size:12px;color:#666;">
            ${categoryVietnamese[amenity.category] || categoryVietnamese.default}
          </div>
          ${amenity.distance ? `<div style="margin-top:4px;font-size:12px;color:#666;">
            Khoảng cách: ${Math.round(amenity.distance)}m
          </div>` : ''}
        </div>
      `);

      const marker = new mapboxgl.Marker(el)
        .setLngLat([amenity.lng, amenity.lat])
        .setPopup(popup)
        .addTo(map.current!);

      markersRef.current.push(marker);
    });
  }, [amenities, selectedCategories, isLoaded]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" data-testid="map-container" />
      <div className="absolute top-4 left-4 z-10">
        <SearchAutocomplete onSelect={handleSearchSelect} />
      </div>
    </div>
  );
}
