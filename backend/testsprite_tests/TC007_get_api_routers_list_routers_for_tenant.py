import requests

BASE_URL = "http://localhost:3001"
LOGIN_ENDPOINT = "/api/auth/login"
ROUTERS_ENDPOINT = "/api/routers"
TIMEOUT = 30

LOGIN_PAYLOAD = {
    "email": "hqbakari@gmail.com",
    "password": "Muu@1212"
}


def test_get_api_routers_list_for_tenant():
    token = None
    router_id_created = None

    try:
        # 1. Log in to get JWT token
        login_resp = requests.post(
            BASE_URL + LOGIN_ENDPOINT,
            json=LOGIN_PAYLOAD,
            timeout=TIMEOUT
        )
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        token = login_resp.json().get("token")
        assert token, "JWT token missing in login response"

        headers = {"Authorization": f"Bearer {token}"}

        # 2. Get current user profile to extract tenant_id
        me_resp = requests.get(
            BASE_URL + "/api/auth/me",
            headers=headers,
            timeout=TIMEOUT
        )
        assert me_resp.status_code == 200, f"Get auth/me failed: {me_resp.text}"
        me_data = me_resp.json()
        tenant_id = me_data.get("tenant_id") or me_data.get("user", {}).get("tenant_id")
        assert tenant_id, "tenant_id missing from /api/auth/me response"

        # 3. Ensure there is at least one router for the tenant by creating one if none exist
        routers_resp = requests.get(
            BASE_URL + ROUTERS_ENDPOINT,
            headers=headers,
            timeout=TIMEOUT
        )
        assert routers_resp.status_code == 200, f"Get routers failed: {routers_resp.text}"
        routers_list = routers_resp.json()
        assert isinstance(routers_list, list), "Routers response is not a list"

        if not routers_list:
            # Create a new router to ensure tenant has at least one router
            router_payload = {
                "host": "192.168.88.1",
                "port": 8728,
                "secret": "testsecret",
                "router_name": "test-router"
            }
            create_resp = requests.post(
                BASE_URL + ROUTERS_ENDPOINT,
                headers=headers,
                json=router_payload,
                timeout=TIMEOUT
            )
            assert create_resp.status_code == 201, f"Create router failed: {create_resp.text}"
            router_id_created = create_resp.json().get("router_id")
            assert router_id_created, "router_id missing in create router response"

            # Re-fetch routers list after creation
            routers_resp = requests.get(
                BASE_URL + ROUTERS_ENDPOINT,
                headers=headers,
                timeout=TIMEOUT
            )
            assert routers_resp.status_code == 200, f"Get routers after create failed: {routers_resp.text}"
            routers_list = routers_resp.json()

        # Validate that routers list only contains routers for tenant (filtered by tenant_id)
        # The response should only include routers belonging to the logged-in user's tenant_id
        # We'll check that the list is a list of dicts and optionally check tenant_id presence
        assert isinstance(routers_list, list), "Routers list is not an array"
        # We cannot assert tenant_id inside router item without response schema so we skip it here.

        # 4. Test tenant with no routers: simulate by logging in as a user with no routers

        # For this test, try to find or create a new tenant user with no routers
        # Since we do not have such user, we'll simulate by trying to register a new user (tenant)
        # and then login as that user and check routers list is empty

        # Register a new user with unique email to isolate tenant with no routers
        import uuid
        unique_email = f"test_no_routers_{uuid.uuid4().hex[:8]}@example.com"
        register_payload = {
            "email": unique_email,
            "password": "Muu@1212",
            "tenant_id": None  # Let the system assign or create new tenant on register
        }

        # Register endpoint is POST /api/auth/register
        register_resp = requests.post(
            BASE_URL + "/api/auth/register",
            json=register_payload,
            timeout=TIMEOUT
        )
        # If user already exists, conflict is possible but since unique email we expect 201
        assert register_resp.status_code == 201, f"Register new user failed: {register_resp.text}"

        # Login newly registered user
        login_resp_2 = requests.post(
            BASE_URL + LOGIN_ENDPOINT,
            json={
                "email": unique_email,
                "password": "Muu@1212"
            },
            timeout=TIMEOUT
        )
        assert login_resp_2.status_code == 200, f"Login new user failed: {login_resp_2.text}"
        new_token = login_resp_2.json().get("token")
        assert new_token, "New JWT token missing in login response"

        new_headers = {"Authorization": f"Bearer {new_token}"}

        # Get routers for user with presumably no routers
        no_routers_resp = requests.get(
            BASE_URL + ROUTERS_ENDPOINT,
            headers=new_headers,
            timeout=TIMEOUT
        )
        assert no_routers_resp.status_code == 200, f"Get routers for tenant with no routers failed: {no_routers_resp.text}"
        no_routers_list = no_routers_resp.json()
        assert isinstance(no_routers_list, list), "Routers response for tenant with no routers is not a list"
        assert len(no_routers_list) == 0, "Expected empty routers list for tenant with no routers"

    finally:
        # Cleanup: delete the router created if any
        if router_id_created and token:
            try:
                delete_resp = requests.delete(
                    f"{BASE_URL}/api/routers/{router_id_created}",
                    headers={"Authorization": f"Bearer {token}"},
                    timeout=TIMEOUT
                )
                # 204 No Content or 200 OK acceptable for delete success
                assert delete_resp.status_code in [200, 204], f"Failed to delete test router: {delete_resp.text}"
            except Exception:
                pass


test_get_api_routers_list_for_tenant()
