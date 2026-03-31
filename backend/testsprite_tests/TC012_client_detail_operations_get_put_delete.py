import requests
import uuid

BASE_URL = "http://localhost:3001"
TIMEOUT = 30

# Helper function to login and get auth token
def get_auth_token():
    login_payload = {
        "email": "admin@example.com",
        "password": "password"
    }
    resp = requests.post(f"{BASE_URL}/api/auth/login", json=login_payload, timeout=TIMEOUT)
    resp.raise_for_status()
    data = resp.json()
    assert "token" in data or "accessToken" in data or "jwt" in data, "Login response missing token"
    # Attempt common token keys
    token = data.get("token") or data.get("accessToken") or data.get("jwt") or data.get("access_token")
    assert token, "No token found in login response"
    return token

def test_TC012_client_detail_operations_get_put_delete():
    token = get_auth_token()
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    created_client_id = None

    # First create a new client to test on
    try:
        client_payload = {
            "username": f"testuser_{uuid.uuid4().hex[:8]}",
            "fullName": "Test User",
            "phone": "+12345678901"
            # Removed planId as it might be required and None causes issue
        }

        # Try creating client
        create_resp = requests.post(f"{BASE_URL}/api/clients", json=client_payload, headers=headers, timeout=TIMEOUT)
        assert create_resp.status_code == 201, f"Expected 201 Created but got {create_resp.status_code}"
        create_data = create_resp.json()
        created_client_id = create_data.get("id") or create_data.get("clientId") or create_data.get("_id")
        assert created_client_id, "Created client response missing id"

        # GET the client detail
        get_resp = requests.get(f"{BASE_URL}/api/clients/{created_client_id}", headers=headers, timeout=TIMEOUT)
        assert get_resp.status_code == 200, f"GET client returned {get_resp.status_code} instead of 200"
        get_data = get_resp.json()
        assert get_data.get("id") == created_client_id or str(get_data.get("id")) == str(created_client_id), "Mismatch in client id from GET"

        # PUT update client detail
        update_payload = {
            "fullName": "Updated Test User",
            "phone": "+10987654321"
        }
        put_resp = requests.put(f"{BASE_URL}/api/clients/{created_client_id}", json=update_payload, headers=headers, timeout=TIMEOUT)
        assert put_resp.status_code == 200, f"PUT update client returned {put_resp.status_code} instead of 200"
        put_data = put_resp.json()
        # Validate updated fields
        assert put_data.get("fullName") == "Updated Test User"
        assert put_data.get("phone") == "+10987654321"

        # GET again to verify update persisted
        get_resp2 = requests.get(f"{BASE_URL}/api/clients/{created_client_id}", headers=headers, timeout=TIMEOUT)
        assert get_resp2.status_code == 200, f"GET after update returned {get_resp2.status_code} instead of 200"
        get_data2 = get_resp2.json()
        assert get_data2.get("fullName") == "Updated Test User"
        assert get_data2.get("phone") == "+10987654321"

    finally:
        # Clean up: delete the created client if exists
        if created_client_id:
            del_resp = requests.delete(f"{BASE_URL}/api/clients/{created_client_id}", headers=headers, timeout=TIMEOUT)
            # 204 No Content or 200 OK expected for delete
            assert del_resp.status_code in (200, 204), f"Delete client returned {del_resp.status_code} instead of 200/204"

test_TC012_client_detail_operations_get_put_delete()
