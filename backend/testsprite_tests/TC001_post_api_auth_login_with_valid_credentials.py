import requests

def test_post_api_auth_login_with_valid_credentials():
    base_url = "http://localhost:3001"
    login_url = f"{base_url}/api/auth/login"
    payload = {
        "username": "admin",
        "password": "admin123"
    }
    headers = {
        "Content-Type": "application/json"
    }
    try:
        response = requests.post(login_url, json=payload, headers=headers, timeout=30)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

    assert response.status_code == 200, f"Expected status code 200 but got {response.status_code}"
    try:
        json_resp = response.json()
    except ValueError:
        assert False, "Response is not valid JSON"

    assert "token" in json_resp, "Response JSON does not contain 'token'"
    token = json_resp.get("token")
    assert isinstance(token, str) and len(token) > 0, "'token' should be a non-empty string"


test_post_api_auth_login_with_valid_credentials()
