from typing import Dict
from backend.app.schemas.measurement import ConvertedUnit

def format_number(val: float, decimals: int = 2) -> str:
    """Format a float with commas and decimal places."""
    return f"{val:,.{decimals}f}"

def convert_area(area_m2: float) -> Dict[str, ConvertedUnit]:
    """
    Convert square meters into standard units:
    - m² (square meters)
    - ha (hectares, 1 ha = 10,000 m²)
    - km² (square kilometers, 1 km² = 1,000,000 m²)
    - ac (acres, 1 acre = 4046.8564224 m²)
    """
    ha = area_m2 / 10_000.0
    km2 = area_m2 / 1_000_000.0
    acres = area_m2 / 4_046.8564224

    return {
        "m2": ConvertedUnit(
            unit="m²",
            value=round(area_m2, 2),
            formatted=f"{format_number(area_m2)} m²"
        ),
        "ha": ConvertedUnit(
            unit="ha",
            value=round(ha, 4),
            formatted=f"{format_number(ha, 4)} ha"
        ),
        "km2": ConvertedUnit(
            unit="km²",
            value=round(km2, 6),
            formatted=f"{format_number(km2, 4)} km²"
        ),
        "acres": ConvertedUnit(
            unit="ac",
            value=round(acres, 4),
            formatted=f"{format_number(acres, 2)} ac"
        )
    }

def convert_length(length_m: float) -> Dict[str, ConvertedUnit]:
    """
    Convert meters into standard units:
    - m (meters)
    - km (kilometers, 1 km = 1,000 m)
    - ft (feet, 1 m = 3.28084 ft)
    - mi (miles, 1 mi = 1609.344 m)
    """
    km = length_m / 1000.0
    feet = length_m * 3.28084
    miles = length_m / 1609.344

    return {
        "m": ConvertedUnit(
            unit="m",
            value=round(length_m, 2),
            formatted=f"{format_number(length_m)} m"
        ),
        "km": ConvertedUnit(
            unit="km",
            value=round(km, 4),
            formatted=f"{format_number(km, 3)} km"
        ),
        "ft": ConvertedUnit(
            unit="ft",
            value=round(feet, 2),
            formatted=f"{format_number(feet)} ft"
        ),
        "mi": ConvertedUnit(
            unit="mi",
            value=round(miles, 4),
            formatted=f"{format_number(miles, 3)} mi"
        )
    }
