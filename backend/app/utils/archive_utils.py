import os
import zipfile
from typing import Tuple, List
from backend.app.core.exceptions import (
    MalformedArchiveException,
    InvalidShapefileZipException
)
from backend.app.core.logging import logger

def safe_extract_zip(zip_path: str, extract_to: str) -> List[str]:
    """
    Safely extract a ZIP archive while protecting against Zip Slip (path traversal) attacks.
    Ensures all extracted paths stay strictly inside extract_to.
    """
    extracted_files = []
    target_abs = os.path.abspath(extract_to)
    
    try:
        with zipfile.ZipFile(zip_path, 'r') as zf:
            # Check for corrupted archive
            bad_file = zf.testzip()
            if bad_file:
                raise MalformedArchiveException(f"ZIP archive is corrupted; failed CRC check on '{bad_file}'.")
            
            for member in zf.infolist():
                # Disallow absolute paths or paths containing '..'
                member_path = member.filename
                if os.path.isabs(member_path) or ".." in member_path.split("/"):
                    raise MalformedArchiveException(f"Archive entry '{member_path}' contains malicious path traversal sequence.")
                
                # Check target destination
                dest_path = os.path.abspath(os.path.join(target_abs, member_path))
                if not dest_path.startswith(target_abs + os.sep) and dest_path != target_abs:
                    raise MalformedArchiveException(f"Zip Slip attempt detected: entry '{member_path}' attempts to write outside target directory.")
                
                # Safe extraction
                zf.extract(member, target_abs)
                if not member.is_dir():
                    extracted_files.append(dest_path)
                    
    except zipfile.BadZipFile as e:
        raise MalformedArchiveException(f"Invalid or corrupted ZIP archive: {str(e)}")
        
    return extracted_files

def find_shapefile_in_directory(directory: str) -> Tuple[str, List[str]]:
    """
    Scan extracted directory for ESRI Shapefile (.shp).
    Verifies that at least one .shp file is present.
    Returns:
        (primary_shp_path, missing_recommended_files)
    """
    shp_files = []
    for root, _, files in os.walk(directory):
        for f in files:
            if f.lower().endswith(".shp") and not f.startswith("."):
                shp_files.append(os.path.join(root, f))
                
    if not shp_files:
        raise InvalidShapefileZipException(
            message="No Shapefile (.shp) was found inside the uploaded ZIP archive. A valid Shapefile package must contain at minimum a .shp file.",
            missing_files=[".shp"]
        )
    
    # Select first or shortest path .shp as primary
    primary_shp = sorted(shp_files, key=len)[0]
    base_no_ext, _ = os.path.splitext(primary_shp)
    
    # Check recommended companion files
    missing_files = []
    for ext in [".shx", ".dbf", ".prj"]:
        # check both lower and upper case
        if not (os.path.exists(base_no_ext + ext) or os.path.exists(base_no_ext + ext.upper())):
            missing_files.append(ext)
            
    if missing_files:
        logger.warning(f"Shapefile '{os.path.basename(primary_shp)}' is missing companion files: {missing_files}")
        
    return primary_shp, missing_files
