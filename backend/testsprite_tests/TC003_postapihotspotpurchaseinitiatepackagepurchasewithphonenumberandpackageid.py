import requests

BASE_URL = "http://localhost:3001/api"
LOGIN_URL = f"{BASE_URL}/auth/login"
HOTSPOT_PURCHASE_URL = f"{BASE_URL}/hotspot/purchase"
TIMEOUT = 30

def test_postapihotspotpurchaseinitiatepackagepurchasewithphonenumberandpackageid():
    # Login to get JWT token
    login_payload = {
        "email": "admin",
        "password": "admin123"
    }
    login_resp = requests.post(LOGIN_URL, json=login_payload, timeout=TIMEOUT)
    assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
    login_data = login_resp.json()
    token = login_data.get("token") or login_data.get("accessToken")  # fallback key
    assert token, "No JWT token in login response"

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    hotspot_payload = {
        "phone": "+1234567890",
        "package_id": "basic-package"
    }

    purchase_resp = requests.post(HOTSPOT_PURCHASE_URL, json=hotspot_payload, timeout=TIMEOUT)
    assert purchase_resp.status_code == 200, f"Hotspot purchase initiation failed: {purchase_resp.text}"
    purchase_data = purchase_resp.json()
    assert "purchase_id" in purchase_data, "'purchase_id' missing in response"
    assert "payment_url" in purchase_data, "'payment_url' missing in response"
    assert purchase_data.get("status") == "pending", f"Expected status 'pending', got {purchase_data.get('status')}"

test_postapihotspotpurchaseinitiatepackagepurchasewithphonenumberandpackageid()