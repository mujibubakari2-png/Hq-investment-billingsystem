import requests

BASE_URL = "http://localhost:3001"
DASHBOARD_ENDPOINT = "/api/dashboard"
TIMEOUT = 30

# Placeholder token for testing; replace with valid JWT for real tests
auth_token = "Bearer test.jwt.token"

def test_get_dashboard_summary_with_auth():
    headers = {"Authorization": auth_token}
    try:
        response = requests.get(f"{BASE_URL}{DASHBOARD_ENDPOINT}", headers=headers, timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"Request to {DASHBOARD_ENDPOINT} failed: {e}"

    assert response.status_code == 200, f"Expected status 200, got {response.status_code}"

    try:
        data = response.json()
    except ValueError:
        assert False, "Response is not valid JSON"

    expected_keys = {"revenue", "routerStatus", "activeUsers"}
    missing_keys = expected_keys - data.keys()
    assert not missing_keys, f"Response JSON missing expected keys: {missing_keys}"

    assert isinstance(data["revenue"], (int, float)) and data["revenue"] >= 0, "Invalid revenue value"
    assert isinstance(data["activeUsers"], int) and data["activeUsers"] >= 0, "Invalid activeUsers value"
    assert isinstance(data["routerStatus"], dict), "Invalid routerStatus structure"


test_get_dashboard_summary_with_auth()