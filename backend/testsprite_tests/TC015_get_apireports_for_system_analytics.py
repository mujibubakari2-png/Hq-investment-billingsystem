import requests

BASE_URL = "http://localhost:3001"
ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "admin123"
TIMEOUT = 30

def test_get_apireports_for_system_analytics():
    login_url = f"{BASE_URL}/api/auth/login"
    reports_url = f"{BASE_URL}/api/reports"

    # Login to get JWT token
    try:
        login_resp = requests.post(
            login_url,
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            timeout=TIMEOUT,
        )
        assert login_resp.status_code == 200, f"Login failed with status {login_resp.status_code}"
        login_data = login_resp.json()
        token = login_data.get("token") or login_data.get("accessToken")
        assert token, "No token found in login response"
    except Exception as e:
        assert False, f"Login request failed: {e}"

    headers = {"Authorization": f"Bearer {token}"}

    # Call /api/reports endpoint
    try:
        resp = requests.get(reports_url, headers=headers, timeout=TIMEOUT)
        assert resp.status_code == 200, f"/api/reports returned status {resp.status_code}"

        data = resp.json()
        # Basic keys expected for aggregated data: revenue, clientGrowth, kpis or similar
        # Since exact response schema isn't provided, check presence of common KPI fields.
        assert isinstance(data, dict), "Response is not a JSON object"

        keys_to_check = ["revenue", "clientGrowth", "kpis", "keyPerformanceIndicators", "summary", "analytics"]
        found_key = any(key in data for key in keys_to_check)
        assert found_key, f"None of the expected keys {keys_to_check} found in response"

    except Exception as e:
        assert False, f"Error during /api/reports request: {e}"

test_get_apireports_for_system_analytics()