import requests

BASE_URL = "http://localhost:3001"
TIMEOUT = 30

# Assuming an existing valid token is needed for /api/packages access based on PRD "auth_required: true"
# For this test, a helper function to login and get a token is implemented
def get_auth_token(email: str, password: str) -> str:
    login_url = f"{BASE_URL}/api/auth/login"
    payload = {"email": email, "password": password}
    resp = requests.post(login_url, json=payload, timeout=TIMEOUT)
    resp.raise_for_status()
    data = resp.json()
    token = data.get("token") or data.get("accessToken") or data.get("jwt")
    if not token:
        raise ValueError("No token found in login response")
    return token

def test_get_packages_list_and_filtering():
    # Replace these credentials with a valid user to obtain auth token
    test_email = "admin@example.com"
    test_password = "adminpassword"

    token = get_auth_token(test_email, test_password)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Test GET /api/packages returns list of packages
    packages_url = f"{BASE_URL}/api/packages"
    resp = requests.get(packages_url, headers=headers, timeout=TIMEOUT)
    assert resp.status_code == 200, f"Expected 200 but got {resp.status_code}"
    packages = resp.json()
    assert isinstance(packages, list), f"Expected list but got {type(packages)}"

    # If no packages, no filtering validation possible, so we create a package for test
    if not packages:
        # Create a package to test filtering
        create_payload = {
            "type": "Hotspot",
            "name": "TestPackageForFilter",
            "price": 10.0,
            "duration": 30,
            "routerId": None,
            "uploadSpeed": 5,
            "downloadSpeed": 10,
            "hotspotSettings": {}
        }
        create_resp = requests.post(packages_url, json=create_payload, headers=headers, timeout=TIMEOUT)
        assert create_resp.status_code == 201, f"Package creation failed with status {create_resp.status_code}"
        new_package = create_resp.json()
        package_id = new_package.get("id") or new_package.get("packageId")
    else:
        package_id = None  # No cleanup needed

    try:
        # 2. Test filtering by type
        test_type = "Hotspot"
        params = {"type": test_type}
        resp_type_filter = requests.get(packages_url, headers=headers, params=params, timeout=TIMEOUT)
        assert resp_type_filter.status_code == 200, f"Filtering by type failed with status {resp_type_filter.status_code}"
        filtered_packages_by_type = resp_type_filter.json()
        assert isinstance(filtered_packages_by_type, list), "Filtered result by type should be a list"
        for pkg in filtered_packages_by_type:
            assert "type" in pkg, "Package missing 'type' field"
            assert pkg["type"].lower() == test_type.lower(), f"Package type mismatch: expected {test_type}, got {pkg['type']}"

        # 3. Test filtering by status if status field exists in any package
        # Determine if packages have status
        sample_pkg = filtered_packages_by_type[0] if filtered_packages_by_type else None
        if sample_pkg and "status" in sample_pkg:
            # Use status of first returned package for filtering
            test_status = sample_pkg["status"]
            params = {"status": test_status}
            resp_status_filter = requests.get(packages_url, headers=headers, params=params, timeout=TIMEOUT)
            assert resp_status_filter.status_code == 200, f"Filtering by status failed with status {resp_status_filter.status_code}"
            filtered_packages_by_status = resp_status_filter.json()
            assert isinstance(filtered_packages_by_status, list), "Filtered result by status should be a list"
            for pkg in filtered_packages_by_status:
                assert "status" in pkg, "Package missing 'status' field"
                assert str(pkg["status"]).lower() == str(test_status).lower(), f"Package status mismatch: expected {test_status}, got {pkg['status']}"
        else:
            # No 'status' field detected; skip status filtering test
            pass

    finally:
        # Cleanup: delete created package if any
        if package_id:
            del_resp = requests.delete(f"{packages_url}/{package_id}", headers=headers, timeout=TIMEOUT)
            assert del_resp.status_code in (200, 204), f"Package cleanup failed with status {del_resp.status_code}"

test_get_packages_list_and_filtering()
