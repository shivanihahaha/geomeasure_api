from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from backend.app.schemas.measurement import MeasurementDetail

class GeoJSONGeometry(BaseModel):
    type: str
    coordinates: Any

class FeatureItem(BaseModel):
    feature_id: int
    geometry_type: str
    geometry: GeoJSONGeometry
    crs: str
    measurement_crs: str
    properties: Dict[str, Any]
    measurement: Optional[MeasurementDetail] = None
    measurement_status: str

class GeoJSONFeature(BaseModel):
    type: str = "Feature"
    id: Optional[int] = None
    geometry: GeoJSONGeometry
    properties: Dict[str, Any]

class GeoJSONFeatureCollection(BaseModel):
    type: str = "FeatureCollection"
    features: List[GeoJSONFeature]
    bbox: Optional[List[float]] = None
    crs_info: Optional[Dict[str, str]] = None

class MapResponse(BaseModel):
    file_id: str
    filename: str
    bounds: List[List[float]] = Field(..., description="Leaflet bounds format: [[min_lat, min_lng], [max_lat, max_lng]]")
    center: List[float] = Field(..., description="[lat, lng] center coordinate")
    feature_count: int
    geojson: GeoJSONFeatureCollection
    summary: Dict[str, Any]
