import {
  FileRecord,
  HealthStatus,
  MapData,
  FeatureItem,
  MeasurementSummary
} from '../types/geospatial';

const API_BASE = 'http://localhost:8001/api';

export async function fetchHealth(): Promise<HealthStatus> {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error('Health check failed');
  return res.json();
}

export async function listFiles(limit = 50): Promise<{ total: number; files: FileRecord[] }> {
  const res = await fetch(`${API_BASE}/files/?limit=${limit}`);
  if (!res.ok) throw new Error('Failed to fetch file list');
  return res.json();
}

export async function getFileInfo(id: string): Promise<FileRecord> {
  const res = await fetch(`${API_BASE}/files/${id}/`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to fetch file details for ${id}`);
  }
  return res.json();
}

export async function getFileMeasurements(id: string): Promise<{
  file_id: string;
  filename: string;
  summary: MeasurementSummary;
  features: Array<{
    feature_id: number;
    geometry_type: string;
    name?: string;
    measurement: any;
    measurement_status: 'COMPLETED' | 'NOT_APPLICABLE' | 'UNSUPPORTED';
  }>;
}> {
  const res = await fetch(`${API_BASE}/files/${id}/measurements/`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to fetch measurements');
  }
  return res.json();
}

export async function getMapData(id: string): Promise<MapData> {
  const res = await fetch(`${API_BASE}/files/${id}/map/`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to fetch map data');
  }
  return res.json();
}

export async function getFeatures(id: string, skip = 0, limit = 200): Promise<{
  file_id: string;
  filename: string;
  total_features: number;
  features: FeatureItem[];
}> {
  const res = await fetch(`${API_BASE}/files/${id}/features/?skip=${skip}&limit=${limit}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to fetch features');
  }
  return res.json();
}

export async function uploadFile(file: File): Promise<{
  id: string;
  filename: string;
  status: string;
  feature_count: number;
  crs: string;
  measurement_crs: string;
  processing_time_ms: number;
}> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/files/`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Upload failed (${res.status})`);
  }

  return res.json();
}

export async function loadSample(sampleType: 'kml' | 'shapefile'): Promise<{
  id: string;
  filename: string;
  status: string;
  feature_count: number;
  crs: string;
  measurement_crs: string;
  processing_time_ms: number;
}> {
  const res = await fetch(`${API_BASE}/files/sample/${sampleType}`, {
    method: 'POST',
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to load sample dataset`);
  }

  return res.json();
}

export async function deleteFile(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/files/${id}/`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to delete file');
  }
}

export function getExportUrl(id: string, format: 'json' | 'csv' | 'geojson'): string {
  return `${API_BASE}/files/${id}/export?format=${format}`;
}
