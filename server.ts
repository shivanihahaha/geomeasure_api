import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as turf from '@turf/turf';
import shp from 'shpjs';
import { kml } from '@tmcw/togeojson';
import { DOMParser } from '@xmldom/xmldom';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Ensure data directories exist
const DATA_DIR = path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const SAMPLES_DIR = path.join(DATA_DIR, 'samples');
const DB_FILE = path.join(DATA_DIR, 'db.json');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(SAMPLES_DIR, { recursive: true });

// Multer memory storage for fast in-memory spatial parsing
const upload = multer({
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

app.use(express.json());

// In-Memory Database with JSON file backup
interface StoredRecord {
  id: string;
  filename: string;
  feature_count: number;
  crs: string;
  measurement_crs: string;
  measurement_units: string;
  status: 'COMPLETED' | 'FAILED' | 'PROCESSING';
  geometry_types: Record<string, number>;
  created_at: string;
  processing_time_ms: number;
  file_size_bytes: number;
  summary_data: any;
  features: any[];
}

let dbRecords: Map<string, StoredRecord> = new Map();

function loadDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
      for (const item of data) {
        dbRecords.set(item.id, item);
      }
    }
  } catch (err) {
    console.warn('Could not load db.json, starting fresh:', err);
  }
}

function saveDb() {
  try {
    const list = Array.from(dbRecords.values());
    fs.writeFileSync(DB_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Could not save db.json:', err);
  }
}

loadDb();

// UTM Zone selection logic
function calculateUtmCrs(lon: number, lat: number) {
  const clampedLon = Math.max(-180, Math.min(179.999999, lon));
  const zone = Math.floor((clampedLon + 180) / 6) + 1;
  const epsg = lat >= 0 ? 32600 + zone : 32700 + zone;
  const name = `WGS 84 / UTM zone ${zone}${lat >= 0 ? 'N' : 'S'} (EPSG:${epsg})`;
  return { epsg, name, code: `EPSG:${epsg}` };
}

// Convert numbers with commas
function formatNumber(num: number, decimals: number = 2): string {
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

// Process GeoJSON features into measurements
function processFeatureCollection(fc: any, filename: string, fileSizeBytes: number, startTime: number): StoredRecord {
  const rawFeatures = fc?.features || [];
  let totalAreaM2 = 0;
  let totalLengthM = 0;

  const geomCounts: Record<string, number> = {
    Polygon: 0,
    LineString: 0,
    Point: 0,
    MultiPolygon: 0,
    MultiLineString: 0,
    MultiPoint: 0,
    Other: 0,
  };

  // Compute dataset bounds and centroid
  let minLng = 180, minLat = 90, maxLng = -180, maxLat = -90;
  let hasValidGeom = false;

  const processedFeatures = rawFeatures.map((f: any, idx: number) => {
    const geom = f.geometry;
    const geomType = geom?.type || 'Unknown';

    if (geomType in geomCounts) {
      geomCounts[geomType]++;
    } else {
      geomCounts.Other++;
    }

    // Update bounding box
    if (geom?.coordinates) {
      try {
        const bbox = turf.bbox(f);
        minLng = Math.min(minLng, bbox[0]);
        minLat = Math.min(minLat, bbox[1]);
        maxLng = Math.max(maxLng, bbox[2]);
        maxLat = Math.max(maxLat, bbox[3]);
        hasValidGeom = true;
      } catch {}
    }

    let measurement: any = null;
    let measurementStatus = 'NOT_APPLICABLE';

    if (geomType === 'Polygon' || geomType === 'MultiPolygon') {
      try {
        const areaM2 = turf.area(f);
        totalAreaM2 += areaM2;
        measurementStatus = 'COMPLETED';

        let formatted = '';
        if (areaM2 >= 1_000_000) {
          formatted = `${formatNumber(areaM2 / 1_000_000, 3)} km²`;
        } else if (areaM2 >= 10_000) {
          formatted = `${formatNumber(areaM2 / 10_000, 2)} ha`;
        } else {
          formatted = `${formatNumber(areaM2, 2)} m²`;
        }

        measurement = {
          type: 'AREA',
          value: Math.round(areaM2 * 100) / 100,
          unit: 'm²',
          formatted,
          conversions: {
            m2: { unit: 'm²', value: Math.round(areaM2 * 100) / 100, formatted: `${formatNumber(areaM2, 2)} m²` },
            ha: { unit: 'ha', value: Math.round((areaM2 / 10000) * 10000) / 10000, formatted: `${formatNumber(areaM2 / 10000, 4)} ha` },
            km2: { unit: 'km²', value: Math.round((areaM2 / 1000000) * 10000) / 10000, formatted: `${formatNumber(areaM2 / 1000000, 4)} km²` },
            acres: { unit: 'ac', value: Math.round((areaM2 / 4046.8564224) * 100) / 100, formatted: `${formatNumber(areaM2 / 4046.8564224, 2)} ac` },
          },
        };
      } catch (err) {
        measurementStatus = 'UNSUPPORTED';
      }
    } else if (geomType === 'LineString' || geomType === 'MultiLineString') {
      try {
        const lengthKm = turf.length(f, { units: 'kilometers' });
        const lengthM = lengthKm * 1000;
        totalLengthM += lengthM;
        measurementStatus = 'COMPLETED';

        const formatted = lengthM >= 1000 ? `${formatNumber(lengthKm, 2)} km` : `${formatNumber(lengthM, 2)} m`;

        measurement = {
          type: 'LENGTH',
          value: Math.round(lengthM * 100) / 100,
          unit: 'm',
          formatted,
          conversions: {
            m: { unit: 'm', value: Math.round(lengthM * 100) / 100, formatted: `${formatNumber(lengthM, 2)} m` },
            km: { unit: 'km', value: Math.round(lengthKm * 1000) / 1000, formatted: `${formatNumber(lengthKm, 3)} km` },
            ft: { unit: 'ft', value: Math.round(lengthM * 3.28084 * 100) / 100, formatted: `${formatNumber(lengthM * 3.28084, 2)} ft` },
            miles: { unit: 'mi', value: Math.round((lengthM / 1609.344) * 1000) / 1000, formatted: `${formatNumber(lengthM / 1609.344, 3)} mi` },
          },
        };
      } catch (err) {
        measurementStatus = 'UNSUPPORTED';
      }
    } else if (geomType === 'Point' || geomType === 'MultiPoint') {
      measurementStatus = 'NOT_APPLICABLE';
    } else {
      measurementStatus = 'UNSUPPORTED';
    }

    return {
      feature_id: idx,
      geometry_type: geomType,
      geometry: geom,
      crs: 'EPSG:4326',
      measurement_crs: 'EPSG:32643', // Will be updated below
      properties: f.properties || {},
      measurement,
      measurement_status: measurementStatus,
    };
  });

  // Calculate centroid and select UTM CRS
  let centroidLon = 0, centroidLat = 0;
  if (hasValidGeom) {
    centroidLon = (minLng + maxLng) / 2;
    centroidLat = (minLat + maxLat) / 2;
  }
  const utmInfo = calculateUtmCrs(centroidLon, centroidLat);

  // Update measurement_crs on features
  for (const feat of processedFeatures) {
    feat.measurement_crs = utmInfo.code;
  }

  const durationMs = Date.now() - startTime;
  const fileId = Math.random().toString(36).substring(2, 14);

  const bounds: [[number, number], [number, number]] = hasValidGeom
    ? [[minLat, minLng], [maxLat, maxLng]]
    : [[-90, -180], [90, 180]];
  const center: [number, number] = hasValidGeom
    ? [centroidLat, centroidLon]
    : [0, 0];

  const summary = {
    total_features: processedFeatures.length,
    polygon_count: (geomCounts.Polygon || 0) + (geomCounts.MultiPolygon || 0),
    linestring_count: (geomCounts.LineString || 0) + (geomCounts.MultiLineString || 0),
    point_count: (geomCounts.Point || 0) + (geomCounts.MultiPoint || 0),
    other_count: geomCounts.Other || 0,
    total_area_m2: Math.round(totalAreaM2 * 100) / 100,
    total_area_ha: Math.round((totalAreaM2 / 10000) * 10000) / 10000,
    total_area_km2: Math.round((totalAreaM2 / 1000000) * 10000) / 10000,
    total_area_acres: Math.round((totalAreaM2 / 4046.8564224) * 100) / 100,
    total_length_m: Math.round(totalLengthM * 100) / 100,
    total_length_km: Math.round((totalLengthM / 1000) * 1000) / 1000,
    total_length_miles: Math.round((totalLengthM / 1609.344) * 1000) / 1000,
    total_length_ft: Math.round(totalLengthM * 3.28084 * 100) / 100,
    source_crs: 'EPSG:4326',
    measurement_crs: utmInfo.code,
    measurement_units: 'meters',
    crs_strategy: `Auto-selected ${utmInfo.name} based on dataset centroid (${centroidLat.toFixed(4)}°N, ${centroidLon.toFixed(4)}°E)`,
    bounds,
    center,
  };

  const record: StoredRecord = {
    id: fileId,
    filename,
    feature_count: processedFeatures.length,
    crs: 'EPSG:4326',
    measurement_crs: utmInfo.code,
    measurement_units: 'meters',
    status: 'COMPLETED',
    geometry_types: geomCounts,
    created_at: new Date().toISOString(),
    processing_time_ms: durationMs,
    file_size_bytes: fileSizeBytes,
    summary_data: summary,
    features: processedFeatures,
  };

  dbRecords.set(fileId, record);
  saveDb();
  return record;
}

// Ensure default sample files exist in dbRecords on start
async function seedDefaultSamples() {
  if (dbRecords.size > 0) return;

  const sampleKmlPath = path.join(SAMPLES_DIR, 'agricultural_zones_survey.kml');
  if (fs.existsSync(sampleKmlPath)) {
    try {
      const kmlXml = fs.readFileSync(sampleKmlPath, 'utf-8');
      const dom = new DOMParser().parseFromString(kmlXml, 'text/xml');
      const geojson = kml(dom);
      processFeatureCollection(geojson, 'agricultural_zones_survey.kml', kmlXml.length, Date.now());
      console.log('[Seed] Agricultural survey KML sample preloaded.');
    } catch (e) {
      console.warn('[Seed] Failed to parse sample KML:', e);
    }
  }

  const sampleShpPath = path.join(SAMPLES_DIR, 'cadastral_parcels_shapefile.zip');
  if (fs.existsSync(sampleShpPath)) {
    try {
      const buffer = fs.readFileSync(sampleShpPath);
      const geojson: any = await shp(buffer);
      const fc = Array.isArray(geojson) ? geojson[0] : geojson;
      processFeatureCollection(fc, 'cadastral_parcels_shapefile.zip', buffer.length, Date.now());
      console.log('[Seed] Cadastral parcels Shapefile sample preloaded.');
    } catch (e) {
      console.warn('[Seed] Failed to parse sample Shapefile:', e);
    }
  }
}
seedDefaultSamples();

// ================= API ROUTES =================

// GET /api/health
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    app_name: 'GeoMeasure API',
    app_version: '1.0.0',
    geospatial_engine: {
      node: process.version,
      turf: '7.2.0',
      shpjs: '6.1.0',
      togeojson: '5.8.1',
    },
    storage: {
      total_files_processed: dbRecords.size,
      max_upload_size_mb: 50,
      allowed_extensions: ['.kml', '.zip'],
    },
  });
});

