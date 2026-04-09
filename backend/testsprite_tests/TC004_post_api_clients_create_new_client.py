import requests

BASE_URL = "http://localhost:3001"
LOGIN_ENDPOINT = "/api/auth/login"
CLIENTS_ENDPOINT = "/api/clients"
TIMEOUT = 30
AUTH_API_KEY = "sk-user-wr0eKZ_Ytg73zZIWxpNDQdWf65bUNwxqET31xUX7c6uNnMi5P4tH6hllD1TqnPiyPBBal8AzniRqDRddlzeaZWfgO15n1RCd4A2Nzb3qIgbgBi1J5Bmj2FPBLP-O5DhhG20"

def test_post_api_clients_create_new_client():
    # Login to get JWT token
    login_payload = {
        "email": "hqbakari@gmail.com",
        "password": "Muu@1212"
    }
    try:
        resp = requests.post(
            BASE_URL + LOGIN_ENDPOINT,
            json=login_payload,
            timeout=TIMEOUT
        )
        resp.raise_for_status()
        token = resp.json().get("token")
        assert token and isinstance(token, str), "JWT token missing or invalid"
    except Exception as e:
        raise AssertionError(f"Login failed: {e}")

    headers = {
        "Authorization": f"Bearer {token}",
        "x-api-key": AUTH_API_KEY,
        "Content-Type": "application/json"
    }

    # Test 1: Create new client with valid required fields -> expect 201 Created with client_id
    valid_client = {
        "name": "Test Client",
        "email": "testclient@example.com",
        "contact": "1234567890"
    }

    client_id = None

    try:
        resp = requests.post(
            BASE_URL + CLIENTS_ENDPOINT,
            json=valid_client,
            headers=headers,
            timeout=TIMEOUT
        )
        assert resp.status_code == 201, f"Expected 201 Created, got {resp.status_code}"
        json_resp = resp.json()
        client_id = json_resp.get("client_id")
        assert client_id and isinstance(client_id, (int, str)), "client_id missing or invalid"

        # Test 2: Missing required fields -> expect 400 Bad Request
        # We'll omit 'name' field
        incomplete_client = {
            "email": "incomplete@example.com",
            "contact": "1234567890"
        }
        resp2 = requests.post(
            BASE_URL + CLIENTS_ENDPOINT,
            json=incomplete_client,
            headers=headers,
            timeout=TIMEOUT
        )
        assert resp2.status_code == 400, f"Expected 400 Bad Request for missing required fields, got {resp2.status_code}"

        # Test 3: tenant_id override attempt -> expect 403 Forbidden
        # Include tenant_id in payload differing from token
        tenant_override_client = {
            "name": "Tenant Override Client",
            "email": "tenantoverride@example.com",
            "contact": "1234567890",
            "tenant_id": "some-other-tenant-id"
        }
        resp3 = requests.post(
            BASE_URL + CLIENTS_ENDPOINT,
            json=tenant_override_client,
            headers=headers,
            timeout=TIMEOUT
        )
        assert resp3.status_code == 403, f"Expected 403 Forbidden for tenant_id override, got {resp3.status_code}"
    finally:
        # Clean up: delete the created client if created
        if client_id:
            try:
                del_resp = requests.delete(
                    f"{BASE_URL}{CLIENTS_ENDPOINT}/{client_id}",
                    headers=headers,
                    timeout=TIMEOUT
                )
                # It's okay if delete fails due to any reason but log/assert if needed
            except Exception:
                pass

test_post_api_clients_create_new_client()
