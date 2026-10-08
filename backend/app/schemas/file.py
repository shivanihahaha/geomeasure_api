from typing import Dict, Optional, List
from pydantic import BaseModel, Field

class FileUploadResponse(BaseModel):
    id: str
    filename: str
    status: str
    feature_count: Optional[int] = None
    crs: Optional[str] = None
    measurement_crs: Optional[str] = None
    created_at: str
    processing_time_ms: Optional[int] = None

class FileInfoResponse(BaseModel):
    id: str
    filename: str
    feature_count: int
    crs: str
    measurement_crs: str
    measurement_units: str
    status: str
    geometry_types: Dict[str, int]
    created_at: str
    processing_time_ms: int
    file_size_bytes: int
    storage_path: Optional[str] = None

class FileListItem(BaseModel):
    id: str
    filename: str
    feature_count: int
    crs: str
    measurement_crs: str
    status: str
    geometry_types: Dict[str, int]
    created_at: str
    processing_time_ms: int
    file_size_bytes: int

class FileListResponse(BaseModel):
    total: int
    files: List[FileListItem]
