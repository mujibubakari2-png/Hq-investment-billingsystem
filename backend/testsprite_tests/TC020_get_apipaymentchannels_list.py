import requests

BASE_URL = "http://localhost:3001"
ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "admin123"
TIMEOUT = 30

def test_tc020_get_apipaymentchannels_list():
    # Step 1: Authenticate with admin credentials to get JWT token
    login_url = f"{BASE_URL}/api/auth/login"
    login_payload = {
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD,
    }
    try:
        login_response = requests.post(login_url, json=login_payload, timeout=TIMEOUT)
        assert login_response.status_code == 200, f"Login failed, status code: {login_response.status_code}"
        login_data = login_response.json()
        assert "token" in login_data, "Login response missing 'token'"
        token = login_data["token"]
    except requests.RequestException as e:
        raise AssertionError(f"Login request failed: {e}")

    # Step 2: Call /api/payment-channels endpoint with Authorization header
    payment_channels_url = f"{BASE_URL}/api/payment-channels"
    headers = {
        "Authorization": f"Bearer {token}"
    }

    try:
        response = requests.get(payment_channels_url, headers=headers, timeout=TIMEOUT)
    except requests.RequestException as e:
        raise AssertionError(f"Request to /api/payment-channels failed: {e}")
    
    # Step 3: Verify response status and structure
    assert response.status_code == 200, f"Expected 200 OK, got {response.status_code}"
    try:
        channels = response.json()
    except ValueError:
        raise AssertionError("Response is not valid JSON")

    # Ensure channels is a list and contains expected gateway names like M-Pesa, PalmPesa
    assert isinstance(channels, list), "Expected response to be a list"
    gateways = [ch.get("name", "").lower() for ch in channels if isinstance(ch, dict) and "name" in ch]
    assert any("mpesa" in g for g in gateways), "M-Pesa not found in payment channels"
    assert any("palmpesa" in g for g in gateways) or any("palm pesa" in g for g in gateways), "PalmPesa not found in payment channels"

test_tc020_get_apipaymentchannels_list()