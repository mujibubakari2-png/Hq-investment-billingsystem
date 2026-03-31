import requests
import random
import string

BASE_URL = "http://localhost:3001"
API_PACKAGES_ENDPOINT = f"{BASE_URL}/api/packages"
TIMEOUT = 30

# This test assumes that authentication is required, so we first register and login a user to get a valid JWT token.
def test_post_api_packages_create_new_package():
    email = "testuser_tc009@example.com"
    password = "Password123!"
    token = None
    headers = {}

    try:
        # First try to register
        register_payload = {
            "name": "Test User TC009",
            "email": email,
            "password": password
        }
        register_resp = requests.post(f"{BASE_URL}/api/auth/register", json=register_payload, timeout=TIMEOUT)
        if register_resp.status_code == 201:
            register_data = register_resp.json()
            assert "token" in register_data, "JWT token missing in registration response"
            token = register_data["token"]
        elif register_resp.status_code == 400:
            # Registration failed, probably user exists, then try to login
            login_payload = {
                "email": email,
                "password": password
            }
            login_resp = requests.post(f"{BASE_URL}/api/auth/login", json=login_payload, timeout=TIMEOUT)
            assert login_resp.status_code == 200, f"Login failed with status {login_resp.status_code}"
            login_data = login_resp.json()
            assert "token" in login_data, "JWT token missing in login response"
            token = login_data["token"]
        else:
            assert False, f"Registration failed with status {register_resp.status_code}"

        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }

        # Create a new package with required valid parameters: name, price, duration
        package_payload = {
            "type": "Hotspot",
            "name": "Test Package TC009",
            "price": 49.99,
            "duration": 30,
            "routerId": None,     # Assuming routerId is optional or can be None
            "uploadSpeed": 1024,  # example numeric bandwidth
            "downloadSpeed": 2048,
            "hotspotSettings": {}
        }

        # Clean routerId if backend rejects None
        if package_payload["routerId"] is None:
            package_payload.pop("routerId")

        post_resp = requests.post(API_PACKAGES_ENDPOINT, headers=headers, json=package_payload, timeout=TIMEOUT)
        assert post_resp.status_code == 201, f"Expected 201 Created, got {post_resp.status_code}"
        
        post_resp_json = post_resp.json()
        # Validate response contains keys indicating the package was created
        assert "id" in post_resp_json, "Created package response missing 'id'"
        assert post_resp_json.get("name") == package_payload["name"], "Response 'name' doesn't match request"
        assert float(post_resp_json.get("price", 0)) == package_payload["price"], "Response 'price' doesn't match request"
        assert int(post_resp_json.get("duration", 0)) == package_payload["duration"], "Response 'duration' doesn't match request"

    finally:
        # Cleanup: delete the created package if present
        try:
            if 'post_resp_json' in locals() and "id" in post_resp_json:
                package_id = post_resp_json["id"]
                del_resp = requests.delete(f"{API_PACKAGES_ENDPOINT}/{package_id}", headers=headers, timeout=TIMEOUT)
                # Accept 200 OK or 204 No Content for delete
                assert del_resp.status_code in (200, 204), f"Failed to delete package ID {package_id}, status {del_resp.status_code}"
        except Exception:
            pass


test_post_api_packages_create_new_package()