// GET /api/files/
app.get('/api/files/', (req, res) => {
  const list = Array.from(dbRecords.values()).map((r) => ({
    id: r.id,
    filename: r.filename,
    feature_count: r.feature_count,
    crs: r.crs,
    measurement_crs: r.measurement_crs,
    status: r.status,
    geometry_types: r.geometry_types,
    created_at: r.created_at,
    processing_time_ms: r.processing_time_ms,
    file_size_bytes: r.file_size_bytes,
  }));
  list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  res.json({ total: list.length, files: list });
});

// POST /api/files/
app.post('/api/files/', upload.single('file'), async (req, res) => {
  const startTime = Date.now();
  if (!req.file) {
    return res.status(400).json({
      error: { code: 'NO_FILE_UPLOADED', message: 'No file was provided in the multipart request.' },
    });
  }

  const filename = req.file.originalname;
  const ext = path.extname(filename).toLowerCase();

  if (ext !== '.kml' && ext !== '.zip') {
    return res.status(400).json({
      error: {
        code: 'UNSUPPORTED_FILE_TYPE',
        message: `File extension '${ext}' is not supported. Upload '.kml' or '.zip' Shapefile archives.`,
      },
    });
  }

  try {
    let geojson: any = null;

    if (ext === '.kml') {
      const kmlString = req.file.buffer.toString('utf-8');
      const dom = new DOMParser().parseFromString(kmlString, 'text/xml');
      geojson = kml(dom);
    } else {
      // Shapefile zip buffer
      const parsed: any = await shp(req.file.buffer);
      geojson = Array.isArray(parsed) ? parsed[0] : parsed;
    }

    if (!geojson || !geojson.features || geojson.features.length === 0) {
      return res.status(400).json({
        error: {
          code: 'EMPTY_GEOSPATIAL_FILE',
          message: 'The file was read successfully but contains 0 geospatial features.',
        },
      });
    }

    const record = processFeatureCollection(geojson, filename, req.file.size, startTime);

    res.status(201).json({
      id: record.id,
      filename: record.filename,
      status: record.status,
      feature_count: record.feature_count,
      crs: record.crs,
      measurement_crs: record.measurement_crs,
      created_at: record.created_at,
      processing_time_ms: record.processing_time_ms,
    });
  } catch (err: any) {
    console.error('File parsing error:', err);
    res.status(400).json({
      error: {
        code: 'GEOSPATIAL_PROCESSING_ERROR',
        message: err.message || 'Failed to parse geospatial data.',
      },
    });
  }
});

