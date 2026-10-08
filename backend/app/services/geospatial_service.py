import json
import numpy as np
import pandas as pd
import geopandas as gpd
import shapely
from shapely.geometry import mapping
from shapely.validation import make_valid
from typing import Dict, Any, List, Tuple

from backend.app.services.crs_service import CRSService
from backend.app.services.measurement_service import MeasurementService
from backend.app.utils.unit_conversion import convert_area, convert_length
from backend.app.core.exceptions import GeospatialProcessingException
from backend.app.core.logging import logger

def sanitize_property_value(val: Any) -> Any:
    """Convert numpy, pandas, and timestamps into JSON-serializable Python primitives."""
    if val is None or pd.isna(val):
        return None
    if isinstance(val, (np.integer, int)):
        return int(val)
    if isinstance(val, (np.floating, float)):
        if np.isnan(val) or np.isinf(val):
            return None
        return float(val)
    if isinstance(val, (np.bool_, bool)):
        return bool(val)
    if isinstance(val, (pd.Timestamp, np.datetime64)):
        return str(val)
    return str(val)

def sanitize_properties(props: Dict[str, Any]) -> Dict[str, Any]:
    """Sanitize all properties in a feature dictionary."""
    clean = {}
    for k, v in props.items():
        if k in ("geometry", "geometry_proj"):
            continue
        clean[str(k)] = sanitize_property_value(v)
    return clean

