import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import { polygon, area, bearing, point, centroid, circle, destination } from '@turf/turf';
import SearchAutocomplete from './SearchAutocomplete';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || 'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw';

interface Amenity {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  distance?: number;
  type?: string;
  subtype?: string;
  tags?: {
    amenity?: string;
    school_type?: string;
    isced_level?: string;
    operator_type?: string;
  };
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
  mapRef?: React.RefObject<any>;
}

const categoryColors: Record<string, string> = {
  education: '#3B82F6',
  healthcare: '#EF4444',
  shopping: '#10B981',
  entertainment: '#F59E0B',
  transport: '#8B5CF6',
  infrastructure: '#6B7280',
  default: '#6B7280'
};

const categoryIcons: Record<string, string> = {
  education: '🏫',
  healthcare: '🏥',
  shopping: '🛒',
  entertainment: '🎭',
  transport: '🚉',
  infrastructure: '🏗️',
  default: '📍'
};

const transportTypeIcons: Record<string, string> = {
  aerodrome: '✈️',
  station: '🚉',
  bus_station: '🚌',
  bus_stop: '🚏',
  default: '🚉'
};

const categoryVietnamese: Record<string, string> = {
  education: 'Giáo dục',
  healthcare: 'Y tế',
  shopping: 'Mua sắm',
  entertainment: 'Giải trí',
  transport: 'Giao thông',
  default: 'Khác'
};

function getEducationTypeLabel(amenity: Amenity): string {
  if (amenity.category !== 'education') return '';
  
  const tags = amenity.tags;
  if (!tags) return '';
  
  if (tags.amenity === 'university') {
    return 'Đại học / Cao đẳng';
  }
  
  if (tags.amenity === 'college') {
    return 'Cao đẳng / Trung cấp';
  }
  
  if (tags.amenity === 'school') {
    if (tags.school_type === 'primary' || tags.isced_level === '1') {
      return 'Trường Tiểu học';
    }
    if (tags.school_type === 'secondary' || tags.isced_level === '2') {
      return 'Trường Trung học cơ sở (THCS)';
    }
    if (tags.school_type === 'high' || tags.isced_level === '3') {
      return 'Trường Trung học phổ thông (THPT)';
    }
    if (tags.school_type === 'kindergarten' || tags.isced_level === '0') {
      return 'Trường Mầm non';
    }
    
    if (tags.operator_type === 'government' || tags.operator_type === 'public') {
      return 'Trường Công lập';
    }
    if (tags.operator_type === 'private') {
      return 'Trường Tư thục';
    }
    
    return 'Trường học';
  }
  
  return 'Cơ sở giáo dục';
}