// POST /api/files/sample/:sampleType
app.post('/api/files/sample/:sampleType', async (req, res) => {
  const startTime = Date.now();
  const sampleType = req.params.sampleType.toLowerCase();

  let filename = '';
  let filePath = '';

  if (sampleType === 'kml') {
    filename = 'agricultural_zones_survey.kml';
    filePath = path.join(SAMPLES_DIR, filename);
  } else if (sampleType === 'shapefile' || sampleType === 'shp' || sampleType === 'zip') {
    filename = 'cadastral_parcels_shapefile.zip';
    filePath = path.join(SAMPLES_DIR, filename);
  } else {
    return res.status(400).json({
      error: { code: 'INVALID_SAMPLE_TYPE', message: 'Allowed sample types: kml or shapefile' },
    });
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({
      error: { code: 'SAMPLE_NOT_FOUND', message: `Sample file '${filename}' was not found.` },
    });
  }

  try {
    const buffer = fs.readFileSync(filePath);
    let geojson: any = null;

    if (filePath.endsWith('.kml')) {
      const kmlXml = buffer.toString('utf-8');
      const dom = new DOMParser().parseFromString(kmlXml, 'text/xml');
      geojson = kml(dom);
    } else {
      const parsed: any = await shp(buffer);
      geojson = Array.isArray(parsed) ? parsed[0] : parsed;
    }

    const record = processFeatureCollection(geojson, filename, buffer.length, startTime);

    res.status(201).json({
      id: record.id,
      filename: record.filename,
      status: record.status,
      feature_count: record.feature_count,
      crs: record.crs,
      measurement_crs: record.measurement_crs,
      created_at: record.created_at,
      processing_time_ms: record.processing_time_ms,
    });
  } catch (err: any) {
    res.status(500).json({
      error: { code: 'SAMPLE_LOAD_ERROR', message: err.message },
    });
  }
});

