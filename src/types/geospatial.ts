export interface ConvertedUnit {
  unit: string;
  value: number;
  formatted: string;
}

export interface MeasurementDetail {
  type: 'AREA' | 'LENGTH';
  value: number;
  unit: string;
  formatted: string;
  conversions?: Record<string, ConvertedUnit>;
}

export interface FeatureItem {
  feature_id: number;
  geometry_type: string;
  geometry: {
    type: string;
    coordinates: any;
  };
  crs: string;
  measurement_crs: string;
  properties: Record<string, any>;
  measurement: MeasurementDetail | null;
  measurement_status: 'COMPLETED' | 'NOT_APPLICABLE' | 'UNSUPPORTED';
}

export interface MeasurementSummary {
  total_features: number;
  polygon_count: number;
  linestring_count: number;
  point_count: number;
  other_count: number;
  total_area_m2: number;
  total_area_ha: number;
  total_area_km2: number;
  total_area_acres: number;
  total_length_m: number;
  total_length_km: number;
  total_length_miles: number;
  total_length_ft: number;
  measurement_crs: string;
  source_crs: string;
  measurement_units: string;
  crs_strategy?: string;
  bounds?: [[number, number], [number, number]];
  center?: [number, number];
}

export interface FileRecord {
  id: string;
  filename: string;
  feature_count: number;
  crs: string;
  measurement_crs: string;
  measurement_units?: string;
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
  geometry_types?: Record<string, number>;
  created_at: string;
  processing_time_ms: number;
  file_size_bytes?: number;
}

export interface MapData {
  file_id: string;
  filename: string;
  bounds: [[number, number], [number, number]];
  center: [number, number];
  feature_count: number;
  geojson: {
    type: 'FeatureCollection';
    features: Array<{
      type: 'Feature';
      id?: number;
      geometry: {
        type: string;
        coordinates: any;
      };
      properties: Record<string, any>;
    }>;
  };
  summary: Record<string, any>;
}

export interface HealthStatus {
  status: string;
  app_name: string;
  app_version: string;
  geospatial_engine: {
    python: string;
    geopandas: string;
    shapely: string;
    pyproj: string;
    proj_version: string;
  };
  storage: {
    total_files_processed: number;
    max_upload_size_mb: number;
    allowed_extensions: string[];
  };
}
