import requests
import time

BASE_URL = "http://localhost:3001"
API_KEY = "sk-user-wr0eKZ_Ytg73zZIWxpNDQdWf65bUNwxqET31xUX7c6uNnMi5P4tH6hllD1TqnPiyPBBal8AzniRqDRddlzeaZWfgO15n1RCd4A2Nzb3qIgbgBi1J5Bmj2FPBLP-O5DhhG20"
API_KEY_HEADER = {"karimu": API_KEY}
TIMEOUT = 30

def test_tenant_isolation_middleware_enforces_tenant_id_from_token():
    session = requests.Session()
    session.headers.update(API_KEY_HEADER)
    session.timeout = TIMEOUT

    # Step 1: Register two tenants/users to have distinct tenants
    tenant_1_email = f"user1_{int(time.time())}@example.com"
    tenant_2_email = f"user2_{int(time.time())}@example.com"
    password = "CorrectHorseBatteryStaple123!"
    tenant_1_name = f"TenantOne_{int(time.time())}"
    tenant_2_name = f"TenantTwo_{int(time.time())}"

    register_url = f"{BASE_URL}/api/auth/register"
    login_url = f"{BASE_URL}/api/auth/login"
    clients_url = f"{BASE_URL}/api/clients"

    def register_user(email, password, tenantName):
        payload = {"email": email, "password": password, "tenantName": tenantName}
        resp = session.post(register_url, json=payload, timeout=TIMEOUT)
        assert resp.status_code == 201, f"Failed to register user: {resp.text}"
        return resp.json()

    def login_user(email, password):
        payload = {"email": email, "password": password}
        resp = session.post(login_url, json=payload, timeout=TIMEOUT)
        assert resp.status_code == 200, f"Failed to login user: {resp.text}"
        data = resp.json()
        assert "token" in data, "Login response missing token"
        assert "user" in data, "Login response missing user"
        return data

    try:
        # Register tenant 1
        reg1 = register_user(tenant_1_email, password, tenant_1_name)
        tenant_1_id = reg1["tenant"]["id"]

        # Register tenant 2
        reg2 = register_user(tenant_2_email, password, tenant_2_name)
        tenant_2_id = reg2["tenant"]["id"]

        # Login tenant 1
        login1 = login_user(tenant_1_email, password)
        token1 = login1["token"]
        user1_tenant_id = login1["user"]["tenant_id"]
        assert user1_tenant_id == tenant_1_id, "Tenant ID mismatch in login user object"

        # Login tenant 2
        login2 = login_user(tenant_2_email, password)
        token2 = login2["token"]
        user2_tenant_id = login2["user"]["tenant_id"]
        assert user2_tenant_id == tenant_2_id, "Tenant ID mismatch in login user object"

        headers1 = {"Authorization": f"Bearer {token1}"}
        headers2 = {"Authorization": f"Bearer {token2}"}

        # Step 2: Tenant 1 create a client with tenant_id in the JSON body set to tenant 2's tenant_id (attempt to override)
        malicious_client_data = {
            "fullName": "Malicious Client",
            "phone": "1234567890",
            "planId": "basic-plan-id",  # Assuming this planId is valid or the backend validates it accordingly
            "tenant_id": tenant_2_id  # Injecting tenant_id from another tenant, should be ignored or rejected
        }

        # Create client with override tenant_id using tenant 1 token
        resp = session.post(clients_url, headers=headers1, json=malicious_client_data, timeout=TIMEOUT)
        assert resp.status_code in (201, 403), \
            f"Expected 201 Created or 403 Forbidden, got {resp.status_code} with body {resp.text}"

        if resp.status_code == 201:
            # Created client, verify tenant_id = tenant_1_id even though tenant_2_id was provided
            client = resp.json()
            assert "tenant_id" in client, "Response client missing tenant_id"
            assert client["tenant_id"] == tenant_1_id, f"Client tenant_id should be tenant 1's but got {client['tenant_id']}"

        if resp.status_code == 403:
            # Forbidden is allowed as enforcement mode
            pass

        # Step 3: Tenant 1 get clients and confirm only clients for their tenant are returned and no leakage
        resp = session.get(clients_url, headers=headers1, timeout=TIMEOUT)
        assert resp.status_code == 200, f"Failed to get clients: {resp.text}"
        clients_list = resp.json()
        assert isinstance(clients_list, list), "Clients list response is not a list"
        for client in clients_list:
            assert "tenant_id" in client, "Client is missing tenant_id field"
            assert client["tenant_id"] == tenant_1_id, "Tenant isolation violated: client tenant_id mismatch"

        # Step 4: Tenant 2 get clients and verify no clients from tenant 1 returned (tenant isolation)
        resp = session.get(clients_url, headers=headers2, timeout=TIMEOUT)
        assert resp.status_code == 200, f"Failed to get clients for tenant 2: {resp.text}"
        clients_list_2 = resp.json()
        assert isinstance(clients_list_2, list), "Clients list response for tenant 2 is not a list"
        for client in clients_list_2:
            assert "tenant_id" in client, "Client for tenant 2 missing tenant_id field"
            assert client["tenant_id"] == tenant_2_id, "Tenant isolation violated for tenant 2: client tenant_id mismatch"

        # Step 5: Try to tamper token for tenant 1 with tenant 2 id and attempt access -> expect 401 or 403
        # Decoding token JSON without verifying signature to tamper payload

        # Decode JWT without verification to tamper payload
        token_parts = token1.split(".")
        assert len(token_parts) == 3, "JWT token format unexpected"

        import base64
        import json

        def b64decode_padding(data):
            rem = len(data) % 4
            if rem > 0:
                data += '=' * (4 - rem)
            return base64.urlsafe_b64decode(data)

        header_json = json.loads(b64decode_padding(token_parts[0]).decode())
        payload_json = json.loads(b64decode_padding(token_parts[1]).decode())

        # Tamper tenant_id in payload
        tampered_payload = payload_json.copy()
        tampered_payload['tenant_id'] = tenant_2_id

        # Re-encode payload without valid signing, so the backend should reject
        tampered_payload_bytes = json.dumps(tampered_payload).encode()
        tampered_payload_b64 = base64.urlsafe_b64encode(tampered_payload_bytes).rstrip(b"=").decode()

        tampered_token = f"{token_parts[0]}.{tampered_payload_b64}.{token_parts[2]}"

        headers_tampered = {"Authorization": f"Bearer {tampered_token}"}

        resp = session.get(clients_url, headers=headers_tampered, timeout=TIMEOUT)
        # Expect 401 Unauthorized or 403 Forbidden due to tenant claim mismatch / invalid signature
        assert resp.status_code in (401, 403), \
            f"Tampered token access should be rejected. Got status {resp.status_code}, body: {resp.text}"

        # Step 6: Use token missing tenant claim and expect 401 Unauthorized
        # Create a token without tenant_id claim (fake token)
        payload_no_tenant = payload_json.copy()
        payload_no_tenant.pop('tenant_id', None)
        no_tenant_payload_bytes = json.dumps(payload_no_tenant).encode()
        no_tenant_payload_b64 = base64.urlsafe_b64encode(no_tenant_payload_bytes).rstrip(b"=").decode()
        token_no_tenant = f"{token_parts[0]}.{no_tenant_payload_b64}.{token_parts[2]}"
        headers_no_tenant = {"Authorization": f"Bearer {token_no_tenant}"}

        resp = session.get(f"{BASE_URL}/api/routers", headers=headers_no_tenant, timeout=TIMEOUT)
        assert resp.status_code == 401, f"Missing tenant claim should return 401 Unauthorized, got {resp.status_code}"

    finally:
        # Cleanup: No explicit deletion endpoints described in PRD to cleanup users/tenants or clients
        # So skipping cleanup of registered tenants, since no DELETE endpoint specified.
        pass

test_tenant_isolation_middleware_enforces_tenant_id_from_token()
