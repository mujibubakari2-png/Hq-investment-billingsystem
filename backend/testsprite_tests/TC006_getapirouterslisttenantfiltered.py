import requests

BASE_URL = "http://localhost:3001/api"
LOGIN_URL = f"{BASE_URL}/auth/login"
ROUTERS_URL = f"{BASE_URL}/routers"
TIMEOUT = 30
EMAIL = "hqbakari@gmail.com"
PASSWORD = "Muu@1212"

def test_getapirouterslisttenantfiltered():
    # Login to get JWT
    login_payload = {
        "email": EMAIL,
        "password": PASSWORD
    }
    login_resp = requests.post(LOGIN_URL, json=login_payload, timeout=TIMEOUT)
    assert login_resp.status_code == 200, f"Login failed with status {login_resp.status_code}"
    login_json = login_resp.json()
    assert "token" in login_json, "JWT token not found in login response"
    token = login_json["token"]
    assert token, "Empty token received"

    headers = {
        "Authorization": f"Bearer {token}"
    }

    routers_resp = requests.get(ROUTERS_URL, headers=headers, timeout=TIMEOUT)
    assert routers_resp.status_code == 200, f"Expected 200 OK, got {routers_resp.status_code}"
    routers_json = routers_resp.json()
    assert isinstance(routers_json, list), "Routers response is not a list"

    # Extract tenant_id from token payload (JWT token base64 decode)
    import base64
    import json

    try:
        # JWT format: header.payload.signature
        payload_part = token.split('.')[1]
        # Pad base64 string if necessary
        padding = '=' * ((4 - len(payload_part) % 4) % 4)
        payload_part += padding
        payload_bytes = base64.urlsafe_b64decode(payload_part)
        payload = json.loads(payload_bytes)
    except Exception as e:
        assert False, f"Failed to decode JWT payload: {e}"

    tenant_id = payload.get("tenant_id")
    assert tenant_id, "tenant_id claim missing in JWT token"

    # Verify all routers have tenant_id matching token tenant_id
    for router in routers_json:
        assert "tenant_id" in router, "Router missing tenant_id field"
        assert router["tenant_id"] == tenant_id, f"Router tenant_id {router['tenant_id']} does not match token tenant_id {tenant_id}"

test_getapirouterslisttenantfiltered()