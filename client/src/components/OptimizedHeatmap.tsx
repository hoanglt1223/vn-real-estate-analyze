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

interface OptimizedHeatmapProps {
  map: mapboxgl.Map | null;
  amenities: Amenity[];
  selectedCategories: string[];
  radius?: number; // in meters
  intensity?: number; // 0-1
  visible: boolean;
}

export default function OptimizedHeatmap({
  map,
  amenities,
  selectedCategories,
  radius = 100,
  intensity = 0.7,
  visible
}: OptimizedHeatmapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageDataRef = useRef<ImageData | null>(null);

  // Category-based colors (different colors for different amenity types)
  const categoryColors = useMemo(() => ({
    education: [59, 130, 246],      // Blue
    healthcare: [239, 68, 68],      // Red
    shopping: [34, 197, 94],        // Green
    entertainment: [168, 85, 247],  // Purple
    transport: [251, 146, 60],      // Orange
    default: [107, 114, 128]        // Gray
  }), []);

  // Memoize and limit amenities for performance
  const processedAmenities = useMemo(() => {
    if (!visible) return [];

    const maxAmenities = 150; // Strict limit for performance
    return amenities
      .filter(amenity =>
        selectedCategories.length === 0 || selectedCategories.includes(amenity.category)
      )
      .slice(0, maxAmenities)
      .map(amenity => {
        // Pre-calculate intensity based on distance
        const distance = amenity.distance || 1000;
        const normalizedDistance = Math.min(distance / radius, 1);
        const pointIntensity = Math.max(0.1, (1 - normalizedDistance) * intensity);

        const color = categoryColors[amenity.category as keyof typeof categoryColors] || categoryColors.default;

        return {
          lat: amenity.lat,
          lng: amenity.lng,
          intensity: pointIntensity,
          color
        };
      });
  }, [amenities, selectedCategories, visible, radius, intensity, categoryColors]);

  useEffect(() => {
    if (!map || !visible || processedAmenities.length === 0) {
      if (containerRef.current?.parentNode) {
        containerRef.current.style.display = 'none';
      }
      return;
    }

    if (containerRef.current) {
      containerRef.current.style.display = 'block';
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    // Position canvas over map
    const positionCanvas = () => {
      const mapCanvas = map.getCanvas();
      if (!mapCanvas || !containerRef.current) return;

      const rect = mapCanvas.getBoundingClientRect();
      containerRef.current.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: ${rect.width}px;
        height: ${rect.height}px;
        pointer-events: none;
        z-index: 1;
      `;

      canvas.width = rect.width;
      canvas.height = rect.height;

      drawHeatmap();
    };

    // Optimized heatmap drawing using ImageData
    const drawHeatmap = () => {
      const bounds = map.getBounds();
      const width = canvas.width;
      const height = canvas.height;

      // Get ImageData for direct pixel manipulation
      const imageData = ctx.createImageData(width, height);
      const data = imageData.data;

      // Clear with transparent background
      data.fill(0);

      // Convert lat/lng to pixel coordinates
      const latLngToPixel = (lat: number, lng: number) => {
        const point = new mapboxgl.LngLat(lng, lat);
        const pixel = map.project(point);
        return { x: Math.round(pixel.x), y: Math.round(pixel.y) };
      };

      // Create heat buffer (faster than drawing circles directly)
      const heatBuffer = new Float32Array(width * height);

      // Process each amenity
      processedAmenities.forEach(amenity => {
        const { x, y } = latLngToPixel(amenity.lat, amenity.lng);

        // Skip if outside visible area
        if (x < 0 || x >= width || y < 0 || y >= height) return;

        // Calculate influence radius based on intensity
        const maxRadius = Math.max(20, 60 * amenity.intensity);
        const radiusSquared = maxRadius * maxRadius;

        // Add heat to buffer (optimized circle drawing)
        for (let dy = -maxRadius; dy <= maxRadius; dy++) {
          for (let dx = -maxRadius; dx <= maxRadius; dx++) {
            const distanceSquared = dx * dx + dy * dy;
            if (distanceSquared > radiusSquared) continue;

            const px = x + dx;
            const py = y + dy;

            if (px < 0 || px >= width || py < 0 || py >= height) continue;

            const distance = Math.sqrt(distanceSquared);
            const falloff = 1 - (distance / maxRadius);
            const heat = amenity.intensity * falloff * falloff; // Quadratic falloff

            const index = py * width + px;
            heatBuffer[index] = Math.min(1, heatBuffer[index] + heat);
          }
        }
      });

      // Convert heat buffer to colored pixels
      for (let i = 0; i < heatBuffer.length; i++) {
        const heat = heatBuffer[i];
        if (heat <= 0) continue;

        const pixelIndex = i * 4;

        // Color gradient based on heat intensity
        if (heat < 0.2) {
          // Blue to cyan
          const t = heat / 0.2;
          data[pixelIndex] = Math.round(33 + (103 - 33) * t);     // R
          data[pixelIndex + 1] = Math.round(102 + (169 - 102) * t); // G
          data[pixelIndex + 2] = Math.round(172 + (207 - 172) * t); // B
          data[pixelIndex + 3] = Math.round(heat * 255 * 0.3);      // A
        } else if (heat < 0.4) {
          // Cyan to light orange
          const t = (heat - 0.2) / 0.2;
          data[pixelIndex] = Math.round(103 + (253 - 103) * t);     // R
          data[pixelIndex + 1] = Math.round(169 + (219 - 169) * t); // G
          data[pixelIndex + 2] = Math.round(207 + (199 - 207) * t); // B
          data[pixelIndex + 3] = Math.round(heat * 255 * 0.5);      // A
        } else if (heat < 0.6) {
          // Light orange to orange
          const t = (heat - 0.4) / 0.2;
          data[pixelIndex] = Math.round(253 + (239 - 253) * t);     // R
          data[pixelIndex + 1] = Math.round(219 + (138 - 219) * t); // G
          data[pixelIndex + 2] = Math.round(199 + (98 - 199) * t);  // B
          data[pixelIndex + 3] = Math.round(heat * 255 * 0.7);      // A
        } else {
          // Orange to red
          const t = Math.min(1, (heat - 0.6) / 0.4);
          data[pixelIndex] = Math.round(239 + (178 - 239) * t);     // R
          data[pixelIndex + 1] = Math.round(138 + (24 - 138) * t);  // G
          data[pixelIndex + 2] = Math.round(98 + (43 - 98) * t);   // B
          data[pixelIndex + 3] = Math.round(heat * 255 * 0.9);      // A
        }
      }

      // Put the image data to canvas
      ctx.putImageData(imageData, 0, 0);

      // Cache the image data
      imageDataRef.current = imageData;
    };

    // Throttled update with requestAnimationFrame
    let lastUpdateTime = 0;
    const throttledUpdate = () => {
      const now = performance.now();
      if (now - lastUpdateTime < 50) return; // 50ms minimum interval

      lastUpdateTime = now;
      requestAnimationFrame(() => {
        positionCanvas();
      });
    };

    // Initial draw
    positionCanvas();

    // Event listeners with throttling
    const updateHandler = () => throttledUpdate();
    map.on('move', updateHandler);
    map.on('moveend', positionCanvas);
    map.on('zoom', updateHandler);
    map.on('zoomend', positionCanvas);

    // Window resize handler
    const resizeHandler = () => {
      setTimeout(positionCanvas, 100);
    };
    window.addEventListener('resize', resizeHandler);

    // Cleanup
    return () => {
      map.off('move', updateHandler);
      map.off('moveend', positionCanvas);
      map.off('zoom', updateHandler);
      map.off('zoomend', positionCanvas);
      window.removeEventListener('resize', resizeHandler);

      if (containerRef.current?.parentNode) {
        containerRef.current.style.display = 'none';
      }
      imageDataRef.current = null;
    };
  }, [map, visible, processedAmenities]);

  return (
    <div
      ref={containerRef}
      style={{ display: 'none' }}
    >
      <canvas
        ref={canvasRef}
        style={{
          mixBlendMode: 'multiply',
          opacity: 0.6
        }}
      />
    </div>
  );
}