class GeospatialService:
    """
    Coordinates reading geospatial data, CRS analysis, geometry validation & repair,
    projected transformation, and feature measurement extraction.
    """

    @classmethod
    def load_geodataframe(cls, file_path: str, file_type: str) -> gpd.GeoDataFrame:
        """
        Loads geospatial file into a GeoDataFrame using GeoPandas / Pyogrio.
        """
        try:
            logger.info(f"Loading {file_type} from {file_path}")
            if file_type == "kml":
                # Pyogrio supports KML reading
                try:
                    gdf = gpd.read_file(file_path, driver="KML")
                except Exception as kml_err:
                    logger.warning(f"Driver 'KML' read failed: {kml_err}. Trying standard read_file...")
                    gdf = gpd.read_file(file_path)
            else:
                gdf = gpd.read_file(file_path)
                
            if gdf is None or len(gdf) == 0:
                raise GeospatialProcessingException(f"The file was successfully read but contains 0 geospatial features.")
                
            return gdf
        except GeospatialProcessingException:
            raise
        except Exception as e:
            logger.error(f"Failed to load geospatial data from {file_path}: {e}")
            raise GeospatialProcessingException(
                message=f"Failed to parse geospatial data: {str(e)}",
                details={"file_path": file_path, "file_type": file_type}
            )

    @classmethod
    def process_file_data(cls, file_path: str, file_type: str) -> Dict[str, Any]:
        """
        Executes the end-to-end geospatial processing pipeline:
        1. Read file
        2. Detect and normalize source CRS
        3. Repair invalid geometries
        4. Select optimal projected measurement CRS
        5. Reproject geometries to measurement CRS
        6. Calculate area / length measurements
        7. Reproject to WGS84 (EPSG:4326) for Leaflet mapping & GeoJSON output
        8. Aggregate summary metrics
        """
        # Step 1: Read GeoDataFrame
        gdf = cls.load_geodataframe(file_path, file_type)
        
        # Step 2: Detect & Normalize Source CRS
        gdf, source_crs_str = CRSService.detect_and_normalize_source_crs(gdf, file_type)
        logger.info(f"Detected Source CRS: {source_crs_str}")

        # Step 3: Geometry validation & repair
        repaired_geoms = []
        for g in gdf.geometry:
            if g is None or g.is_empty:
                repaired_geoms.append(None)
            else:
                try:
                    if not g.is_valid:
                        logger.info(f"Repairing invalid geometry using make_valid...")
                        g_repaired = make_valid(g)
                        repaired_geoms.append(g_repaired)
                    else:
                        repaired_geoms.append(g)
                except Exception as val_err:
                    logger.warning(f"Error repairing geometry: {val_err}. Keeping original.")
                    repaired_geoms.append(g)
        gdf["geometry"] = repaired_geoms

        # Step 4: Determine projected CRS for measurement
        crs_info = CRSService.select_measurement_crs(gdf)
        measurement_crs = crs_info["measurement_crs"]
        measurement_units = crs_info["units"]
        crs_strategy = crs_info["strategy"]
        logger.info(f"Selected Measurement CRS: {measurement_crs} (Strategy: {crs_strategy})")

        # Step 5: Reproject to measurement CRS for calculation
        try:
            gdf_proj = gdf.to_crs(measurement_crs)
        except Exception as proj_err:
            logger.error(f"Reprojection to {measurement_crs} failed: {proj_err}. Falling back to EPSG:3857.")
            measurement_crs = "EPSG:3857"
            gdf_proj = gdf.to_crs(measurement_crs)

        # Step 6: Reproject to WGS84 for GeoJSON mapping in Leaflet
        try:
            if str(gdf.crs) == "EPSG:4326":
                gdf_wgs84 = gdf
            else:
                gdf_wgs84 = gdf.to_crs("EPSG:4326")
        except Exception as wgs_err:
            logger.warning(f"Reprojection to WGS84 for map display failed: {wgs_err}")
            gdf_wgs84 = gdf

        # Step 7: Feature extraction & measurements
        features = []
        geometry_counts = {"Polygon": 0, "LineString": 0, "Point": 0, "MultiPolygon": 0, "MultiLineString": 0, "MultiPoint": 0, "Other": 0}
        total_area_m2 = 0.0
        total_length_m = 0.0

        for idx in range(len(gdf)):
            geom_proj = gdf_proj.geometry.iloc[idx]
            geom_wgs = gdf_wgs84.geometry.iloc[idx]
            
            raw_props = gdf.iloc[idx].to_dict()
            clean_props = sanitize_properties(raw_props)

            if geom_wgs is not None and not geom_wgs.is_empty:
                geom_type = geom_wgs.geom_type
                geojson_geom = mapping(geom_wgs)
            else:
                geom_type = "None"
                geojson_geom = {"type": "GeometryCollection", "geometries": []}

            # Update geometry counts
            if geom_type in geometry_counts:
                geometry_counts[geom_type] += 1
            else:
                geometry_counts["Other"] += 1

            # Calculate measurement on projected geometry
            meas_detail, meas_status = MeasurementService.calculate_feature_measurement(geom_proj)

            if meas_detail is not None:
                if meas_detail.type == "AREA":
                    total_area_m2 += meas_detail.value
                elif meas_detail.type == "LENGTH":
                    total_length_m += meas_detail.value

            features.append({
                "feature_index": idx,
                "geometry_type": geom_type,
                "geometry": geojson_geom,
                "properties": clean_props,
                "measurement": meas_detail,
                "measurement_status": meas_status
            })

        # Calculate bounding box in WGS84 for Leaflet fitBounds
        bounds = [[-90.0, -180.0], [90.0, 180.0]]
        center = [0.0, 0.0]
        try:
            valid_wgs_geoms = gdf_wgs84.geometry.dropna()
            if not valid_wgs_geoms.empty:
                minx, miny, maxx, maxy = valid_wgs_geoms.total_bounds
                # Leaflet uses [[south, west], [north, east]] -> [[min_lat, min_lng], [max_lat, max_lng]]
                bounds = [[float(miny), float(minx)], [float(maxy), float(maxx)]]
                center = [float((miny + maxy) / 2.0), float((minx + maxx) / 2.0)]
        except Exception as b_err:
            logger.warning(f"Could not calculate bounding box: {b_err}")

        # Conversions for totals
        area_conversions = convert_area(total_area_m2)
        length_conversions = convert_length(total_length_m)

        summary = {
            "total_features": len(features),
            "polygon_count": geometry_counts.get("Polygon", 0) + geometry_counts.get("MultiPolygon", 0),
            "linestring_count": geometry_counts.get("LineString", 0) + geometry_counts.get("MultiLineString", 0),
            "point_count": geometry_counts.get("Point", 0) + geometry_counts.get("MultiPoint", 0),
            "other_count": geometry_counts.get("Other", 0),
            "total_area_m2": round(total_area_m2, 2),
            "total_area_ha": area_conversions["ha"].value,
            "total_area_km2": area_conversions["km2"].value,
            "total_area_acres": area_conversions["acres"].value,
            "total_length_m": round(total_length_m, 2),
            "total_length_km": length_conversions["km"].value,
            "total_length_miles": length_conversions["mi"].value,
            "total_length_ft": length_conversions["ft"].value,
            "source_crs": source_crs_str,
            "measurement_crs": measurement_crs,
            "measurement_units": measurement_units,
            "crs_strategy": crs_strategy
        }

        return {
            "features": features,
            "summary": summary,
            "bounds": bounds,
            "center": center,
            "source_crs": source_crs_str,
            "measurement_crs": measurement_crs,
            "measurement_units": measurement_units,
            "crs_strategy": crs_strategy,
            "geometry_types": geometry_counts
        }
