import pytest
import geopandas as gpd
import shapely.geometry as sg
from backend.app.services.crs_service import CRSService

def test_utm_zone_calculation():
    # London: -0.12°E, 51.5°N -> UTM Zone 30N (EPSG:32630)
    epsg_london, name_london = CRSService.calculate_utm_epsg(-0.12, 51.5)
    assert epsg_london == 32630
    assert "30N" in name_london

    # Bengaluru / India: 77.59°E, 12.97°N -> UTM Zone 43N (EPSG:32643)
    epsg_blr, name_blr = CRSService.calculate_utm_epsg(77.59, 12.97)
    assert epsg_blr == 32643
    assert "43N" in name_blr

    # Sydney / Australia: 151.2°E, -33.86°S -> UTM Zone 56S (EPSG:32756)
    epsg_syd, name_syd = CRSService.calculate_utm_epsg(151.2, -33.86)
    assert epsg_syd == 32756
    assert "56S" in name_syd

    # New York: -74.0°E, 40.7°N -> UTM Zone 18N (EPSG:32618)
    epsg_ny, name_ny = CRSService.calculate_utm_epsg(-74.0, 40.7)
    assert epsg_ny == 32618
    assert "18N" in name_ny

def test_crs_selection_geographic_wgs84():
    # Create GeoDataFrame in EPSG:4326 around Bangalore
    poly = sg.Polygon([
        (77.58, 12.97),
        (77.59, 12.97),
        (77.59, 12.98),
        (77.58, 12.98),
        (77.58, 12.97)
    ])
    gdf = gpd.GeoDataFrame([{"name": "Zone", "geometry": poly}], crs="EPSG:4326")
    
    crs_info = CRSService.select_measurement_crs(gdf)
    assert crs_info["is_projected"] is True
    assert crs_info["units"] == "meters"
    assert crs_info["measurement_crs"] == "EPSG:32643"
    assert "UTM zone 43N" in crs_info["strategy"]

def test_crs_selection_already_projected():
    # Create GeoDataFrame already in British National Grid (EPSG:27700)
    poly = sg.Polygon([(500000, 180000), (501000, 180000), (501000, 181000), (500000, 181000), (500000, 180000)])
    gdf = gpd.GeoDataFrame([{"name": "UK Zone", "geometry": poly}], crs="EPSG:27700")

    crs_info = CRSService.select_measurement_crs(gdf)
    assert crs_info["is_projected"] is True
    assert crs_info["measurement_crs"] == "EPSG:27700"
    assert "Preserved source projected CRS" in crs_info["strategy"]

def test_measurement_is_not_in_degrees():
    # 0.01 degree by 0.01 degree square in EPSG:4326
    # In degrees, raw area is 0.0001
    # In projected meters, 1 degree at 13°N is ~108km, 0.01 deg is ~1.08km -> Area is ~1,100,000 m²
    poly = sg.Polygon([
        (77.50, 13.00),
        (77.51, 13.00),
        (77.51, 13.01),
        (77.50, 13.01),
        (77.50, 13.00)
    ])
    gdf = gpd.GeoDataFrame([{"name": "Square", "geometry": poly}], crs="EPSG:4326")
    crs_info = CRSService.select_measurement_crs(gdf)
    gdf_proj = gdf.to_crs(crs_info["measurement_crs"])

    area_projected = gdf_proj.geometry.iloc[0].area
    assert area_projected > 1_000_000, f"Projected area must be in m², not degrees! Got: {area_projected}"
