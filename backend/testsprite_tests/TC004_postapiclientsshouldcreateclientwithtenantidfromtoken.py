import requests

base_url = "http://localhost:3001"
api_key = "sk-user-wr0eKZ_Ytg73zZIWxpNDQdWf65bUNwxqET31xUX7c6uNnMi5P4tH6hllD1TqnPiyPBBal8AzniRqDRddlzeaZWfgO15n1RCd4A2Nzb3qIgbgBi1J5Bmj2FPBLP-O5DhhG20"
api_key_header_name = "X-API-KEY"

def test_post_api_clients_creates_client_with_tenant_id_from_token():
    # Step 1: Authenticate user to obtain JWT token with tenant_id
    login_url = f"{base_url}/api/auth/login"
    login_payload = {
        "email": "testuser@example.com",
        "password": "TestPassword123!"
    }
    headers = {
        api_key_header_name: api_key,
        "Content-Type": "application/json"
    }
    login_resp = requests.post(login_url, json=login_payload, headers=headers, timeout=30)
    assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
    login_json = login_resp.json()
    token = login_json.get("token")
    assert token, "No token received from login"
    user = login_json.get("user")
    assert user, "No user object received from login"
    tenant_id_from_token = user.get("tenant_id")
    assert tenant_id_from_token, "tenant_id missing from user object in login response"

    # Step 2: Attempt to create client with Authorization Bearer token and tenant_id in request body (should be forbidden)
    clients_url = f"{base_url}/api/clients"
    client_payload = {
        "fullName": "Client Tenant Ignore Test",
        "phone": "+12345678900",
        "planId": "plan_basic_001",
        # Intentionally put a different tenant_id to test backend forbidding it
        "tenant_id": "some-wrong-tenant-id-to-be-ignored"
    }
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        api_key_header_name: api_key
    }

    create_resp = requests.post(clients_url, json=client_payload, headers=headers, timeout=30)
    assert create_resp.status_code == 403, f"Expected 403 Forbidden, got {create_resp.status_code}: {create_resp.text}"
    error_json = create_resp.json()
    assert "Forbidden" in error_json.get("error", ""), f"Unexpected error message: {error_json}"


test_post_api_clients_creates_client_with_tenant_id_from_token()
