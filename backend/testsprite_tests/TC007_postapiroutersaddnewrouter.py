import requests

BASE_URL = "http://localhost:3001"
LOGIN_ENDPOINT = "/api/auth/login"
ROUTERS_ENDPOINT = "/api/routers"

EMAIL = "hqbakari@gmail.com"
PASSWORD = "Muu@1212"

TIMEOUT = 30

def test_postapiroutersaddnewrouter():
    # Step 1: Login to get JWT token
    login_payload = {
        "email": EMAIL,
        "password": PASSWORD
    }
    login_response = requests.post(
        f"{BASE_URL}{LOGIN_ENDPOINT}",
        json=login_payload,
        timeout=TIMEOUT
    )
    assert login_response.status_code == 200, f"Login failed with status {login_response.status_code}"
    login_json = login_response.json()
    assert "token" in login_json, "Login response missing 'token'"
    token = login_json["token"]
    assert token, "Token is empty"

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    # Prepare router data
    router_data = {
        "hostname": "test-router-01",
        "host": "192.168.88.1",
        "secret": "testSecret123",
        "port": 8728
        # tenant_id is optional and typically taken from token claims
    }

    router_id = None

    try:
        # Step 2: Create new router
        router_response = requests.post(
            f"{BASE_URL}{ROUTERS_ENDPOINT}",
            headers=headers,
            json=router_data,
            timeout=TIMEOUT
        )
        assert router_response.status_code == 201, f"Router creation failed with status {router_response.status_code}"
        router_json = router_response.json()
        assert "router_id" in router_json, "Response missing 'router_id'"

        router_id = router_json["router_id"]
        assert router_id, "'router_id' is empty or invalid"

    finally:
        # Step 3: Clean up - delete the router if created
        if router_id:
            del_response = requests.delete(
                f"{BASE_URL}{ROUTERS_ENDPOINT}/{router_id}",
                headers=headers,
                timeout=TIMEOUT
            )
            # Accept 200 OK or 204 No Content as successful deletion
            assert del_response.status_code in (200, 204), f"Failed to delete router with status {del_response.status_code}"

test_postapiroutersaddnewrouter()
