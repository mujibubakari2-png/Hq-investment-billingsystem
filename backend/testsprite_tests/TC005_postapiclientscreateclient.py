import requests
import uuid

BASE_URL = "http://localhost:3001"
LOGIN_ENDPOINT = "/api/auth/login"
CLIENTS_ENDPOINT = "/api/clients"
TIMEOUT = 30

EMAIL = "hqbakari@gmail.com"
PASSWORD = "Muu@1212"

API_KEY_NAME = "musa"
API_KEY_VALUE = "sk-user-wr0eKZ_Ytg73zZIWxpNDQdWf65bUNwxqET31xUX7c6uNnMi5P4tH6hllD1TqnPiyPBBal8AzniRqDRddlzeaZWfgO15n1RCd4A2Nzb3qIgbgBi1J5Bmj2FPBLP-O5DhhG20"


def test_postapiclientscreateclient():
    # Authenticate user to get JWT token
    login_url = BASE_URL + LOGIN_ENDPOINT
    login_payload = {
        "email": EMAIL,
        "password": PASSWORD
    }
    try:
        login_resp = requests.post(login_url, json=login_payload, timeout=TIMEOUT)
        assert login_resp.status_code == 200, f"Login failed with status {login_resp.status_code}"
        login_data = login_resp.json()
        assert "token" in login_data, "Login response missing token"
        token = login_data["token"]

        # Decode JWT token payload to extract tenant_id
        # JWT format: header.payload.signature (payload is base64url encoded JSON)
        import base64
        import json

        try:
            payload_part = token.split(".")[1]
            # Add padding if needed
            padding = 4 - (len(payload_part) % 4)
            if padding != 4:
                payload_part += "=" * padding
            payload_json = base64.urlsafe_b64decode(payload_part).decode("utf-8")
            payload = json.loads(payload_json)
            tenant_id_from_token = payload.get("tenant_id")
            assert tenant_id_from_token is not None, "tenant_id claim missing in token"
        except Exception as e:
            raise AssertionError(f"Error decoding JWT token: {e}")

        # Create a new client with valid JWT and client data
        create_client_url = BASE_URL + CLIENTS_ENDPOINT
        test_client_name = f"TestClient-{str(uuid.uuid4())[:8]}"
        test_client_phone = "+1234567890"
        test_client_metadata = {"notes": "Created during TC005"}

        headers = {
            "Authorization": f"Bearer {token}",
            "x-api-key": API_KEY_VALUE,
            "Content-Type": "application/json"
        }

        client_payload = {
            "name": test_client_name,
            "phone": test_client_phone,
            "metadata": test_client_metadata
        }

        created_client_id = None
        try:
            create_resp = requests.post(create_client_url, json=client_payload, headers=headers, timeout=TIMEOUT)
            assert create_resp.status_code == 201, f"Expected 201 Created, got {create_resp.status_code}"
            create_data = create_resp.json()
            assert "client_id" in create_data, "Response missing client_id"
            assert "tenant_id" in create_data, "Response missing tenant_id"
            created_client_id = create_data["client_id"]
            tenant_id_from_response = create_data["tenant_id"]
            assert tenant_id_from_response == tenant_id_from_token, (
                f"Response tenant_id {tenant_id_from_response} does not match token tenant_id {tenant_id_from_token}"
            )

        finally:
            # Clean up: delete the created client if it was created successfully
            if created_client_id:
                delete_url = f"{BASE_URL}{CLIENTS_ENDPOINT}/{created_client_id}"
                try:
                    requests.delete(delete_url, headers=headers, timeout=TIMEOUT)
                except Exception:
                    pass

    except requests.RequestException as e:
        raise AssertionError(f"HTTP request failed: {e}")


test_postapiclientscreateclient()
