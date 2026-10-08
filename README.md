# GeoMeasure — Geospatial File Measurement & Analysis Platform

> Production-grade geospatial analysis API and interactive mapping platform built with **Python 3.11**, **FastAPI**, **GeoPandas**, **PyProj**, **Shapely**, **React**, and **Leaflet**.

---

## 1. Project Overview

**GeoMeasure** solves a foundational challenge in geospatial engineering: transforming raw spatial files (`.kml` and `.zip` Shapefiles) into mathematically accurate Euclidean metric measurements (**Polygon area** and **LineString length**).

Geographic datasets frequently arrive in angular coordinate reference systems (such as `EPSG:4326` / WGS 84), where positions are recorded in spherical degrees ($\text{latitude}, \text{longitude}$). Calculating areas or lengths directly on unprojected degrees produces erroneous degree-squared values ($\text{deg}^2$) that vary non-linearly with latitude.

**GeoMeasure automatically:**
1. Validates uploaded files and guards against security exploits (including Zip Slip directory traversal).
2. Reads vectors using GeoPandas and Fiona/Pyogrio drivers.
3. Detects source Coordinate Reference Systems (CRS).
4. Analyzes spatial extents and **dynamically reprojects geometries into optimal metric coordinate systems (e.g., local Universal Transverse Mercator / UTM zones)**.
5. Accurately calculates Polygon areas ($m^2$, hectares, $km^2$, acres) and LineString lengths ($m$, $km$, feet, miles).
6. Gracefully handles Point markers (discrete geodetic stations) and unsupported geometry collections without crashing.
7. Exposes an OpenAPI/Swagger-documented REST API.
8. Provides a modern interactive React dashboard with Leaflet map visualization, multi-layer cartography, tabular inspection, and multiple export formats (JSON, CSV, GeoJSON).

---

## 2. Features

### Core Assignment Requirements
- **FastAPI Framework**: High-performance asynchronous Python backend with Pydantic validation.
- **Dual File Format Support**:
  - `.kml` (OGC Keyhole Markup Language)
  - `.zip` (ESRI Shapefile archive containing `.shp`, `.shx`, `.dbf`, `.prj`)
- **Rigorous File Validation**: Extension checks, MIME verification, file size limits (50 MB), and Zip Slip path traversal protection.
- **Feature Extraction**: Extracts feature indices, GeoJSON geometries, CRS metadata, and custom attributes.
- **Metric Measurements**:
  - **Polygon / MultiPolygon**: Exact area in $m^2$.
  - **LineString / MultiLineString**: Exact length in meters.
  - **Point / MultiPoint**: Gracefully designated as non-measurable discrete sites.
- **Strict CRS Handling**: Unprojected geographic coordinates (`EPSG:4326`) are never measured directly; they are transformed to projected metric systems prior to calculation.
- **REST APIs**: `POST /api/files/`, `GET /api/files/{id}/`, `GET /api/files/{id}/measurements/`.
- **Automated Tests**: Pytest test suite with 24 passing tests covering uploads, CRS transformations, geometry measurements, and error cases.

### Enhanced Production Features
- **Interactive Leaflet Map**: Reprojects geometries to WGS84 for web rendering with custom styling by geometry type, hover tooltips, and bounding-box zoom (`fitBounds`).
- **Multi-Cartography Basemaps**: Dark Matter, Positron Light, OpenStreetMap, and Esri Satellite World Imagery.
- **Dynamic UTM Engine**: Computes dataset centroid and projects into the exact UTM Zone ($1..60\text{N/S}$) or Equal-Area projections for broad spans.
- **Multi-Unit Conversions**: Real-time conversions to hectares, square kilometers, acres, kilometers, feet, and miles.
- **Multi-Format Export**: Full JSON, tabular CSV, and RFC 7946 GeoJSON export endpoints.
- **Built-in Sample Benchmarks**: One-click loaders for Agricultural Survey (`.kml`) and Cadastral Land Parcels (`.zip` Shapefile).
- **Docker & Compose**: Production containerization with system GDAL/PROJ dependencies.

---

## 3. Architecture

