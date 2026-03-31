import requests

BASE_URL = "http://localhost:3001"
TIMEOUT = 30

def test_post_apihotspotpurchase_with_valid_and_invalid_payment_details():
    url = f"{BASE_URL}/api/hotspot/purchase"
    
    # Valid purchase payload simplified to required fields
    valid_payload = {
        "username": "testuser1",
        "routerId": 1,
        "packageId": 1,
        "paymentInfo": {
            "method": "mpesa",
            "amount": 100.0
        }
    }
    
    # Invalid payment payloads examples
    invalid_payloads = [
        # Insufficient funds / payment required scenario
        {
            "username": "testuser1",
            "routerId": 1,
            "packageId": 1,
            "paymentInfo": {
                "method": "mpesa",
                "amount": 0.0  # zero or insufficient amount
            }
        },
        # Invalid payment method scenario
        {
            "username": "testuser1",
            "routerId": 1,
            "packageId": 1,
            "paymentInfo": {
                "method": "invalid_method",
                "amount": 100.0
            }
        }
    ]
    
    headers = {
        "Content-Type": "application/json"
    }

    # Test valid purchase
    try:
        resp = requests.post(url, json=valid_payload, headers=headers, timeout=TIMEOUT)
        assert resp.status_code == 200, f"Expected 200 OK for valid purchase, got {resp.status_code}"
        json_resp = resp.json()
        assert ("voucher" in json_resp or "activation" in json_resp), "Response must include voucher or activation details"
        assert False, f"Valid purchase request failed: {e}"
    
    # Test invalid payment scenarios
    for idx, payload in enumerate(invalid_payloads):
        try:
            resp = requests.post(url, json=payload, headers=headers, timeout=TIMEOUT)
            assert resp.status_code in (400, 402), \
                f"Expected 400 or 402 for invalid payment in test case {idx}, got {resp.status_code}"
            json_resp = resp.json()
            error_message = json_resp.get("error") or json_resp.get("message") or ""
            assert error_message != "", \
                f"Expected error message in test case {idx}, got: {json_resp}"
        except requests.RequestException as e:
            assert False, f"Invalid payment request {idx} failed: {e}"


test_post_apihotspotpurchase_with_valid_and_invalid_payment_details()
