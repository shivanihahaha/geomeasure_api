import os
from pydantic import BaseModel

class Settings(BaseModel):
    APP_NAME: str = "GeoMeasure API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"
    HOST: str = os.getenv("HOST", "127.0.0.1")
    PORT: int = int(os.getenv("PORT", "8001"))
    
    # File upload configurations
    MAX_UPLOAD_SIZE_BYTES: int = 50 * 1024 * 1024  # 50 MB
    ALLOWED_EXTENSIONS: set = {".kml", ".zip"}
    
    # Storage directories
    BASE_DIR: str = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    DATA_DIR: str = os.path.join(BASE_DIR, "data")
    UPLOAD_DIR: str = os.path.join(DATA_DIR, "uploads")
    PROCESSED_DIR: str = os.path.join(DATA_DIR, "processed")
    SAMPLES_DIR: str = os.path.join(DATA_DIR, "samples")
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{os.path.join(DATA_DIR, 'geomeasure.db')}")

settings = Settings()

# Ensure directories exist
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(settings.PROCESSED_DIR, exist_ok=True)
os.makedirs(settings.SAMPLES_DIR, exist_ok=True)
