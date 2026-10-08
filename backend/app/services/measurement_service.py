from typing import Tuple, Optional, Dict, Any
from shapely.geometry.base import BaseGeometry
from shapely.geometry import (
    Point, MultiPoint,
    LineString, MultiLineString,
    Polygon, MultiPolygon,
    GeometryCollection
)
from backend.app.schemas.measurement import MeasurementDetail
from backend.app.utils.unit_conversion import convert_area, convert_length, format_number
from backend.app.core.logging import logger

class MeasurementService:
    """
    Dedicated service for calculating metric geospatial measurements
    from projected geometries and computing multi-unit representations.
    """

    @staticmethod
    def calculate_feature_measurement(geom: Optional[BaseGeometry]) -> Tuple[Optional[MeasurementDetail], str]:
        """
        Calculates measurement for a single projected geometry.
        Returns:
            (MeasurementDetail or None, status_string)
            status_string: 'COMPLETED', 'NOT_APPLICABLE', or 'UNSUPPORTED'
        """
        if geom is None or geom.is_empty:
            return None, "UNSUPPORTED"

        geom_type = geom.geom_type

        # 1. Polygon / MultiPolygon -> AREA
        if geom_type in ("Polygon", "MultiPolygon"):
            try:
                area_m2 = float(geom.area)
                conversions = convert_area(area_m2)
                
                # Human readable display
                if area_m2 >= 1_000_000:
                    formatted = f"{format_number(area_m2 / 1_000_000, 3)} km²"
                elif area_m2 >= 10_000:
                    formatted = f"{format_number(area_m2 / 10_000, 2)} ha"
                else:
                    formatted = f"{format_number(area_m2, 2)} m²"

                detail = MeasurementDetail(
                    type="AREA",
                    value=round(area_m2, 4),
                    unit="m²",
                    formatted=formatted,
                    conversions=conversions
                )
                return detail, "COMPLETED"
            except Exception as e:
                logger.error(f"Error calculating area for {geom_type}: {e}")
                return None, "UNSUPPORTED"

        # 2. LineString / MultiLineString -> LENGTH
        elif geom_type in ("LineString", "MultiLineString"):
            try:
                length_m = float(geom.length)
                conversions = convert_length(length_m)
                
                if length_m >= 1000:
                    formatted = f"{format_number(length_m / 1000, 2)} km"
                else:
                    formatted = f"{format_number(length_m, 2)} m"

                detail = MeasurementDetail(
                    type="LENGTH",
                    value=round(length_m, 4),
                    unit="m",
                    formatted=formatted,
                    conversions=conversions
                )
                return detail, "COMPLETED"
            except Exception as e:
                logger.error(f"Error calculating length for {geom_type}: {e}")
                return None, "UNSUPPORTED"

        # 3. Point / MultiPoint -> No measurement required
        elif geom_type in ("Point", "MultiPoint"):
            return None, "NOT_APPLICABLE"

        # 4. GeometryCollection or other -> Gracefully unsupported
        else:
            logger.info(f"Geometry type '{geom_type}' is not supported for measurement.")
            return None, "UNSUPPORTED"
