import pytest

def test_map_endpoint(client, sample_kml_path):
    with open(sample_kml_path, "rb") as f:
        res = client.post(
            "/api/files/",
            files={"file": ("map_test.kml", f, "application/vnd.google-earth.kml+xml")}
        )
    file_id = res.json()["id"]

    map_res = client.get(f"/api/files/{file_id}/map/")
    assert map_res.status_code == 200
    map_data = map_res.json()
    assert "bounds" in map_data
    assert len(map_data["bounds"]) == 2  # [[min_lat, min_lng], [max_lat, max_lng]]
    assert "center" in map_data
    assert "geojson" in map_data
    assert map_data["geojson"]["type"] == "FeatureCollection"
    assert len(map_data["geojson"]["features"]) >= 4

def test_export_json(client, sample_kml_path):
    with open(sample_kml_path, "rb") as f:
        res = client.post(
            "/api/files/",
            files={"file": ("export_json.kml", f, "application/vnd.google-earth.kml+xml")}
        )
    file_id = res.json()["id"]

    export_res = client.get(f"/api/files/{file_id}/export?format=json")
    assert export_res.status_code == 200
    assert "application/json" in export_res.headers["content-type"]
    data = export_res.json()
    assert data["file_id"] == file_id
    assert "features" in data

def test_export_csv(client, sample_kml_path):
    with open(sample_kml_path, "rb") as f:
        res = client.post(
            "/api/files/",
            files={"file": ("export_csv.kml", f, "application/vnd.google-earth.kml+xml")}
        )
    file_id = res.json()["id"]

    export_res = client.get(f"/api/files/{file_id}/export?format=csv")
    assert export_res.status_code == 200
    assert "text/csv" in export_res.headers["content-type"]
    lines = export_res.text.strip().split("\n")
    assert len(lines) >= 5  # header + >=4 features
    assert "feature_id,geometry_type,measurement_type" in lines[0]

def test_export_geojson(client, sample_kml_path):
    with open(sample_kml_path, "rb") as f:
        res = client.post(
            "/api/files/",
            files={"file": ("export_geojson.kml", f, "application/vnd.google-earth.kml+xml")}
        )
    file_id = res.json()["id"]

    export_res = client.get(f"/api/files/{file_id}/export?format=geojson")
    assert export_res.status_code == 200
    assert "application/geo+json" in export_res.headers["content-type"]
    data = export_res.json()
    assert data["type"] == "FeatureCollection"
    assert len(data["features"]) >= 4
