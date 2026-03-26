import requests

BASE_URL = "http://localhost:3000"
DASHBOARD_ENDPOINT = "/api/dashboard"
AUTH_LOGIN_ENDPOINT = "/api/auth/login"

# Replace with valid credentials to get JWT token for Authorization header
TEST_USERNAME = "admin"
TEST_PASSWORD = "admin123"

def test_get_api_dashboard_with_authorization():
    try:
        # Login to get a valid token
        login_url = f"{BASE_URL}/api/auth/login"
        login_payload = {
            "username": TEST_USERNAME,
            "password": TEST_PASSWORD
        }
        login_resp = requests.post(
            login_url,
            json=login_payload,
            timeout=30
        )
        assert login_resp.status_code == 200, f"Login failed with status {login_resp.status_code}"
        login_json = login_resp.json()
        token = login_json.get("token")
        assert token, "JWT token not found in login response"

        # Step 2: Call GET /api/dashboard with Authorization header
        headers = {
            "Authorization": f"Bearer {token}"
        }
        dashboard_resp = requests.get(
            BASE_URL + DASHBOARD_ENDPOINT,
            headers=headers,
            timeout=30
        )
        assert dashboard_resp.status_code == 200, f"Dashboard request failed with status {dashboard_resp.status_code}"
        dashboard_json = dashboard_resp.json()

        # Validate presence of aggregated metrics keys
        assert "revenue" in dashboard_json, "Missing 'revenue' in dashboard response"
        assert "routerStatus" in dashboard_json or "router_status" in dashboard_json, "Missing 'routerStatus' in dashboard response"
        assert "activeUsers" in dashboard_json or "active_users" in dashboard_json, "Missing 'activeUsers' in dashboard response"

        # Optionally check types
        assert isinstance(dashboard_json.get("revenue", 0), (int, float)), "'revenue' should be numeric"
        # routerStatus and activeUsers might be complex objects or numeric counts
        # Just check they exist and are not None
        router_status = dashboard_json.get("routerStatus") or dashboard_json.get("router_status")
        active_users = dashboard_json.get("activeUsers") or dashboard_json.get("active_users")
        assert router_status is not None, "'routerStatus' value is None"
        assert active_users is not None, "'activeUsers' value is None"

    except requests.RequestException as e:
        assert False, f"Request failed: {str(e)}"

test_get_api_dashboard_with_authorization()