```
                                  [ Client Browser ]
                                          |
                                   HTTP / REST API
                                          |
                        +-----------------+-----------------+
                        |                                   |
                        v                                   v
             [ React + Vite Frontend ]             [ FastAPI REST API ]
             - Leaflet Interactive Map             - Port 8001
             - Tabular Numeral Grids               - Swagger /docs
             - Metric / Imperial Toggle            - OpenAPI 3.1
                        |                                   |
                        +-----------------+-----------------+
                                          |
                                          v
                              [ GeoMeasure Pipeline ]
                                          |
                 +------------------------+------------------------+
                 |                        |                        |
                 v                        v                        v
        [ File Validation ]      [ Archive Security ]     [ GeoPandas Reader ]
        - Extension Filter       - Zip Slip Prevention    - Pyogrio / Fiona
        - 50MB Size Cap          - Header CRC Check       - KML / Shapefile
                 |                        |                        |
                 +------------------------+------------------------+
                                          |
                                          v
                              [ CRS Geodesy Service ]
                              - Detect Source CRS (e.g. EPSG:4326)
                              - Compute Dataset Centroid (lat, lon)
                              - Select Metric UTM Zone (EPSG:32601..32760)
                                          |
                                          v
                            [ Measurement Engine (Shapely) ]
                            - Reproject to UTM Metric CRS
                            - Polygon Area (m² -> ha, km², ac)
                            - LineString Length (m -> km, ft, mi)
                            - Point Handling (N/A)
                                          |
                                          v
                            [ SQLite / PostGIS Storage ]
                            - File Records & Feature Entities
                            - JSON / CSV / GeoJSON Exporters
```

---

## 4. Processing Flow

```
1. Upload & Intake
   Client sends POST /api/files/ with multipart file payload.
   
2. Security & Header Validation
   - Verifies extension is in { .kml, .zip }.
   - Verifies file size <= 50 MB.
   - For ZIP: inspects archive members for path traversal ("../") and verifies .shp presence.

3. Spatial Extraction
   GeoPandas loads geometries into a GeoDataFrame using native GDAL drivers.

4. Geodetic Analysis & CRS Detection
   - Source CRS identified. If missing (common in legacy KML), defaults to EPSG:4326 per OGC standard.
   - Evaluates whether CRS is geographic (degrees) or projected (linear meters).

5. Dynamic Projection Selection
   - For geographic datasets: calculates centroid longitude and latitude.
   - Determines UTM Zone: zone = int((lon + 180) / 6) + 1.
   - Determines hemisphere: EPSG:32600 + zone (North) or EPSG:32700 + zone (South).
   - For broad regional spans (> 6° longitude), selects Equal Earth / Cylindrical Equal Area (EPSG:6933).

6. Reprojection & Metric Measurement
   - PyProj transforms coordinates from angular degrees to projected meters.
   - Shapely computes Euclidean polygon area ($m^2$) and linestring length ($m$).
   - Unit conversion matrices calculate display units.

7. Persistence & Visualization
   - Features, properties, and measurements persisted to database.
   - Geometries reprojected to EPSG:4326 for Leaflet map display.
   - Returns unique file ID and full processing summary.
```

---

## 5. CRS Strategy & Geodetic Rigor

### Why Geographic Coordinates Cannot Calculate Metric Measurements
In an unprojected geographic coordinate system (e.g., `EPSG:4326` / WGS 84):
- Coordinates are expressed as angles on an ellipsoid: $\text{longitude } \lambda \in [-180^\circ, 180^\circ]$ and $\text{latitude } \phi \in [-90^\circ, 90^\circ]$.
- 1 degree of longitude at the Equator is $\approx 111.32\text{ km}$.
- At $60^\circ\text{ N}$ latitude, 1 degree of longitude contracts to $\approx 55.66\text{ km}$ ($\cos(60^\circ) = 0.5$).
- At the poles ($90^\circ$), 1 degree of longitude converges to $0\text{ km}$.

If an algorithm runs `geom.area` on unprojected degrees, it computes **square degrees** ($\text{deg}^2$). Converting square degrees to square meters using a flat scalar factor produces errors exceeding $50\text{--}80\%$ depending on latitude!

### GeoMeasure's Projection Selection Algorithm
```python
def select_measurement_crs(gdf):
    if gdf.crs.is_projected and "metre" in gdf.crs.axis_info[0].unit_name:
        return gdf.crs  # Retain existing local survey projection
        
    bounds = gdf.to_crs("EPSG:4326").total_bounds
    centroid_lon = (bounds[0] + bounds[2]) / 2.0
    centroid_lat = (bounds[1] + bounds[3]) / 2.0
    lon_span = abs(bounds[2] - bounds[0])
    
    if lon_span > 6.0:
        return "EPSG:6933"  # World Cylindrical Equal Area for multi-zone extent
        
    # Local survey extent -> Calculate exact UTM Zone
    zone = int((centroid_lon + 180.0) / 6.0) + 1
    epsg = 32600 + zone if centroid_lat >= 0 else 32700 + zone
    return f"EPSG:{epsg}"
```

