import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { MapData } from '../types/geospatial';
import {
  Maximize2,
  Map,
  Globe,
  Sun,
  Moon,
  Mountain,
  Compass,
  Key,
  Layers,
  Check,
  ChevronDown
} from 'lucide-react';

interface InteractiveMapProps {
  mapData: MapData | null;
  selectedFeatureId: number | null;
  onSelectFeature: (id: number | null) => void;
}

export type BaseMapLayer = 'street' | 'satellite' | 'topographic' | 'dark' | 'light';

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
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 20,
  },
  satellite: {
    id: 'satellite',
    name: 'Satellite',
    category: 'Aerial',
    description: 'High-resolution global satellite and aerial photographic imagery',
    getUrl: () =>
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, GIS User Community',
    maxZoom: 19,
  },
  topographic: {
    id: 'topographic',
    name: 'Topographic',
    category: 'Terrain',
    description: 'Contour lines, elevation relief hillshades, water bodies, and physical geography',
    getUrl: () =>
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, TomTom, Intermap, iPC, USGS, FAO, NPS, NRCAN, GeoBase, Kadaster NL, Ordnance Survey',
    maxZoom: 19,
  },
  dark: {
    id: 'dark',
    name: 'Dark View',
    category: 'CARTO',
    description: 'CARTO Dark Matter minimal dark cartography for high-contrast geospatial inspection',
    getUrl: (key: string) =>
      `https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png?key=${encodeURIComponent(key)}&v=2`,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 20,
  },
  light: {
    id: 'light',
    name: 'Light View',
    category: 'CARTO',
    description: 'CARTO Positron subtle monochromatic clean background',
    getUrl: (key: string) =>
      `https://basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png?key=${encodeURIComponent(key)}&v=2`,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 20,
  },
};

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  mapData,
  selectedFeatureId,
  onSelectFeature,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const geojsonLayerRef = useRef<L.GeoJSON | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  // Active layer state
  const [activeLayer, setActiveLayer] = useState<BaseMapLayer>('street');
  const [isLayerMenuOpen, setIsLayerMenuOpen] = useState(false);

  // CARTO Key management
  const [cartoKey, setCartoKey] = useState<string>(() => {
    return localStorage.getItem('geomeasure_carto_key') || DEFAULT_CARTO_KEY;
  });
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [keyInput, setKeyInput] = useState(cartoKey);

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

      const cfg = BASEMAP_LAYERS[activeLayer];
      const tiles = L.tileLayer(cfg.getUrl(cartoKey), {
        attribution: cfg.attribution,
        maxZoom: cfg.maxZoom,
      }).addTo(map);

      tileLayerRef.current = tiles;
      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Switch Layer or update Key
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    const cfg = BASEMAP_LAYERS[activeLayer];
    const newTiles = L.tileLayer(cfg.getUrl(cartoKey), {
      attribution: cfg.attribution,
      maxZoom: cfg.maxZoom,
    }).addTo(map);

    tileLayerRef.current = newTiles;
  }, [activeLayer, cartoKey]);

  // Load and Render GeoJSON Features
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapData || !mapData.geojson) return;

    if (geojsonLayerRef.current) {
      map.removeLayer(geojsonLayerRef.current);
      geojsonLayerRef.current = null;
    }

    const geoLayer = L.geoJSON(mapData.geojson as any, {
      pointToLayer: (feature, latlng) => {
        const isSelected = feature.properties?.feature_id === selectedFeatureId;
        return L.circleMarker(latlng, {
          radius: isSelected ? 9 : 6,
          fillColor: '#f59e0b',
          color: isSelected ? '#ffffff' : '#fbbf24',
          weight: isSelected ? 3 : 1.5,
          opacity: 1,
          fillOpacity: 0.85,
        });
      },
      style: (feature) => {
        const isSelected = feature?.properties?.feature_id === selectedFeatureId;
        const geomType = feature?.geometry?.type || '';

        if (geomType.includes('Polygon')) {
          return {
            fillColor: isSelected ? '#34d399' : '#10b981',
            color: isSelected ? '#ffffff' : '#34d399',
            weight: isSelected ? 3 : 1.8,
            fillOpacity: isSelected ? 0.6 : 0.35,
          };
        } else if (geomType.includes('LineString')) {
          return {
            color: isSelected ? '#ffffff' : '#22d3ee',
            weight: isSelected ? 5 : 3.5,
            opacity: 0.9,
          };
        }

        return {
          color: '#3b82f6',
          weight: 2,
        };
      },
      onEachFeature: (feature, layer) => {
        const p = feature.properties || {};
        const featId = p.feature_id ?? feature.id ?? 0;
        const featName = p.name || p.NAME || `Feature #${featId}`;
        const geomType = p.geometry_type || feature.geometry.type;
        const measFormatted = p.measurement_formatted || 'No metric measurement (Point)';

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
          },
        });
      },
    });

    geoLayer.addTo(map);
    geojsonLayerRef.current = geoLayer;

    // Fit bounds
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
  }, [mapData, selectedFeatureId, onSelectFeature]);

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

  return (
    <div className="relative w-full h-[540px] rounded-xl overflow-hidden border border-slate-800 bg-slate-950 shadow-inner">
      {/* Map DOM Element */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Floating Info Pill (Top Left) */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-200 flex items-center gap-2 shadow-lg">
          <Globe className="w-3.5 h-3.5 text-emerald-400" />
          <span>Interactive Geodesic Canvas</span>
          <span className="text-slate-500">·</span>
          <span className="font-mono text-emerald-400">{mapData?.feature_count || 0} features</span>
        </div>
      </div>

      {/* Floating Layer Control & Key Manager (Top Right) */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
        {/* Layer Selector Bar */}
        <div className="bg-slate-900/95 backdrop-blur-md border border-slate-800 p-1 rounded-lg shadow-xl flex items-center gap-1">
          {/* 1. Street View (CARTO Voyager) */}
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
            <span className="hidden sm:inline">Street View</span>
          </button>

          {/* 2. Satellite */}
          <button
            onClick={() => setActiveLayer('satellite')}
            title="Satellite Aerial Imagery"
            className={`px-2.5 py-1.5 rounded text-xs transition-colors flex items-center gap-1.5 ${
              activeLayer === 'satellite'
                ? 'bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Map className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Satellite</span>
          </button>

          {/* 3. Topographic */}
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
            <span className="hidden sm:inline">Topographic</span>
          </button>

          {/* 4. More Layers Dropdown (Dark & Light) */}
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
            <span className="hidden md:inline">Fit</span>
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

      {/* Map Legend */}
      <div className="absolute bottom-3 left-3 z-10 bg-slate-950/90 backdrop-blur-md border border-slate-800 px-3 py-2 rounded-lg text-[11px] shadow-lg flex items-center gap-4 text-slate-300">
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
          <span>Points (Sites)</span>
        </div>
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
  );
};
