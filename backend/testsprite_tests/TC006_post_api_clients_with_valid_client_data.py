import requests
import uuid

BASE_URL = "http://localhost:3000"
TIMEOUT = 30

# These are dummy credentials for login, replace with valid ones if needed.
AUTH_USERNAME = "admin"
AUTH_PASSWORD = "admin123"

def test_post_api_clients_with_valid_client_data():
    # Authenticate and get JWT token
    login_payload = {"username": AUTH_USERNAME, "password": AUTH_PASSWORD}
    login_resp = requests.post(
        f"{BASE_URL}/api/auth/login",
        json=login_payload,
        timeout=TIMEOUT,
    )
    assert login_resp.status_code == 200, "Login failed"
    token = login_resp.json().get("token")
    assert token, "JWT token not found in login response"

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    # Prepare valid client payload
    unique_username = f"user_{uuid.uuid4().hex[:8]}"
    client_payload = {
        "username": unique_username,
        "fullName": "Test User",
        "phone": "+1234567890",
        "planId": "basic"  # assuming 'basic' is a valid planId; adjust as needed
    }

    client_id = None
    try:
        # Create client
        create_resp = requests.post(
            f"{BASE_URL}/api/clients",
            headers=headers,
            json=client_payload,
            timeout=TIMEOUT,
        )
        assert create_resp.status_code == 201, f"Unexpected status code on client creation: {create_resp.status_code}"
        created_client = create_resp.json()
        client_id = created_client.get("id")
        assert client_id, "Created client ID not returned"

        # List clients
        list_resp = requests.get(
            f"{BASE_URL}/api/clients",
            headers=headers,
            timeout=TIMEOUT,
        )
        assert list_resp.status_code == 200, f"Unexpected status code on client list: {list_resp.status_code}"
        clients_list = list_resp.json()
        assert isinstance(clients_list, list), "Clients list response is not a list"

        # Check if newly created client is in the list
        found = any(
            c.get("id") == client_id and c.get("username") == unique_username
            for c in clients_list
        )
        assert found, "Newly created client not found in clients list"
    finally:
        # Clean up: delete the created client if it was created
        if client_id:
            del_resp = requests.delete(
                f"{BASE_URL}/api/clients/{client_id}",
                headers=headers,
                timeout=TIMEOUT,
            )
            # It is okay if the delete fails during cleanup, just log or ignore here
            assert del_resp.status_code in (200, 204), f"Failed to delete client during cleanup, status: {del_resp.status_code}"

test_post_api_clients_with_valid_client_data()