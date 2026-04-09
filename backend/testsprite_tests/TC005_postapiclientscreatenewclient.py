import requests

BASE_URL = "http://localhost:3001/api"
LOGIN_URL = BASE_URL + "/auth/login"
CLIENTS_URL = BASE_URL + "/clients"
LOGIN_CREDENTIALS = {"email": "admin", "password": "admin123"}
TIMEOUT = 30

def test_postapiclientscreatenewclient():
    # Login to get JWT token
    try:
        login_resp = requests.post(LOGIN_URL, json=LOGIN_CREDENTIALS, timeout=TIMEOUT)
        assert login_resp.status_code == 200, f"Login failed with status {login_resp.status_code}"
        login_data = login_resp.json()
        assert "token" in login_data, "Login response missing token"
        token = login_data["token"]
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
    except Exception as e:
        raise AssertionError(f"Login request failed: {str(e)}")

    # Prepare valid client data
    client_data = {
        "name": "Test Client",
        "phone": "+12345678901",
        "metadata": {"plan": "basic", "notes": "automated test client"}
    }

    client_id = None
    try:
        # Create new client
        response = requests.post(CLIENTS_URL, json=client_data, headers=headers, timeout=TIMEOUT)
        assert response.status_code == 201, f"Expected 201 Created, got {response.status_code}"
        resp_json = response.json()
        assert "client_id" in resp_json, "Response missing client_id"
        assert "tenant_id" in resp_json, "Response missing tenant_id"
        client_id = resp_json["client_id"]
        tenant_id = resp_json["tenant_id"]
        assert isinstance(client_id, str) or isinstance(client_id, int), "client_id is not valid"
        assert isinstance(tenant_id, str) or isinstance(tenant_id, int), "tenant_id is not valid"
    except Exception as e:
        raise AssertionError(f"Client creation failed: {str(e)}")
    finally:
        # Cleanup: delete created client if client_id exists
        if client_id is not None:
            try:
                del_resp = requests.delete(f"{CLIENTS_URL}/{client_id}", headers=headers, timeout=TIMEOUT)
                # Accept 204 No Content or 200 OK or 404 Not Found for idempotency
                assert del_resp.status_code in [200, 204, 404]
            except Exception as e:
                print(f"Warning: Failed to delete client {client_id}: {str(e)}")

test_postapiclientscreatenewclient()
