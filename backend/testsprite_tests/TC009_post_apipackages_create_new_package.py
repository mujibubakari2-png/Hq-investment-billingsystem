import requests

BASE_URL = "http://localhost:3001"
LOGIN_ENDPOINT = "/api/auth/login"
PACKAGES_ENDPOINT = "/api/packages"
ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "admin123"
TIMEOUT = 30

def test_post_apipackages_create_new_package():
    # Step 1: Authenticate as admin to get JWT token
    login_payload = {
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    }
    try:
        login_resp = requests.post(
            BASE_URL + LOGIN_ENDPOINT,
            json=login_payload,
            timeout=TIMEOUT
        )
        assert login_resp.status_code == 200, f"Login failed with status {login_resp.status_code}: {login_resp.text}"
        login_data = login_resp.json()
        assert "token" in login_data, "Login response missing 'token'"
        token = login_data["token"]
    except Exception as e:
        raise AssertionError(f"Admin login request failed: {e}")

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    # Step 2: Prepare new package payload with valid parameters
    # Using required fields from PRD: name, price, duration
    package_payload = {
        "name": "Test Package TC009",
        "price": 19.99,
        "duration": 30
    }

    # Step 3: Create new package
    try:
        create_resp = requests.post(
            BASE_URL + PACKAGES_ENDPOINT,
            headers=headers,
            json=package_payload,
            timeout=TIMEOUT,
        )
    except Exception as e:
        raise AssertionError(f"Package creation request failed: {e}")

    # Step 4: Validate response
    assert create_resp.status_code == 201, f"Expected 201 Created, got {create_resp.status_code}: {create_resp.text}"
    create_data = create_resp.json()
    # Validate returned package fields
    assert isinstance(create_data, dict), "Response JSON is not an object"
    assert create_data.get("name") == package_payload["name"], "Package name mismatch"
    # Price may be int or float depending on backend parsing
    assert abs(float(create_data.get("price", 0)) - package_payload["price"]) < 0.001, "Package price mismatch"
    assert create_data.get("duration") == package_payload["duration"], "Package duration mismatch"
    assert "id" in create_data, "Created package missing 'id'"

    # Step 5: Cleanup - delete created package to keep environment clean
    package_id = create_data["id"]
    delete_endpoint = f"{PACKAGES_ENDPOINT}/{package_id}"
    try:
        del_resp = requests.delete(
            BASE_URL + delete_endpoint,
            headers=headers,
            timeout=TIMEOUT
        )
        assert del_resp.status_code in (200, 204), f"Failed to delete test package with status {del_resp.status_code}: {del_resp.text}"
    except Exception as e:
        raise AssertionError(f"Package deletion request failed: {e}")

test_post_apipackages_create_new_package()