import requests
import uuid

BASE_URL = "http://localhost:3001"
HEADERS = {"Content-Type": "application/json"}
TIMEOUT = 30

def test_post_api_auth_register_user_registration():
    register_url = f"{BASE_URL}/api/auth/register"

    # Generate a unique email to avoid conflict in registration
    unique_email = f"testuser_{uuid.uuid4().hex[:8]}@example.com"
    password = "ValidPass123!"
    tenant_id = "tenant_test_1"

    # 1. Test user registration with valid email, password, tenant_id - expect 201 Created and user id
    payload = {
        "email": unique_email,
        "password": password,
        "tenant_id": tenant_id
    }

    # Registration request - new user
    try:
        response = requests.post(register_url, json=payload, headers=HEADERS, timeout=TIMEOUT)
        assert response.status_code == 201, f"Expected 201 Created, got {response.status_code}"
        response_json = response.json()
        assert "id" in response_json, "Response JSON missing 'id'"
        new_user_id = response_json["id"]
    except Exception as e:
        raise AssertionError(f"User registration failed with exception: {e}")

    # 2. Test registration with existing email - expect 409 Conflict with message 'email already exists'
    try:
        response_dup = requests.post(register_url, json=payload, headers=HEADERS, timeout=TIMEOUT)
        assert response_dup.status_code == 409, f"Expected 409 Conflict, got {response_dup.status_code}"
        resp_json = response_dup.json()
        assert "email already exists" in resp_json.get("message", "").lower(), "Expected error message about existing email"
    except Exception as e:
        raise AssertionError(f"Duplicate email registration test failed with exception: {e}")

test_post_api_auth_register_user_registration()
