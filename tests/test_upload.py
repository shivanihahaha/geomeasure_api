import io
import os
import zipfile
import pytest

def test_health_endpoint(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "geospatial_engine" in data
    assert "geopandas" in data["geospatial_engine"]
    assert "pyproj" in data["geospatial_engine"]

def test_valid_kml_upload(client, sample_kml_path):
    assert os.path.exists(sample_kml_path), "Sample KML must exist"
    with open(sample_kml_path, "rb") as f:
        response = client.post(
            "/api/files/",
            files={"file": ("survey.kml", f, "application/vnd.google-earth.kml+xml")}
        )
    assert response.status_code == 201
    data = response.json()
    assert "id" in data
    assert data["filename"] == "survey.kml"
    assert data["status"] == "COMPLETED"
    assert data["feature_count"] >= 4
    assert "EPSG" in data["measurement_crs"]

    # Verify get file info
    info_res = client.get(f"/api/files/{data['id']}/")
    assert info_res.status_code == 200
    info_data = info_res.json()
    assert info_data["feature_count"] == data["feature_count"]
    assert info_data["geometry_types"]["Polygon"] >= 2

def test_valid_shapefile_zip_upload(client, sample_shapefile_zip_path):
    assert os.path.exists(sample_shapefile_zip_path), "Sample Shapefile ZIP must exist"
    with open(sample_shapefile_zip_path, "rb") as f:
        response = client.post(
            "/api/files/",
            files={"file": ("parcels.zip", f, "application/zip")}
        )
    assert response.status_code == 201
    data = response.json()
    assert data["filename"] == "parcels.zip"
    assert data["status"] == "COMPLETED"
    assert data["feature_count"] >= 4
    assert data["measurement_crs"].startswith("EPSG:")

def test_load_sample_endpoints(client):
    # Test built-in sample loader for KML
    res_kml = client.post("/api/files/sample/kml")
    assert res_kml.status_code == 201
    assert res_kml.json()["status"] == "COMPLETED"

    # Test built-in sample loader for Shapefile
    res_shp = client.post("/api/files/sample/shapefile")
    assert res_shp.status_code == 201
    assert res_shp.json()["status"] == "COMPLETED"

def test_list_files(client):
    response = client.get("/api/files/")
    assert response.status_code == 200
    data = response.json()
    assert "total" in data
    assert data["total"] >= 1
    assert len(data["files"]) >= 1
