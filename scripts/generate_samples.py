import os
import zipfile
import tempfile
import geopandas as gpd
import shapely.geometry as sg

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAMPLES_DIR = os.path.join(BASE_DIR, "data", "samples")
os.makedirs(SAMPLES_DIR, exist_ok=True)

# 1. Generate Sample KML
kml_content = """<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Agricultural Parcels &amp; Irrigation Infrastructure</name>
    <description>Sample survey dataset for GeoMeasure analysis</description>
    
    <!-- Parcel 1: North Orchard (Polygon) -->
    <Placemark>
      <name>North Orchard Field</name>
      <description>Commercial citrus orchard zone</description>
      <ExtendedData>
        <Data name="crop_type"><value>Citrus</value></Data>
        <Data name="soil_grade"><value>Class A</value></Data>
      </ExtendedData>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>
              77.5850,12.9800,0
              77.5900,12.9800,0
              77.5900,12.9850,0
              77.5850,12.9850,0
              77.5850,12.9800,0
            </coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>

    <!-- Parcel 2: South Vineyard (Polygon) -->
    <Placemark>
      <name>South Vineyard Field</name>
      <description>Organic grape cultivation parcel</description>
      <ExtendedData>
        <Data name="crop_type"><value>Grapevine</value></Data>
        <Data name="irrigation"><value>Drip</value></Data>
      </ExtendedData>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>
              77.5920,12.9750,0
              77.5980,12.9750,0
              77.5980,12.9790,0
              77.5920,12.9790,0
              77.5920,12.9750,0
            </coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>

    <!-- Irrigation Canal Route (LineString) -->
    <Placemark>
      <name>Main Irrigation Canal</name>
      <description>Primary concrete-lined water distribution canal</description>
      <ExtendedData>
        <Data name="flow_rate"><value>4.5 m3/s</value></Data>
      </ExtendedData>
      <LineString>
        <coordinates>
          77.5830,12.9780,0
          77.5870,12.9810,0
          77.5910,12.9830,0
          77.5960,12.9860,0
        </coordinates>
      </LineString>
    </Placemark>

    <!-- Perimeter Boundary Fence (LineString) -->
    <Placemark>
      <name>Estate Access Roadway</name>
      <description>Paved dual-lane agricultural access road</description>
      <LineString>
        <coordinates>
          77.5840,12.9720,0
          77.5890,12.9740,0
          77.5950,12.9760,0
        </coordinates>
      </LineString>
    </Placemark>

    <!-- Monitoring Station (Point - No measurement required) -->
    <Placemark>
      <name>Meteorological Station A1</name>
      <description>Solar-powered automated agro-weather telemetry station</description>
      <Point>
        <coordinates>77.5880,12.9820,0</coordinates>
      </Point>
    </Placemark>

    <!-- Soil Moisture Node (Point) -->
    <Placemark>
      <name>Soil Telemetry Sensor #4</name>
      <description>Subsurface IoT moisture and salinity probe</description>
      <Point>
        <coordinates>77.5940,12.9770,0</coordinates>
      </Point>
    </Placemark>
  </Document>
</kml>
"""

kml_path = os.path.join(SAMPLES_DIR, "agricultural_zones_survey.kml")
with open(kml_path, "w", encoding="utf-8") as f:
    f.write(kml_content)
print(f"Generated KML sample at {kml_path}")

# 2. Generate Sample Shapefile ZIP
records = [
    {
        "PARCEL_ID": "P-101",
        "NAME": "Central Research Farm",
        "ZONE": "Agri-Special",
        "AREA_CLASS": "Prime",
        "geometry": sg.Polygon([
            (77.6000, 12.9600),
            (77.6080, 12.9600),
            (77.6080, 12.9670),
            (77.6000, 12.9670),
            (77.6000, 12.9600)
        ])
    },
    {
        "PARCEL_ID": "P-102",
        "NAME": "East Wetland Buffer",
        "ZONE": "Conservation",
        "AREA_CLASS": "Protected",
        "geometry": sg.Polygon([
            (77.6100, 12.9620),
            (77.6160, 12.9620),
            (77.6170, 12.9690),
            (77.6110, 12.9680),
            (77.6100, 12.9620)
        ])
    },
    {
        "PARCEL_ID": "P-103",
        "NAME": "High-Density Orchards",
        "ZONE": "Agri-Commercial",
        "AREA_CLASS": "High-Yield",
        "geometry": sg.Polygon([
            (77.6010, 12.9680),
            (77.6090, 12.9680),
            (77.6090, 12.9740),
            (77.6010, 12.9740),
            (77.6010, 12.9680)
        ])
    },
    {
        "PARCEL_ID": "P-104",
        "NAME": "Eco-Corridor Grasslands",
        "ZONE": "Preservation",
        "AREA_CLASS": "Native",
        "geometry": sg.Polygon([
            (77.6120, 12.9700),
            (77.6180, 12.9700),
            (77.6185, 12.9760),
            (77.6125, 12.9760),
            (77.6120, 12.9700)
        ])
    }
]

gdf = gpd.GeoDataFrame(records, crs="EPSG:4326")

with tempfile.TemporaryDirectory() as td:
    base_shp = os.path.join(td, "cadastral_parcels.shp")
    gdf.to_file(base_shp, driver="ESRI Shapefile")
    
    zip_path = os.path.join(SAMPLES_DIR, "cadastral_parcels_shapefile.zip")
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for ext in [".shp", ".shx", ".dbf", ".prj", ".cpg"]:
            fpath = os.path.join(td, "cadastral_parcels" + ext)
            if os.path.exists(fpath):
                zf.write(fpath, arcname="cadastral_parcels" + ext)
    print(f"Generated Shapefile ZIP sample at {zip_path}")
