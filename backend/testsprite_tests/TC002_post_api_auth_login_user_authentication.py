import requests
import jwt

BASE_URL = "http://localhost:3001/http://localhost:3001"
API_KEY = "sk-user-wr0eKZ_Ytg73zZIWxpNDQdWf65bUNwxqET31xUX7c6uNnMi5P4tH6hllD1TqnPiyPBBal8AzniRqDRddlzeaZWfgO15n1RCd4A2Nzb3qIgbgBi1J5Bmj2FPBLP-O5DhhG20"
TIMEOUT = 30


def test_post_api_auth_login_user_authentication():
    login_url = f"{BASE_URL}/api/auth/login"
    me_url = f"{BASE_URL}/api/auth/me"
    packages_url = f"{BASE_URL}/api/packages"
    vouchers_generate_url = f"{BASE_URL}/api/vouchers/generate"
    transactions_url = f"{BASE_URL}/api/transactions"
    headers_api_key = {"apikey": API_KEY}

    # Valid credentials login
    valid_payload = {
        "email": "hqbakari@gmail.com",
        "password": "Muu@1212"
    }

    # Login with valid creds
    try:
        login_resp = requests.post(login_url, json=valid_payload, headers=headers_api_key, timeout=TIMEOUT)
    except Exception as e:
        assert False, f"Login request failed with exception: {e}"

    assert login_resp.status_code == 200, f"Expected 200 OK for valid login, got {login_resp.status_code}"

    login_json = login_resp.json()
    assert "token" in login_json, "Response JSON missing 'token'"
    token = login_json["token"]

    # Decode JWT token without verification to check tenant_id claim
    try:
        payload_b64 = token.split(".")[1]
        # Pad base64 string
        padding = 4 - (len(payload_b64) % 4)
        payload_b64 += "=" * (padding if padding < 4 else 0)
        payload_json = base64.urlsafe_base64decode(payload_b64.encode()).decode()
        decoded = json.loads(payload_json)
    except Exception as e:
        assert False, f"JWT decoding failed: {e}"
    assert "tenant_id" in decoded, "JWT token missing 'tenant_id' claim"

    bearer_headers = {
        "Authorization": f"Bearer {token}",
        "apikey": API_KEY,
    }

    # Validate /api/auth/me endpoint
    try:
        me_resp = requests.get(me_url, headers=bearer_headers, timeout=TIMEOUT)
    except Exception as e:
        assert False, f"/api/auth/me request failed: {e}"
    assert me_resp.status_code == 200, f"/api/auth/me expected 200 OK, got {me_resp.status_code}"
    me_json = me_resp.json()
    assert "tenant_id" in me_json, "/api/auth/me response missing tenant_id"

    # Validate /api/packages endpoint (GET)
    try:
        packages_resp = requests.get(packages_url, headers=bearer_headers, timeout=TIMEOUT)
    except Exception as e:
        assert False, f"/api/packages GET request failed: {e}"
    assert packages_resp.status_code == 200, f"/api/packages expected 200 OK, got {packages_resp.status_code}"
    packages_json = packages_resp.json()
    assert isinstance(packages_json, (list, dict)), "/api/packages response should be list or dict"

    # Validate /api/vouchers/generate endpoint (assuming POST, no schema given, skip payload)
    try:
        vouchers_resp = requests.post(vouchers_generate_url, headers=bearer_headers, timeout=TIMEOUT)
    except Exception as e:
        assert False, f"/api/vouchers/generate POST request failed: {e}"
    # Accept either 200 or 201 depending on implementation
    assert vouchers_resp.status_code in (200,201), f"/api/vouchers/generate expected 200 or 201, got {vouchers_resp.status_code}"

    # Validate /api/transactions endpoint (assuming GET)
    try:
        transactions_resp = requests.get(transactions_url, headers=bearer_headers, timeout=TIMEOUT)
    except Exception as e:
        assert False, f"/api/transactions GET request failed: {e}"
    assert transactions_resp.status_code == 200, f"/api/transactions expected 200 OK, got {transactions_resp.status_code}"
    transactions_json = transactions_resp.json()
    assert isinstance(transactions_json, (list, dict)), "/api/transactions response should be list or dict"

    # Test login with wrong password
    wrong_payload = {
        "email": "hqbakari@gmail.com",
        "password": "WrongPassword123!"
    }
    try:
        login_wrong_resp = requests.post(login_url, json=wrong_payload, headers=headers_api_key, timeout=TIMEOUT)
    except Exception as e:
        assert False, f"Login with wrong password request failed: {e}"
    assert login_wrong_resp.status_code == 401, f"Expected 401 Unauthorized for wrong password, got {login_wrong_resp.status_code}"


test_post_api_auth_login_user_authentication()