from sqlalchemy import Column, String, Integer, Float, ForeignKey, JSON
from backend.app.repositories.database import Base

class FeatureRecord(Base):
    __tablename__ = "features"

    id = Column(Integer, primary_key=True, autoincrement=True)
    file_id = Column(String(64), ForeignKey("files.id", ondelete="CASCADE"), index=True, nullable=False)
    feature_index = Column(Integer, nullable=False)
    
    geometry_type = Column(String(64), nullable=False)
    # Store GeoJSON geometry (WGS84 for fast mapping and export)
    geometry_geojson = Column(JSON, nullable=False)
    properties = Column(JSON, default=dict)
    
    measurement_type = Column(String(32), nullable=True)  # 'AREA', 'LENGTH', None
    measurement_value = Column(Float, nullable=True)
    measurement_unit = Column(String(16), nullable=True)
    measurement_formatted = Column(String(64), nullable=True)
    measurement_status = Column(String(32), default="COMPLETED")
    measurement_conversions = Column(JSON, default=dict)
