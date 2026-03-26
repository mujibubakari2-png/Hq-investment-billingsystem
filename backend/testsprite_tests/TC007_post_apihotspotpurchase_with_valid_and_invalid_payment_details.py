import requests

BASE_URL = "http://localhost:3001"
LOGIN_URL = f"{BASE_URL}/api/auth/login"
HOTSPOT_PURCHASE_URL = f"{BASE_URL}/api/hotspot/purchase"

ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "admin123"
TIMEOUT = 30

def get_auth_token(email: str, password: str) -> str:
    login_payload = {
        "email": email,
        "password": password
    }
    resp = requests.post(LOGIN_URL, json=login_payload, timeout=TIMEOUT)
    resp.raise_for_status()
    data = resp.json()
    token = data.get("token") or data.get("accessToken") or data.get("jwt")
    if not token:
        raise RuntimeError("No token found in login response")
    return token

def test_post_apihotspotpurchase_with_valid_and_invalid_payment_details():
    # Authenticate admin user to get token
    token = get_auth_token(ADMIN_EMAIL, ADMIN_PASSWORD)

    headers = {
        "Content-Type": "application/json"
    }

    packages_resp = requests.get(f"{BASE_URL}/api/packages", headers={"Authorization": f"Bearer {token}"}, timeout=TIMEOUT)
    packages_resp.raise_for_status()
    packages = packages_resp.json()
    if not packages or not isinstance(packages, list):
        raise RuntimeError("No packages found to use for purchase test")
    package = packages[0]
    package_id = package.get("id")
    assert package_id is not None, "Package id is missing"
    package_id = str(package_id)

    routers_resp = requests.get(f"{BASE_URL}/api/routers", headers={"Authorization": f"Bearer {token}"}, timeout=TIMEOUT)
    routers_resp.raise_for_status()
    routers = routers_resp.json()
    if not routers or not isinstance(routers, list):
        raise RuntimeError("No routers found to use for purchase test")
    router = routers[0]
    router_id = router.get("id")
    assert router_id is not None, "Router id is missing"
    router_id = str(router_id)

    valid_purchase_payload = {
        "username": "testuser123",
        "router_id": router_id,
        "package_id": package_id,
        "payment_info": {
            "method": "mpesa",
            "transactionId": "TX1234567890",
            "amount": package.get("price", 100)  # fallback 100 if price not present
        }
    }

    valid_resp = requests.post(HOTSPOT_PURCHASE_URL, json=valid_purchase_payload, timeout=TIMEOUT)
    assert valid_resp.status_code == 200, f"Expected 200 OK for valid purchase, got {valid_resp.status_code}"
    valid_json = valid_resp.json()
    assert (
        "voucher" in valid_json or
        "activation" in valid_json or
        "credentials" in valid_json or
        "accessDetails" in valid_json
    ), "Valid purchase response missing expected keys"

    invalid_payloads = [
        {
            "username": "testuser123",
            "router_id": router_id,
            "package_id": package_id,
            "payment_info": {
                "method": "mpesa",
                "transactionId": "TX1234567891",
                "amount": 0
            }
        },
        {
            "username": "testuser123",
            "router_id": router_id,
            "package_id": package_id
        },
        {
            "username": "testuser123",
            "router_id": router_id,
            "package_id": package_id,
            "payment_info": {
                "method": "invalidmethod",
                "transactionId": "TX1234567892",
                "amount": package.get("price", 100)
            }
        },
        {
            "username": "testuser123",
            "router_id": router_id,
            "package_id": package_id,
            "payment_info": {
                "method": "mpesa",
                "transactionId": 1234567893,
                "amount": package.get("price", 100)
            }
        },
    ]

    for i, invalid_payload in enumerate(invalid_payloads):
        resp = requests.post(HOTSPOT_PURCHASE_URL, json=invalid_payload, timeout=TIMEOUT)
        assert resp.status_code in (400, 402), (
            f"Invalid payment test case {i} expected 400 or 402, got {resp.status_code}"
        )
        json_resp = {}
        try:
            json_resp = resp.json()
        except Exception:
            pass
        error_msg = (
            json_resp.get("error") or
            json_resp.get("message") or
            json_resp.get("detail") or
            ""
        ).lower()
        assert (
            "payment" in error_msg or
            "required" in error_msg or
            "insufficient" in error_msg or
            "invalid" in error_msg or
            "failed" in error_msg
        ), f"Invalid payment test case {i} response missing payment related error message"

test_post_apihotspotpurchase_with_valid_and_invalid_payment_details()
