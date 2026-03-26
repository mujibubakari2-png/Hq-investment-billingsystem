import requests

BASE_URL = "http://localhost:3001"
REGISTER_ENDPOINT = "/api/auth/register"
TIMEOUT = 30

def test_post_apiauthregister_with_valid_and_invalid_payloads():
    # Valid payload
    valid_payload = {
        "name": "Test User",
        "email": "testuser@example.com",
        "password": "TestPass123!"
    }

    # Invalid payloads (missing fields or wrong types)
    invalid_payloads = [
        {},  # empty payload
        {"name": "No Email User", "password": "TestPass123!"},  # missing email
        {"email": "missingname@example.com", "password": "TestPass123!"},  # missing name
        {"name": "No Password User", "email": "nopassword@example.com"},  # missing password
        {"name": "", "email": "emptyname@example.com", "password": "TestPass123!"},  # empty name
        {"name": "Invalid Email", "email": "not-an-email", "password": "TestPass123!"},  # invalid email format
        {"name": "Short Password", "email": "shortpass@example.com", "password": "123"},  # too short password
    ]

    headers = {
        "Content-Type": "application/json"
    }

    # Test valid registration
    try:
        resp = requests.post(
            BASE_URL + REGISTER_ENDPOINT,
            json=valid_payload,
            headers=headers,
            timeout=TIMEOUT
        )
    except requests.RequestException as e:
        assert False, f"Valid registration request failed with exception: {e}"

    assert resp.status_code == 201, f"Expected 201 Created, got {resp.status_code}"
    try:
        data = resp.json()
    except ValueError:
        assert False, "Response is not valid JSON"

    assert "token" in data and isinstance(data["token"], str) and len(data["token"]) > 0, \
        "Response JSON does not contain a valid 'token' field"

    # Test invalid registration payloads
    for idx, invalid_payload in enumerate(invalid_payloads):
        try:
            resp_invalid = requests.post(
                BASE_URL + REGISTER_ENDPOINT,
                json=invalid_payload,
                headers=headers,
                timeout=TIMEOUT
            )
        except requests.RequestException as e:
            assert False, f"Invalid registration request #{idx+1} failed with exception: {e}"

        # Expecting 400 Bad Request or other 4xx error related to validation
        assert resp_invalid.status_code >= 400 and resp_invalid.status_code < 500, \
            f"Invalid payload #{idx+1} expected 4xx status, got {resp_invalid.status_code}"

        try:
            error_data = resp_invalid.json()
        except ValueError:
            continue  # If no JSON, skip further checks for this case

        # Validate error message presence (may vary, do loose check)
        error_fields = ["error", "message", "errors"]
        assert any(field in error_data for field in error_fields), \
            f"Invalid payload #{idx+1} response JSON missing error-related fields"

test_post_apiauthregister_with_valid_and_invalid_payloads()