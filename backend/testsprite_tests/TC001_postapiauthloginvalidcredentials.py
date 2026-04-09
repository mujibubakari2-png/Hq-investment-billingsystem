import requests
import base64
import json

BASE_URL = "http://localhost:3001"
LOGIN_ENDPOINT = "/api/auth/login"
TIMEOUT = 30


def test_postapiauthloginvalidcredentials():
    url = BASE_URL + LOGIN_ENDPOINT
    headers = {
        "Content-Type": "application/json"
    }
    payload = {
        "email": "hqbakari@gmail.com",
        "password": "Muu@1212"
    }
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=TIMEOUT)
        assert response.status_code == 200, f"Expected 200 OK, got {response.status_code}"
        json_resp = response.json()
        assert "token" in json_resp, "Response JSON does not contain 'token'"

        token = json_resp["token"]
        payload_b64 = token.split(".")[1]
        # Pad base64 string
        padding = 4 - (len(payload_b64) % 4)
        payload_b64 += "=" * (padding if padding < 4 else 0)
        payload_json = base64.urlsafe_base64decode(payload_b64.encode()).decode()
        decoded = json.loads(payload_json)
        assert "tenant_id" in decoded, "JWT token does not contain tenant_id claim"
        assert decoded["tenant_id"], "tenant_id claim is empty or falsey"

    except requests.exceptions.RequestException as e:
        assert False, f"Request failed: {e}"


test_postapiauthloginvalidcredentials()