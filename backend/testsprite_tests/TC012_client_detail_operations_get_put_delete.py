import requests

BASE_URL = "http://localhost:3001"
ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "admin123"
TIMEOUT = 30

def test_client_detail_operations_get_put_delete():
    # Authenticate to get JWT token
    login_url = f"{BASE_URL}/api/auth/login"
    login_payload = {
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    }
    try:
        login_resp = requests.post(login_url, json=login_payload, timeout=TIMEOUT)
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        token = login_resp.json().get("token") or login_resp.json().get("accessToken") or login_resp.json().get("jwt")
        assert token, "JWT token not found in login response"
    except (requests.RequestException, AssertionError) as e:
        raise RuntimeError(f"Authentication failed: {e}")

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    # Create a new client to use for get/put/delete tests
    create_client_url = f"{BASE_URL}/api/clients"
    new_client_payload = {
        "username": "testuser_tc012",
        "fullName": "Test User TC012",
        "phone": "+12345678901",
        "planId": None  # Assuming planId can be null or skipped if not mandatory
    }
    # If planId is required, we must fetch a planId first. So let's try to get clients and grab a valid planId.
    try:
        plans_resp = requests.get(f"{BASE_URL}/api/packages", headers=headers, timeout=TIMEOUT)
        if plans_resp.status_code == 200:
            packages = plans_resp.json()
            if isinstance(packages, list) and len(packages) > 0:
                new_client_payload["planId"] = packages[0].get("id") or packages[0].get("planId") or packages[0].get("packageId")
        # fallback: if no planId assignable, remove from payload
        if not new_client_payload["planId"]:
            new_client_payload.pop("planId", None)
    except requests.RequestException:
        # ignore error, use payload without planId
        new_client_payload.pop("planId", None)

    client_id = None
    try:
        create_resp = requests.post(create_client_url, headers=headers, json=new_client_payload, timeout=TIMEOUT)
        assert create_resp.status_code == 201, f"Failed to create client: {create_resp.text}"
        created_client = create_resp.json()
        client_id = created_client.get("id") or created_client.get("_id")
        assert client_id, "Created client ID not returned"

        client_url = f"{BASE_URL}/api/clients/{client_id}"

        # GET client details
        get_resp = requests.get(client_url, headers=headers, timeout=TIMEOUT)
        assert get_resp.status_code == 200, f"Failed to get client details: {get_resp.text}"
        client_data = get_resp.json()
        assert client_data.get("username") == new_client_payload["username"], "Client username mismatch on GET"

        # PUT update client details
        update_payload = {
            "fullName": "Test User TC012 Updated",
            "phone": "+19876543210"
        }
        put_resp = requests.put(client_url, headers=headers, json=update_payload, timeout=TIMEOUT)
        assert put_resp.status_code == 200, f"Failed to update client: {put_resp.text}"
        updated_client = put_resp.json()
        assert updated_client.get("fullName") == update_payload["fullName"], "Client fullName not updated"
        assert updated_client.get("phone") == update_payload["phone"], "Client phone not updated"

        # Verify updated client by GET again
        get_after_put_resp = requests.get(client_url, headers=headers, timeout=TIMEOUT)
        assert get_after_put_resp.status_code == 200, f"Failed to get client after update: {get_after_put_resp.text}"
        client_after_update = get_after_put_resp.json()
        assert client_after_update.get("fullName") == update_payload["fullName"], "Client fullName mismatch after update"
        assert client_after_update.get("phone") == update_payload["phone"], "Client phone mismatch after update"

        # DELETE the client
        delete_resp = requests.delete(client_url, headers=headers, timeout=TIMEOUT)
        assert delete_resp.status_code in (200, 204), f"Failed to delete client: {delete_resp.text}"

        # Verify client no longer exists
        get_after_delete_resp = requests.get(client_url, headers=headers, timeout=TIMEOUT)
        assert get_after_delete_resp.status_code == 404, f"Deleted client still accessible: {get_after_delete_resp.text}"

    finally:
        # Cleanup if client still exists (in case test failed before delete)
        if client_id:
            try:
                requests.delete(f"{BASE_URL}/api/clients/{client_id}", headers=headers, timeout=TIMEOUT)
            except requests.RequestException:
                pass

test_client_detail_operations_get_put_delete()