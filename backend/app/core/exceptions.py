from fastapi import HTTPException, status

class GeoMeasureException(HTTPException):
    def __init__(self, status_code: int, code: str, message: str, details: dict = None):
        super().__init__(
            status_code=status_code,
            detail={
                "code": code,
                "message": message,
                "details": details or {}
            }
        )

class InvalidFileExtensionException(GeoMeasureException):
    def __init__(self, filename: str, allowed: list):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="UNSUPPORTED_FILE_TYPE",
            message=f"File '{filename}' has an unsupported extension. Allowed extensions: {', '.join(allowed)}.",
            details={"filename": filename, "allowed_extensions": allowed}
        )

class FileTooLargeException(GeoMeasureException):
    def __init__(self, max_size_mb: float):
        super().__init__(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            code="FILE_TOO_LARGE",
            message=f"The uploaded file exceeds the maximum permitted limit of {max_size_mb} MB.",
            details={"max_size_mb": max_size_mb}
        )

class InvalidShapefileZipException(GeoMeasureException):
    def __init__(self, message: str, missing_files: list = None):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="INVALID_SHAPEFILE_ARCHIVE",
            message=message,
            details={"missing_files": missing_files or []}
        )

class MalformedArchiveException(GeoMeasureException):
    def __init__(self, message: str):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="MALFORMED_ARCHIVE",
            message=message
        )

class GeospatialProcessingException(GeoMeasureException):
    def __init__(self, message: str, details: dict = None):
        super().__init__(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            code="GEOSPATIAL_PROCESSING_ERROR",
            message=message,
            details=details or {}
        )

class FileNotFoundException(GeoMeasureException):
    def __init__(self, file_id: str):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            code="FILE_NOT_FOUND",
            message=f"Geospatial record with ID '{file_id}' was not found.",
            details={"file_id": file_id}
        )
