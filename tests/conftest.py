import sys
import os
import pytest
from fastapi.testclient import TestClient

# Ensure root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app.main import app
from backend.app.config import settings

@pytest.fixture(scope="session")
def client():
    with TestClient(app) as test_client:
        yield test_client

@pytest.fixture(scope="session")
def sample_kml_path():
    path = os.path.join(settings.SAMPLES_DIR, "agricultural_zones_survey.kml")
    return path

@pytest.fixture(scope="session")
def sample_shapefile_zip_path():
    path = os.path.join(settings.SAMPLES_DIR, "cadastral_parcels_shapefile.zip")
    return path
