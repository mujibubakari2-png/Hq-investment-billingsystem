import requests
import time

BASE_URL = "http://localhost:3001"
ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "admin123"
TIMEOUT = 30

def test_get_and_post_apiclients_with_valid_and_invalid_data():
    # Step 1: Authenticate and get JWT token
    login_url = f"{BASE_URL}/api/auth/login"
    login_payload = {
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    }
    try:
        login_resp = requests.post(login_url, json=login_payload, timeout=TIMEOUT)
        assert login_resp.status_code == 200, f"Login failed with status {login_resp.status_code}"
        token = login_resp.json().get("token")
        assert token, "JWT token not found in login response"
    except requests.RequestException as e:
        assert False, f"Login request failed: {e}"
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    # Step 2: GET /api/clients with valid Authorization header
    clients_url = f"{BASE_URL}/api/clients"
    try:
        get_clients_resp = requests.get(clients_url, headers=headers, timeout=TIMEOUT)
        assert get_clients_resp.status_code == 200, f"GET /api/clients failed with status {get_clients_resp.status_code}"
        clients_list = get_clients_resp.json()
        assert isinstance(clients_list, list), "Response for GET /api/clients is not a list"
    except requests.RequestException as e:
        assert False, f"GET /api/clients request failed: {e}"

    # Step 3: POST /api/clients with complete valid payload (should create client and respond 201)
    unique_suffix = int(time.time())
    valid_client_payload = {
        "username": f"testuser123_{unique_suffix}",
        "fullName": "Test User",
        "phone": "+12345678901",
        "planId": 1  # Assuming planId 1 exists; no API details given, using integer as typical ID
    }
    created_client_id = None
    try:
        post_client_resp = requests.post(clients_url, headers=headers, json=valid_client_payload, timeout=TIMEOUT)
        assert post_client_resp.status_code == 201, f"POST /api/clients valid payload expected 201 but got {post_client_resp.status_code}"
        created_client = post_client_resp.json()
        created_client_id = created_client.get("id")
        assert created_client_id is not None, "Created client id not found in response"
        # Basic fields check
        assert created_client.get("username") == valid_client_payload["username"], "Created client username mismatch"
        assert created_client.get("fullName") == valid_client_payload["fullName"], "Created client fullName mismatch"
    except requests.RequestException as e:
        assert False, f"POST /api/clients request with valid payload failed: {e}"
    finally:
        # Clean up created client if it was created
        if created_client_id:
            try:
                del_resp = requests.delete(f"{clients_url}/{created_client_id}", headers=headers, timeout=TIMEOUT)
                # Accept 200 OK or 204 No Content as successful deletion
                assert del_resp.status_code in (200, 204), f"Failed to delete client {created_client_id} status {del_resp.status_code}"
            except Exception:
                # Don't throw further, just ignore cleanup failure here
                pass

    # Step 4: POST /api/clients with incomplete payload (missing required field 'username')
    invalid_payload_missing_username = {
        "fullName": "Invalid User",
        "phone": "+12345678901",
        "planId": 1
    }
    try:
        post_invalid_resp = requests.post(clients_url, headers=headers, json=invalid_payload_missing_username, timeout=TIMEOUT)
        assert post_invalid_resp.status_code == 400, f"POST /api/clients incomplete payload expected 400 but got {post_invalid_resp.status_code}"
        error_resp = post_invalid_resp.json()
        # Expect validation error mentioning username required (may vary, check key or message)
        error_message = (
            error_resp.get("error") or
            error_resp.get("message") or
            str(error_resp)
        )
        assert "username" in str(error_message).lower(), "Expected validation error about missing 'username'"
    except requests.RequestException as e:
        assert False, f"POST /api/clients request with incomplete payload failed: {e}"

    # Step 5: POST /api/clients with invalid payload (invalid phone format)
    invalid_payload_bad_phone = {
        "username": "invaliduser",
        "fullName": "Invalid Phone",
        "phone": "notaphone",
        "planId": 1
    }
    try:
        post_invalid_phone_resp = requests.post(clients_url, headers=headers, json=invalid_payload_bad_phone, timeout=TIMEOUT)
        # API might return 400 Bad Request if validation triggers on phone format
        if post_invalid_phone_resp.status_code != 400:
            # If it does not error out here, we assert failure
            assert False, f"POST /api/clients with invalid phone expected 400 but got {post_invalid_phone_resp.status_code}"
        error_resp = post_invalid_phone_resp.json()
        error_message = (
            error_resp.get("error") or
            error_resp.get("message") or
            str(error_resp)
        )
        assert "phone" in str(error_message).lower(), "Expected validation error about invalid 'phone'"
    except requests.RequestException as e:
        assert False, f"POST /api/clients request with invalid phone payload failed: {e}"

test_get_and_post_apiclients_with_valid_and_invalid_data()
