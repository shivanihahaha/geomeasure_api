import os
from typing import Optional, List
from fastapi import APIRouter, Depends, UploadFile, File, Query, Response, status
from sqlalchemy.orm import Session

from backend.app.repositories.database import get_db
from backend.app.services.file_service import FileService
from backend.app.services.export_service import ExportService
from backend.app.schemas.file import (
    FileUploadResponse,
    FileInfoResponse,
    FileListResponse,
    FileListItem
)
from backend.app.schemas.feature import (
    FeatureItem,
    GeoJSONGeometry,
    MapResponse,
    GeoJSONFeatureCollection,
    GeoJSONFeature
)
from backend.app.schemas.measurement import MeasurementDetail
from backend.app.core.exceptions import GeoMeasureException

router = APIRouter(prefix="/files", tags=["Files"])

@router.post("/", response_model=FileUploadResponse, status_code=status.HTTP_201_CREATED, summary="Upload & Process Geospatial File")
async def upload_file(
    file: UploadFile = File(..., description="Geospatial file (.kml or .zip Shapefile)"),
    db: Session = Depends(get_db)
):
    """
    Upload and process a geospatial file (.kml or .zip containing a Shapefile).
    Extracts features, identifies geometries, detects CRS, selects appropriate projected CRS,
    calculates measurements (Polygon area, LineString length), and returns processing summary.
    """
    file_service = FileService(db)
    record = await file_service.handle_upload(file)

    return FileUploadResponse(
        id=record.id,
        filename=record.filename,
        status=record.status,
        feature_count=record.feature_count,
        crs=record.source_crs,
        measurement_crs=record.measurement_crs,
        created_at=record.created_at.isoformat() if record.created_at else "",
        processing_time_ms=record.processing_time_ms
    )

@router.post("/sample/{sample_type}", response_model=FileUploadResponse, status_code=status.HTTP_201_CREATED, summary="Load Built-in Sample Dataset")
async def load_sample_file(
    sample_type: str,
    db: Session = Depends(get_db)
):
    """
    Instantly processes and loads a pre-configured realistic sample dataset:
    - 'kml': Agricultural Zones & Irrigation Infrastructure survey (.kml)
    - 'shapefile': Cadastral Land Parcels shapefile package (.zip)
    """
    import io
    from backend.app.config import settings
    from fastapi import HTTPException
    
    if sample_type == "kml":
        filename = "agricultural_zones_survey.kml"
        sample_path = os.path.join(settings.SAMPLES_DIR, filename)
    elif sample_type in ("shapefile", "shp", "zip"):
        filename = "cadastral_parcels_shapefile.zip"
        sample_path = os.path.join(settings.SAMPLES_DIR, filename)
    else:
        raise HTTPException(status_code=400, detail="Invalid sample type. Allowed: 'kml' or 'shapefile'")
        
    if not os.path.exists(sample_path):
        raise HTTPException(status_code=404, detail=f"Sample file '{filename}' not found.")
        
    with open(sample_path, "rb") as f:
        file_bytes = f.read()
        
    upload_file = UploadFile(
        file=io.BytesIO(file_bytes),
        filename=filename,
        headers={"content-type": "application/octet-stream"}
    )
    
    file_service = FileService(db)
    record = await file_service.handle_upload(upload_file)
    
    return FileUploadResponse(
        id=record.id,
        filename=record.filename,
        status=record.status,
        feature_count=record.feature_count,
        crs=record.source_crs,
        measurement_crs=record.measurement_crs,
        created_at=record.created_at.isoformat() if record.created_at else "",
        processing_time_ms=record.processing_time_ms
    )

@router.get("/", response_model=FileListResponse, summary="List Processed Files")
def list_files(
    limit: int = Query(50, ge=1, le=200, description="Max files to return"),
    db: Session = Depends(get_db)
):
    """Returns a list of recently uploaded and processed geospatial files."""
    file_service = FileService(db)
    records = file_service.list_files(limit=limit)

    items = [
        FileListItem(
            id=r.id,
            filename=r.filename,
            feature_count=r.feature_count,
            crs=r.source_crs,
            measurement_crs=r.measurement_crs,
            status=r.status,
            geometry_types=r.geometry_types or {},
            created_at=r.created_at.isoformat() if r.created_at else "",
            processing_time_ms=r.processing_time_ms,
            file_size_bytes=r.file_size_bytes
        )
        for r in records
    ]
    return FileListResponse(total=len(items), files=items)

@router.get("/{id}/", response_model=FileInfoResponse, summary="Get File Information")
def get_file_info(id: str, db: Session = Depends(get_db)):
    """Returns metadata and processing details for a specific uploaded file."""
    file_service = FileService(db)
    r = file_service.get_file_info(id)

    return FileInfoResponse(
        id=r.id,
        filename=r.filename,
        feature_count=r.feature_count,
        crs=r.source_crs,
        measurement_crs=r.measurement_crs,
        measurement_units=r.measurement_units,
        status=r.status,
        geometry_types=r.geometry_types or {},
        created_at=r.created_at.isoformat() if r.created_at else "",
        processing_time_ms=r.processing_time_ms,
        file_size_bytes=r.file_size_bytes,
        storage_path=r.stored_path
    )

