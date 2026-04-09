import requests

BASE_URL = "http://localhost:3001"
LOGIN_URL = f"{BASE_URL}/api/auth/login"
PACKAGES_URL = f"{BASE_URL}/api/packages"

EMAIL = "hqbakari@gmail.com"
PASSWORD = "Muu@1212"
TIMEOUT = 30


def test_get_api_packages_list_service_packages():
    # Step 1: Login to get JWT token
    login_payload = {
        "email": EMAIL,
        "password": PASSWORD
    }
    try:
        login_resp = requests.post(LOGIN_URL, json=login_payload, timeout=TIMEOUT)
        assert login_resp.status_code == 200, f"Login failed with status {login_resp.status_code}"
        login_data = login_resp.json()
        token = login_data.get("token")
        assert token is not None, "JWT token not present in login response"
    except (requests.RequestException, AssertionError) as e:
        raise AssertionError(f"Login request failed or invalid response: {e}")

    headers = {
        "Authorization": f"Bearer {token}"
    }

    # Step 2: GET /api/packages with valid token (expect 200 OK and packages filtered by tenant_id)
    try:
        packages_resp = requests.get(PACKAGES_URL, headers=headers, timeout=TIMEOUT)
        assert packages_resp.status_code == 200, f"Expected 200 OK, got {packages_resp.status_code}"
        packages_data = packages_resp.json()
        assert isinstance(packages_data, list), "Packages response is not a list"
        # Optionally could validate structure of package objects if known
    except (requests.RequestException, AssertionError) as e:
        raise AssertionError(f"Failed to get packages list or invalid response: {e}")

    # Step 3: GET /api/packages with tenant_id override via query param (expect 403 Forbidden)
    # We'll try to override tenant_id with "some-invalid-tenant-id" param
    params = {"tenant_id": "fake-tenant-id-override"}
    try:
        forbidden_resp = requests.get(PACKAGES_URL, headers=headers, params=params, timeout=TIMEOUT)
        assert forbidden_resp.status_code == 403, f"Expected 403 Forbidden for tenant_id override, got {forbidden_resp.status_code}"
    except requests.RequestException as e:
        raise AssertionError(f"Request for tenant_id override failed: {e}")


test_get_api_packages_list_service_packages()