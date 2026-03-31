import requests
import random
import string

BASE_URL = "http://localhost:3001"
TIMEOUT = 30

# Use valid admin credentials for login (should be replaced with valid test credentials)
ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "admin123"

def get_auth_token():
    login_url = f"{BASE_URL}/api/auth/login"
    payload = {
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    }
    try:
        resp = requests.post(login_url, json=payload, timeout=TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
        token = data.get("token") or data.get("accessToken")
        assert token, "Token not found in login response"
        return token
    except Exception as e:
        raise RuntimeError(f"Failed to authenticate: {e}")

def test_get_and_put_apisettings():
    token = get_auth_token()
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    settings_url = f"{BASE_URL}/api/settings"

    # Step 1: GET current system configurations
    try:
        get_resp = requests.get(settings_url, headers=headers, timeout=TIMEOUT)
        get_resp.raise_for_status()
        settings_data = get_resp.json()
    except Exception as e:
        raise AssertionError(f"GET /api/settings failed: {e}")

    assert isinstance(settings_data, dict), "Settings response should be a JSON object"

    # Pick a key to update "companyName" or similar. If not present, just add one.
    # We'll assume "companyName" is a typical setting key.
    original_company_name = settings_data.get("companyName", "")
    new_company_name = (
        original_company_name + "_" + "".join(random.choices(string.ascii_letters + string.digits, k=6))
        if original_company_name else "TestCompany_" + "".join(random.choices(string.ascii_letters + string.digits, k=6))
    )

    # Step 2: PUT updated settings to update the company name
    updated_settings = dict(settings_data)  # copy current settings
    updated_settings["companyName"] = new_company_name

    try:
        put_resp = requests.put(settings_url, headers=headers, json=updated_settings, timeout=TIMEOUT)
        put_resp.raise_for_status()
        updated_resp_data = put_resp.json()
    except Exception as e:
        raise AssertionError(f"PUT /api/settings failed: {e}")

    assert isinstance(updated_resp_data, dict), "PUT response should be a JSON object"
    assert updated_resp_data.get("companyName") == new_company_name, "companyName was not updated correctly"

    # Step 3: Verify by GET again that the change persisted
    try:
        verify_resp = requests.get(settings_url, headers=headers, timeout=TIMEOUT)
        verify_resp.raise_for_status()
        verify_data = verify_resp.json()
    except Exception as e:
        raise AssertionError(f"Verification GET /api/settings failed: {e}")

    assert verify_data.get("companyName") == new_company_name, "Updated companyName not persisted after PUT"

    # Cleanup: revert the change back to original value to avoid side effects
    if original_company_name != new_company_name:
        reverted_settings = dict(verify_data)
        reverted_settings["companyName"] = original_company_name
        try:
            revert_resp = requests.put(settings_url, headers=headers, json=reverted_settings, timeout=TIMEOUT)
            revert_resp.raise_for_status()
        except Exception as e:
            print(f"Warning: Failed to revert companyName after test: {e}")

test_get_and_put_apisettings()