@router.get("/{id}/features/", summary="Get Extracted Features")
def get_features(
    id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    """Returns extracted geospatial features including properties, geometry, and measurements."""
    file_service = FileService(db)
    file_record, features = file_service.get_file_measurements(id)

    paginated = features[skip: skip + limit]

    feature_list = []
    for f in paginated:
        m = None
        if f.measurement_type:
            m = MeasurementDetail(
                type=f.measurement_type,
                value=f.measurement_value,
                unit=f.measurement_unit or "",
                formatted=f.measurement_formatted or "",
                conversions=f.measurement_conversions
            )
        feature_list.append(FeatureItem(
            feature_id=f.feature_index,
            geometry_type=f.geometry_type,
            geometry=GeoJSONGeometry(**f.geometry_geojson),
            crs=file_record.source_crs,
            measurement_crs=file_record.measurement_crs,
            properties=f.properties or {},
            measurement=m,
            measurement_status=f.measurement_status
        ))

    return {
        "file_id": file_record.id,
        "filename": file_record.filename,
        "total_features": len(features),
        "skip": skip,
        "limit": limit,
        "features": feature_list
    }

@router.get("/{id}/map/", response_model=MapResponse, summary="Get Map-Ready GeoJSON and Bounds")
def get_map_data(id: str, db: Session = Depends(get_db)):
    """
    Returns map-optimized GeoJSON FeatureCollection reprojected in WGS84,
    along with dataset bounding box and center coordinate for Leaflet fitBounds.
    """
    file_service = FileService(db)
    file_record, features = file_service.get_file_measurements(id)

    summary_data = file_record.summary_data or {}
    bounds = summary_data.get("bounds", [[-90, -180], [90, 180]])
    center = summary_data.get("center", [0, 0])

    geojson_features = []
    for f in features:
        props = dict(f.properties or {})
        props["feature_id"] = f.feature_index
        props["geometry_type"] = f.geometry_type
        props["measurement_type"] = f.measurement_type
        props["measurement_value"] = f.measurement_value
        props["measurement_unit"] = f.measurement_unit
        props["measurement_formatted"] = f.measurement_formatted
        props["measurement_status"] = f.measurement_status
        props["source_crs"] = file_record.source_crs
        props["measurement_crs"] = file_record.measurement_crs

        geojson_features.append(GeoJSONFeature(
            type="Feature",
            id=f.feature_index,
            geometry=GeoJSONGeometry(**f.geometry_geojson),
            properties=props
        ))

    fc = GeoJSONFeatureCollection(
        type="FeatureCollection",
        features=geojson_features,
        crs_info={
            "source_crs": file_record.source_crs,
            "measurement_crs": file_record.measurement_crs
        }
    )

    return MapResponse(
        file_id=file_record.id,
        filename=file_record.filename,
        bounds=bounds,
        center=center,
        feature_count=len(features),
        geojson=fc,
        summary=summary_data
    )

@router.get("/{id}/export", summary="Export Geospatial Analysis")
def export_file(
    id: str,
    format: str = Query("json", pattern="^(json|csv|geojson)$", description="Export format: json, csv, or geojson"),
    db: Session = Depends(get_db)
):
    """
    Exports geospatial processing results in requested format:
    - json: Full nested JSON with measurements, summary, and properties.
    - csv: Tabular CSV with measurements and properties.
    - geojson: Standard RFC 7946 GeoJSON FeatureCollection.
    """
    file_service = FileService(db)
    file_record, features = file_service.get_file_measurements(id)

    filename_base = file_record.filename.rsplit(".", 1)[0]

    if format == "csv":
        csv_content = ExportService.export_as_csv(file_record, features)
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{filename_base}_measurements.csv"'}
        )
    elif format == "geojson":
        geojson_content = ExportService.export_as_geojson(file_record, features)
        return Response(
            content=geojson_content,
            media_type="application/geo+json",
            headers={"Content-Disposition": f'attachment; filename="{filename_base}.geojson"'}
        )
    else:
        json_content = ExportService.export_as_json(file_record, features)
        return Response(
            content=json_content,
            media_type="application/json",
            headers={"Content-Disposition": f'attachment; filename="{filename_base}_analysis.json"'}
        )

@router.delete("/{id}/", status_code=status.HTTP_200_OK, summary="Delete File Analysis")
def delete_file(id: str, db: Session = Depends(get_db)):
    """Deletes a file record and its extracted features."""
    file_service = FileService(db)
    file_service.delete_file(id)
    return {"message": f"File analysis '{id}' was successfully deleted.", "file_id": id}
