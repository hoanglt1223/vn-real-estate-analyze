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

interface CanvasHeatmapProps {
  map: mapboxgl.Map | null;
  amenities: Amenity[];
  selectedCategories: string[];
  radius?: number; // in meters
  intensity?: number; // 0-1
  visible: boolean;
}

export default function CanvasHeatmap({
  map,
  amenities,
  selectedCategories,
  radius = 100,
  intensity = 0.7,
  visible
}: CanvasHeatmapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();
  const updateTimeoutRef = useRef<NodeJS.Timeout>();

  // Memoize filtered amenities to prevent unnecessary recalculations
  const filteredAmenities = useMemo(() => {
    if (!visible) return [];
    return amenities.filter(amenity =>
      selectedCategories.length === 0 || selectedCategories.includes(amenity.category)
    );
  }, [amenities, selectedCategories, visible]);

  // Performance optimization: Limit amenities for heatmap
  const limitedAmenities = useMemo(() => {
    const maxAmenities = 200; // Fixed limit for canvas performance
    return filteredAmenities.slice(0, maxAmenities);
  }, [filteredAmenities]);

  useEffect(() => {
    if (!map || !visible || limitedAmenities.length === 0) {
      if (containerRef.current && containerRef.current.parentNode) {
        containerRef.current.style.display = 'none';
      }
      return;
    }

    // Show container
    if (containerRef.current) {
      containerRef.current.style.display = 'block';
    }

    // Position canvas over map
    const positionCanvas = () => {
      if (!canvasRef.current || !containerRef.current) return;

      const mapCanvas = map.getCanvas();
      if (!mapCanvas) return;

      // Position canvas exactly over map canvas
      const rect = mapCanvas.getBoundingClientRect();
      containerRef.current.style.position = 'absolute';
      containerRef.current.style.top = '0';
      containerRef.current.style.left = '0';
      containerRef.current.style.width = rect.width + 'px';
      containerRef.current.style.height = rect.height + 'px';
      containerRef.current.style.pointerEvents = 'none';
      containerRef.current.style.zIndex = '1';

      canvasRef.current.width = rect.width;
      canvasRef.current.height = rect.height;

      drawHeatmap();
    };

    // Create gradient colors
    const createGradient = (ctx: CanvasRenderingContext2D, colors: string[]) => {
      const gradient = ctx.createLinearGradient(0, 0, 1, 0);
      colors.forEach((color, index) => {
        gradient.addColorStop(index / (colors.length - 1), color);
      });
      return gradient;
    };

    // Draw heatmap on canvas
    const drawHeatmap = () => {
      if (!canvasRef.current || !map) return;

      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;

      const bounds = map.getBounds();
      const width = canvasRef.current.width;
      const height = canvasRef.current.height;

      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      // Convert lat/lng to canvas coordinates
      const latLngToCanvas = (lat: number, lng: number) => {
        const point = new mapboxgl.LngLat(lng, lat);
        const pixel = map.project(point);
        return { x: pixel.x, y: pixel.y };
      };

      // Create gradient for intensity
      const gradient = createGradient(ctx, [
        'rgba(33, 102, 172, 0)',      // Blue (transparent)
        'rgba(103, 169, 207, 0.2)',    // Light blue
        'rgba(209, 229, 240, 0.4)',    // Very light blue
        'rgba(253, 219, 199, 0.6)',    // Light orange
        'rgba(239, 138, 98, 0.8)',      // Orange
        'rgba(178, 24, 43, 1)'          // Red (opaque)
      ]);

      // Draw heatmap points
      limitedAmenities.forEach(amenity => {
        const { x, y } = latLngToCanvas(amenity.lat, amenity.lng);

        // Skip if outside visible area
        if (x < 0 || x > width || y < 0 || y > height) return;

        // Calculate heat intensity based on distance and category
        const distance = amenity.distance || 1000;
        const normalizedDistance = Math.min(distance / radius, 1);
        const pointIntensity = (1 - normalizedDistance) * intensity;

        // Draw gradient circles for each point
        const maxRadius = Math.max(30, 100 * (1 - normalizedDistance));
        const steps = 5;

        for (let i = steps; i > 0; i--) {
          const currentRadius = (maxRadius * i) / steps;
          const currentIntensity = pointIntensity * (1 - (i - 1) / steps);

          ctx.globalAlpha = currentIntensity * 0.3; // Reduced alpha for better performance

          // Create radial gradient for each circle
          const radialGradient = ctx.createRadialGradient(x, y, 0, x, y, currentRadius);
          radialGradient.addColorStop(0, `rgba(255, 100, 50, ${currentIntensity})`);
          radialGradient.addColorStop(0.4, `rgba(255, 150, 50, ${currentIntensity * 0.6})`);
          radialGradient.addColorStop(0.7, `rgba(255, 200, 100, ${currentIntensity * 0.3})`);
          radialGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

          ctx.fillStyle = radialGradient;
          ctx.fillRect(x - currentRadius, y - currentRadius, currentRadius * 2, currentRadius * 2);
        }
      });

      // Apply color overlay
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // Reset composite operation
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    };

    // Throttled update function
    const throttledUpdate = () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }

      updateTimeoutRef.current = setTimeout(() => {
        positionCanvas();
      }, 100); // 100ms throttle for performance
    };

    // Initial positioning
    positionCanvas();

    // Update on map move/zoom
    map.on('move', throttledUpdate);
    map.on('moveend', throttledUpdate);
    map.on('zoom', throttledUpdate);
    map.on('zoomend', throttledUpdate);

    // Update on window resize
    window.addEventListener('resize', throttledUpdate);

    // Cleanup
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }

      map.off('move', throttledUpdate);
      map.off('moveend', throttledUpdate);
      map.off('zoom', throttledUpdate);
      map.off('zoomend', throttledUpdate);
      window.removeEventListener('resize', throttledUpdate);

      if (containerRef.current && containerRef.current.parentNode) {
        containerRef.current.style.display = 'none';
      }
    };
  }, [map, visible, limitedAmenities, radius, intensity]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none"
      style={{ display: 'none' }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{
          mixBlendMode: 'multiply',
          opacity: 0.7
        }}
      />
    </div>
  );
}