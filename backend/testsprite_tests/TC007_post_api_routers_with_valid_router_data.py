import requests

BASE_URL = "http://localhost:3000"
TIMEOUT = 30

# Replace with valid JWT token for authentication before running the test
AUTH_TOKEN = "YOUR_VALID_JWT_TOKEN_HERE"

def test_post_api_routers_with_valid_router_data():
    url = f"{BASE_URL}/api/routers"
    headers = {
        "Authorization": f"Bearer {AUTH_TOKEN}",
        "Content-Type": "application/json",
        "Accept": "application/json"
    }
    router_data = {
        "accessCode": "ABC123XYZ",
        "name": "TestRouter01",
        "vpnMode": "disabled",
        "description": "Router for testing POST /api/routers endpoint",
        "initialStatus": "active"
    }
    response = None
    router_id = None
    try:
        response = requests.post(url, json=router_data, headers=headers, timeout=TIMEOUT)
        assert response.status_code == 201, f"Expected 201 Created but got {response.status_code}"
        resp_json = response.json()
        # Validate some keys expected in the response: for example 'id', 'setupInstructions' etc.
        assert "id" in resp_json, "Response JSON missing 'id'"
        router_id = resp_json.get("id")
        assert isinstance(router_id, str) and len(router_id) > 0, "'id' should be a non-empty string in response"
        assert "setupInstructions" in resp_json, "Response JSON missing 'setupInstructions'"
        setup_instructions = resp_json["setupInstructions"]
        assert isinstance(setup_instructions, str) and len(setup_instructions) > 0, "'setupInstructions' should be non-empty string"
        # Additional optional validations
        if "downloadLinks" in resp_json:
            assert isinstance(resp_json["downloadLinks"], list), "'downloadLinks' should be a list if present"
    except requests.RequestException as e:
        assert False, f"HTTP request failed: {str(e)}"
    finally:
        if router_id:
            # Cleanup: delete the created router to maintain test idempotency
            try:
                del_url = f"{BASE_URL}/api/routers/{router_id}"
                del_resp = requests.delete(del_url, headers=headers, timeout=TIMEOUT)
                assert del_resp.status_code in (200, 204), f"Expected 200 or 204 on delete but got {del_resp.status_code}"
            except requests.RequestException:
                pass  # For cleanup failure, just pass

test_post_api_routers_with_valid_router_data()
