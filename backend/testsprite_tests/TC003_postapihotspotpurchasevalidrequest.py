import requests

BASE_URL = "http://localhost:3001/api"
TIMEOUT = 30

def test_postapihotspotpurchasevalidrequest():
    # Prepare payload with valid phone and hardcoded valid package_id
    payload = {
        "phone": "0712345678",
        "package_id": "valid-package-1"
    }

    # Step 1: Initiate hotspot package purchase (no auth required)
    purchase_resp = requests.post(f"{BASE_URL}/hotspot/purchase", json=payload, timeout=TIMEOUT)
    assert purchase_resp.status_code == 200, f"Expected 200 OK but got {purchase_resp.status_code}: {purchase_resp.text}"

    purchase_data = purchase_resp.json()
    assert "purchase_id" in purchase_data and purchase_data["purchase_id"], "Missing purchase_id in response"
    assert "payment_url" in purchase_data and purchase_data["payment_url"], "Missing payment_url in response"
    assert purchase_data.get("status") == "pending", f"Expected status 'pending' but got {purchase_data.get('status')}"


test_postapihotspotpurchasevalidrequest()
