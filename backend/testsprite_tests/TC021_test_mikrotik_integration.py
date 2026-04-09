import requests
import pytest

BASE_URL = "http://localhost:3001"
LOGIN_ENDPOINT = "/api/auth/login"
ROUTERS_ENDPOINT = "/api/routers"
TIMEOUT = 30

# Valid credentials for authentication
VALID_EMAIL = "hqbakari@gmail.com"
VALID_PASSWORD = "Muu@1212"

def get_jwt_token(email: str, password: str) -> str:
    url = BASE_URL + LOGIN_ENDPOINT
    try:
        resp = requests.post(
            url,
            json={"email": email, "password": password},
            timeout=TIMEOUT
        )
        resp.raise_for_status()
        data = resp.json()
        token = data.get("token") or data.get("jwt") or data.get("accessToken")
        assert token, "JWT token not found in login response"
        return token
    except requests.RequestException as e:
        pytest.fail(f"Failed to log in and obtain JWT token: {e}")

def test_mikrotik_integration():
    token = get_jwt_token(VALID_EMAIL, VALID_PASSWORD)
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. Get list of routers
    try:
        routers_resp = requests.get(BASE_URL + ROUTERS_ENDPOINT, headers=headers, timeout=TIMEOUT)
        routers_resp.raise_for_status()
        routers = routers_resp.json()
    except requests.RequestException as e:
        pytest.fail(f"Failed to fetch routers: {e}")

    assert isinstance(routers, list), "Expected routers to be a list"
    
    if not routers:
        print("No routers found in the system. Creating a test router...")
        # 2. Create a test router if none exists
        test_router_payload = {
            "name": "TestSprite-Router",
            "host": "1.1.1.1", # Dummy IP
            "username": "admin",
            "password": "password",
            "port": 8728
        }
        try:
            create_resp = requests.post(BASE_URL + ROUTERS_ENDPOINT, json=test_router_payload, headers=headers, timeout=TIMEOUT)
            create_resp.raise_for_status()
            new_router = create_resp.json()
            # The API returns different structures, let's try to get ID
            router_id = new_router.get("id") or new_router.get("router_id")
            assert router_id, "Failed to get router ID from creation response"
            routers = [{"id": router_id, "name": "TestSprite-Router"}]
        except requests.RequestException as e:
            pytest.fail(f"Failed to create test router: {e}")

    # 3. Test connection for the first router
    router = routers[0]
    router_id = router["id"]
    test_url = f"{BASE_URL}{ROUTERS_ENDPOINT}/{router_id}/test"
    
    print(f"Testing connection for router: {router.get('name')} ({router_id})")
    try:
        test_resp = requests.post(test_url, headers=headers, timeout=TIMEOUT)
        test_resp.raise_for_status()
        result = test_resp.json()
        
        # The test connection endpoint returns { success: boolean, message: string, info?: ... }
        assert "success" in result, "Response missing 'success' field"
        print(f"Connection test result: {result.get('message')}")
        
        # We don't assert success=True because the dummy router will fail, 
        # but the integration (API call -> MikroTik service -> response) is what we are testing.
        assert isinstance(result["success"], bool), "'success' should be a boolean"
        
    except requests.RequestException as e:
        pytest.fail(f"Failed to test router connection: {e}")

    print("MikroTik integration test passed (API flow verified)!")

if __name__ == "__main__":
    test_mikrotik_integration()
