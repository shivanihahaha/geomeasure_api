import math
from typing import Tuple, Dict, Any, Optional
import geopandas as gpd
from pyproj import CRS
from backend.app.core.logging import logger

class CRSService:
    """
    Dedicated service for Coordinate Reference System (CRS) detection,
    validation, and projected CRS selection for metric calculations.
    """

    @staticmethod
    def detect_and_normalize_source_crs(gdf: gpd.GeoDataFrame, file_type: str = "kml") -> Tuple[gpd.GeoDataFrame, str]:
        """
        Detect the source CRS of a GeoDataFrame.
        If missing:
        - For KML: OGC KML standard mandates EPSG:4326 (WGS84).
        - For Shapefile without .prj: Default to EPSG:4326 with warning.
        """
        if gdf.crs is None:
            default_epsg = "EPSG:4326"
            logger.warning(f"File ({file_type}) has no CRS defined. Defaulting to standard {default_epsg}.")
            gdf = gdf.set_crs(default_epsg)
            return gdf, f"{default_epsg} (Defaulted - missing metadata)"
        
        try:
            crs_obj = CRS.from_user_input(gdf.crs)
            auth_name = crs_obj.to_authority()
            if auth_name:
                source_str = f"{auth_name[0]}:{auth_name[1]}"
            else:
                source_str = crs_obj.to_string()
            return gdf, source_str
        except Exception as e:
            logger.warning(f"Failed to parse source CRS string: {e}. Falling back to str(gdf.crs).")
            return gdf, str(gdf.crs)

    @staticmethod
    def calculate_utm_epsg(lon: float, lat: float) -> Tuple[int, str]:
        """
        Calculate the standard EPSG code for the UTM zone covering (lon, lat).
        Zone is 1 to 60.
        EPSG 32601-32660 for Northern Hemisphere (lat >= 0).
        EPSG 32701-32760 for Southern Hemisphere (lat < 0).
        """
        # Clamp lon to -180 .. 180
        clamped_lon = max(-180.0, min(179.999999, lon))
        zone = int((clamped_lon + 180.0) / 6.0) + 1
        zone = max(1, min(60, zone))
        
        if lat >= 0:
            epsg = 32600 + zone
            name = f"WGS 84 / UTM zone {zone}N (EPSG:{epsg})"
        else:
            epsg = 32700 + zone
            name = f"WGS 84 / UTM zone {zone}S (EPSG:{epsg})"
            
        return epsg, name

    @classmethod
    def select_measurement_crs(cls, gdf: gpd.GeoDataFrame) -> Dict[str, Any]:
        """
        Select an optimal projected CRS for metric measurements (area in m², length in m).
        
        Strategy:
        1. If source CRS is already a projected CRS with metric units:
           - Retain source CRS for maximum local survey precision.
        2. If source CRS is geographic (e.g. EPSG:4326 in degrees):
           - Inspect dataset centroid and spatial bounding box.
           - If localized (< 6° longitude span, common for parcels, surveys, farm zones, municipal boundaries):
             Select exact UTM Zone based on dataset centroid.
           - If polar (|lat| > 80°):
             Select Universal Polar Stereographic (UPS North EPSG:32661 or UPS South EPSG:32761).
           - If broad / global extent (> 6° longitude span or spanning multiple UTM zones):
             Select World Cylindrical Equal Area (EPSG:6933) or Equal Earth (EPSG:8857) to ensure
             distortion-free area measurement across large spans.
        """
        if gdf.empty:
            return {
                "measurement_crs": "EPSG:3857",
                "epsg_code": 3857,
                "is_projected": True,
                "units": "meters",
                "strategy": "Empty dataset fallback"
            }

        source_crs_obj = None
        if gdf.crs is not None:
            try:
                source_crs_obj = CRS.from_user_input(gdf.crs)
            except Exception:
                pass

        # Check if source CRS is already projected
        if source_crs_obj and source_crs_obj.is_projected:
            axis_units = [axis.unit_name for axis in source_crs_obj.axis_info]
            primary_unit = axis_units[0].lower() if axis_units else "metre"
            
            if "metre" in primary_unit or "meter" in primary_unit:
                auth = source_crs_obj.to_authority()
                auth_str = f"{auth[0]}:{auth[1]}" if auth else source_crs_obj.to_string()
                return {
                    "measurement_crs": auth_str,
                    "epsg_code": source_crs_obj.to_epsg(),
                    "is_projected": True,
                    "units": "meters",
                    "strategy": f"Preserved source projected CRS ({source_crs_obj.name}) with native metric units"
                }

        # Need to project from geographic coordinates (e.g. EPSG:4326)
        # Compute bounds in WGS84 for extent analysis
        gdf_wgs84 = gdf.to_crs("EPSG:4326") if gdf.crs and str(gdf.crs) != "EPSG:4326" else gdf
        
        # Filter valid geometries
        valid_geoms = gdf_wgs84.geometry.dropna()
        if valid_geoms.empty:
            return {
                "measurement_crs": "EPSG:3857",
                "epsg_code": 3857,
                "is_projected": True,
                "units": "meters",
                "strategy": "Fallback"
            }

        total_bounds = valid_geoms.total_bounds  # [minx, miny, maxx, maxy]
        min_lon, min_lat, max_lon, max_lat = total_bounds
        centroid_lon = (min_lon + max_lon) / 2.0
        centroid_lat = (min_lat + max_lat) / 2.0
        lon_span = abs(max_lon - min_lon)
        lat_span = abs(max_lat - min_lat)

        # Polar datasets
        if centroid_lat > 80.0:
            return {
                "measurement_crs": "EPSG:32661",
                "epsg_code": 32661,
                "is_projected": True,
                "units": "meters",
                "strategy": "UPS North (Universal Polar Stereographic) for Arctic extent"
            }
        elif centroid_lat < -80.0:
            return {
                "measurement_crs": "EPSG:32761",
                "epsg_code": 32761,
                "is_projected": True,
                "units": "meters",
                "strategy": "UPS South (Universal Polar Stereographic) for Antarctic extent"
            }

        # Broad multi-zone or global extent (> 6 degrees longitude)
        if lon_span > 6.0:
            return {
                "measurement_crs": "EPSG:6933",
                "epsg_code": 6933,
                "is_projected": True,
                "units": "meters",
                "strategy": f"World Cylindrical Equal Area (EPSG:6933) chosen for broad regional extent spanning {lon_span:.2f}° longitude"
            }

        # Standard local / regional dataset -> exact UTM Zone
        utm_epsg, utm_name = cls.calculate_utm_epsg(centroid_lon, centroid_lat)
        return {
            "measurement_crs": f"EPSG:{utm_epsg}",
            "epsg_code": utm_epsg,
            "is_projected": True,
            "units": "meters",
            "strategy": f"Auto-selected {utm_name} based on dataset centroid ({centroid_lat:.4f}°N, {centroid_lon:.4f}°E)"
        }
