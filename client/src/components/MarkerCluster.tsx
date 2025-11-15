import { useEffect, useRef, useMemo } from 'react';
import mapboxgl from 'mapbox-gl';
import * as supercluster from 'supercluster';

// Type definition for supercluster instance
type SuperclusterInstance = any;

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

interface ClusterProps {
  map: mapboxgl.Map | null;
  amenities: Amenity[];
  selectedCategories: string[];
  categoryColors: Record<string, string>;
  categoryIcons: Record<string, string>;
  transportTypeIcons: Record<string, string>;
  categoryVietnamese: Record<string, string>;
  getEducationTypeLabel: (amenity: Amenity) => string;
}

interface SuperclusterResult {
  type: 'FeatureCollection';
  features: any[];
}

interface ClusterProperties {
  cluster: boolean;
  cluster_id: number;
  point_count: number;
  point_count_abbreviated: string;
  [key: string]: any;
}

export default function MarkerCluster({
  map,
  amenities,
  selectedCategories,
  categoryColors,
  categoryIcons,
  transportTypeIcons,
  categoryVietnamese,
  getEducationTypeLabel
}: ClusterProps) {
  const clusterRef = useRef<SuperclusterInstance | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const sourceId = 'cluster-source';
  const clusterLayerId = 'cluster-layer';
  const clusterCountLayerId = 'cluster-count-layer';
  const unclusteredLayerId = 'unclustered-layer';
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateRef = useRef<number>(0);

  // Memoize filtered amenities to prevent unnecessary recalculations
  const filteredAmenities = useMemo(() => {
    return amenities.filter(amenity =>
      selectedCategories.length === 0 || selectedCategories.includes(amenity.category)
    );
  }, [amenities, selectedCategories]);

  // Initialize or update cluster
  useEffect(() => {
    if (!map) return;

    // Performance optimization: Only update if there are actual changes
    if (filteredAmenities.length === 0) {
      // Clear existing layers when no amenities
      try {
        if (map.getLayer(clusterLayerId)) {
          map.removeLayer(clusterLayerId);
        }
        if (map.getLayer(clusterCountLayerId)) {
          map.removeLayer(clusterCountLayerId);
        }
        if (map.getLayer(unclusteredLayerId)) {
          map.removeLayer(unclusteredLayerId);
        }
        if (map.getSource(sourceId)) {
          map.removeSource(sourceId);
        }
      } catch (e) {
        console.warn('Error clearing cluster layers:', e);
      }
      return;
    }

    // Convert to GeoJSON format
    const geojsonPoints = {
      type: 'FeatureCollection' as const,
      features: filteredAmenities.map(amenity => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [amenity.lng, amenity.lat]
        },
        properties: {
          ...amenity,
          color: categoryColors[amenity.category] || categoryColors.default
        }
      }))
    };

    // Initialize supercluster with performance optimizations
    const zoom = map.getZoom();
    const clusterRadius = zoom < 12 ? 75 : zoom < 15 ? 50 : 25; // Adaptive radius

    clusterRef.current = new supercluster.default({
      radius: clusterRadius,
      maxZoom: 16,
      minPoints: 2,
      extent: 512, // Increased for better performance
      nodeSize: 64  // Optimized node size
    });

    clusterRef.current.load(geojsonPoints.features);

    // Get map bounds for current zoom
    const bounds = map.getBounds();
    if (!bounds) return;
    const currentZoom = Math.floor(zoom);

    // Get clusters within current view
    const clusters = clusterRef.current.getClusters(
      [
        bounds.getWest(),
        bounds.getSouth(),
        bounds.getEast(),
        bounds.getNorth()
      ],
      currentZoom
    );

    updateClusterSource(clusters);

  }, [map, filteredAmenities, categoryColors]);

  const updateClusterSource = (clusters: any[]) => {
    if (!map) return;

    const geojson = {
      type: 'FeatureCollection' as const,
      features: clusters.map(cluster => ({
        type: 'Feature' as const,
        geometry: cluster.geometry,
        properties: cluster.properties
      }))
    };

    // Remove existing source and layers if they exist
    try {
      if (map.getLayer(clusterLayerId)) {
        map.removeLayer(clusterLayerId);
      }
      if (map.getLayer(clusterCountLayerId)) {
        map.removeLayer(clusterCountLayerId);
      }
      if (map.getLayer(unclusteredLayerId)) {
        map.removeLayer(unclusteredLayerId);
      }
      if (map.getSource(sourceId)) {
        map.removeSource(sourceId);
      }
    } catch (e) {
      console.warn('Error removing cluster layers:', e);
    }

    // Add source
    map.addSource(sourceId, {
      type: 'geojson',
      data: geojson
    });

    // Add cluster layer
    map.addLayer({
      id: clusterLayerId,
      type: 'circle',
      source: sourceId,
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': [
          'step',
          ['get', 'point_count'],
          '#51bbd6', // Blue for small clusters
          10,
          '#f1f075', // Yellow for medium clusters
          100,
          '#f28cb1'  // Red for large clusters
        ],
        'circle-radius': [
          'step',
          ['get', 'point_count'],
          20,
          10,
          25,
          100,
          30
        ],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#fff'
      }
    });

    // Add cluster count layer
    map.addLayer({
      id: clusterCountLayerId,
      type: 'symbol',
      source: sourceId,
      filter: ['has', 'point_count'],
      layout: {
        'text-field': '{point_count_abbreviated}',
        'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
        'text-size': 12,
        'text-allow-overlap': true
      },
      paint: {
        'text-color': '#ffffff'
      }
    });

    // Add unclustered points layer
    map.addLayer({
      id: unclusteredLayerId,
      type: 'circle',
      source: sourceId,
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-radius': 8,
        'circle-color': ['get', 'color'],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff'
      }
    });

    // Add click handlers for clusters
    map.on('click', clusterLayerId, (e) => {
      const features = e.features;
      if (!features || features.length === 0) return;

      const cluster = features[0];
      const clusterId = cluster.properties?.cluster_id;

      if (clusterId && clusterRef.current) {
        const zoom = map.getZoom();
        const leaves = clusterRef.current.getLeaves(clusterId, 100, 0);

        if (leaves.length <= 20) {
          // Show individual markers for small clusters
          expandCluster(leaves);
        } else {
          // Zoom to cluster
          (map.getSource(sourceId) as any).getClusterExpansionZoom(clusterId, (err: any, zoom: number) => {
            if (err || !zoom) return;
            map.flyTo({
              center: (cluster.geometry as any).coordinates,
              zoom: zoom + 1,
              speed: 1
            });
          });
        }
      }
    });

    // Add click handlers for unclustered points
    map.on('click', unclusteredLayerId, (e) => {
      const features = e.features;
      if (!features || features.length === 0) return;

      const amenity = features[0].properties as Amenity;
      showAmenityPopup(e.lngLat, amenity);
    });

    // Add hover effects
    map.on('mouseenter', clusterLayerId, () => {
      map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mouseleave', clusterLayerId, () => {
      map.getCanvas().style.cursor = '';
    });

    map.on('mouseenter', unclusteredLayerId, () => {
      map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mouseleave', unclusteredLayerId, () => {
      map.getCanvas().style.cursor = '';
    });

    // Throttled update function for better performance
    const throttledUpdateClusters = () => {
      const now = Date.now();
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }

      const delay = map.getZoom() < 12 ? 500 : 200; // Longer delay at lower zoom

      if (now - lastUpdateRef.current > delay) {
        updateClusters();
        lastUpdateRef.current = now;
      } else {
        updateTimeoutRef.current = setTimeout(() => {
          updateClusters();
          lastUpdateRef.current = Date.now();
        }, delay);
      }
    };

    const updateClusters = () => {
      if (!map || !clusterRef.current) return;

      const bounds = map.getBounds();
      if (!bounds) return;
      const zoom = Math.floor(map.getZoom());

      const clusters = clusterRef.current.getClusters(
        [
          bounds.getWest(),
          bounds.getSouth(),
          bounds.getEast(),
          bounds.getNorth()
        ],
        zoom
      );

      updateClusterSource(clusters);
    };

    map.on('moveend', throttledUpdateClusters);
    map.on('zoomend', throttledUpdateClusters);

    // Cleanup function
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }

      // Remove event listeners
      map.off('moveend', throttledUpdateClusters);
      map.off('zoomend', throttledUpdateClusters);
    };
  };

  const expandCluster = (leaves: any[]) => {
    if (!map) return;

    // Remove individual markers if they exist
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    leaves.forEach(leaf => {
      const amenity = leaf.properties as Amenity;

      let icon = categoryIcons[amenity.category] || categoryIcons.default;
      if (amenity.category === 'transport' && amenity.type) {
        icon = transportTypeIcons[amenity.type] || transportTypeIcons.default;
      }

      const el = document.createElement('div');
      el.className = 'expanded-marker';
      el.style.width = '28px';
      el.style.height = '28px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = categoryColors[amenity.category] || categoryColors.default;
      el.style.color = 'white';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.style.fontSize = '14px';
      el.style.cursor = 'pointer';
      el.style.border = '2px solid white';
      el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
      el.textContent = icon;

      const marker = new mapboxgl.Marker(el)
        .setLngLat(leaf.geometry.coordinates)
        .addTo(map);

      marker.getElement().addEventListener('click', () => {
        showAmenityPopup(leaf.geometry.coordinates as [number, number], amenity);
      });

      markersRef.current.push(marker);
    });

    // Remove expanded markers after 30 seconds or when user clicks elsewhere
    const cleanup = () => {
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current = [];
    };

    setTimeout(cleanup, 30000);
    map.once('click', cleanup);
  };

  const showAmenityPopup = (lngLat: mapboxgl.LngLatLike, amenity: Amenity) => {
    if (!map) return;

    let educationType = '';
    if (amenity.category === 'education') {
      educationType = getEducationTypeLabel(amenity);
    }

    const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
      <div style="padding:8px;min-width:150px;">
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

    popup.setLngLat(lngLat).addTo(map);
  };

  return null; // This component doesn't render anything, it manages map layers
}