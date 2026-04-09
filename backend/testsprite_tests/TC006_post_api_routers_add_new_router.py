import requests

BASE_URL = "http://localhost:3001"
LOGIN_ENDPOINT = f"{BASE_URL}/api/auth/login"
ROUTERS_ENDPOINT = f"{BASE_URL}/api/routers"
TIMEOUT = 30

USER_EMAIL = "hqbakari@gmail.com"
USER_PASSWORD = "Muu@1212"

def get_jwt_token():
    try:
        resp = requests.post(
            LOGIN_ENDPOINT,
            json={"email": USER_EMAIL, "password": USER_PASSWORD},
            timeout=TIMEOUT,
        )
        assert resp.status_code == 200, f"Login failed: {resp.text}"
        data = resp.json()
        token = data.get("token") or data.get("access_token")
        assert token, "Token not found in login response"
        return token
    except requests.RequestException as e:
        assert False, f"Login request failed: {e}"

def test_post_api_routers_add_new_router():
    token = get_jwt_token()
    headers = {"Authorization": f"Bearer {token}"}

    new_router_payload = {
        "host": "192.168.88.1",
        "port": 8728,
        "secret": "validsecret",
        "router_name": "test-router-001"
    }

    malformed_host_payload = {
        "host": "invalid host@@",  # malformed
        "port": 8728,
        "secret": "validsecret",
        "router_name": "test-router-malformed-host"
    }

    malformed_secret_payload = {
        "host": "192.168.88.2",
        "port": 8728,
        "secret": "",  # malformed secret empty
        "router_name": "test-router-malformed-secret"
    }

    tenant_override_payload = {
        "host": "192.168.88.3",
        "port": 8728,
        "secret": "validsecret",
        "router_name": "test-router-tenant-override",
        "tenant_id": "some-other-tenant-id"
    }

    router_id = None

    # Test valid router creation -> 201 Created
    try:
        resp = requests.post(
            ROUTERS_ENDPOINT,
            json=new_router_payload,
            headers=headers,
            timeout=TIMEOUT,
        )
        assert resp.status_code == 201, f"Expected 201 Created, got {resp.status_code}: {resp.text}"
        resp_json = resp.json()
        router_id = resp_json.get("router_id")
        assert router_id, "router_id missing in response"
    except requests.RequestException as e:
        assert False, f"Request for valid router creation failed: {e}"

    # Test malformed host -> 400 Bad Request
    try:
        resp = requests.post(
            ROUTERS_ENDPOINT,
            json=malformed_host_payload,
            headers=headers,
            timeout=TIMEOUT,
        )
        assert resp.status_code == 400, f"Expected 400 Bad Request for malformed host, got {resp.status_code}"
    except requests.RequestException as e:
        assert False, f"Request for malformed host failed: {e}"

    # Test malformed secret -> 400 Bad Request
    try:
        resp = requests.post(
            ROUTERS_ENDPOINT,
            json=malformed_secret_payload,
            headers=headers,
            timeout=TIMEOUT,
        )
        assert resp.status_code == 400, f"Expected 400 Bad Request for malformed secret, got {resp.status_code}"
    except requests.RequestException as e:
        assert False, f"Request for malformed secret failed: {e}"

    # Test tenant_id override -> 403 Forbidden
    try:
        resp = requests.post(
            ROUTERS_ENDPOINT,
            json=tenant_override_payload,
            headers=headers,
            timeout=TIMEOUT,
        )
        assert resp.status_code == 403, f"Expected 403 Forbidden for tenant_id override, got {resp.status_code}"
    except requests.RequestException as e:
        assert False, f"Request for tenant_id override failed: {e}"

    # Cleanup: delete the created router if possible
    if router_id:
        try:
            delete_resp = requests.delete(
                f"{ROUTERS_ENDPOINT}/{router_id}",
                headers=headers,
                timeout=TIMEOUT,
            )
            # Deletion may return 204 No Content or 200 OK, accept both
            assert delete_resp.status_code in (200, 204), f"Unexpected status deleting router: {delete_resp.status_code}"
        except requests.RequestException:
            # Log failure but do not fail test for cleanup
            pass

test_post_api_routers_add_new_router()