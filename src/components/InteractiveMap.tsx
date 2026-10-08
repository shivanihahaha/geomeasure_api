import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import * as turf from '@turf/turf';
import { MapData, FeatureItem } from '../types/geospatial';
import { DrawingToolbar, DrawingToolType } from './DrawingToolbar';
import { ElevationProfile } from './ElevationProfile';
import {
  Maximize2,
  Map as MapIcon,
  Globe,
  Sun,
  Moon,
  Mountain,
  Compass,
  Key,
  Layers,
  Check,
  ChevronDown,
  Columns2,
  Palette,
  ShieldAlert
} from 'lucide-react';

interface InteractiveMapProps {
  mapData: MapData | null;
  features?: FeatureItem[];
  selectedFeatureId: number | null;
  onSelectFeature: (id: number | null) => void;
}

export type BaseMapLayer = 'street' | 'satellite' | 'topographic' | 'dark' | 'light';
export type ThematicMode = 'standard' | 'choropleth' | 'attribute';

interface LayerConfig {
  id: BaseMapLayer;
  name: string;
  category: 'CARTO' | 'Aerial' | 'Terrain';
  description: string;
  getUrl: (key: string) => string;
  attribution: string;
  maxZoom: number;
}

const DEFAULT_CARTO_KEY = 'cb1_4e1g_1_50cc14efefa0a1e1f8ba5b22';

export const BASEMAP_LAYERS: Record<BaseMapLayer, LayerConfig> = {
  street: {
    id: 'street',
    name: 'Street View',
    category: 'CARTO',
    description: 'CARTO Voyager with detailed road networks, building footprints, and place labels',
    getUrl: (key: string) =>
      `https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=${encodeURIComponent(key)}&v=2`,
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    maxZoom: 20,
  },
  satellite: {
    id: 'satellite',
    name: 'Satellite',
    category: 'Aerial',
    description: 'High-resolution global satellite and aerial photographic imagery',
    getUrl: () =>
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP',
    maxZoom: 19,
  },
  topographic: {
    id: 'topographic',
    name: 'Topographic',
    category: 'Terrain',
    description: 'Contour lines, elevation relief hillshades, water bodies, and physical geography',
    getUrl: () =>
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; USGS, FAO, NPS, NRCAN, GeoBase, Ordnance Survey',
    maxZoom: 19,
  },
  dark: {
    id: 'dark',
    name: 'Dark View',
    category: 'CARTO',
    description: 'CARTO Dark Matter minimal dark cartography for high-contrast geospatial inspection',
    getUrl: (key: string) =>
      `https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png?key=${encodeURIComponent(key)}&v=2`,
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    maxZoom: 20,
  },
  light: {
    id: 'light',
    name: 'Light View',
    category: 'CARTO',
    description: 'CARTO Positron subtle monochromatic clean background',
    getUrl: (key: string) =>
      `https://basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png?key=${encodeURIComponent(key)}&v=2`,
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    maxZoom: 20,
  },
};

