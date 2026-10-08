from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional

from backend.app.repositories.database import get_db
from backend.app.services.file_service import FileService
from backend.app.schemas.measurement import (
    FileMeasurementsResponse,
    MeasurementSummary,
    FeatureMeasurementItem,
    MeasurementDetail
)

router = APIRouter(prefix="/files", tags=["Measurements"])

@router.get("/{id}/measurements/", response_model=FileMeasurementsResponse, summary="Get File Measurements")
def get_measurements(id: str, db: Session = Depends(get_db)):
    """
    Returns both overall measurement summary (total area, total length, counts)
    and feature-level measurement results for the given file ID.
    """
    file_service = FileService(db)
    file_record, features = file_service.get_file_measurements(id)

    summary_data = file_record.summary_data or {}

    summary = MeasurementSummary(
        total_features=file_record.feature_count,
        polygon_count=summary_data.get("polygon_count", 0),
        linestring_count=summary_data.get("linestring_count", 0),
        point_count=summary_data.get("point_count", 0),
        other_count=summary_data.get("other_count", 0),
        total_area_m2=summary_data.get("total_area_m2", 0.0),
        total_area_ha=summary_data.get("total_area_ha", 0.0),
        total_area_km2=summary_data.get("total_area_km2", 0.0),
        total_area_acres=summary_data.get("total_area_acres", 0.0),
        total_length_m=summary_data.get("total_length_m", 0.0),
        total_length_km=summary_data.get("total_length_km", 0.0),
        total_length_miles=summary_data.get("total_length_miles", 0.0),
        total_length_ft=summary_data.get("total_length_ft", 0.0),
        measurement_crs=file_record.measurement_crs,
        source_crs=file_record.source_crs,
        measurement_units=file_record.measurement_units
    )

    feature_items = []
    for f in features:
        detail = None
        if f.measurement_type:
            detail = MeasurementDetail(
                type=f.measurement_type,
                value=f.measurement_value,
                unit=f.measurement_unit or "",
                formatted=f.measurement_formatted or "",
                conversions=f.measurement_conversions
            )
            
        feature_name = None
        if f.properties and isinstance(f.properties, dict):
            for candidate_key in ("name", "NAME", "Name", "label", "id", "title"):
                if candidate_key in f.properties and f.properties[candidate_key]:
                    feature_name = str(f.properties[candidate_key])
                    break

        feature_items.append(FeatureMeasurementItem(
            feature_id=f.feature_index,
            geometry_type=f.geometry_type,
            name=feature_name,
            measurement=detail,
            measurement_status=f.measurement_status
        ))

    return FileMeasurementsResponse(
        file_id=file_record.id,
        filename=file_record.filename,
        summary=summary,
        features=feature_items
    )
