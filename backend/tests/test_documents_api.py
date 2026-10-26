import pytest

def test_invalid_document_extension(client, admin_headers):
    file_tuple = ("script.sh", b"#!/bin/bash echo payload", "application/x-sh")
    res = client.post(
        "/api/v1/documents/upload",
        files={"file": file_tuple},
        data={"title": "Script Payload"},
        headers=admin_headers
    )
    assert res.status_code == 400
    assert "Invalid document file extension" in res.json()["detail"]

def test_oversized_document_upload(client, admin_headers):
    large_bytes = b"0" * (26 * 1024 * 1024)
    file_tuple = ("oversized.pdf", large_bytes, "application/pdf")
    res = client.post(
        "/api/v1/documents/upload",
        files={"file": file_tuple},
        data={"title": "Oversized Docket"},
        headers=admin_headers
    )
    assert res.status_code == 400
    assert "exceeds maximum limit of 25MB" in res.json()["detail"]

def test_valid_document_upload_and_download(client, admin_headers):
    pdf_bytes = b"%PDF-1.4 %CRMS FIR Legal Docket Test File Content %EOF"
    file_tuple = ("FIR_Docket_2024_8891.pdf", pdf_bytes, "application/pdf")
    res = client.post(
        "/api/v1/documents/upload",
        files={"file": file_tuple},
        data={
            "title": "FIR Docket 2024-8891 Legal Filing",
            "document_type": "FIR Document",
            "criminal_id": "CR-001245"
        },
        headers=admin_headers
    )
    assert res.status_code == 200
    doc_data = res.json()
    doc_id = doc_data["id"]
    assert doc_data["fileHashSha256"] is not None

    # Test Download
    res_dl = client.get(f"/api/v1/documents/{doc_id}/download", headers=admin_headers)
    assert res_dl.status_code == 200
    assert res_dl.content == pdf_bytes

    # Test Delete
    res_del = client.delete(f"/api/v1/documents/{doc_id}", headers=admin_headers)
    assert res_del.status_code == 200
