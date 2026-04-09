import requests

BASE_URL = "http://localhost:3001/api"
LOGIN_URL = f"{BASE_URL}/auth/login"
CLIENTS_URL = f"{BASE_URL}/clients"

AUTH_API_KEY = "sk-user-wr0eKZ_Ytg73zZIWxpNDQdWf65bUNwxqET31xUX7c6uNnMi5P4tH6hllD1TqnPiyPBBal8AzniRqDRddlzeaZWfgO15n1RCd4A2Nzb3qIgbgBi1J5Bmj2FPBLP-O5DhhG20"
HEADERS_API_KEY = {"x-api-key": AUTH_API_KEY}

EMAIL = "hqbakari@gmail.com"
PASSWORD = "Muu@1212"
TIMEOUT = 30

def test_get_clients_list_filtered_by_tenant():
    # 1. Login to get JWT token
    login_payload = {"email": EMAIL, "password": PASSWORD}
    try:
        login_resp = requests.post(
            LOGIN_URL, json=login_payload, headers=HEADERS_API_KEY, timeout=TIMEOUT
        )
        assert login_resp.status_code == 200, f"Login failed with status {login_resp.status_code}, body: {login_resp.text}"
        login_data = login_resp.json()
        token = login_data.get("token") or login_data.get("jwt") or login_data.get("access_token")
        assert token, "No JWT token found in login response"

        auth_headers = {
            "Authorization": f"Bearer {token}",
            **HEADERS_API_KEY,
            "Accept": "application/json"
        }

        # 2. Call GET /api/clients with Authorization header
        clients_resp = requests.get(CLIENTS_URL, headers=auth_headers, timeout=TIMEOUT)
        assert clients_resp.status_code == 200, f"GET /clients failed with status {clients_resp.status_code}, body: {clients_resp.text}"
        clients_data = clients_resp.json()
        assert isinstance(clients_data, list), "Expected clients list to be a list"

        # 3. Verify all returned clients have tenant_id matching JWT token's tenant_id claim
        # Decode tenant_id from JWT payload (without verification, just basic split)
        # JWT format: header.payload.signature (base64url)
        import base64
        import json

        try:
            payload_part = token.split(".")[1]
            # Add padding if needed
            payload_part += "=" * ((4 - len(payload_part) % 4) % 4)
            payload_bytes = base64.urlsafe_b64decode(payload_part)
            payload = json.loads(payload_bytes)
        except Exception:
            payload = {}

        token_tenant_id = payload.get("tenant_id")

        assert token_tenant_id, "No tenant_id found in JWT token"

        for client in clients_data:
            assert isinstance(client, dict), "Each client item should be a dict"
            tenant_id = client.get("tenant_id")
            assert tenant_id == token_tenant_id, f"Client tenant_id {tenant_id} does not match token tenant_id {token_tenant_id}"

    except requests.RequestException as e:
        assert False, f"RequestException occurred: {e}"

test_get_clients_list_filtered_by_tenant()