---

## 6. API Documentation

Interactive Swagger documentation is available at `/docs` (or `/redoc`).

### Endpoints Overview

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/files/` | Upload and process `.kml` or `.zip` Shapefile |
| `POST` | `/api/files/sample/{type}` | Load built-in sample (`kml` or `shapefile`) |
| `GET` | `/api/files/` | List recently processed files |
| `GET` | `/api/files/{id}/` | Get file metadata and processing status |
| `GET` | `/api/files/{id}/measurements/` | Get summary and feature-level measurements |
| `GET` | `/api/files/{id}/features/` | Get paginated features and GeoJSON geometries |
| `GET` | `/api/files/{id}/map/` | Get Leaflet-optimized GeoJSON and bounding box |
| `GET` | `/api/files/{id}/export?format=` | Export analysis as `json`, `csv`, or `geojson` |
| `DELETE` | `/api/files/{id}/` | Delete file record and clean stored data |
| `GET` | `/api/health` | Service health and GDAL/PROJ versions |

### Example Request: Upload File
```bash
curl -X POST "http://localhost:8001/api/files/" \
  -F "file=@survey_parcels.kml"
```

### Example Response
```json
{
  "id": "e4c5b6a78901",
  "filename": "survey_parcels.kml",
  "status": "COMPLETED",
  "feature_count": 6,
  "crs": "EPSG:4326",
  "measurement_crs": "EPSG:32643",
  "created_at": "2026-10-08T09:00:00Z",
  "processing_time_ms": 142
}
```

### Example Request: Get Measurements
```bash
curl "http://localhost:8001/api/files/e4c5b6a78901/measurements/"
```

### Example Response
```json
{
  "file_id": "e4c5b6a78901",
  "filename": "survey_parcels.kml",
  "summary": {
    "total_features": 6,
    "polygon_count": 2,
    "linestring_count": 2,
    "point_count": 2,
    "total_area_m2": 310540.25,
    "total_area_ha": 31.054,
    "total_area_km2": 0.3105,
    "total_area_acres": 76.736,
    "total_length_m": 4820.50,
    "total_length_km": 4.821,
    "total_length_miles": 2.995,
    "total_length_ft": 15815.29,
    "source_crs": "EPSG:4326",
    "measurement_crs": "EPSG:32643",
    "measurement_units": "meters"
  },
  "features": [
    {
      "feature_id": 0,
      "geometry_type": "Polygon",
      "name": "North Orchard Field",
      "measurement": {
        "type": "AREA",
        "value": 310540.25,
        "unit": "m²",
        "formatted": "31.05 ha",
        "conversions": {
          "m2": { "unit": "m²", "value": 310540.25, "formatted": "310,540.25 m²" },
          "ha": { "unit": "ha", "value": 31.054, "formatted": "31.0540 ha" },
          "acres": { "unit": "ac", "value": 76.736, "formatted": "76.74 ac" }
        }
      },
      "measurement_status": "COMPLETED"
    },
    {
      "feature_id": 2,
      "geometry_type": "LineString",
      "name": "Main Irrigation Canal",
      "measurement": {
        "type": "LENGTH",
        "value": 4820.5,
        "unit": "m",
        "formatted": "4.82 km",
        "conversions": {
          "m": { "unit": "m", "value": 4820.5, "formatted": "4,820.50 m" },
          "km": { "unit": "km", "value": 4.821, "formatted": "4.821 km" },
          "miles": { "unit": "mi", "value": 2.995, "formatted": "2.995 mi" }
        }
      },
      "measurement_status": "COMPLETED"
    },
    {
      "feature_id": 4,
      "geometry_type": "Point",
      "name": "Meteorological Station A1",
      "measurement": null,
      "measurement_status": "NOT_APPLICABLE"
    }
  ]
}
```

---

## 7. Setup & Local Execution

### Option A: Local Python & Node Environment

#### 1. System Requirements
- Python 3.11+
- Node.js 18+
- GDAL libraries (`apt-get install -y gdal-bin libgdal-dev libproj-dev libgeos-dev`)

#### 2. Install Python Dependencies
```bash
pip install fastapi uvicorn pydantic geopandas shapely pyproj fiona python-multipart sqlalchemy pytest httpx
```

#### 3. Install Frontend Dependencies
```bash
npm install
```

#### 4. Run Development Server
```bash
npm run dev
```
- Frontend UI opens at `http://localhost:3000`
- FastAPI server runs on `http://127.0.0.1:8001`
- Swagger UI available at `http://localhost:3000/docs` (or `http://localhost:8001/docs`)

