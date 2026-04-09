import requests

BASE_URL = "http://localhost:3001/api"
TIMEOUT = 30

def test_postapiauthregisteruserregistrationwithemailandpassword():
    url = f"{BASE_URL}/auth/register"
    headers = {"Content-Type": "application/json"}
    payload = {
        "email": "testuser1234@example.com",
        "password": "StrongP@ssw0rd!",
        "company": {
            "name": "TestCompany Ltd",
            "address": "123 Test St",
            "phone": "1234567890"
        }
    }
    user_id = None
    tenant_id = None
    
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=TIMEOUT)
        assert response.status_code == 201, f"Expected status code 201 but got {response.status_code}"
        response_json = response.json()
        assert "user_id" in response_json, "Response JSON missing 'user_id'"
        assert "tenant_id" in response_json, "Response JSON missing 'tenant_id'"
        user_id = response_json["user_id"]
        tenant_id = response_json["tenant_id"]
    finally:
        if user_id:
            # Attempt to delete created user to clean up; assuming DELETE /api/auth/users/{user_id}
            # No auth required info provided for delete, ignoring auth headers
            try:
                requests.delete(f"{BASE_URL}/auth/users/{user_id}", timeout=TIMEOUT)
            except Exception:
                pass

test_postapiauthregisteruserregistrationwithemailandpassword()