// GET /api/files/:id/
app.get('/api/files/:id/', (req, res) => {
  const rec = dbRecords.get(req.params.id);
  if (!rec) {
    return res.status(404).json({
      error: { code: 'FILE_NOT_FOUND', message: `File analysis '${req.params.id}' was not found.` },
    });
  }

  res.json({
    id: rec.id,
    filename: rec.filename,
    feature_count: rec.feature_count,
    crs: rec.crs,
    measurement_crs: rec.measurement_crs,
    measurement_units: rec.measurement_units,
    status: rec.status,
    geometry_types: rec.geometry_types,
    created_at: rec.created_at,
    processing_time_ms: rec.processing_time_ms,
    file_size_bytes: rec.file_size_bytes,
  });
});

// GET /api/files/:id/measurements/
app.get('/api/files/:id/measurements/', (req, res) => {
  const rec = dbRecords.get(req.params.id);
  if (!rec) {
    return res.status(404).json({
      error: { code: 'FILE_NOT_FOUND', message: `File analysis '${req.params.id}' was not found.` },
    });
  }

  const features = rec.features.map((f: any) => ({
    feature_id: f.feature_id,
    geometry_type: f.geometry_type,
    name: f.properties?.name || f.properties?.NAME || `Feature #${f.feature_id}`,
    measurement: f.measurement,
    measurement_status: f.measurement_status,
  }));

  res.json({
    file_id: rec.id,
    filename: rec.filename,
    summary: rec.summary_data,
    features,
  });
});

