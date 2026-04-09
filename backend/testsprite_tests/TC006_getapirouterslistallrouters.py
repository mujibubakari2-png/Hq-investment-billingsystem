import requests

BASE_URL = "http://localhost:3001/api"
LOGIN_URL = f"{BASE_URL}/auth/login"
ROUTERS_URL = f"{BASE_URL}/routers"
TIMEOUT = 30

def test_getapirouterslistallrouters():
    # Login to get JWT token
    login_payload = {
        "email": "admin",
        "password": "admin123"
    }
    try:
        login_resp = requests.post(LOGIN_URL, json=login_payload, timeout=TIMEOUT)
        assert login_resp.status_code == 200, f"Login failed with status {login_resp.status_code}"
        login_json = login_resp.json()
        token = login_json.get("token")
        assert token, "JWT token not found in login response"
    except requests.RequestException as e:
        assert False, f"Login request failed: {str(e)}"

    headers = {
        "Authorization": f"Bearer {token}"
    }

    try:
        routers_resp = requests.get(ROUTERS_URL, headers=headers, timeout=TIMEOUT)
        assert routers_resp.status_code == 200, f"Expected 200 but got {routers_resp.status_code}"
        routers_data = routers_resp.json()
        assert isinstance(routers_data, list), "Response is not a list of routers"
        # Additional validation: each router should contain tenant_id (scoped)
        for router in routers_data:
            assert "tenant_id" in router, "Router missing tenant_id field"
    except requests.RequestException as e:
        assert False, f"GET /api/routers request failed: {str(e)}"

test_getapirouterslistallrouters()