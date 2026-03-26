import requests
import uuid

BASE_URL = "http://localhost:3000"
REGISTER_ENDPOINT = "/api/auth/register"
AUTH_ME_ENDPOINT = "/api/auth/me"
TIMEOUT = 30

def test_post_api_auth_register_with_valid_user_data():
    # Generate unique user data to avoid conflicts
    unique_suffix = str(uuid.uuid4())[:8]
    user_data = {
        "name": f"Test User {unique_suffix}",
        "email": f"testuser{unique_suffix}@example.com",
        "password": "SecurePass123!"
    }

    try:
        # POST /api/auth/register
        response = requests.post(
            f"{BASE_URL}{REGISTER_ENDPOINT}",
            json=user_data,
            timeout=TIMEOUT
        )
        assert response.status_code == 201, f"Expected 201 Created, got {response.status_code}"
        resp_json = response.json()
        # Check JWT presence in response
        assert "token" in resp_json and isinstance(resp_json["token"], str) and len(resp_json["token"]) > 0, \
            "JWT token missing or invalid in response"

        token = resp_json["token"]

        # GET /api/auth/me with Authorization header
        headers = {"Authorization": f"Bearer {token}"}
        profile_response = requests.get(
            f"{BASE_URL}{AUTH_ME_ENDPOINT}",
            headers=headers,
            timeout=TIMEOUT
        )
        assert profile_response.status_code == 200, f"Expected 200 OK for /api/auth/me, got {profile_response.status_code}"

        profile_json = profile_response.json()
        # Validate returned user profile data matches registration (except password)
        assert "name" in profile_json and profile_json["name"] == user_data["name"], "Name in profile does not match registered name"
        assert "email" in profile_json and profile_json["email"] == user_data["email"], "Email in profile does not match registered email"

    except requests.RequestException as e:
        assert False, f"Request failed: {str(e)}"

test_post_api_auth_register_with_valid_user_data()