---

### Option B: Docker & Docker Compose

#### 1. Build and Run via Docker Compose
```bash
docker compose up --build
```

#### 2. Access Services
- API and Swagger Documentation: `http://localhost:8001/docs`
- Health check: `http://localhost:8001/api/health`

---

## 8. Running the Test Suite

Execute the comprehensive automated test suite:

```bash
pytest tests/ -v
```

### Test Suite Coverage (24 Tests)
- `tests/test_upload.py`: Health check, valid KML upload, valid Shapefile ZIP upload, sample loaders, file listing.
- `tests/test_validation.py`: Extension rejection, empty file, corrupted ZIP, ZIP without Shapefile, 404 handling, deletion.
- `tests/test_crs.py`: UTM zone calculation across hemispheres, geographic EPSG:4326 detection, already projected CRS preservation, non-degree measurement assertion.
- `tests/test_measurements.py`: Point exclusion, LineString length calculation, Polygon area calculation, unsupported geometry resilience, measurements API schema validation.
- `tests/test_export.py`: Map bounds and GeoJSON, JSON export, CSV export, GeoJSON export.

---

## 9. Design Decisions & Trade-Offs

| Component | Choice | Rationale |
| :--- | :--- | :--- |
| **Backend Framework** | **FastAPI** | Selected per assignment specification. Offers native asynchronous I/O, automatic OpenAPI documentation, high performance with Uvicorn, and type safety with Pydantic. |
| **Geospatial Engine** | **GeoPandas + Pyogrio** | Industry standard for vector processing. Pyogrio driver delivers C-level GDAL read speeds and natively supports both KML and ESRI Shapefiles. |
| **Coordinate Transformation** | **PyProj** | Direct binding to the PROJ geodetic library. Accurately performs datum transforms, ellipsoid calculations, and UTM zone conversions. |
| **Geometry Representation** | **Shapely** | Provides GEOS-backed computational geometry algorithms for topological validation, repairing (`make_valid`), and Euclidean metric calculations. |
| **Frontend Map** | **Leaflet** | Lightweight, high-performance web mapping library. Perfectly displays GeoJSON layers without requiring external proprietary API keys. |
| **Storage Architecture** | **SQLAlchemy** | Provides an abstraction layer for database persistence. Defaults to zero-config SQLite locally, but seamlessly points to PostgreSQL/PostGIS in production via `DATABASE_URL`. |

---

## 10. Learnings

- **Geodetic Precision**: Implementing automated CRS selection highlighted the critical necessity of reprojection. Many GIS tools silently perform planar math on lat/long degrees, yielding misleading results. Building a dynamic UTM Zone selector demonstrated the mathematical elegance of transverse mercator projections.
- **ESRI Shapefile Quirks**: An ESRI Shapefile strictly permits only a single geometry type per `.shp` layer (e.g. only Polygons, or only LineStrings), whereas KML allows mixed Placemark collections. Building robust ingestion meant handling single-layer Shapefile conventions alongside heterogeneous KML folders.
- **Archive Security**: Decompressing user-supplied ZIP files poses significant path traversal risks (Zip Slip). Enforcing canonical path resolution ensures zero arbitrary file writes.

---

## 11. Future Scope

1. **Cloud Object Storage**: S3 / Google Cloud Storage adapter for multi-gigabyte vector files.
2. **Asynchronous Background Workers**: Celery / Redis queue integration for background chunked processing of massive national shapefile datasets.
3. **Advanced Spatial Analytics**: Buffer generation, intersection overlays, centroid calculations, and convex hulls.
4. **Cloud-Optimized Formats**: Support for FlatGeobuf, GeoParquet, and Geopackage (`.gpkg`).
5. **Multi-User RBAC & Workspaces**: Team sharing and audit logs for land surveying enterprises.
