import requests

BASE_URL = "http://localhost:3001"
TIMEOUT = 30

# Sample valid user credentials for login; these should correspond to a registered user in the test environment
EMAIL = "testuser@example.com"
PASSWORD = "correct_password"

def test_get_api_auth_me_should_return_current_user_profile():
    try:
        # First login to get JWT token
        login_url = f"{BASE_URL}/api/auth/login"
        login_payload = {
            "email": EMAIL,
            "password": PASSWORD
        }
        login_response = requests.post(login_url, json=login_payload, timeout=TIMEOUT)
        assert login_response.status_code == 200, f"Login failed, expected 200 but got {login_response.status_code}"
        login_json = login_response.json()

        assert "token" in login_json, "Login response missing 'token' field"
        token = login_json["token"]
        assert token, "Received empty token from login"

        # Now call /api/auth/me with Authorization: Bearer <token>
        headers = {
            "Authorization": f"Bearer {token}"
        }
        me_url = f"{BASE_URL}/api/auth/me"
        me_response = requests.get(me_url, headers=headers, timeout=TIMEOUT)

        assert me_response.status_code == 200, f"Expected 200, got {me_response.status_code}"

        json_data = me_response.json()

        assert "tenant_id" in json_data, "Response JSON does not contain 'tenant_id'"
        assert json_data["tenant_id"], "'tenant_id' should not be empty or null"

        assert "id" in json_data or "email" in json_data, "Response JSON missing user identification fields"

        tenant_id = json_data["tenant_id"]
        assert isinstance(tenant_id, (str, int)), f"tenant_id must be string or int, got {type(tenant_id)}"

    except requests.Timeout:
        assert False, "Request timed out"
    except requests.RequestException as e:
        assert False, f"Request failed: {str(e)}"
    except ValueError:
        assert False, "Response not in JSON format"


test_get_api_auth_me_should_return_current_user_profile()