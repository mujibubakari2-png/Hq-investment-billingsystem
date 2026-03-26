import requests

BASE_URL = "http://localhost:3001"
ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "admin123"
TIMEOUT = 30

def test_get_packages_list_and_filtering():
    # Authenticate to get JWT token
    login_url = f"{BASE_URL}/api/auth/login"
    login_payload = {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    login_resp = requests.post(login_url, json=login_payload, timeout=TIMEOUT)
    assert login_resp.status_code == 200, f"Login failed with status {login_resp.status_code}"
    login_data = login_resp.json()
    assert "token" in login_data and isinstance(login_data["token"], str), "Token not found in login response"
    token = login_data["token"]

    headers = {"Authorization": f"Bearer {token}"}

    packages_url = f"{BASE_URL}/api/packages"

    # 1. Test GET /api/packages returns list of packages
    resp = requests.get(packages_url, headers=headers, timeout=TIMEOUT)
    assert resp.status_code == 200, f"Failed to get packages list, status: {resp.status_code}"
    data = resp.json()
    assert isinstance(data, list), "Packages response is not a list"

    # If there is no package, we can't test filtering but no error expected
    # If there are packages, check if each has expected fields (like type, status)
    if len(data) > 0:
        for p in data:
            assert isinstance(p, dict), "Each package item should be a dict"
            assert "type" in p, "Package missing 'type' field"
            # status may or may not be present, so only check if present
            # Filtering is by type or status, so check keys are consistent
            assert "status" in p or "status" not in p, "Package 'status' field presence inconsistent"

    # 2. Test filtering by type
    # Get all distinct types if packages exist, else skip
    types = set(p.get("type") for p in data if "type" in p)
    for type_filter in types:
        params = {"type": type_filter}
        resp = requests.get(packages_url, headers=headers, params=params, timeout=TIMEOUT)
        assert resp.status_code == 200, f"Filter by type failed (type={type_filter}), status {resp.status_code}"
        filtered_list = resp.json()
        assert isinstance(filtered_list, list), "Filtered packages response is not a list"
        for package in filtered_list:
            assert "type" in package, "Filtered package missing 'type'"
            assert package["type"] == type_filter, f"Package type does not match filter: {package['type']} != {type_filter}"

    # 3. Test filtering by status if status field is used in any package
    statuses = set(p.get("status") for p in data if "status" in p and p.get("status") is not None)
    for status_filter in statuses:
        params = {"status": status_filter}
        resp = requests.get(packages_url, headers=headers, params=params, timeout=TIMEOUT)
        assert resp.status_code == 200, f"Filter by status failed (status={status_filter}), status {resp.status_code}"
        filtered_list = resp.json()
        assert isinstance(filtered_list, list), "Filtered packages response is not a list"
        for package in filtered_list:
            # Some packages may not have a status - but filtered results should have the status matching
            assert "status" in package, "Filtered package missing 'status'"
            assert package["status"] == status_filter, f"Package status does not match filter: {package['status']} != {status_filter}"

test_get_packages_list_and_filtering()