import requests

BASE_URL = "http://localhost:3000"
TIMEOUT = 30

# Replace these with valid credentials for authentication
AUTH_USERNAME = "admin"
AUTH_PASSWORD = "admin123"

def test_get_api_clients_list_with_authorization():
    login_url = f"{BASE_URL}/api/auth/login"
    clients_url = f"{BASE_URL}/api/clients"
    headers = {}

    # Authenticate and get JWT token
    try:
        login_resp = requests.post(
            login_url,
            json={"username": AUTH_USERNAME, "password": AUTH_PASSWORD},
            timeout=TIMEOUT,
        )
        assert login_resp.status_code == 200, f"Login failed with status {login_resp.status_code}"
        login_data = login_resp.json()
        token = login_data.get("token") or login_data.get("jwt") or login_data.get("accessToken")
        assert token, "JWT token not found in login response"
        headers["Authorization"] = f"Bearer {token}"
    except requests.RequestException as e:
        assert False, f"Login request failed: {e}"

    # Call GET /api/clients with Authorization header
    try:
        resp = requests.get(clients_url, headers=headers, timeout=TIMEOUT)
        assert resp.status_code == 200, f"Expected 200 OK, got {resp.status_code}"
        clients_list = resp.json()
        assert isinstance(clients_list, list), "Response is not a list"
        # Validate that each client has 'status' and 'plan' fields (if present)
        for client in clients_list:
            assert isinstance(client, dict), "Client item is not a dict"
            assert "status" in client, "Client missing 'status' field"
            assert "plan" in client, "Client missing 'plan' field"
    except requests.RequestException as e:
        assert False, f"GET /api/clients request failed: {e}"

test_get_api_clients_list_with_authorization()