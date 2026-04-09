import requests

BASE_URL = "http://localhost:3001/api"
LOGIN_URL = f"{BASE_URL}/auth/login"
CLIENTS_URL = f"{BASE_URL}/clients"
TIMEOUT = 30

def test_getapiclientslistallclients():
    # Login to get JWT token
    login_payload = {"email": "admin", "password": "admin123"}
    try:
        login_response = requests.post(LOGIN_URL, json=login_payload, timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"Login request failed: {e}"
    assert login_response.status_code == 200, f"Login failed with status {login_response.status_code}"
    login_data = login_response.json()
    assert "token" in login_data or "access_token" in login_data, "JWT token not found in login response"
    token = login_data.get("token") or login_data.get("access_token")
    assert isinstance(token, str) and token != "", "Invalid token value"

    headers = {"Authorization": f"Bearer {token}"}
    try:
        clients_response = requests.get(CLIENTS_URL, headers=headers, timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"Clients list request failed: {e}"

    assert clients_response.status_code == 200, f"Expected status 200, got {clients_response.status_code}"
    clients_data = clients_response.json()
    assert isinstance(clients_data, list), "Clients response is not a list"
    for client in clients_data:
        # Each client should have tenant_id
        assert "tenant_id" in client, "Client missing tenant_id"
        assert client["tenant_id"] is not None, "Client tenant_id is None"

test_getapiclientslistallclients()
