import requests

BASE_URL = "http://localhost:3001"
LOGIN_ENDPOINT = "/api/auth/login"
TIMEOUT = 30

def test_post_apiauthlogin_valid_and_invalid_credentials():
    # Valid credentials - these should exist on the system for the test to pass.

        "email": "admin@example.com",
        "password": "CorrectPassword123"
        "email": "admin@example.com",
        "password": "AdminPassword123!"
    }

    try:
        valid_response = requests.post(url, json=valid_payload, timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"Valid credentials request failed: {e}"

    assert valid_response.status_code == 200, f"Expected 200 OK for valid credentials, got {valid_response.status_code}"
    try:
        valid_json = valid_response.json()
    except ValueError:
        assert False, "Valid credentials response is not valid JSON"

    # Assert JWT token presence in response (could be in a field like 'token')
    assert "token" in valid_json or "accessToken" in valid_json, "JWT token not found in valid login response"

    # Invalid credentials (wrong password)
    invalid_payload = {
        "email": "admin@example.com",
        "password": "WrongPassword!"
    }

    try:
        invalid_response = requests.post(url, json=invalid_payload, timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"Invalid credentials request failed: {e}"

    assert invalid_response.status_code == 401, f"Expected 401 Unauthorized for invalid credentials, got {invalid_response.status_code}"
    try:
        invalid_json = invalid_response.json()
    except ValueError:
        assert False, "Invalid credentials response is not valid JSON"

    # Assert error message
    error_message = invalid_json.get("error") or invalid_json.get("message") or ""
    assert "Invalid credentials" in error_message, f"Expected 'Invalid credentials' message, got: {error_message}"

test_post_apiauthlogin_valid_and_invalid_credentials()