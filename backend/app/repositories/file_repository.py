from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from backend.app.models.file import FileRecord
from backend.app.models.feature import FeatureRecord

class FileRepository:
    def __init__(self, db: Session):
        self.db = db

    def create_file(self, record: FileRecord) -> FileRecord:
        self.db.add(record)
        self.db.commit()
        self.db.refresh(record)
        return record

    def update_file(self, record: FileRecord) -> FileRecord:
        self.db.commit()
        self.db.refresh(record)
        return record

    def get_file_by_id(self, file_id: str) -> Optional[FileRecord]:
        return self.db.query(FileRecord).filter(FileRecord.id == file_id).first()

    def list_files(self, limit: int = 50) -> List[FileRecord]:
        return self.db.query(FileRecord).order_by(FileRecord.created_at.desc()).limit(limit).all()

    def delete_file(self, file_id: str) -> bool:
        rec = self.get_file_by_id(file_id)
        if not rec:
            return False
        # Delete associated features first
        self.db.query(FeatureRecord).filter(FeatureRecord.file_id == file_id).delete()
        self.db.delete(rec)
        self.db.commit()
        return True

    def save_features(self, features: List[FeatureRecord]):
        self.db.bulk_save_objects(features)
        self.db.commit()

    def get_features_by_file_id(self, file_id: str) -> List[FeatureRecord]:
        return self.db.query(FeatureRecord).filter(FeatureRecord.file_id == file_id).order_by(FeatureRecord.feature_index.asc()).all()
