import requests
import uuid

BASE_URL = "http://localhost:3000"
TIMEOUT = 30

def test_get_api_auth_me_with_valid_token():
    register_url = f"{BASE_URL}/api/auth/register"
    me_url = f"{BASE_URL}/api/auth/me"
    unique_email = f"testuser_tc003_{uuid.uuid4()}@example.com"
    user_payload = {
        "name": "Test User TC003",
        "email": unique_email,
        "password": "StrongPassword123!"
    }
    token = None
    headers = {}

    # Register a new user to get a valid JWT token
    try:
        response = requests.post(register_url, json=user_payload, timeout=TIMEOUT)
        assert response.status_code == 201, f"Expected 201 Created but got {response.status_code}"
        data = response.json()
        assert "token" in data and isinstance(data["token"], str) and data["token"], "JWT token missing or empty in register response"
        token = data["token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Use the token to call GET /api/auth/me
        me_response = requests.get(me_url, headers=headers, timeout=TIMEOUT)
        assert me_response.status_code == 200, f"Expected 200 OK but got {me_response.status_code}"
        me_data = me_response.json()

        # Validate user profile fields in response
        assert isinstance(me_data, dict), "Response JSON for /api/auth/me is not a dictionary"
        required_fields = ["id", "name", "email"]
        for field in required_fields:
            assert field in me_data, f"Field '{field}' not found in /api/auth/me response"
        assert me_data["email"] == user_payload["email"], "Email in profile does not match registered email"
        assert me_data["name"] == user_payload["name"], "Name in profile does not match registered name"

    finally:
        pass

test_get_api_auth_me_with_valid_token()
