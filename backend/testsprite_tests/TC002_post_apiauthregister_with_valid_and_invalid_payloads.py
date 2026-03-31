import requests

BASE_URL = "http://localhost:3001"
REGISTER_ENDPOINT = "/api/auth/register"
TIMEOUT = 30

def test_post_apiauthregister_with_valid_and_invalid_payloads():
    valid_payload = {
        "name": "Test User",
        "email": "testuser@example.com",
        "password": "StrongPass123!"
        "password": "TestPass123!"

    # Test valid registration
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
        assert response.status_code == 201, f"Expected 201 Created, got {response.status_code}"
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
test_post_apiauthregister_with_valid_and_invalid_payloads()