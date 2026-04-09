import requests

BASE_URL = "http://localhost:3001"
LOGIN_ENDPOINT = "/api/auth/login"
AUTH_ME_ENDPOINT = "/api/auth/me"
TIMEOUT = 30

def test_get_api_auth_me_get_current_user_profile():
    login_url = BASE_URL + LOGIN_ENDPOINT
    auth_me_url = BASE_URL + AUTH_ME_ENDPOINT
    login_payload = {
        "email": "hqbakari@gmail.com",
        "password": "Muu@1212"
    }
    headers = {"Content-Type": "application/json"}
    token = None

    # Login to get JWT token
    try:
        login_resp = requests.post(login_url, json=login_payload, headers=headers, timeout=TIMEOUT)
        assert login_resp.status_code == 200, f"Login failed with status code {login_resp.status_code}"
        login_json = login_resp.json()
        # Check common token keys
        if "token" in login_json:
            token = login_json["token"]
        elif "access_token" in login_json:
            token = login_json["access_token"]
        elif "jwt" in login_json:
            token = login_json["jwt"]
        else:
            assert False, "No token found in login response"
    except requests.RequestException as e:
        assert False, f"Login request failed: {e}"

    # Test GET /api/auth/me with valid Authorization header
    try:
        auth_headers = {
            "Authorization": f"Bearer {token}"
        }
        resp = requests.get(auth_me_url, headers=auth_headers, timeout=TIMEOUT)
        assert resp.status_code == 200, f"Expected 200 OK with valid token, got {resp.status_code}"
        profile = resp.json()
        assert isinstance(profile, dict), "Profile response is not a JSON object"
        assert "tenant_id" in profile, "tenant_id not present in user profile"
    except requests.RequestException as e:
        assert False, f"GET /api/auth/me with token request failed: {e}"

    # Test GET /api/auth/me without Authorization header
    try:
        resp_no_auth = requests.get(auth_me_url, timeout=TIMEOUT)
        assert resp_no_auth.status_code == 401, f"Expected 401 Unauthorized without token, got {resp_no_auth.status_code}"
    except requests.RequestException as e:
        assert False, f"GET /api/auth/me without token request failed: {e}"

test_get_api_auth_me_get_current_user_profile()
