import requests

BASE_URL = "http://localhost:3001"
ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "admin123"
TIMEOUT = 30

def test_get_and_put_api_settings_for_system_configuration():
    # Authenticate as admin to get JWT token
    login_url = f"{BASE_URL}/api/auth/login"
    login_payload = {
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    }
    try:
        login_response = requests.post(login_url, json=login_payload, timeout=TIMEOUT)
        assert login_response.status_code == 200, f"Login failed with status {login_response.status_code}"
        login_json = login_response.json()
        assert "token" in login_json, "JWT token missing in login response"
        token = login_json["token"]
    except Exception as e:
        raise AssertionError(f"Login request failed: {e}")

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    settings_url = f"{BASE_URL}/api/settings"

    try:
        # Step 1: GET current settings
        get_response = requests.get(settings_url, headers=headers, timeout=TIMEOUT)
        assert get_response.status_code == 200, f"GET /api/settings failed with status {get_response.status_code}"
        settings = get_response.json()
        assert isinstance(settings, dict), "Settings response is not a JSON object"

        # Extract original companyName if exists, else set fallback value
        original_company_name = settings.get("companyName", None)
        new_company_name = "Test Company Inc."

        # Step 2: PUT updated setting (update company name)
        put_payload = dict(settings)  # copy current settings
        put_payload["companyName"] = new_company_name

        put_response = requests.put(settings_url, headers=headers, json=put_payload, timeout=TIMEOUT)
        assert put_response.status_code == 200, f"PUT /api/settings failed with status {put_response.status_code}"
        updated_settings = put_response.json()
        assert isinstance(updated_settings, dict), "PUT response is not a JSON object"
        assert updated_settings.get("companyName") == new_company_name, "Company name was not updated correctly"

        # Step 3: GET again to verify update persisted
        verify_get_response = requests.get(settings_url, headers=headers, timeout=TIMEOUT)
        assert verify_get_response.status_code == 200, f"Second GET /api/settings failed with status {verify_get_response.status_code}"
        verify_settings = verify_get_response.json()
        assert verify_settings.get("companyName") == new_company_name, "Company name update not persisted"

    finally:
        # Cleanup: revert companyName to original if it existed and was changed
        if original_company_name is not None and original_company_name != new_company_name:
            revert_payload = dict(settings)
            revert_payload["companyName"] = original_company_name
            try:
                revert_response = requests.put(settings_url, headers=headers, json=revert_payload, timeout=TIMEOUT)
                assert revert_response.status_code == 200, f"Cleanup PUT /api/settings failed with status {revert_response.status_code}"
            except Exception as e:
                print(f"Warning: Cleanup revert companyName failed: {e}")

test_get_and_put_api_settings_for_system_configuration()