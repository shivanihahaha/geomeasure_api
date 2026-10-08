from sqlalchemy import Column, String, Integer, DateTime, Text, JSON
from datetime import datetime
from backend.app.repositories.database import Base

class FileRecord(Base):
    __tablename__ = "files"

    id = Column(String(64), primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    stored_path = Column(String(512), nullable=False)
    file_type = Column(String(16), nullable=False)  # 'kml' or 'shapefile'
    file_size_bytes = Column(Integer, default=0)
    status = Column(String(32), default="PROCESSING", index=True)  # 'PROCESSING', 'COMPLETED', 'FAILED'
    
    feature_count = Column(Integer, default=0)
    source_crs = Column(String(128), default="EPSG:4326")
    measurement_crs = Column(String(128), default="EPSG:3857")
    measurement_units = Column(String(64), default="meters")
    crs_strategy = Column(Text, nullable=True)
    
    geometry_types = Column(JSON, default=dict)
    summary_data = Column(JSON, default=dict)
    
    error_message = Column(Text, nullable=True)
    processing_time_ms = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
