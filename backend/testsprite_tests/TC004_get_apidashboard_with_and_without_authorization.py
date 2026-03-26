import requests

BASE_URL = "http://localhost:3001"
LOGIN_ENDPOINT = f"{BASE_URL}/api/auth/login"
DASHBOARD_ENDPOINT = f"{BASE_URL}/api/dashboard"

ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "admin123"


def test_tc004_get_api_dashboard_with_and_without_authorization():
    # Get JWT token by logging in as admin
    login_payload = {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    try:
        login_resp = requests.post(
            LOGIN_ENDPOINT, json=login_payload, timeout=30
        )
        login_resp.raise_for_status()
    except requests.RequestException as e:
        assert False, f"Login request failed: {e}"

    login_data = login_resp.json()
    assert "token" in login_data, "Login response missing token"
    token = login_data["token"]
    assert isinstance(token, str) and len(token) > 0, "Invalid token received"

    headers_auth = {"Authorization": f"Bearer {token}"}

    # Call /api/dashboard with valid Authorization header
    try:
        dashboard_auth_resp = requests.get(
            DASHBOARD_ENDPOINT, headers=headers_auth, timeout=30
        )
        dashboard_auth_resp.raise_for_status()
    except requests.RequestException as e:
        assert False, f"Authorized dashboard request failed: {e}"

    assert dashboard_auth_resp.status_code == 200, "Expected HTTP 200 for authorized request"
    dashboard_data = dashboard_auth_resp.json()
    # Validate keys in dashboard response
    expected_keys = {"revenue", "router_status", "active_users"}
    missing_keys = expected_keys - dashboard_data.keys()
    assert not missing_keys, f"Dashboard response missing keys: {missing_keys}"

    # Call /api/dashboard without Authorization header
    try:
        dashboard_noauth_resp = requests.get(DASHBOARD_ENDPOINT, timeout=30)
    except requests.RequestException as e:
        assert False, f"Unauthorized dashboard request failed: {e}"

    assert dashboard_noauth_resp.status_code == 401, (
        f"Expected HTTP 401 for unauthorized request, got {dashboard_noauth_resp.status_code}"
    )
    # Optionally check error message in response
    try:
        error_data = dashboard_noauth_resp.json()
        assert (
            "error" in error_data or "message" in error_data
        ), "Unauthorized response missing error message"
    except Exception:
        # If invalid JSON, ignore
        pass


test_tc004_get_api_dashboard_with_and_without_authorization()
