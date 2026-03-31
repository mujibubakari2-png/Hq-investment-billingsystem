import requests

BASE_URL = "http://localhost:3001"
REGISTER_ENDPOINT = "/api/auth/register"
AUTH_ME_ENDPOINT = "/api/auth/me"
TIMEOUT = 30


def test_get_apiauthme_with_valid_and_missing_authorization():
    # Prepare a registration payload to get a valid JWT token
    register_payload = {
        "name": "Test User",
        "email": "testuser_tc003@example.com",
        "password": "TestPassword123!",
        "verificationCode": "123456",
        "companyName": "Test Company"
    }
    token = None

    try:
        # Register a new user to obtain a JWT token
        register_response = requests.post(
            BASE_URL + REGISTER_ENDPOINT,
            json=register_payload,
            timeout=TIMEOUT
        )
        assert register_response.status_code == 201, f"Registration failed: {register_response.text}"
        register_data = register_response.json()
        assert "token" in register_data, "No token found in registration response"
        token = register_data["token"]

        # Call /api/auth/me with valid Authorization header
        headers_valid_auth = {"Authorization": f"Bearer {token}"}
        me_response_valid = requests.get(
            BASE_URL + AUTH_ME_ENDPOINT,
            headers=headers_valid_auth,
            timeout=TIMEOUT
        )
        assert me_response_valid.status_code == 200, f"Expected 200 OK with valid auth, got {me_response_valid.status_code}"
        me_data = me_response_valid.json()
        # Basic checks for user profile fields
        assert "email" in me_data and me_data["email"] == register_payload["email"], "User email mismatch in /api/auth/me response"
        assert "name" in me_data and me_data["name"] == register_payload["name"], "User name mismatch in /api/auth/me response"

        # Call /api/auth/me without Authorization header
        me_response_no_auth = requests.get(
            BASE_URL + AUTH_ME_ENDPOINT,
            timeout=TIMEOUT
        )
        assert me_response_no_auth.status_code == 401, f"Expected 401 Unauthorized without auth, got {me_response_no_auth.status_code}"
        error_data = me_response_no_auth.json()
        assert (
            ("error" in error_data and "unauthorized" in error_data.get("error", "").lower())
            or ("message" in error_data and "unauthorized" in error_data.get("message", "").lower())
            or ("detail" in error_data and "unauthorized" in error_data.get("detail", "").lower())
        ), f"Unauthorized response does not contain expected error message: {error_data}"

    finally:
        if token:
            # Cleanup user by deleting it if such endpoint exists
            # Since no delete user endpoint is documented, skip deletion
            pass


test_get_apiauthme_with_valid_and_missing_authorization()