const CATEGORY_COLORS = [
  '#10b981', // emerald
  '#06b6d4', // cyan
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#3b82f6', // blue
  '#eab308', // yellow
];

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  mapData,
  features = [],
  selectedFeatureId,
  onSelectFeature,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const geojsonLayerRef = useRef<L.GeoJSON | null>(null);
  const clusterGroupRef = useRef<any>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const splitTileLayerRef = useRef<L.TileLayer | null>(null);
  const drawnLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const elevationHoverMarkerRef = useRef<L.Marker | null>(null);

  // Basemap & Swipe Split State
  const [activeLayer, setActiveLayer] = useState<BaseMapLayer>('street');
  const [isSwipeMode, setIsSwipeMode] = useState<boolean>(false);
  const [splitRightLayer, setSplitRightLayer] = useState<BaseMapLayer>('satellite');
  const [swipePosition, setSwipePosition] = useState<number>(50); // percentage 0-100
  const [isDraggingSwipe, setIsDraggingSwipe] = useState(false);
  const [isLayerMenuOpen, setIsLayerMenuOpen] = useState(false);

  // Thematic Styling State
  const [thematicMode, setThematicMode] = useState<ThematicMode>('standard');
  const [isThematicMenuOpen, setIsThematicMenuOpen] = useState(false);

  // Drawing Tools State
  const [activeDrawingTool, setActiveDrawingTool] = useState<DrawingToolType>(null);
  const [drawnPoints, setDrawnPoints] = useState<[number, number][]>([]);
  const [bufferDistanceM, setBufferDistanceM] = useState<number>(50);
  const [hasDrawnItems, setHasDrawnItems] = useState(false);

  // Selected LineString for Elevation Profile
  const [profileFeature, setProfileFeature] = useState<FeatureItem | null>(null);

  // CARTO Key management
  const [cartoKey, setCartoKey] = useState<string>(() => {
    return localStorage.getItem('geomeasure_carto_key') || DEFAULT_CARTO_KEY;
  });
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [keyInput, setKeyInput] = useState(cartoKey);

  // Compute Area Quartiles for Choropleth
  const areaQuartiles = useMemo(() => {
    if (!mapData?.geojson?.features) return null;
    const areas: number[] = [];
    for (const f of mapData.geojson.features) {
      if (f.geometry?.type?.includes('Polygon')) {
        try {
          const a = turf.area(f as any);
          if (a > 0) areas.push(a);
        } catch {}
      }
    }
    if (areas.length === 0) return null;
    areas.sort((a, b) => a - b);
    const q1 = areas[Math.floor(areas.length * 0.25)] || 0;
    const q2 = areas[Math.floor(areas.length * 0.50)] || 0;
    const q3 = areas[Math.floor(areas.length * 0.75)] || 0;
    const max = areas[areas.length - 1] || 0;
    return { q1, q2, q3, max };
  }, [mapData]);

  // Compute Attribute Categories for Thematic Map
  const { attributeKey, categoryMap } = useMemo(() => {
    if (!mapData?.geojson?.features) return { attributeKey: '', categoryMap: new Map<string, string>() };

    // Find first high-cardinality discrete property (e.g. ZONE, CLASS, category)
    const candidateKeys = ['ZONE', 'zone', 'AREA_CLASS', 'class', 'CLASS', 'type', 'category', 'status'];
    let selectedKey = '';
    const sampleProps = mapData.geojson.features[0]?.properties || {};

    for (const k of candidateKeys) {
      if (k in sampleProps) {
        selectedKey = k;
        break;
      }
    }

    if (!selectedKey) {
      // Find any string key with < 10 unique values
      for (const k of Object.keys(sampleProps)) {
        if (k !== 'name' && k !== 'NAME' && k !== 'feature_id' && typeof sampleProps[k] === 'string') {
          selectedKey = k;
          break;
        }
      }
    }

    const catMap = new Map<string, string>();
    if (selectedKey) {
      let colorIdx = 0;
      for (const f of mapData.geojson.features) {
        const val = String(f.properties?.[selectedKey] || 'Other');
        if (!catMap.has(val)) {
          catMap.set(val, CATEGORY_COLORS[colorIdx % CATEGORY_COLORS.length]);
          colorIdx++;
        }
      }
    }

    return { attributeKey: selectedKey, categoryMap: catMap };
  }, [mapData]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [20, 0],
        zoom: 2,
        zoomControl: false,
        attributionControl: true,
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // Create Custom Panes for Split Screen Swipe
      map.createPane('leftPane');
      map.createPane('rightPane');
      (map.getPane('leftPane') as HTMLElement).style.zIndex = '200';
      (map.getPane('rightPane') as HTMLElement).style.zIndex = '201';

      // Primary Tile Layer
      const cfg = BASEMAP_LAYERS[activeLayer];
      const tiles = L.tileLayer(cfg.getUrl(cartoKey), {
        attribution: cfg.attribution,
        maxZoom: cfg.maxZoom,
        pane: 'leftPane',
      }).addTo(map);
      tileLayerRef.current = tiles;

      // Group for user drawings
      const drawnGroup = L.layerGroup().addTo(map);
      drawnLayerGroupRef.current = drawnGroup;

      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Primary and Split Tile Layers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Update Left Tile
    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }
    const leftCfg = BASEMAP_LAYERS[activeLayer];
    const leftTiles = L.tileLayer(leftCfg.getUrl(cartoKey), {
      attribution: leftCfg.attribution,
      maxZoom: leftCfg.maxZoom,
      pane: isSwipeMode ? 'leftPane' : 'tilePane',
    }).addTo(map);
    tileLayerRef.current = leftTiles;

    // Handle Split Right Tile
    if (splitTileLayerRef.current) {
      map.removeLayer(splitTileLayerRef.current);
      splitTileLayerRef.current = null;
    }

    if (isSwipeMode) {
      const rightCfg = BASEMAP_LAYERS[splitRightLayer];
      const rightTiles = L.tileLayer(rightCfg.getUrl(cartoKey), {
        attribution: rightCfg.attribution,
        maxZoom: rightCfg.maxZoom,
        pane: 'rightPane',
      }).addTo(map);
      splitTileLayerRef.current = rightTiles;
    }
  }, [activeLayer, splitRightLayer, isSwipeMode, cartoKey]);

  // Apply CSS Clip Path to Panes when Swipe Position changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const leftPane = map.getPane('leftPane') as HTMLElement | null;
    const rightPane = map.getPane('rightPane') as HTMLElement | null;

    if (isSwipeMode && leftPane && rightPane) {
      // Left pane visible from 0 to swipePosition%
      leftPane.style.clipPath = `polygon(0 0, ${swipePosition}% 0, ${swipePosition}% 100%, 0 100%)`;
      // Right pane visible from swipePosition% to 100%
      rightPane.style.clipPath = `polygon(${swipePosition}% 0, 100% 0, 100% 100%, ${swipePosition}% 100%)`;
    } else {
      if (leftPane) leftPane.style.clipPath = 'none';
      if (rightPane) rightPane.style.clipPath = 'none';
    }
  }, [swipePosition, isSwipeMode]);

  // Sync selected feature with Elevation profile if LineString
  useEffect(() => {
    if (selectedFeatureId === null) {
      setProfileFeature(null);
      return;
    }
    const feat = features.find((f) => f.feature_id === selectedFeatureId);
    if (feat && feat.geometry_type.includes('LineString')) {
      setProfileFeature(feat);
    }
  }, [selectedFeatureId, features]);

  // Load and Render GeoJSON Features + Marker Clustering
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapData || !mapData.geojson) return;

    if (geojsonLayerRef.current) {
      map.removeLayer(geojsonLayerRef.current);
      geojsonLayerRef.current = null;
    }
    if (clusterGroupRef.current) {
      map.removeLayer(clusterGroupRef.current);
      clusterGroupRef.current = null;
    }

    // Initialize MarkerClusterGroup for Points
    const clusterGroup = (L as any).markerClusterGroup
      ? (L as any).markerClusterGroup({
          maxClusterRadius: 40,
          spiderfyOnMaxZoom: true,
          showCoverageOnHover: false,
          iconCreateFunction: (cluster: any) => {
            const count = cluster.getChildCount();
            return L.divIcon({
              html: `<span>${count}</span>`,
              className: 'custom-cluster-icon',
              iconSize: L.point(36, 36),
            });
          },
        })
      : L.layerGroup();

    const geoLayer = L.geoJSON(mapData.geojson as any, {
      pointToLayer: (feature, latlng) => {
        const isSelected = feature.properties?.feature_id === selectedFeatureId;
        const marker = L.circleMarker(latlng, {
          radius: isSelected ? 9 : 6,
          fillColor: '#f59e0b',
          color: isSelected ? '#ffffff' : '#fbbf24',
          weight: isSelected ? 3 : 1.5,
          opacity: 1,
          fillOpacity: 0.85,
        });

        clusterGroup.addLayer(marker);
        return marker;
      },
      style: (feature) => {
        const isSelected = feature?.properties?.feature_id === selectedFeatureId;
        const geomType = feature?.geometry?.type || '';

        // Thematic polygon color calculation
        let fillColor = '#10b981';
        let strokeColor = '#34d399';

        if (geomType.includes('Polygon')) {
          if (thematicMode === 'choropleth' && areaQuartiles) {
            try {
              const a = turf.area(feature as any);
              if (a <= areaQuartiles.q1) {
                fillColor = '#a3e635'; // Lime / small
                strokeColor = '#bef264';
              } else if (a <= areaQuartiles.q2) {
                fillColor = '#10b981'; // Emerald / medium
                strokeColor = '#34d399';
              } else if (a <= areaQuartiles.q3) {
                fillColor = '#06b6d4'; // Cyan / large
                strokeColor = '#22d3ee';
              } else {
                fillColor = '#8b5cf6'; // Violet / huge
                strokeColor = '#a78bfa';
              }
            } catch {}
          } else if (thematicMode === 'attribute' && attributeKey) {
            const val = String(feature?.properties?.[attributeKey] || 'Other');
            const catColor = categoryMap.get(val) || '#10b981';
            fillColor = catColor;
            strokeColor = catColor;
          }

          return {
            fillColor: isSelected ? '#ffffff' : fillColor,
            color: isSelected ? '#ffffff' : strokeColor,
            weight: isSelected ? 3.5 : 2,
            fillOpacity: isSelected ? 0.65 : 0.4,
          };
        } else if (geomType.includes('LineString')) {
          return {
            color: isSelected ? '#ffffff' : '#22d3ee',
            weight: isSelected ? 5.5 : 3.5,
            opacity: 0.95,
          };
        }

        return { color: '#3b82f6', weight: 2 };
      },
      onEachFeature: (feature, layer) => {
        const p = feature.properties || {};
        const featId = p.feature_id ?? feature.id ?? 0;
        const featName = p.name || p.NAME || `Feature #${featId}`;
        const geomType = p.geometry_type || feature.geometry.type;
        const measFormatted = p.measurement_formatted || 'Point (Control Site)';

        const popupContent = `
          <div style="font-family: system-ui, sans-serif; font-size: 12px; color: #0f172a; min-width: 170px;">
            <div style="font-weight: 700; margin-bottom: 2px;">${featName}</div>
            <div style="color: #64748b; font-size: 11px; margin-bottom: 6px;">ID: ${featId} · ${geomType}</div>
            <div style="background: #f1f5f9; padding: 4px 8px; border-radius: 4px; font-weight: 600; color: #0f766e;">
              ${measFormatted}
            </div>
          </div>
        `;
        layer.bindPopup(popupContent);

        layer.bindTooltip(`${featName} (${geomType})`, {
          direction: 'top',
          sticky: true,
          className: 'bg-slate-900 text-white text-xs px-2 py-1 rounded shadow-md border border-slate-700',
        });

        layer.on({
          click: () => {
            onSelectFeature(featId);
            const found = features.find((f) => f.feature_id === featId);
            if (found && found.geometry_type.includes('LineString')) {
              setProfileFeature(found);
            }
          },
        });
      },
    });

    // Add polygon/linestring layer to map
    geoLayer.addTo(map);
    geojsonLayerRef.current = geoLayer;

    // Add marker cluster group
    clusterGroup.addTo(map);
    clusterGroupRef.current = clusterGroup;

    // Fit bounds on initial load
    if (mapData.bounds && mapData.bounds.length === 2) {
      try {
        const [southWest, northEast] = mapData.bounds;
        if (
          !isNaN(southWest[0]) &&
          !isNaN(southWest[1]) &&
          !isNaN(northEast[0]) &&
          !isNaN(northEast[1])
        ) {
          map.fitBounds(mapData.bounds, { padding: [40, 40], maxZoom: 17 });
        }
      } catch (err) {
        console.warn('Error fitting bounds:', err);
      }
    }
  }, [mapData, selectedFeatureId, thematicMode, areaQuartiles, attributeKey, categoryMap, features, onSelectFeature]);

  // Handle Interactive Map Clicking for Drawing Tool
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (!activeDrawingTool) {
      map.getContainer().classList.remove('drawing-crosshair');
      return;
    }

    map.getContainer().classList.add('drawing-crosshair');

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      const newPt: [number, number] = [e.latlng.lat, e.latlng.lng];

      if (activeDrawingTool === 'buffer') {
        // Create buffer point or buffer around selected polygon
        createBufferAtLocation(newPt);
      } else {
        setDrawnPoints((prev) => [...prev, newPt]);
      }
    };

    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [activeDrawingTool, bufferDistanceM]);

  // Update Live Drawing Layer as Points are added
  useEffect(() => {
    const drawnGroup = drawnLayerGroupRef.current;
    if (!drawnGroup) return;

    // Clear active temporary sketch layer
    drawnGroup.clearLayers();

    if (drawnPoints.length === 0) return;

    if (activeDrawingTool === 'line') {
      const latlngs = drawnPoints.map((p) => L.latLng(p[0], p[1]));
      const polyline = L.polyline(latlngs, {
        color: '#22d3ee',
        weight: 3.5,
        dashArray: '6 6',
      }).addTo(drawnGroup);

      // Add vertex dots
      drawnPoints.forEach((p) => {
        L.circleMarker(L.latLng(p[0], p[1]), {
          radius: 4,
          fillColor: '#22d3ee',
          color: '#ffffff',
          weight: 1.5,
          fillOpacity: 1,
        }).addTo(drawnGroup);
      });
    } else if (activeDrawingTool === 'polygon') {
      const latlngs = drawnPoints.map((p) => L.latLng(p[0], p[1]));
      L.polygon(latlngs, {
        color: '#10b981',
        weight: 2,
        fillColor: '#10b981',
        fillOpacity: 0.35,
        dashArray: '4 4',
      }).addTo(drawnGroup);

      drawnPoints.forEach((p) => {
        L.circleMarker(L.latLng(p[0], p[1]), {
          radius: 4,
          fillColor: '#10b981',
          color: '#ffffff',
          weight: 1.5,
          fillOpacity: 1,
        }).addTo(drawnGroup);
      });
    }
  }, [drawnPoints, activeDrawingTool]);

  // Compute live measurement for active drawing tool
  const activeMeasurement = useMemo(() => {
    if (drawnPoints.length < 2) {
      return drawnPoints.length === 1 ? { pointsCount: 1, valueFormatted: 'Click next point...' } : null;
    }

    try {
      if (activeDrawingTool === 'line') {
        const coords = drawnPoints.map((p) => [p[1], p[0]]); // [lng, lat]
        const line = turf.lineString(coords);
        const distM = turf.length(line, { units: 'meters' });
        return {
          pointsCount: drawnPoints.length,
          valueFormatted: distM >= 1000 ? `${(distM / 1000).toFixed(3)} km` : `${distM.toFixed(1)} m`,
          secondaryFormatted: `${(distM * 3.28084).toFixed(0)} ft`,
        };
      } else if (activeDrawingTool === 'polygon' && drawnPoints.length >= 3) {
        const coords = drawnPoints.map((p) => [p[1], p[0]]);
        coords.push(coords[0]); // close loop
        const poly = turf.polygon([coords]);
        const areaM2 = turf.area(poly);
        return {
          pointsCount: drawnPoints.length,
          valueFormatted:
            areaM2 >= 10000 ? `${(areaM2 / 10000).toFixed(3)} ha` : `${areaM2.toFixed(1)} m²`,
          secondaryFormatted: `${(areaM2 / 4046.856).toFixed(2)} ac`,
        };
      }
    } catch (e) {
      console.warn('Measurement calc error:', e);
    }
    return { pointsCount: drawnPoints.length, valueFormatted: 'Drawing...' };
  }, [drawnPoints, activeDrawingTool]);

  // Finish Drawing
  const handleFinishDrawing = () => {
    const map = mapInstanceRef.current;
    if (!map || drawnPoints.length < (activeDrawingTool === 'line' ? 2 : 3)) return;

    if (activeDrawingTool === 'line') {
      const latlngs = drawnPoints.map((p) => L.latLng(p[0], p[1]));
      const coords = drawnPoints.map((p) => [p[1], p[0]]);
      const line = turf.lineString(coords);
      const distM = turf.length(line, { units: 'meters' });

      const permLine = L.polyline(latlngs, {
        color: '#06b6d4',
        weight: 4,
      }).addTo(map);

      permLine.bindPopup(
        `<div style="font-size:12px; font-weight:600;">Custom Measured Line: ${distM >= 1000 ? (distM / 1000).toFixed(2) + ' km' : distM.toFixed(1) + ' m'}</div>`
      );
      setHasDrawnItems(true);
    } else if (activeDrawingTool === 'polygon') {
      const latlngs = drawnPoints.map((p) => L.latLng(p[0], p[1]));
      const coords = drawnPoints.map((p) => [p[1], p[0]]);
      coords.push(coords[0]);
      const poly = turf.polygon([coords]);
      const areaM2 = turf.area(poly);

      const permPoly = L.polygon(latlngs, {
        color: '#10b981',
        weight: 2,
        fillColor: '#10b981',
        fillOpacity: 0.45,
      }).addTo(map);

      permPoly.bindPopup(
        `<div style="font-size:12px; font-weight:600;">Custom Measured Polygon: ${(areaM2 / 10000).toFixed(2)} ha (${areaM2.toFixed(0)} m²)</div>`
      );
      setHasDrawnItems(true);
    }

    setDrawnPoints([]);
    setActiveDrawingTool(null);
  };

  // Create Parcel Buffer Zone
  const createBufferAtLocation = (centerPt: [number, number]) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    try {
      // Create buffer around point or selected feature
      const pt = turf.point([centerPt[1], centerPt[0]]);
      const buffered = turf.buffer(pt, bufferDistanceM, { units: 'meters' });

      if (buffered) {
        const bufferedGeoJson = L.geoJSON(buffered as any, {
          style: {
            color: '#f59e0b',
            weight: 2.5,
            fillColor: '#f59e0b',
            fillOpacity: 0.3,
            dashArray: '5 5',
          },
        }).addTo(map);

        const bufAreaM2 = turf.area(buffered);
        bufferedGeoJson.bindPopup(`
          <div style="font-size:12px;">
            <div style="font-weight:700; color:#b45309;">Parcel Buffer Zone (${bufferDistanceM}m)</div>
            <div style="color:#475569; margin-top:3px;">Impact Area: ${(bufAreaM2 / 10000).toFixed(2)} ha (${bufAreaM2.toFixed(0)} m²)</div>
          </div>
        `);

        setHasDrawnItems(true);
        setActiveDrawingTool(null);
      }
    } catch (e) {
      console.warn('Error creating buffer:', e);
    }
  };

  // Clear All Drawn Items
  const handleClearAllDrawn = () => {
    drawnLayerGroupRef.current?.clearLayers();
    setDrawnPoints([]);
    setActiveDrawingTool(null);
    setHasDrawnItems(false);
  };

  // Hover Marker on Map synced from Elevation Profile
  const handleElevationHoverPoint = (coord: [number, number] | null) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (elevationHoverMarkerRef.current) {
      map.removeLayer(elevationHoverMarkerRef.current);
      elevationHoverMarkerRef.current = null;
    }

    if (coord) {
      const pulseIcon = L.divIcon({
        className: 'elevation-cursor-pulse',
        html: '<div style="width:14px; height:14px; background:#06b6d4; border:2px solid #ffffff; border-radius:50%; box-shadow:0 0 10px #06b6d4; animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

      const marker = L.marker(L.latLng(coord[0], coord[1]), { icon: pulseIcon }).addTo(map);
      elevationHoverMarkerRef.current = marker;
    }
  };

  const handleFitBounds = () => {
    if (!mapInstanceRef.current || !mapData?.bounds) return;
    mapInstanceRef.current.fitBounds(mapData.bounds, { padding: [40, 40], maxZoom: 17 });
  };

  const handleSaveKey = () => {
    const trimmed = keyInput.trim() || DEFAULT_CARTO_KEY;
    setCartoKey(trimmed);
    localStorage.setItem('geomeasure_carto_key', trimmed);
    setIsKeyModalOpen(false);
  };

  // Mouse drag handler for Split Swipe bar
  const handleSwipeMouseDown = () => {
    setIsDraggingSwipe(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingSwipe || !mapContainerRef.current) return;
      const rect = mapContainerRef.current.getBoundingClientRect();
      const pos = ((e.clientX - rect.left) / rect.width) * 100;
      setSwipePosition(Math.max(5, Math.min(95, pos)));
    };

    const handleMouseUp = () => {
      setIsDraggingSwipe(false);
    };

    if (isDraggingSwipe) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingSwipe]);

  return (
    <div className="space-y-3">
      <div className="relative w-full h-[540px] rounded-xl overflow-hidden border border-slate-800 bg-slate-950 shadow-inner select-none">
        {/* Map DOM Element */}
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* ================= SWIPE SPLIT SLIDER DIVIDER ================= */}
        {isSwipeMode && (
          <div
            className="absolute top-0 bottom-0 z-20 pointer-events-auto cursor-ew-resize flex items-center justify-center group"
            style={{ left: `${swipePosition}%`, transform: 'translateX(-50%)' }}
            onMouseDown={handleSwipeMouseDown}
          >
            {/* Vertical hairline */}
            <div className="w-0.5 h-full bg-white shadow-[0_0_10px_rgba(0,0,0,0.8)]" />

            {/* Draggable Thumb pill */}
            <div className="absolute w-8 h-8 rounded-full bg-slate-900 border-2 border-white shadow-2xl flex items-center justify-center text-white text-xs group-hover:scale-110 transition-transform">
              <Columns2 className="w-4 h-4 text-emerald-400" />
            </div>

            {/* Floating Left/Right Labels */}
            <div className="absolute top-4 -left-20 bg-slate-950/80 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-mono text-slate-300 pointer-events-none">
              {BASEMAP_LAYERS[activeLayer].name}
            </div>
            <div className="absolute top-4 -right-20 bg-slate-950/80 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-mono text-slate-300 pointer-events-none">
              {BASEMAP_LAYERS[splitRightLayer].name}
            </div>
          </div>
        )}

        {/* ================= FLOATING HEADER CONTROLS (TOP LEFT) ================= */}
        <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-2">
          {/* Geodesic Status Pill */}
          <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-200 flex items-center gap-2 shadow-lg">
            <Globe className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Geodesic Canvas</span>
            <span className="text-slate-500">·</span>
            <span className="font-mono text-emerald-400">{mapData?.feature_count || 0} features</span>
          </div>

          {/* Drawing & Measurement Toolbar */}
          <DrawingToolbar
            activeTool={activeDrawingTool}
            onSelectTool={(tool) => {
              setActiveDrawingTool(tool);
              setDrawnPoints([]);
            }}
            activeMeasurement={activeMeasurement}
            bufferDistanceM={bufferDistanceM}
            onChangeBufferDistance={setBufferDistanceM}
            onFinishDrawing={handleFinishDrawing}
            onCancelDrawing={() => {
              setDrawnPoints([]);
              setActiveDrawingTool(null);
            }}
            onClearAllDrawn={handleClearAllDrawn}
            hasDrawnItems={hasDrawnItems}
          />
        </div>

        {/* ================= FLOATING TOOLBAR CONTROLS (TOP RIGHT) ================= */}
        <div className="absolute top-3 right-3 z-10 flex flex-wrap items-center justify-end gap-1.5">
          {/* 1. Thematic & Choropleth Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsThematicMenuOpen(!isThematicMenuOpen)}
              title="Thematic & Choropleth Styling"
              className={`p-1.5 rounded-lg text-xs transition-colors flex items-center gap-1 shadow-lg backdrop-blur-md border border-slate-800 ${
                thematicMode !== 'standard'
                  ? 'bg-emerald-950/80 text-emerald-300 font-semibold border-emerald-500/50'
                  : 'bg-slate-900/90 text-slate-300 hover:text-white'
              }`}
            >
              <Palette className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden md:inline">Thematic</span>
              <ChevronDown className="w-3 h-3" />
            </button>

            {isThematicMenuOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-52 bg-slate-900 border border-slate-800 rounded-lg shadow-2xl p-1 z-30 divide-y divide-slate-800/60">
                <div className="p-1">
                  <div className="text-[10px] text-slate-400 font-semibold px-2 py-1 uppercase">Polygon Thematic Mode</div>

                  <button
                    onClick={() => {
                      setThematicMode('standard');
                      setIsThematicMenuOpen(false);
                    }}
                    className={`w-full text-left px-2 py-1.5 rounded text-xs flex items-center justify-between ${
                      thematicMode === 'standard' ? 'bg-slate-800 text-emerald-400 font-medium' : 'text-slate-300 hover:bg-slate-800/40'
                    }`}
                  >
                    <span>Uniform Emerald</span>
                    {thematicMode === 'standard' && <Check className="w-3 h-3 text-emerald-400" />}
                  </button>

                  <button
                    onClick={() => {
                      setThematicMode('choropleth');
                      setIsThematicMenuOpen(false);
                    }}
                    className={`w-full text-left px-2 py-1.5 rounded text-xs flex items-center justify-between ${
                      thematicMode === 'choropleth' ? 'bg-slate-800 text-emerald-400 font-medium' : 'text-slate-300 hover:bg-slate-800/40'
                    }`}
                  >
                    <span>Choropleth by Area</span>
                    {thematicMode === 'choropleth' && <Check className="w-3 h-3 text-emerald-400" />}
                  </button>

                  {attributeKey && (
                    <button
                      onClick={() => {
                        setThematicMode('attribute');
                        setIsThematicMenuOpen(false);
                      }}
                      className={`w-full text-left px-2 py-1.5 rounded text-xs flex items-center justify-between ${
                        thematicMode === 'attribute' ? 'bg-slate-800 text-emerald-400 font-medium' : 'text-slate-300 hover:bg-slate-800/40'
                      }`}
                    >
                      <span>Category: {attributeKey}</span>
                      {thematicMode === 'attribute' && <Check className="w-3 h-3 text-emerald-400" />}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 2. Side-by-Side Swipe Comparison Toggle */}
          <button
            onClick={() => setIsSwipeMode(!isSwipeMode)}
            title="Side-by-Side Split Map / Swipe Comparison"
            className={`p-1.5 rounded-lg text-xs transition-colors flex items-center gap-1 shadow-lg backdrop-blur-md border border-slate-800 ${
              isSwipeMode
                ? 'bg-cyan-950/80 text-cyan-300 font-semibold border-cyan-500/50'
                : 'bg-slate-900/90 text-slate-300 hover:text-white'
            }`}
          >
            <Columns2 className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden md:inline">Swipe</span>
          </button>

          {/* Secondary Layer Picker when Swipe is Active */}
          {isSwipeMode && (
            <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 px-2 py-1 rounded-lg flex items-center gap-1 text-[11px]">
              <span className="text-slate-400">vs</span>
              <select
                value={splitRightLayer}
                onChange={(e) => setSplitRightLayer(e.target.value as BaseMapLayer)}
                className="bg-slate-950 border border-slate-700 text-white rounded px-1.5 py-0.5 focus:outline-none"
              >
                <option value="satellite">Satellite</option>
                <option value="topographic">Topographic</option>
                <option value="street">Street View</option>
                <option value="dark">Dark View</option>
                <option value="light">Light View</option>
              </select>
            </div>
          )}

          {/* 3. Base Layer Switcher Bar */}
          <div className="bg-slate-900/95 backdrop-blur-md border border-slate-800 p-1 rounded-lg shadow-xl flex items-center gap-1">
            <button
              onClick={() => setActiveLayer('street')}
              title="Street View (CARTO Voyager)"
              className={`px-2.5 py-1.5 rounded text-xs transition-colors flex items-center gap-1.5 ${
                activeLayer === 'street'
                  ? 'bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Compass className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden lg:inline">Street View</span>
            </button>

            <button
              onClick={() => setActiveLayer('satellite')}
              title="Satellite Aerial Imagery"
              className={`px-2.5 py-1.5 rounded text-xs transition-colors flex items-center gap-1.5 ${
                activeLayer === 'satellite'
                  ? 'bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <MapIcon className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden lg:inline">Satellite</span>
            </button>

            <button
              onClick={() => setActiveLayer('topographic')}
              title="Topographic Terrain & Elevation Contours"
              className={`px-2.5 py-1.5 rounded text-xs transition-colors flex items-center gap-1.5 ${
                activeLayer === 'topographic'
                  ? 'bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Mountain className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden lg:inline">Topographic</span>
            </button>

            {/* More Basemaps Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsLayerMenuOpen(!isLayerMenuOpen)}
                className={`p-1.5 rounded text-xs transition-colors flex items-center gap-1 ${
                  activeLayer === 'dark' || activeLayer === 'light'
                    ? 'bg-slate-800 text-white font-medium'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
                title="More Basemaps (Dark / Light)"
              >
                <Layers className="w-3.5 h-3.5" />
                <ChevronDown className="w-3 h-3" />
              </button>

              {isLayerMenuOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-48 bg-slate-900 border border-slate-800 rounded-lg shadow-2xl p-1 z-30 divide-y divide-slate-800/60">
                  <div className="p-1">
                    <button
                      onClick={() => {
                        setActiveLayer('dark');
                        setIsLayerMenuOpen(false);
                      }}
                      className={`w-full text-left px-2 py-1.5 rounded text-xs flex items-center justify-between ${
                        activeLayer === 'dark' ? 'bg-slate-800 text-emerald-400 font-medium' : 'text-slate-300 hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Moon className="w-3.5 h-3.5 text-slate-400" />
                        <span>Dark View (CARTO)</span>
                      </div>
                      {activeLayer === 'dark' && <Check className="w-3 h-3 text-emerald-400" />}
                    </button>

                    <button
                      onClick={() => {
                        setActiveLayer('light');
                        setIsLayerMenuOpen(false);
                      }}
                      className={`w-full text-left px-2 py-1.5 rounded text-xs flex items-center justify-between ${
                        activeLayer === 'light' ? 'bg-slate-800 text-emerald-400 font-medium' : 'text-slate-300 hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Sun className="w-3.5 h-3.5 text-amber-400" />
                        <span>Light View (CARTO)</span>
                      </div>
                      {activeLayer === 'light' && <Check className="w-3 h-3 text-emerald-400" />}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="w-px h-4 bg-slate-800 mx-0.5" />

            {/* Fit Bounds Button */}
            <button
              onClick={handleFitBounds}
              title="Recenter and Fit Dataset Envelope"
              className="p-1.5 rounded text-xs text-slate-300 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-1"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>

            {/* CARTO Key Config Button */}
            <button
              onClick={() => {
                setKeyInput(cartoKey);
                setIsKeyModalOpen(true);
              }}
              title="Manage CARTO API Key"
              className="p-1.5 rounded text-xs text-emerald-400 hover:text-emerald-300 hover:bg-slate-800 transition-colors"
            >
              <Key className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* ================= MAP LEGEND (BOTTOM LEFT) ================= */}
        <div className="absolute bottom-3 left-3 z-10 bg-slate-950/90 backdrop-blur-md border border-slate-800 px-3 py-2 rounded-lg text-[11px] shadow-lg flex flex-wrap items-center gap-3 text-slate-300">
          {thematicMode === 'choropleth' && areaQuartiles ? (
            <div className="flex items-center gap-3">
              <span className="text-[10px] uppercase font-bold text-slate-400">Area:</span>
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#a3e635]" />
                <span>&lt;{(areaQuartiles.q1 / 10000).toFixed(1)}ha</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#10b981]" />
                <span>{(areaQuartiles.q1 / 10000).toFixed(1)}–{(areaQuartiles.q2 / 10000).toFixed(1)}ha</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#06b6d4]" />
                <span>{(areaQuartiles.q2 / 10000).toFixed(1)}–{(areaQuartiles.q3 / 10000).toFixed(1)}ha</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#8b5cf6]" />
                <span>&gt;{(areaQuartiles.q3 / 10000).toFixed(1)}ha</span>
              </div>
            </div>
          ) : thematicMode === 'attribute' && attributeKey ? (
            <div className="flex items-center gap-3">
              <span className="text-[10px] uppercase font-bold text-slate-400">{attributeKey}:</span>
              {Array.from(categoryMap.entries()).slice(0, 4).map(([cat, col]) => (
                <div key={cat} className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: col }} />
                  <span className="max-w-[80px] truncate">{cat}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-emerald-500/40 border border-emerald-400 inline-block" />
                <span>Polygons (Area)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-cyan-400 inline-block" />
                <span>Lines (Length)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                <span>Points (Clustered)</span>
              </div>
            </div>
          )}
        </div>

        {/* CARTO Key Settings Modal */}
        {isKeyModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 shadow-2xl">
              <div className="flex items-center gap-2 mb-3">
                <Key className="w-4 h-4 text-emerald-400" />
                <h4 className="text-sm font-semibold text-white">CARTO Basemaps API Key</h4>
              </div>

              <p className="text-xs text-slate-400 mb-3 leading-relaxed">
                Your CARTO API Key is passed directly to CARTO raster endpoints (`?key=...`) to authenticate Street View (Voyager), Dark Matter, and Positron basemaps.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    API Key
                  </label>
                  <input
                    type="text"
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value)}
                    placeholder="Paste your CARTO API key..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-emerald-400 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="text-[11px] text-slate-500 flex items-center justify-between">
                  <span>Active Key: <code className="text-slate-400 font-mono">{cartoKey.slice(0, 10)}...</code></span>
                  <button
                    type="button"
                    onClick={() => setKeyInput(DEFAULT_CARTO_KEY)}
                    className="text-emerald-400 hover:underline"
                  >
                    Reset Default
                  </button>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    onClick={() => setIsKeyModalOpen(false)}
                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveKey}
                    className="px-4 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors"
                  >
                    Apply Key
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ================= ELEVATION & TERRAIN PROFILE PANEL ================= */}
      {profileFeature && (
        <ElevationProfile
          feature={profileFeature}
          onHoverPoint={handleElevationHoverPoint}
          onClose={() => setProfileFeature(null)}
        />
      )}
    </div>
  );
};
