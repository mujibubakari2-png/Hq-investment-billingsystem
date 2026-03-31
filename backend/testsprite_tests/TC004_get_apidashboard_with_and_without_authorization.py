import requests

BASE_URL = "http://localhost:3001"
TIMEOUT = 30

def test_get_api_dashboard_with_and_without_authorization():
    login_url = f"{BASE_URL}/api/auth/login"
    dashboard_url = f"{BASE_URL}/api/dashboard"
    login_payload = {
        "email": "admin@example.com",
        "password": "adminpassword"
    }
    # First, obtain a valid JWT token by logging in
    try:
        login_resp = requests.post(login_url, json=login_payload, timeout=TIMEOUT)
        assert login_resp.status_code == 200, f"Login failed with status {login_resp.status_code}, response: {login_resp.text}"
        login_data = login_resp.json()
        token = login_data.get("token") or login_data.get("accessToken") or login_data.get("jwt")
        assert token is not None, "JWT token not found in login response"
    except (requests.RequestException, AssertionError) as e:
        raise AssertionError(f"Failed to login to get auth token: {e}")

    headers_auth = {
        "Authorization": f"Bearer {token}"
    }

    # Call /api/dashboard with Authorization header
    try:
        resp_with_auth = requests.get(dashboard_url, headers=headers_auth, timeout=TIMEOUT)
        assert resp_with_auth.status_code == 200, f"Expected 200 OK with auth, got {resp_with_auth.status_code}"
        data = resp_with_auth.json()
        # Validate expected keys in dashboard response
        assert isinstance(data, dict), "Dashboard response is not a JSON object"
        # Check expected keys present (revenue, router status, active users)
        expected_keys = ["revenue", "routerStatus", "activeUsers"]
        for key in expected_keys:
            assert key in data, f"Expected key '{key}' missing in dashboard response"
    except (requests.RequestException, AssertionError) as e:
        raise AssertionError(f"GET /api/dashboard with auth failed: {e}")

    # Call /api/dashboard without Authorization header
    try:
        resp_without_auth = requests.get(dashboard_url, timeout=TIMEOUT)
        assert resp_without_auth.status_code == 401, f"Expected 401 Unauthorized without auth, got {resp_without_auth.status_code}"
        err_data = resp_without_auth.json()
        # The error message might vary, just check for common unauthorized messages
        assert any(msg in err_data.get("message", "").lower() for msg in ["unauthorized", "not authenticated", "token"]), \
            f"Unexpected error message without auth: {err_data.get('message')}"
    except (requests.RequestException, AssertionError) as e:
        raise AssertionError(f"GET /api/dashboard without auth failed: {e}")

test_get_api_dashboard_with_and_without_authorization()
