import io
import zipfile
import pytest

def test_unsupported_file_extension(client):
    file_content = b"Some random text data"
    response = client.post(
        "/api/files/",
        files={"file": ("unsupported.txt", io.BytesIO(file_content), "text/plain")}
    )
    assert response.status_code == 400
    data = response.json()
    assert "error" in data
    assert data["error"]["code"] == "UNSUPPORTED_FILE_TYPE"

def test_empty_file_upload(client):
    response = client.post(
        "/api/files/",
        files={"file": ("empty.kml", io.BytesIO(b""), "application/vnd.google-earth.kml+xml")}
    )
    assert response.status_code == 400
    data = response.json()
    assert data["error"]["code"] == "MALFORMED_ARCHIVE"

def test_corrupted_zip_archive(client):
    fake_zip_bytes = b"PK\x03\x04corrupted-archive-garbage-bytes"
    response = client.post(
        "/api/files/",
        files={"file": ("corrupt.zip", io.BytesIO(fake_zip_bytes), "application/zip")}
    )
    assert response.status_code == 400
    data = response.json()
    assert data["error"]["code"] == "MALFORMED_ARCHIVE"

def test_zip_without_shapefile(client):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("notes.txt", "This zip has no shapefiles.")
        zf.writestr("image.png", b"fake-png-bytes")
    buf.seek(0)

    response = client.post(
        "/api/files/",
        files={"file": ("no_shp.zip", buf, "application/zip")}
    )
    assert response.status_code == 400
    data = response.json()
    assert data["error"]["code"] == "INVALID_SHAPEFILE_ARCHIVE"
    assert ".shp" in data["error"]["details"]["missing_files"]

def test_nonexistent_file_404(client):
    response = client.get("/api/files/nonexistent_id_999/")
    assert response.status_code == 404
    data = response.json()
    assert data["error"]["code"] == "FILE_NOT_FOUND"

def test_delete_file(client, sample_kml_path):
    with open(sample_kml_path, "rb") as f:
        upload_res = client.post(
            "/api/files/",
            files={"file": ("to_delete.kml", f, "application/vnd.google-earth.kml+xml")}
        )
    file_id = upload_res.json()["id"]

    del_res = client.delete(f"/api/files/{file_id}/")
    assert del_res.status_code == 200

    # Ensure it is gone
    get_res = client.get(f"/api/files/{file_id}/")
    assert get_res.status_code == 404