// GET /api/files/:id/map/
app.get('/api/files/:id/map/', (req, res) => {
  const rec = dbRecords.get(req.params.id);
  if (!rec) {
    return res.status(404).json({
      error: { code: 'FILE_NOT_FOUND', message: `File analysis '${req.params.id}' was not found.` },
    });
  }

  const geojsonFeatures = rec.features.map((f: any) => ({
    type: 'Feature',
    id: f.feature_id,
    geometry: f.geometry,
    properties: {
      ...f.properties,
      feature_id: f.feature_id,
      geometry_type: f.geometry_type,
      measurement_type: f.measurement?.type,
      measurement_value: f.measurement?.value,
      measurement_unit: f.measurement?.unit,
      measurement_formatted: f.measurement?.formatted,
      measurement_status: f.measurement_status,
      source_crs: rec.crs,
      measurement_crs: rec.measurement_crs,
    },
  }));

  res.json({
    file_id: rec.id,
    filename: rec.filename,
    bounds: rec.summary_data.bounds,
    center: rec.summary_data.center,
    feature_count: rec.feature_count,
    geojson: {
      type: 'FeatureCollection',
      features: geojsonFeatures,
    },
    summary: rec.summary_data,
  });
});

// GET /api/files/:id/features/
app.get('/api/files/:id/features/', (req, res) => {
  const rec = dbRecords.get(req.params.id);
  if (!rec) {
    return res.status(404).json({
      error: { code: 'FILE_NOT_FOUND', message: `File analysis '${req.params.id}' was not found.` },
    });
  }

  const skip = parseInt(req.query.skip as string, 10) || 0;
  const limit = parseInt(req.query.limit as string, 10) || 200;

  res.json({
    file_id: rec.id,
    filename: rec.filename,
    total_features: rec.features.length,
    skip,
    limit,
    features: rec.features.slice(skip, skip + limit),
  });
});

// GET /api/files/:id/export
app.get('/api/files/:id/export', (req, res) => {
  const rec = dbRecords.get(req.params.id);
  if (!rec) {
    return res.status(404).json({
      error: { code: 'FILE_NOT_FOUND', message: `File analysis '${req.params.id}' was not found.` },
    });
  }

  const format = (req.query.format as string || 'json').toLowerCase();
  const baseName = rec.filename.replace(/\.[^/.]+$/, '');

  if (format === 'csv') {
    const headers = [
      'feature_id',
      'geometry_type',
      'measurement_type',
      'measurement_value',
      'measurement_unit',
      'measurement_formatted',
      'measurement_status',
      'source_crs',
      'measurement_crs',
      'properties_json',
    ];

    const rows = rec.features.map((f: any) => [
      f.feature_id,
      f.geometry_type,
      f.measurement?.type || '',
      f.measurement?.value ?? '',
      f.measurement?.unit || '',
      f.measurement?.formatted || '',
      f.measurement_status,
      rec.crs,
      rec.measurement_crs,
      `"${JSON.stringify(f.properties).replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${baseName}_measurements.csv"`);
    return res.send(csvContent);
  }

  if (format === 'geojson') {
    const geojsonFeatures = rec.features.map((f: any) => ({
      type: 'Feature',
      id: f.feature_id,
      geometry: f.geometry,
      properties: {
        ...f.properties,
        feature_id: f.feature_id,
        geometry_type: f.geometry_type,
        measurement_type: f.measurement?.type,
        measurement_value: f.measurement?.value,
        measurement_unit: f.measurement?.unit,
        measurement_formatted: f.measurement?.formatted,
        measurement_status: f.measurement_status,
        source_crs: rec.crs,
        measurement_crs: rec.measurement_crs,
      },
    }));

    const fc = {
      type: 'FeatureCollection',
      name: rec.filename,
      features: geojsonFeatures,
    };

    res.setHeader('Content-Type', 'application/geo+json');
    res.setHeader('Content-Disposition', `attachment; filename="${baseName}.geojson"`);
    return res.json(fc);
  }

  // JSON format
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${baseName}_analysis.json"`);
  res.json({
    file_id: rec.id,
    filename: rec.filename,
    status: rec.status,
    feature_count: rec.feature_count,
    crs: rec.crs,
    measurement_crs: rec.measurement_crs,
    summary: rec.summary_data,
    features: rec.features,
  });
});

// DELETE /api/files/:id/
app.delete('/api/files/:id/', (req, res) => {
  if (dbRecords.has(req.params.id)) {
    dbRecords.delete(req.params.id);
    saveDb();
    return res.json({ message: 'Deleted successfully', file_id: req.params.id });
  }
  res.status(404).json({
    error: { code: 'FILE_NOT_FOUND', message: `File '${req.params.id}' was not found.` },
  });
});

// ================= VITE DEV / PROD MIDDLEWARE =================
async function startServer() {
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: process.env.DISABLE_HMR !== 'true' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[GeoMeasure Server] Running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
