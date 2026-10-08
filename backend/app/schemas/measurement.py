from typing import Optional, Dict, List
from pydantic import BaseModel, Field

class ConvertedUnit(BaseModel):
    unit: str
    value: float
    formatted: str

class MeasurementDetail(BaseModel):
    type: str = Field(..., description="Measurement type: AREA, LENGTH, or None")
    value: float = Field(..., description="Canonical value in metric units (m² for area, m for length)")
    unit: str = Field(..., description="Primary unit: m² or m")
    formatted: str = Field(..., description="Human-readable formatted string")
    conversions: Optional[Dict[str, ConvertedUnit]] = Field(default=None, description="Converted values in alternative units")

class MeasurementSummary(BaseModel):
    total_features: int
    polygon_count: int
    linestring_count: int
    point_count: int
    other_count: int
    total_area_m2: float
    total_area_ha: float
    total_area_km2: float
    total_area_acres: float
    total_length_m: float
    total_length_km: float
    total_length_miles: float
    total_length_ft: float
    measurement_crs: str
    source_crs: str
    measurement_units: str

class FeatureMeasurementItem(BaseModel):
    feature_id: int
    geometry_type: str
    name: Optional[str] = None
    measurement: Optional[MeasurementDetail] = None
    measurement_status: str = Field("COMPLETED", description="COMPLETED, NOT_APPLICABLE, or UNSUPPORTED")

class FileMeasurementsResponse(BaseModel):
    file_id: str
    filename: str
    summary: MeasurementSummary
    features: List[FeatureMeasurementItem]
