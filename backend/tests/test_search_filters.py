import pytest

def test_global_text_search(client, admin_headers):
    res = client.get("/api/v1/search?q=Raj", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert "records" in data
    assert data["totalCount"] >= 1
    assert data["records"][0]["name"] == "Raj Kumar Sharma"

def test_advanced_multi_filter_search(client, admin_headers):
    res = client.get(
        "/api/v1/search?category=Theft&status=Active&gender=Male&minAge=20&maxAge=40",
        headers=admin_headers
    )
    assert res.status_code == 200
    data = res.json()
    assert data["totalCount"] >= 1
    assert data["records"][0]["category"] == "Theft"

def test_search_pagination(client, admin_headers):
    res = client.get("/api/v1/search?page=1&pageSize=5", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["page"] == 1
    assert data["pageSize"] == 5
    assert "totalPages" in data
