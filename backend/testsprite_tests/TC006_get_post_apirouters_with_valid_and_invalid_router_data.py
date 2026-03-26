import requests

BASE_URL = "http://localhost:3001"
ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "admin123"
TIMEOUT = 30

def test_get_post_api_routers_valid_invalid():
    # Step 1: Login to get JWT token
    login_url = f"{BASE_URL}/api/auth/login"
    login_payload = {
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    }
    login_resp = requests.post(login_url, json=login_payload, timeout=TIMEOUT)
    assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
    auth_token = login_resp.json().get("token")
    assert auth_token, "No token received on login"

    headers = {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }

    # Step 2: GET /api/routers with Authorization header - expect 200 and list JSON
    routers_get_url = f"{BASE_URL}/api/routers"
    get_resp = requests.get(routers_get_url, headers=headers, timeout=TIMEOUT)
    assert get_resp.status_code == 200, f"Failed to get routers: {get_resp.text}"
    routers_list = get_resp.json()
    assert isinstance(routers_list, list), "Routers response is not a list"

    # Step 3: POST valid router data, expect 201 Created with setup instructions and download links
    valid_router_payload = {
        "accessCode": "ACCESS12345",
        "name": "ValidRouterName01",
        "vpnMode": "ipsec",
        "description": "Test router created by automated test.",
        "initialStatus": "active",
        "host": "192.168.88.1"
    }

    created_router_id = None
    try:
        post_resp = requests.post(routers_get_url, headers=headers, json=valid_router_payload, timeout=TIMEOUT)
        assert post_resp.status_code == 201, f"Valid router creation failed: {post_resp.text}"
        data = post_resp.json()
        assert "setupInstructions" in data or "instructions" in data, "No setup instructions in response"
        assert any(k in data for k in ["downloadLinks", "downloads", "setupLinks"]), "No download links in response"
        created_router_id = data.get("id") or data.get("routerId")
        assert created_router_id, "Created router ID missing in response"

        # Step 4: POST invalid router names to verify validation error 400 & message
        invalid_names = [
            "Invalid Router!",
            "Router@Name#",
            "NameWith$Sign",
            "Router*Name",
            "NameWith/Slash"
        ]
        for invalid_name in invalid_names:
            invalid_payload = valid_router_payload.copy()
            invalid_payload["name"] = invalid_name
            resp_invalid = requests.post(routers_get_url, headers=headers, json=invalid_payload, timeout=TIMEOUT)
            assert resp_invalid.status_code == 400, f"Invalid router name '{invalid_name}' did not return 400"
            resp_json = resp_invalid.json()
            error_msg = resp_json.get("error") or resp_json.get("message") or ""
            assert isinstance(error_msg, str) and "router name invalid" in error_msg.lower(), (
                f"Validation error message missing or incorrect for name '{invalid_name}'"
            )

    finally:
        if created_router_id:
            delete_url = f"{BASE_URL}/api/routers/{created_router_id}"
            try:
                del_resp = requests.delete(delete_url, headers=headers, timeout=TIMEOUT)
                if del_resp.status_code not in (200, 204, 404):
                    print(f"Warning: Failed to delete router {created_router_id}: {del_resp.status_code} {del_resp.text}")
            except Exception as e:
                print(f"Exception during cleanup delete router: {e}")

test_get_post_api_routers_valid_invalid()
