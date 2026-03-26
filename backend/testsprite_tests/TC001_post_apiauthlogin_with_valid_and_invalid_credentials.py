import requests

BASE_URL = "http://localhost:3001"
LOGIN_ENDPOINT = "/api/auth/login"
TIMEOUT = 30

def test_post_apiauthlogin_with_valid_and_invalid_credentials():
    url = BASE_URL + LOGIN_ENDPOINT
    headers = {"Content-Type": "application/json"}

    # Valid credentials payload
    valid_payload = {
        "email": "admin@example.com",
        "password": "admin123"
    }
    # Invalid credentials payload
    invalid_payload = {
        "email": "admin@example.com",
        "password": "wrongpassword"
    }

    # Test login with valid credentials
    try:
        valid_response = requests.post(url, json=valid_payload, headers=headers, timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"Request to {url} with valid credentials failed: {e}"
    assert valid_response.status_code == 200, f"Expected 200 OK for valid credentials but got {valid_response.status_code}"
    try:
        json_data = valid_response.json()
    except ValueError:
        assert False, "Response for valid credentials is not valid JSON"
    assert "token" in json_data and isinstance(json_data["token"], str) and len(json_data["token"].strip()) > 0, "Valid login response missing JWT token"

    # Test login with invalid credentials
    try:
        invalid_response = requests.post(url, json=invalid_payload, headers=headers, timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"Request to {url} with invalid credentials failed: {e}"
    assert invalid_response.status_code == 401, f"Expected 401 Unauthorized for invalid credentials but got {invalid_response.status_code}"
    try:
        json_data = invalid_response.json()
    except ValueError:
        assert False, "Response for invalid credentials is not valid JSON"
    # Validate error message field containing 'Invalid credentials'
    error_message = None
    if isinstance(json_data, dict):
        error_message = json_data.get("error") or json_data.get("message") or json_data.get("detail")
    assert error_message is not None, "Error message missing in invalid credentials response"
    assert "invalid credentials" in error_message.lower(), f"Expected error message to contain 'Invalid credentials' but got: {error_message}"

test_post_apiauthlogin_with_valid_and_invalid_credentials()