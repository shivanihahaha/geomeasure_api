import csv
import io
import json
from typing import List, Dict, Any
from backend.app.models.file import FileRecord
from backend.app.models.feature import FeatureRecord

class ExportService:
    @staticmethod
    def export_as_json(file_record: FileRecord, features: List[FeatureRecord]) -> str:
        """Export comprehensive measurement and feature record as JSON."""
        data = {
            "file_id": file_record.id,
            "filename": file_record.filename,
            "status": file_record.status,
            "feature_count": file_record.feature_count,
            "source_crs": file_record.source_crs,
            "measurement_crs": file_record.measurement_crs,
            "measurement_units": file_record.measurement_units,
            "crs_strategy": file_record.crs_strategy,
            "processing_time_ms": file_record.processing_time_ms,
            "created_at": file_record.created_at.isoformat() if file_record.created_at else None,
            "summary": file_record.summary_data,
            "features": [
                {
                    "feature_id": f.feature_index,
                    "geometry_type": f.geometry_type,
                    "measurement": {
                        "type": f.measurement_type,
                        "value": f.measurement_value,
                        "unit": f.measurement_unit,
                        "formatted": f.measurement_formatted,
                        "conversions": f.measurement_conversions
                    } if f.measurement_type else None,
                    "measurement_status": f.measurement_status,
                    "properties": f.properties,
                    "geometry": f.geometry_geojson
                }
                for f in features
            ]
        }
        return json.dumps(data, indent=2)

    @staticmethod
    def export_as_csv(file_record: FileRecord, features: List[FeatureRecord]) -> str:
        """Export tabular feature list as CSV with properties flattened."""
        output = io.StringIO()
        writer = csv.writer(output)

        # Header
        writer.writerow([
            "feature_id",
            "geometry_type",
            "measurement_type",
            "measurement_value",
            "measurement_unit",
            "measurement_formatted",
            "measurement_status",
            "source_crs",
            "measurement_crs",
            "properties_json"
        ])

        for f in features:
            writer.writerow([
                f.feature_index,
                f.geometry_type,
                f.measurement_type or "",
                f.measurement_value if f.measurement_value is not None else "",
                f.measurement_unit or "",
                f.measurement_formatted or "",
                f.measurement_status,
                file_record.source_crs,
                file_record.measurement_crs,
                json.dumps(f.properties) if f.properties else "{}"
            ])

        return output.getvalue()

    @staticmethod
    def export_as_geojson(file_record: FileRecord, features: List[FeatureRecord]) -> str:
        """Export as standard GeoJSON FeatureCollection."""
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

            geojson_features.append({
                "type": "Feature",
                "id": f.feature_index,
                "geometry": f.geometry_geojson,
                "properties": props
            })

        fc = {
            "type": "FeatureCollection",
            "name": file_record.filename,
            "crs": {
                "type": "name",
                "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}
            },
            "features": geojson_features
        }
        return json.dumps(fc, indent=2)
