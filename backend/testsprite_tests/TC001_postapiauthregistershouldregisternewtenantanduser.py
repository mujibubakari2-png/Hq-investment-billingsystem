import requests
import uuid

BASE_URL = "http://localhost:3001"
HEADERS = {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "x-api-key": "sk-user-wr0eKZ_Ytg73zZIWxpNDQdWf65bUNwxqET31xUX7c6uNnMi5P4tH6hllD1TqnPiyPBBal8AzniRqDRddlzeaZWfgO15n1RCd4A2Nzb3qIgbgBi1J5Bmj2FPBLP-O5DhhG20"
}
TIMEOUT = 30

def test_post_api_auth_register_should_register_new_tenant_and_user():
    # Generate unique email and tenantName to avoid conflicts
    unique_suffix = str(uuid.uuid4())
    register_payload = {
        "email": f"testuser_{unique_suffix}@example.com",
        "password": "StrongPassword123!",
        "tenantName": f"tenant_{unique_suffix}"
    }
    
    register_url = f"{BASE_URL}/api/auth/register"
    
    # POST /api/auth/register
    response = requests.post(register_url, json=register_payload, headers=HEADERS, timeout=TIMEOUT)
    try:
        assert response.status_code == 201, f"Expected 201 Created, got {response.status_code}. Response: {response.text}"
        data = response.json()
        
        # Validate returned user and tenant object presence
        # Must include tenant_id (or id as per actual response)
        assert isinstance(data, dict), "Response is not a JSON object"

        # Check user fields
        assert "user" in data, "Response missing 'user' object"
        user = data["user"]
        assert isinstance(user, dict), "'user' is not an object"
        assert "email" in user, "User object missing 'email'"
        assert user["email"] == register_payload["email"], "Email in response does not match request"

        # Check tenant fields presence and tenant_id or id
        assert "tenant" in data, "Response missing 'tenant' object"
        tenant = data["tenant"]
        assert isinstance(tenant, dict), "'tenant' is not an object"
        # Changed to check for 'id' field instead of 'tenant_id'
        assert ("tenant_id" in tenant) or ("id" in tenant), "Response tenant object missing 'tenant_id' or 'id'"
        tenant_id_val = tenant.get("tenant_id") or tenant.get("id")
        assert isinstance(tenant_id_val, (str, int)), "'tenant_id' or 'id' is not string or int"
        assert tenant.get("name", "") == register_payload["tenantName"], "Tenant name in response does not match request"
        
        # Verify 409 Conflict if try to register with same email again (authentication fix check)
        conflict_response = requests.post(register_url, json=register_payload, headers=HEADERS, timeout=TIMEOUT)
        assert conflict_response.status_code == 409, f"Expected 409 Conflict on duplicate email, got {conflict_response.status_code}"
        
    finally:
        # Cleanup: try to delete created tenant/user if API supports it (not specified in PRD)
        # Since no delete endpoint specified, no cleanup action performed here.
        pass

test_post_api_auth_register_should_register_new_tenant_and_user()