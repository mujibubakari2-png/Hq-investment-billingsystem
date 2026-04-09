import requests
import uuid

BASE_URL = "http://localhost:3001/api"
HEADERS = {
    "Content-Type": "application/json"
}
TIMEOUT = 30


def test_postapiauthregisternewuser():
    # Generate a unique email to ensure new user creation
    unique_email = f"testuser_{uuid.uuid4().hex}@example.com"
    password = "TestPassword123!"
    company = "TestCompany Inc."

    register_url = f"{BASE_URL}/auth/register"
    payload = {
        "email": unique_email,
        "password": password,
        "company": company
    }

    try:
        response = requests.post(register_url, json=payload, headers=HEADERS, timeout=TIMEOUT)
        assert response.status_code == 201, f"Expected 201 Created, got {response.status_code}"
        json_data = response.json()
        assert "user_id" in json_data, "Response missing user_id"
        assert "tenant_id" in json_data, "Response missing tenant_id"
        user_id = json_data["user_id"]
        tenant_id = json_data["tenant_id"]
        assert isinstance(user_id, str) and user_id != "", "Invalid user_id value"
        assert isinstance(tenant_id, str) and tenant_id != "", "Invalid tenant_id value"
    finally:
        # Cleanup: Delete the newly created user to keep test environment clean
        if 'user_id' in locals():
            delete_url = f"{BASE_URL}/auth/users/{user_id}"
            # Assuming the delete endpoint requires the same API key header and the method is DELETE
            try:
                del_resp = requests.delete(delete_url, headers=HEADERS, timeout=TIMEOUT)
                # No assertion on delete, just attempt cleanup
            except Exception:
                pass


test_postapiauthregisternewuser()