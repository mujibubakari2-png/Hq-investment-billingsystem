import requests

BASE_URL = "http://localhost:3000"
LOGIN_ENDPOINT = "/api/auth/login"
ROUTERS_ENDPOINT = "/api/routers"
TIMEOUT = 30

def test_get_api_routers_list_with_authorization():
    # First, log in to get a valid JWT token
    login_payload = {
        "username": "admin",
        "password": "admin123"
    }
    try:
        login_response = requests.post(
            BASE_URL + LOGIN_ENDPOINT,
            json=login_payload,
            timeout=TIMEOUT
        )
        assert login_response.status_code == 200, f"Login failed with status code {login_response.status_code}"
        login_json = login_response.json()
        assert "accessToken" in login_json, "JWT token not found in login response"
        token = login_json["accessToken"]

        # Use the token to get the list of routers
        headers = {
            "Authorization": f"Bearer {token}"
        }
        routers_response = requests.get(
            BASE_URL + ROUTERS_ENDPOINT,
            headers=headers,
            timeout=TIMEOUT
        )
        assert routers_response.status_code == 200, f"Failed to get routers list with status {routers_response.status_code}"
        routers_list = routers_response.json()
        assert isinstance(routers_list, list), "Routers list response is not a list"
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

test_get_api_routers_list_with_authorization()
