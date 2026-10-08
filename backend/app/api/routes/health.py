import sys
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
import pyproj
import geopandas
import shapely

from backend.app.config import settings
from backend.app.repositories.database import get_db
from backend.app.models.file import FileRecord

router = APIRouter(prefix="/health", tags=["Health"])

@router.get("", summary="Health Check and Geospatial Engine Status")
def get_health(db: Session = Depends(get_db)):
    """
    Returns API health status along with runtime versions of
    core geospatial dependencies (GDAL/Pyogrio, PROJ, Shapely, GeoPandas).
    """
    file_count = db.query(FileRecord).count()
    
    return {
        "status": "healthy",
        "app_name": settings.APP_NAME,
        "app_version": settings.APP_VERSION,
        "geospatial_engine": {
            "python": sys.version.split()[0],
            "geopandas": geopandas.__version__,
            "shapely": shapely.__version__,
            "pyproj": pyproj.__version__,
            "proj_version": pyproj.proj_version_str
        },
        "storage": {
            "total_files_processed": file_count,
            "max_upload_size_mb": settings.MAX_UPLOAD_SIZE_BYTES / (1024 * 1024),
            "allowed_extensions": list(settings.ALLOWED_EXTENSIONS)
        }
    }
