import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import * as turf from '@turf/turf';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || 'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw';

interface Amenity {
  id: string;
  name: string;
  category: string;
  lat: number;
  lon: number;
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
  default: '#6B7280'
};

const categoryIcons: Record<string, string> = {
  education: '🏫',
  healthcare: '🏥',
  shopping: '🛒',
  entertainment: '🎭',
  default: '📍'
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

    const geocoderContainer = document.createElement('div');
    geocoderContainer.className = 'mapboxgl-ctrl';
    geocoderContainer.style.position = 'absolute';
    geocoderContainer.style.top = '10px';
    geocoderContainer.style.left = '10px';
    geocoderContainer.style.zIndex = '1';
    geocoderContainer.innerHTML = `
      <div style="background:white;padding:8px;border-radius:4px;box-shadow:0 2px 4px rgba(0,0,0,0.1);display:flex;align-items:center;gap:8px;">
        <input 
          type="text" 
          placeholder="Tìm kiếm địa chỉ tại Việt Nam..." 
          id="geocoder-search"
          style="border:1px solid #ddd;padding:6px 12px;border-radius:4px;width:300px;font-size:14px;outline:none;"
        />
        <button 
          id="geocoder-btn"
          style="background:#3B82F6;color:white;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:14px;"
        >Tìm</button>
      </div>
    `;
    
    const searchInput = geocoderContainer.querySelector('#geocoder-search') as HTMLInputElement;
    const searchBtn = geocoderContainer.querySelector('#geocoder-btn') as HTMLButtonElement;
    
    const performSearch = async () => {
      const query = searchInput.value.trim();
      if (!query) return;
      
      try {
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?country=vn&access_token=${mapboxgl.accessToken}`
        );
        const data = await response.json();
        
        if (data.features && data.features.length > 0) {
          const [lng, lat] = data.features[0].center;
          map.current?.flyTo({ center: [lng, lat], zoom: 15 });
        }
      } catch (error) {
        console.error('Geocoding error:', error);
      }
    };
    
    searchBtn.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') performSearch();
    });
    
    mapContainer.current?.appendChild(geocoderContainer);

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
      if (!map.current) return;
      
      if (!map.current.getSource(radiusSourceRef.current)) {
        map.current.addSource(radiusSourceRef.current, {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: []
          }
        });
      }

      if (!map.current.getLayer('radius-circle-fill')) {
        map.current.addLayer({
          id: 'radius-circle-fill',
          type: 'fill',
          source: radiusSourceRef.current,
          paint: {
            'fill-color': '#3B82F6',
            'fill-opacity': 0.1
          }
        });
      }

      if (!map.current.getLayer('radius-circle-outline')) {
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
            ${amenity.category === 'education' ? 'Giáo dục' : 
              amenity.category === 'healthcare' ? 'Y tế' :
              amenity.category === 'shopping' ? 'Mua sắm' :
              amenity.category === 'entertainment' ? 'Giải trí' : amenity.category}
          </div>
          ${amenity.distance ? `<div style="margin-top:4px;font-size:12px;color:#666;">
            Khoảng cách: ${Math.round(amenity.distance)}m
          </div>` : ''}
        </div>
      `);

      const marker = new mapboxgl.Marker(el)
        .setLngLat([amenity.lon, amenity.lat])
        .setPopup(popup)
        .addTo(map.current!);

      markersRef.current.push(marker);
    });
  }, [amenities, selectedCategories, isLoaded]);

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

  return (
    <div ref={mapContainer} className="w-full h-full" data-testid="map-container" />
  );
}
