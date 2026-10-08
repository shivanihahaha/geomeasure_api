import os
import re
from fastapi import UploadFile
from backend.app.config import settings
from backend.app.core.exceptions import (
    InvalidFileExtensionException,
    FileTooLargeException,
    MalformedArchiveException
)

def sanitize_filename(filename: str) -> str:
    """Sanitize filename to prevent directory traversal and remove dangerous chars."""
    basename = os.path.basename(filename)
    # Strip any characters that aren't alphanumeric, underscores, hyphens, dots, or spaces
    cleaned = re.sub(r'[^\w\s\.-]', '_', basename).strip()
    return cleaned or "unnamed_geofile"

def validate_uploaded_file(upload_file: UploadFile) -> str:
    """
    Validate extension and sanitize filename.
    Returns sanitized filename.
    """
    if not upload_file.filename:
        raise InvalidFileExtensionException(
            filename="unknown",
            allowed=list(settings.ALLOWED_EXTENSIONS)
        )
    
    sanitized = sanitize_filename(upload_file.filename)
    _, ext = os.path.splitext(sanitized.lower())
    
    if ext not in settings.ALLOWED_EXTENSIONS:
        raise InvalidFileExtensionException(
            filename=sanitized,
            allowed=sorted(list(settings.ALLOWED_EXTENSIONS))
        )
        
    return sanitized

def validate_file_content(file_bytes: bytes, filename: str):
    """
    Validate binary content headers.
    - ZIP must begin with 'PK\x03\x04' or 'PK\x05\x06' (empty zip)
    - KML must contain '<kml' or '<Document' or xml header
    """
    if len(file_bytes) > settings.MAX_UPLOAD_SIZE_BYTES:
        raise FileTooLargeException(max_size_mb=settings.MAX_UPLOAD_SIZE_BYTES / (1024 * 1024))
    
    if len(file_bytes) == 0:
        raise MalformedArchiveException(f"The uploaded file '{filename}' is empty (0 bytes).")
    
    _, ext = os.path.splitext(filename.lower())
    
    if ext == ".zip":
        # ZIP magic numbers
        if not (file_bytes.startswith(b"PK\x03\x04") or file_bytes.startswith(b"PK\x05\x06") or file_bytes.startswith(b"PK\x07\x08")):
            raise MalformedArchiveException(f"The uploaded file '{filename}' does not have a valid ZIP header signature.")
    elif ext == ".kml":
        header_sample = file_bytes[:1024].decode('utf-8', errors='ignore').lower()
        if not ("<kml" in header_sample or "<?xml" in header_sample or "<document" in header_sample):
            # Check anywhere in first 4KB
            full_sample = file_bytes[:4096].decode('utf-8', errors='ignore').lower()
            if not ("<kml" in full_sample or "<placemark" in full_sample):
                raise MalformedArchiveException(f"The uploaded file '{filename}' is not a valid KML document.")
