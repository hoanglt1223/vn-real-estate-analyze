import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import { polygon, area, bearing, point, centroid, circle } from '@turf/turf';
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

  const handleSearchSelect = (result: any) => {
    if (!map.current || !draw.current) return;

    const [lng, lat] = result.center;

    map.current.flyTo({
      center: [lng, lat],
      zoom: 16,
      duration: 1500
    });

    // Tính kích thước polygon phù hợp dựa trên loại địa điểm và giới hạn 1000m²
    const calculatePolygonSize = (result: any): number => {
      // Kích thước cơ bản (sẽ điều chỉnh để diện tích <= 1000m²)
      let baseSize = 0.0002; // Khoảng 400-500m² cho địa điểm trung bình

      // Điều chỉnh dựa trên loại địa điểm
      if (result.place_type) {
        const placeType = Array.isArray(result.place_type) ? result.place_type[0] : result.place_type;

        switch (placeType) {
          case 'address':
          case 'poi':
            baseSize = 0.0001; // Địa điểm cụ thể rất nhỏ
            break;
          case 'neighborhood':
            baseSize = 0.0003; // Khu phố nhỏ
            break;
          case 'locality':
          case 'place':
            baseSize = 0.0004; // Địa điểm lớn hơn
            break;
          default:
            baseSize = 0.0002; // Mặc định
        }
      }

      // Điều chỉnh nếu có bounding box
      if (result.bbox && Array.isArray(result.bbox) && result.bbox.length === 4) {
        const bboxWidth = Math.abs(result.bbox[2] - result.bbox[0]);
        const bboxHeight = Math.abs(result.bbox[3] - result.bbox[1]);
        const avgSize = (bboxWidth + bboxHeight) / 4;

        // Sử dụng kích thước từ bbox nhưng không quá lớn
        baseSize = Math.min(avgSize, 0.0003);
      }

      // Giới hạn tối đa để đảm bảo diện tích <= 1000m²
      // 1 độ dài ≈ 111km, 0.001 độ ≈ 111m, diện tích ≈ 12321m²
      // Để có diện tích <= 1000m², kích thước tối đa ≈ 0.00028
      const maxSize = 0.00028;
      return Math.min(baseSize, maxSize);
    };

    const size = calculatePolygonSize(result);
    const polygonCoords = [
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
        coordinates: [polygonCoords]
      },
      properties: {},
      id: undefined
    };
    draw.current.add(feature as any);

    const turfPolygon = polygon([polygonCoords]);
    const areaValue = area(turfPolygon);
    const bearingValue = bearing(
      point(polygonCoords[0]),
      point(polygonCoords[1])
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
    map.current.addControl(new mapboxgl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true
      },
      trackUserLocation: true,
      showUserHeading: true
    }), 'bottom-right');

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
          const turfPolygon = polygon([coords]);
          const areaValue = area(turfPolygon);
          const bearingValue = bearing(
            point(coords[0]),
            point(coords[1])
          );
          const orientation = getOrientation(bearingValue);
          const centerPoint = centroid(turfPolygon);
          const [lng, lat] = centerPoint.geometry.coordinates;

          setCurrentCenter({ lat, lng });

          onPolygonChange?.({
            coordinates: coords,
            area: Math.round(areaValue),
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

      const marker = new mapboxgl.Marker(el)
        .setLngLat([amenity.lng, amenity.lat])
        .setPopup(popup)
        .addTo(map.current!);

      markersRef.current.push(marker);
    });
  }, [amenities, selectedCategories, isLoaded, styleLoaded]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" data-testid="map-container" />
      <div className="absolute top-4 left-4 z-[100]">
        <SearchAutocomplete onSelect={handleSearchSelect} />
      </div>
      <div className="absolute top-20 left-4 z-[90] bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm px-4 py-2 rounded-lg shadow-md text-sm max-w-xs">
        <p className="font-semibold text-gray-800 dark:text-gray-100 mb-1">💡 Hướng dẫn vẽ khu đất:</p>
        <p className="text-gray-600 dark:text-gray-300 text-xs">
          1. Click vào icon <span className="inline-block w-6 h-6 align-middle">📐</span> ở góc trên bản đồ<br/>
          2. Click lần lượt để đánh dấu các góc khu đất<br/>
          3. Click vào điểm đầu tiên để hoàn thành polygon
        </p>
      </div>
    </div>
  );
}
