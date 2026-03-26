import requests

BASE_URL = "http://localhost:3001"
ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "admin123"
TIMEOUT = 30

def test_get_api_auth_me_with_valid_and_missing_authorization():
    login_url = f"{BASE_URL}/api/auth/login"
    auth_me_url = f"{BASE_URL}/api/auth/me"

    # Step 1: Login with valid admin credentials to get JWT token
    login_payload = {
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    }
    try:
        login_response = requests.post(login_url, json=login_payload, timeout=TIMEOUT)
        assert login_response.status_code == 200, f"Login failed, status: {login_response.status_code}, response: {login_response.text}"

        login_json = login_response.json()
        assert "token" in login_json or "accessToken" in login_json, "No token found in login response"
        # Supporting either "token" or "accessToken" key for JWT token
        token = login_json.get("token") or login_json.get("accessToken")
        assert isinstance(token, str) and len(token) > 0, "Token is empty or invalid"

        headers_with_auth = {
            "Authorization": f"Bearer {token}"
        }

        # Step 2: Call /api/auth/me with valid Authorization header
        auth_me_response = requests.get(auth_me_url, headers=headers_with_auth, timeout=TIMEOUT)
        assert auth_me_response.status_code == 200, f"/api/auth/me with valid token failed, status: {auth_me_response.status_code}, response: {auth_me_response.text}"

        auth_me_json = auth_me_response.json()
        # Validate expected fields in user profile, minimally email matches admin email 
        assert "email" in auth_me_json, "Email field missing in /api/auth/me response"
        assert auth_me_json["email"].lower() == ADMIN_EMAIL.lower(), f"Email mismatch: expected {ADMIN_EMAIL} got {auth_me_json['email']}"

        # Step 3: Call /api/auth/me WITHOUT Authorization header
        no_auth_response = requests.get(auth_me_url, timeout=TIMEOUT)
        assert no_auth_response.status_code == 401, f"/api/auth/me without token should return 401, got {no_auth_response.status_code}"
        # Optional: Validate error message in response
        try:
            error_json = no_auth_response.json()
            error_msg_keys = ['error', 'message', 'detail']
            assert any(key in error_json for key in error_msg_keys), "No error message in 401 response"
        except Exception:
            # Response may not be JSON, skip further validation
            pass

    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

test_get_api_auth_me_with_valid_and_missing_authorization()