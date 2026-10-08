import os
import time
import uuid
from typing import Dict, Any, Tuple
from fastapi import UploadFile
from sqlalchemy.orm import Session

from backend.app.config import settings
from backend.app.core.exceptions import (
    FileNotFoundException,
    GeospatialProcessingException
)
from backend.app.core.logging import logger
from backend.app.models.file import FileRecord
from backend.app.models.feature import FeatureRecord
from backend.app.repositories.file_repository import FileRepository
from backend.app.services.geospatial_service import GeospatialService
from backend.app.utils.file_validation import validate_uploaded_file, validate_file_content
from backend.app.utils.archive_utils import safe_extract_zip, find_shapefile_in_directory

class FileService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = FileRepository(db)

    async def handle_upload(self, upload_file: UploadFile) -> FileRecord:
        """
        Handle upload, validate content, persist initial record,
        execute geospatial processing pipeline, and store results.
        """
        start_time = time.time()
        
        # 1. Validate name & extension
        clean_filename = validate_uploaded_file(upload_file)
        file_id = uuid.uuid4().hex[:12]
        _, ext = os.path.splitext(clean_filename.lower())
        file_type = "kml" if ext == ".kml" else "shapefile"
        
        # 2. Read bytes & validate headers / size
        content = await upload_file.read()
        validate_file_content(content, clean_filename)
        
        file_size = len(content)
        logger.info(f"Received upload: '{clean_filename}' ({file_size} bytes, type: {file_type})")

        # 3. Save raw file to storage
        upload_subfolder = os.path.join(settings.UPLOAD_DIR, file_id)
        os.makedirs(upload_subfolder, exist_ok=True)
        stored_file_path = os.path.join(upload_subfolder, clean_filename)
        
        with open(stored_file_path, "wb") as f:
            f.write(content)

        # 4. Create initial processing record
        record = FileRecord(
            id=file_id,
            filename=clean_filename,
            stored_path=stored_file_path,
            file_type=file_type,
            file_size_bytes=file_size,
            status="PROCESSING"
        )
        self.repo.create_file(record)

        # 5. Extract if zip/shapefile
        primary_data_path = stored_file_path
        if file_type == "shapefile":
            extract_folder = os.path.join(upload_subfolder, "extracted")
            os.makedirs(extract_folder, exist_ok=True)
            safe_extract_zip(stored_file_path, extract_folder)
            primary_shp_path, missing_files = find_shapefile_in_directory(extract_folder)
            primary_data_path = primary_shp_path

        # 6. Execute geospatial processing
        try:
            results = GeospatialService.process_file_data(primary_data_path, file_type)
            
            # Store features in database
            features_to_save = []
            for f in results["features"]:
                m = f["measurement"]
                features_to_save.append(FeatureRecord(
                    file_id=file_id,
                    feature_index=f["feature_index"],
                    geometry_type=f["geometry_type"],
                    geometry_geojson=f["geometry"],
                    properties=f["properties"],
                    measurement_type=m.type if m else None,
                    measurement_value=m.value if m else None,
                    measurement_unit=m.unit if m else None,
                    measurement_formatted=m.formatted if m else None,
                    measurement_status=f["measurement_status"],
                    measurement_conversions={k: v.model_dump() for k, v in m.conversions.items()} if m and m.conversions else {}
                ))
            self.repo.save_features(features_to_save)

            # Update file record
            duration_ms = int((time.time() - start_time) * 1000)
            record.status = "COMPLETED"
            record.feature_count = len(features_to_save)
            record.source_crs = results["source_crs"]
            record.measurement_crs = results["measurement_crs"]
            record.measurement_units = results["measurement_units"]
            record.crs_strategy = results["crs_strategy"]
            record.geometry_types = results["geometry_types"]
            record.summary_data = {
                **results["summary"],
                "bounds": results["bounds"],
                "center": results["center"]
            }
            record.processing_time_ms = duration_ms
            self.repo.update_file(record)
            
            logger.info(f"Successfully processed {clean_filename} in {duration_ms}ms ({record.feature_count} features).")
            return record

        except Exception as e:
            record.status = "FAILED"
            record.error_message = str(e)
            record.processing_time_ms = int((time.time() - start_time) * 1000)
            self.repo.update_file(record)
            logger.error(f"Processing failed for {clean_filename}: {e}")
            raise

    def get_file_info(self, file_id: str) -> FileRecord:
        rec = self.repo.get_file_by_id(file_id)
        if not rec:
            raise FileNotFoundException(file_id)
        return rec

    def get_file_measurements(self, file_id: str) -> Tuple[FileRecord, list]:
        rec = self.get_file_info(file_id)
        features = self.repo.get_features_by_file_id(file_id)
        return rec, features

    def list_files(self, limit: int = 50) -> list:
        return self.repo.list_files(limit=limit)

    def delete_file(self, file_id: str) -> bool:
        rec = self.get_file_info(file_id)
        # Clean up files on disk
        folder = os.path.dirname(rec.stored_path)
        if os.path.exists(folder):
            import shutil
            shutil.rmtree(folder, ignore_errors=True)
        return self.repo.delete_file(file_id)