export default function MapView({
  onPolygonChange,
  center = [106.6297, 10.8231],
  zoom = 12,
  amenities = [],
  radius = 1000,
  selectedCategories = [],
  selectedLayers = [],
  infrastructure,
  mapRef
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const draw = useRef<MapboxDraw | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [styleLoaded, setStyleLoaded] = useState(0);
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

  // Helper function to validate coordinates
  function isValidCoordinate(lng: number, lat: number): boolean {
    return (
      typeof lng === 'number' &&
      typeof lat === 'number' &&
      !isNaN(lng) &&
      !isNaN(lat) &&
      isFinite(lng) &&
      isFinite(lat) &&
      lng >= -180 &&
      lng <= 180 &&
      lat >= -90 &&
      lat <= 90
    );
  }

  // Helper function to validate coordinate array
  function isValidCoordinateArray(coords: number[][]): boolean {
    return (
      Array.isArray(coords) &&
      coords.length > 0 &&
      coords.every(coord =>
        Array.isArray(coord) &&
        coord.length >= 2 &&
        isValidCoordinate(coord[0], coord[1])
      )
    );
  }

  // Helper function to safely create a point with error handling
  function safeCreatePoint(lng: number, lat: number) {
    if (!isValidCoordinate(lng, lat)) {
      throw new Error(`Invalid coordinates: [${lng}, ${lat}]`);
    }
    return point([lng, lat]);
  }

  // Helper function to create a square around a center point
  function createSquareAroundPoint(lng: number, lat: number, halfSize: number = 5): number[][] {
    const center = safeCreatePoint(lng, lat);

    try {
      // Calculate square corners using destination function
      const topRight = destination(center, halfSize * Math.sqrt(2), 45, { units: 'meters' });
      const bottomLeft = destination(center, halfSize * Math.sqrt(2), 225, { units: 'meters' });

      // Get corners
      const tr = topRight.geometry.coordinates;
      const bl = bottomLeft.geometry.coordinates;

      // Calculate other corners
      const topLeft = destination(center, halfSize * Math.sqrt(2), 135, { units: 'meters' });
      const bottomRight = destination(center, halfSize * Math.sqrt(2), 315, { units: 'meters' });

      const tl = topLeft.geometry.coordinates;
      const br = bottomRight.geometry.coordinates;

      return [
        [bl[0], bl[1]], // Bottom-left
        [br[0], br[1]], // Bottom-right
        [tr[0], tr[1]], // Top-right
        [tl[0], tl[1]], // Top-left
        [bl[0], bl[1]]  // Close polygon
      ];
    } catch (error) {
      console.error('Error creating square:', error);
      // Fallback to simple calculation
      const offset = halfSize / 111320; // rough approximation
      return [
        [lng - offset, lat - offset], // Bottom-left
        [lng + offset, lat - offset], // Bottom-right
        [lng + offset, lat + offset], // Top-right
        [lng - offset, lat + offset], // Top-left
        [lng - offset, lat - offset]  // Close polygon
      ];
    }
  }

  const handleSearchSelect = (result: any) => {
    if (!map.current || !draw.current) return;

    if (!result || !result.center || !Array.isArray(result.center) || result.center.length < 2) {
      console.error('Invalid search result:', result);
      return;
    }

    const [lng, lat] = result.center;

    // Validate coordinates before using them
    if (!isValidCoordinate(lng, lat)) {
      console.error('Invalid coordinates from search result:', [lng, lat]);
      return;
    }

    try {
      map.current.flyTo({
        center: [lng, lat],
        zoom: 18,
        duration: 1500
      });

      // Tạo ô vuông 10m x 10m (cách tâm 5m mỗi cạnh) xung quanh điểm được chọn
      const polygonCoords = createSquareAroundPoint(lng, lat, 5);

      draw.current.deleteAll();
      const feature = {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [polygonCoords]
        },
        properties: {},
        id: undefined
      };
      draw.current.add(feature as any);

      const turfPolygon = polygon([polygonCoords]);
      const areaValue = area(turfPolygon);
      const bearingValue = bearing(
        safeCreatePoint(polygonCoords[0][0], polygonCoords[0][1]),
        safeCreatePoint(polygonCoords[1][0], polygonCoords[1][1])
      );
      const orientation = getOrientation(bearingValue);

      setCurrentCenter({ lat, lng });

      onPolygonChange?.({
        coordinates: polygonCoords,
        area: Math.round(areaValue),
        orientation,
        frontageCount: 4,
        center: { lat, lng }
      });
    } catch (error) {
      console.error('Error in handleSearchSelect:', error);
      // Optionally show user-friendly error message
    }
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
    const geolocateControl = new mapboxgl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true,
        timeout: 30000, // Increased timeout for better reliability
        maximumAge: 60000 // Allow cached positions for 1 minute
      },
      trackUserLocation: true,
      showUserHeading: true
    });

    map.current.addControl(geolocateControl, 'bottom-right');

    // Add event listener for when user location is found
    geolocateControl.on('geolocate', (e: any) => {
      console.log('Geolocate event:', e);
      if (e.coords) {
        const { latitude, longitude } = e.coords;
        console.log('Location found:', latitude, longitude);

        // Validate coordinates from geolocation
        if (!isValidCoordinate(longitude, latitude)) {
          console.error('Invalid coordinates from geolocation:', [longitude, latitude]);
          return;
        }

        // Auto-create 10m x 10m square (5m from center to edges) around user's location
        if (draw.current && map.current) {
          try {
            // Center map on user location with appropriate zoom
            map.current.flyTo({
              center: [longitude, latitude],
              zoom: 18,
              duration: 1500
            });

            // Create 10m x 10m square (5m from center to each edge) around user location
            const polygonCoords = createSquareAroundPoint(longitude, latitude, 5);

            draw.current.deleteAll();
            const feature = {
              type: 'Feature',
              geometry: {
                type: 'Polygon',
                coordinates: [polygonCoords]
              },
              properties: {},
              id: undefined
            };
            draw.current.add(feature as any);

            const turfPolygon = polygon([polygonCoords]);
            const areaValue = area(turfPolygon);
            const bearingValue = bearing(
              safeCreatePoint(polygonCoords[0][0], polygonCoords[0][1]),
              safeCreatePoint(polygonCoords[1][0], polygonCoords[1][1])
            );
            const orientation = getOrientation(bearingValue);

            setCurrentCenter({ lat: latitude, lng: longitude });

            onPolygonChange?.({
              coordinates: polygonCoords,
              area: Math.round(areaValue),
              orientation,
              frontageCount: 4,
              center: { lat: latitude, lng: longitude }
            });
          } catch (error) {
            console.error('Error creating polygon from geolocation:', error);
          }
        }
      }
    });

    // Add error handling for geolocation
    geolocateControl.on('error', (e: any) => {
      console.error('Geolocation error:', e);
      // On macOS, sometimes permissions need to be explicitly requested
      if (navigator.platform && navigator.platform.includes('Mac')) {
        console.log('macOS detected - you may need to enable location services in System Preferences');
      }
    });

    const layerControl = document.createElement('div');
    layerControl.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';
    layerControl.innerHTML = `
      <button data-layer="streets" title="Đường phố" style="width:29px;height:29px;border:none;background:#fff;cursor:pointer;font-size:14px;">🗺️</button>
      <button data-layer="light" title="Sáng (Tối giản)" style="width:29px;height:29px;border:none;background:#fff;cursor:pointer;border-top:1px solid #ddd;font-size:14px;">☀️</button>
      <button data-layer="dark" title="Tối" style="width:29px;height:29px;border:none;background:#fff;cursor:pointer;border-top:1px solid #ddd;font-size:14px;">🌙</button>
      <button data-layer="outdoors" title="Ngoài trời" style="width:29px;height:29px;border:none;background:#fff;cursor:pointer;border-top:1px solid #ddd;font-size:14px;">🏔️</button>
      <button data-layer="satellite" title="Vệ tinh" style="width:29px;height:29px;border:none;background:#fff;cursor:pointer;border-top:1px solid #ddd;font-size:14px;">🛰️</button>
      <button data-layer="navigation" title="Điều hướng" style="width:29px;height:29px;border:none;background:#fff;cursor:pointer;border-top:1px solid #ddd;font-size:14px;">🧭</button>
    `;
    
    const mapStyles: Record<string, string> = {
      streets: 'mapbox://styles/mapbox/streets-v12',
      light: 'mapbox://styles/mapbox/light-v11',
      dark: 'mapbox://styles/mapbox/dark-v11',
      outdoors: 'mapbox://styles/mapbox/outdoors-v12',
      satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
      navigation: 'mapbox://styles/mapbox/navigation-day-v1'
    };
    
    layerControl.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const layer = (e.target as HTMLButtonElement).dataset.layer;
        if (layer && mapStyles[layer]) {
          map.current?.setStyle(mapStyles[layer]);
        }
      });
    });

    const controlContainer = document.createElement('div');
    controlContainer.className = 'mapboxgl-ctrl-top-right';
    controlContainer.style.position = 'absolute';
    controlContainer.style.top = '85px';
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

    // Assign map instance to ref if provided
    if (mapRef && 'current' in mapRef) {
      (mapRef as any).current = map.current;
    }

    map.current.on('load', () => {
      setIsLoaded(true);
      addRadiusLayers();
    });

    map.current.on('style.load', () => {
      addRadiusLayers();
      if (draw.current) {
        const data = draw.current.getAll();
        if (data.features.length > 0) {
          updatePolygon();
        }
      }
      setStyleLoaded(prev => prev + 1);
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
        const polygonFeature = data.features[0];
        if (polygonFeature.geometry.type === 'Polygon') {
          const coords = polygonFeature.geometry.coordinates[0];

          // Validate coordinate array
          if (!isValidCoordinateArray(coords)) {
            console.error('Invalid coordinates in polygon:', coords);
            return;
          }

          try {
            const turfPolygon = polygon([coords]);
            const areaValue = area(turfPolygon);
            const bearingValue = bearing(
              safeCreatePoint(coords[0][0], coords[0][1]),
              safeCreatePoint(coords[1][0], coords[1][1])
            );
            const orientation = getOrientation(bearingValue);
            const centerPoint = centroid(turfPolygon);
            const [lng, lat] = centerPoint.geometry.coordinates;

            // Validate center coordinates
            if (!isValidCoordinate(lng, lat)) {
              console.error('Invalid center coordinates:', [lng, lat]);
              return;
            }

            setCurrentCenter({ lat, lng });

            onPolygonChange?.({
              coordinates: coords,
              area: Math.round(areaValue),
              orientation,
              frontageCount: coords.length - 1,
              center: { lat, lng }
            });
          } catch (error) {
            console.error('Error in updatePolygon:', error);
          }
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
      const circleGeometry = circle([currentCenter.lng, currentCenter.lat], radius / 1000, {
        steps: 64,
        units: 'kilometers'
      });

      source.setData(circleGeometry);
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
  }, [infrastructure, selectedLayers, isLoaded, styleLoaded]);

  useEffect(() => {
    if (!map.current || !isLoaded) return;

    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    const filteredAmenities = amenities.filter(amenity => 
      selectedCategories.length === 0 || selectedCategories.includes(amenity.category)
    );

    filteredAmenities.forEach(amenity => {
      // Validate amenity coordinates before creating marker
      if (!isValidCoordinate(amenity.lng, amenity.lat)) {
        console.error('Invalid amenity coordinates:', amenity.name, [amenity.lng, amenity.lat]);
        return;
      }

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

      let icon = categoryIcons[amenity.category] || categoryIcons.default;
      if (amenity.category === 'transport' && amenity.type) {
        icon = transportTypeIcons[amenity.type] || transportTypeIcons.default;
      }
      el.textContent = icon;

      let educationType = '';
      if (amenity.category === 'education') {
        educationType = getEducationTypeLabel(amenity);
        console.log('Education amenity:', amenity.name, 'Tags:', amenity.tags, 'Type:', educationType);
      }

      const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
        <div style="padding:8px;">
          <strong style="font-size:14px;">${amenity.name}</strong>
          ${educationType ? `<div style="margin-top:4px;font-size:12px;color:#3B82F6;font-weight:500;">
            ${educationType}
          </div>` : ''}
          <div style="margin-top:4px;font-size:12px;color:#666;">
            ${categoryVietnamese[amenity.category] || categoryVietnamese.default}
          </div>
          ${amenity.distance ? `<div style="margin-top:4px;font-size:12px;color:#666;">
            Khoảng cách: ${Math.round(amenity.distance)}m
          </div>` : ''}
        </div>
      `);

      try {
        const marker = new mapboxgl.Marker(el)
          .setLngLat([amenity.lng, amenity.lat])
          .setPopup(popup)
          .addTo(map.current!);

        markersRef.current.push(marker);
      } catch (error) {
        console.error('Error creating marker for amenity:', amenity.name, error);
      }
    });
  }, [amenities, selectedCategories, isLoaded, styleLoaded]);

  const handleFindMyLocation = () => {
    if (!map.current || !draw.current) return;

    // Fallback geolocation implementation for macOS
    if (!navigator.geolocation) {
      alert('Trình duyệt của bạn không hỗ trợ định vị vị trí');
      return;
    }

    const attemptGeolocation = (attemptNumber: number = 1) => {
      console.log(`Geolocation attempt ${attemptNumber}`);

      // Request current position with retry logic
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          console.log(`Fallback location found (attempt ${attemptNumber}):`, latitude, longitude);

          // Validate coordinates from geolocation
          if (!isValidCoordinate(longitude, latitude)) {
            console.error('Invalid coordinates from geolocation fallback:', [longitude, latitude]);
            return;
          }

          try {
            // Center map on user location
            map.current!.flyTo({
              center: [longitude, latitude],
              zoom: 18,
              duration: 1500
            });

            // Create 10m x 10m square (5m from center to each edge) around user location
            const polygonCoords = createSquareAroundPoint(longitude, latitude, 5);

            draw.current!.deleteAll();
            const feature = {
              type: 'Feature',
              geometry: {
                type: 'Polygon',
                coordinates: [polygonCoords]
              },
              properties: {},
              id: undefined
            };
            draw.current!.add(feature as any);

            const turfPolygon = polygon([polygonCoords]);
            const areaValue = area(turfPolygon);
            const bearingValue = bearing(
              safeCreatePoint(polygonCoords[0][0], polygonCoords[0][1]),
              safeCreatePoint(polygonCoords[1][0], polygonCoords[1][1])
            );
            const orientation = getOrientation(bearingValue);

            setCurrentCenter({ lat: latitude, lng: longitude });

            onPolygonChange?.({
              coordinates: polygonCoords,
              area: Math.round(areaValue),
              orientation,
              frontageCount: 4,
              center: { lat: latitude, lng: longitude }
            });
          } catch (error) {
            console.error('Error creating polygon from geolocation fallback:', error);
          }
        },
        (error) => {
          console.error(`Geolocation error (attempt ${attemptNumber}):`, error);

          // Retry on timeout up to 3 times
          if (error.code === error.TIMEOUT && attemptNumber < 3) {
            console.log('Timeout occurred, retrying...');
            setTimeout(() => attemptGeolocation(attemptNumber + 1), 2000); // Wait 2 seconds before retry
            return;
          }

          let errorMessage = `Không thể xác định vị trí của bạn (thử ${attemptNumber}/3). `;

          switch(error.code) {
            case error.PERMISSION_DENIED:
              errorMessage += 'Vui lòng cho phép truy cập vị trí trong cài đặt trình duyệt và macOS System Preferences > Security & Privacy > Location Services.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage += 'Thông tin vị trí không có sẵn. Vui lòng kiểm tra GPS/WiFi.';
              break;
            case error.TIMEOUT:
              errorMessage += 'Hết thời gian chờ định vị vị trí. Vui lòng thử lại hoặc kiểm tra kết nối internet.';
              break;
          }

          // Suggest alternatives for macOS
          if (navigator.platform && navigator.platform.includes('Mac')) {
            errorMessage += '\n\nGợi ý cho macOS:\n- Kiểm tra System Preferences > Security & Privacy > Location Services\n- Thử dùng WiFi thay vì chỉ dùng Ethernet\n- Di chuyển đến nơi có tín hiệu GPS tốt hơn';
          }

          alert(errorMessage);
        },
        {
          enableHighAccuracy: attemptNumber === 1, // Use high accuracy only on first attempt
          timeout: attemptNumber === 1 ? 30000 : 20000, // Shorter timeout for retries
          maximumAge: attemptNumber === 1 ? 60000 : 300000 // Allow older cached positions for retries
        }
      );
    };

    // Check if we have permission first
    navigator.permissions.query({ name: 'geolocation' }).then((result) => {
      if (result.state === 'denied') {
        alert('Vui lòng cho phép truy cập vị trí trong cài đặt trình duyệt và macOS System Preferences > Security & Privacy > Location Services.');
        return;
      }

      // Start geolocation attempts
      attemptGeolocation();
    }).catch((error) => {
      console.error('Permission query error:', error);
      // Proceed with geolocation anyway as permission check failed
      attemptGeolocation();
    });
  };

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" data-testid="map-container" />
      <div className="absolute top-4 left-4 z-[100]">
        <SearchAutocomplete onSelect={handleSearchSelect} />
      </div>
      <div className="absolute top-20 left-4 z-[100]">
        <button
          onClick={handleFindMyLocation}
          className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm px-4 py-2 rounded-lg shadow-md text-sm hover:bg-white dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
          title="Tìm vị trí hiện tại của bạn (Fallback cho macOS)"
        >
          📍 Vị trí của tôi
        </button>
      </div>
      <div className="absolute top-32 left-4 z-[90] bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm px-4 py-2 rounded-lg shadow-md text-sm max-w-xs">
        <p className="font-semibold text-gray-800 dark:text-gray-100 mb-1">💡 Hướng dẫn sử dụng:</p>
        <p className="text-gray-600 dark:text-gray-300 text-xs">
          <strong>Tự động tạo ô vuông:</strong><br/>
          • 📍 Tìm vị trí: Chọn địa điểm ở thanh tìm kiếm<br/>
          • 📍 Định vị: Bấm "Vị trí của tôi" hoặc nút định vị bản đồ<br/><br/>
          <strong>Vẽ thủ công:</strong><br/>
          1. Click vào icon <span className="inline-block w-6 h-6 align-middle">📐</span> ở góc trên bản đồ<br/>
          2. Click lần lượt để đánh dấu các góc khu đất<br/>
          3. Click vào điểm đầu tiên để hoàn thành polygon
        </p>
        <p className="text-gray-600 dark:text-gray-300 text-xs mt-2">
          ✅ Khu đất 10m×10m sẽ được tự tạo khi bạn tìm hoặc định vị vị trí
        </p>
      </div>
    </div>
  );
}
