import requests
import base64
import json

BASE_URL = "http://localhost:3001/api"
TIMEOUT = 30


def test_postapiauthloginuserloginwithusernameandpassword():
    url = f"{BASE_URL}/auth/login"
    payload = {
        "email": "admin",
        "password": "admin123"
    }
    try:
        response = requests.post(url, json=payload, timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"HTTP request failed: {e}"

    assert response.status_code == 200, f"Expected status code 200, got {response.status_code}"

    try:
        data = response.json()
    except ValueError:
        assert False, "Response is not valid JSON"

    token = data.get("token")
    assert token is not None, "JWT token is missing in response"

    # Decode JWT token payload (second part) without verification
    try:
        payload_part = token.split('.')[1]
        # Pad base64 string if necessary
        padding = '=' * (-len(payload_part) % 4)
        payload_bytes = base64.urlsafe_b64decode(payload_part + padding)
        decoded = json.loads(payload_bytes)
    except Exception as e:
        assert False, f"Failed to decode JWT token payload: {e}"

    assert "tenant_id" in decoded, "tenant_id claim missing in JWT token"


test_postapiauthloginuserloginwithusernameandpassword()
