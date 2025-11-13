import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import * as turf from '@turf/turf';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || 'pk.eyJ1IjoiZGVtb3VzZXIiLCJhIjoiY2wxMjM0NTY3ODkwMWFiYzEyMzQ1Njc4OTBhYmMifQ.demo';

interface MapViewProps {
  onPolygonChange?: (data: {
    coordinates: number[][];
    area: number;
    orientation: string;
    frontageCount: number;
  }) => void;
  center?: [number, number];
  zoom?: number;
}

export default function MapView({ onPolygonChange, center = [106.6297, 10.8231], zoom = 12 }: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const draw = useRef<MapboxDraw | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center,
      zoom,
      language: 'vi'
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

    map.current.on('load', () => {
      setIsLoaded(true);
    });

    map.current.on('draw.create', updatePolygon);
    map.current.on('draw.update', updatePolygon);
    map.current.on('draw.delete', () => {
      onPolygonChange?.({
        coordinates: [],
        area: 0,
        orientation: '',
        frontageCount: 0
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
          
          onPolygonChange?.({
            coordinates: coords,
            area: Math.round(area),
            orientation,
            frontageCount: coords.length - 1
          });
        }
      }
    }

    return () => {
      map.current?.remove();
    };
  }, []);

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
