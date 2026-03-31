import requests

BASE_URL = "http://localhost:3001"
TIMEOUT = 30

# Replace these with valid credentials in your test environment
TEST_USER_EMAIL = "testuser@example.com"
TEST_USER_PASSWORD = "TestPassword123!"

def get_auth_token():
    login_url = f"{BASE_URL}/api/auth/login"
    payload = {
        "email": TEST_USER_EMAIL,
        "password": TEST_USER_PASSWORD
    }
    try:
        response = requests.post(login_url, json=payload, timeout=TIMEOUT)
        response.raise_for_status()
        data = response.json()
        token = data.get("token") or data.get("accessToken") or data.get("jwt")  # check common JWT fields
        assert token, "JWT token not found in login response"
        return token
    except requests.RequestException as e:
        raise AssertionError(f"Authentication failed: {e}")
    except AssertionError as e:
        raise AssertionError(f"Authentication failed: {e}")

def test_get_and_post_api_clients_valid_invalid_data():
    token = get_auth_token()
    headers = {"Authorization": f"Bearer {token}"}

    # 1. GET /api/clients with valid Authorization header -> expect 200 OK and JSON list
    clients_url = f"{BASE_URL}/api/clients"
    try:
        get_response = requests.get(clients_url, headers=headers, timeout=TIMEOUT)
        assert get_response.status_code == 200, f"Expected 200 OK on GET /api/clients, got {get_response.status_code}"
        clients_list = get_response.json()
        assert isinstance(clients_list, list), "Expected response to be a JSON list of clients"
    except requests.RequestException as e:
        assert False, f"GET /api/clients request failed: {e}"
    except AssertionError as e:
        assert False, f"GET /api/clients assertion failed: {e}"

    # 2. POST /api/clients with complete valid payload -> expect 201 Created and response includes client info
    valid_payload = {
        "username": "testclient123",
        "fullName": "Test Client",
        "phone": "+254700000000",
        "planId": 1  # assuming planId 1 exists; adjust if needed
    }

    created_client_id = None
    try:
        post_response = requests.post(clients_url, headers={**headers, "Content-Type": "application/json"},
                                      json=valid_payload, timeout=TIMEOUT)
        assert post_response.status_code == 201, f"Expected 201 Created on POST /api/clients, got {post_response.status_code}"
        created_client = post_response.json()
        created_client_id = created_client.get("id") or created_client.get("clientId")
        assert created_client_id is not None, "Created client id missing in response"
        assert created_client.get("username") == valid_payload["username"], "Created client username mismatch"
    except requests.RequestException as e:
        assert False, f"POST /api/clients with valid data request failed: {e}"
    except AssertionError as e:
        assert False, f"POST /api/clients with valid data assertion failed: {e}"

    # 3. POST /api/clients with invalid (incomplete) payload - e.g. missing required field 'username'
    invalid_payload = {
        # "username" omitted intentionally
        "fullName": "Invalid Client",
        "phone": "+254700000001",
        "planId": 1
    }
    try:
        invalid_post_response = requests.post(clients_url, headers={**headers, "Content-Type": "application/json"},
                                              json=invalid_payload, timeout=TIMEOUT)
        # Expect 400 Bad Request or similar validation error
        assert invalid_post_response.status_code == 400, (
            f"Expected 400 Bad Request for invalid POST /api/clients, got {invalid_post_response.status_code}"
        )
        error_response = invalid_post_response.json()
        # Validate error contains mention of missing 'username'
        error_messages = str(error_response).lower()
        assert "username" in error_messages or "missing" in error_messages or "required" in error_messages, (
            f"Error response does not mention missing 'username': {error_response}"
        )
    except requests.RequestException as e:
        assert False, f"POST /api/clients with invalid data request failed: {e}"
    except AssertionError as e:
        assert False, f"POST /api/clients with invalid data assertion failed: {e}"
    finally:
        # Clean up - delete the created client if created
        if created_client_id is not None:
            delete_url = f"{clients_url}/{created_client_id}"
            try:
                del_response = requests.delete(delete_url, headers=headers, timeout=TIMEOUT)
                # Accept 200 OK or 204 No Content on delete success
                assert del_response.status_code in [200, 204], f"Failed to delete test client, status: {del_response.status_code}"
            except Exception:
                # Log but do not fail the test on cleanup issues
                pass

test_get_and_post_api_clients_valid_invalid_data()
