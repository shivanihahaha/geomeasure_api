import pytest
import shapely.geometry as sg
from backend.app.services.measurement_service import MeasurementService
from backend.app.utils.unit_conversion import convert_area, convert_length

def test_point_has_no_measurement():
    point = sg.Point(100.0, 20.0)
    detail, status = MeasurementService.calculate_feature_measurement(point)
    assert detail is None
    assert status == "NOT_APPLICABLE"

def test_linestring_length_calculation():
    # 100m straight line along X in projected coordinates
    line = sg.LineString([(0, 0), (100, 0)])
    detail, status = MeasurementService.calculate_feature_measurement(line)
    
    assert status == "COMPLETED"
    assert detail is not None
    assert detail.type == "LENGTH"
    assert detail.value == 100.0
    assert detail.unit == "m"
    assert "conversions" in detail.model_dump()
    
    conversions = detail.conversions
    assert conversions["km"].value == 0.1
    assert abs(conversions["ft"].value - 328.084) < 0.1

def test_polygon_area_calculation():
    # 100m x 200m rectangle in projected coordinates -> 20,000 m² = 2.0 ha
    poly = sg.Polygon([(0, 0), (100, 0), (100, 200), (0, 200), (0, 0)])
    detail, status = MeasurementService.calculate_feature_measurement(poly)
    
    assert status == "COMPLETED"
    assert detail is not None
    assert detail.type == "AREA"
    assert detail.value == 20000.0
    assert detail.unit == "m²"
    
    conversions = detail.conversions
    assert conversions["ha"].value == 2.0
    assert conversions["km2"].value == 0.02
    assert abs(conversions["acres"].value - (20000.0 / 4046.8564224)) < 0.01

def test_unsupported_geometry():
    gc = sg.GeometryCollection([sg.Point(0, 0), sg.LineString([(0, 0), (1, 1)])])
    detail, status = MeasurementService.calculate_feature_measurement(gc)
    assert detail is None
    assert status == "UNSUPPORTED"

def test_measurements_api_endpoint(client, sample_kml_path):
    with open(sample_kml_path, "rb") as f:
        res = client.post(
            "/api/files/",
            files={"file": ("agri.kml", f, "application/vnd.google-earth.kml+xml")}
        )
    file_id = res.json()["id"]

    meas_res = client.get(f"/api/files/{file_id}/measurements/")
    assert meas_res.status_code == 200
    data = meas_res.json()
    assert "summary" in data
    assert "features" in data

    summary = data["summary"]
    assert summary["polygon_count"] >= 2
    assert summary["linestring_count"] >= 2
    assert summary["point_count"] >= 2
    assert summary["total_area_m2"] > 0
    assert summary["total_length_m"] > 0

    # Verify individual feature measurements
    for feat in data["features"]:
        g_type = feat["geometry_type"]
        if g_type in ("Polygon", "MultiPolygon"):
            assert feat["measurement"] is not None
            assert feat["measurement"]["type"] == "AREA"
            assert feat["measurement"]["value"] > 0
        elif g_type in ("LineString", "MultiLineString"):
            assert feat["measurement"] is not None
            assert feat["measurement"]["type"] == "LENGTH"
            assert feat["measurement"]["value"] > 0
        elif g_type in ("Point", "MultiPoint"):
            assert feat["measurement"] is None
            assert feat["measurement_status"] == "NOT_APPLICABLE"
