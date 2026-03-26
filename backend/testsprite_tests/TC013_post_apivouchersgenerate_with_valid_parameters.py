import requests

BASE_URL = "http://localhost:3001"
ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "admin123"
TIMEOUT = 30

def test_post_api_vouchers_generate_with_valid_parameters():
    # Authenticate as admin to get JWT token
    login_url = f"{BASE_URL}/api/auth/login"
    login_payload = {
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    }
    try:
        login_response = requests.post(login_url, json=login_payload, timeout=TIMEOUT)
        login_response.raise_for_status()
    except requests.RequestException as e:
        assert False, f"Admin login request failed: {e}"
    login_data = login_response.json()
    assert "token" in login_data and login_data["token"], "JWT token not returned in login response"
    token = login_data["token"]
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    # Get list of packages to get a valid planId
    packages_url = f"{BASE_URL}/api/packages"
    try:
        packages_response = requests.get(packages_url, headers=headers, timeout=TIMEOUT)
        packages_response.raise_for_status()
    except requests.RequestException as e:
        assert False, f"Failed to get packages: {e}"
    packages = packages_response.json()
    assert isinstance(packages, list), "Packages response is not a list"
    assert len(packages) > 0, "No packages available to test voucher generation"
    plan_id = None
    for p in packages:
        if "id" in p and p["id"]:
            plan_id = p["id"]
            break
    assert plan_id is not None, "No valid plan id found"

    # Get list of routers to get a valid routerId
    routers_url = f"{BASE_URL}/api/routers"
    try:
        routers_response = requests.get(routers_url, headers=headers, timeout=TIMEOUT)
        routers_response.raise_for_status()
    except requests.RequestException as e:
        assert False, f"Failed to get routers: {e}"
    routers = routers_response.json()
    assert isinstance(routers, list), "Routers response is not a list"
    assert len(routers) > 0, "No routers available to test voucher generation"
    router_id = None
    for r in routers:
        if "id" in r and r["id"]:
            router_id = r["id"]
            break
    assert router_id is not None, "No valid router id found"

    # Prepare payload to generate vouchers
    vouchers_url = f"{BASE_URL}/api/vouchers"
    generate_payload = {
        "type": "Hotspot",
        "routerId": router_id,
        "planId": plan_id,
        "quantity": 5
    }

    try:
        generate_response = requests.post(vouchers_url, json=generate_payload, headers=headers, timeout=TIMEOUT)
        generate_response.raise_for_status()
    except requests.HTTPError as e:
        assert False, f"Voucher generation failed with status {generate_response.status_code}: {generate_response.text}"
    except requests.RequestException as e:
        assert False, f"Voucher generation request failed: {e}"

    generate_data = generate_response.json()
    assert isinstance(generate_data, dict), "Voucher generation response is not a dict"
    vouchers = generate_data.get("vouchers") or generate_data.get("codes") or generate_data.get("data")
    assert vouchers is not None, "No vouchers found in the response"
    assert isinstance(vouchers, list), "Vouchers in response is not a list"
    assert len(vouchers) == 5, f"Expected 5 vouchers but got {len(vouchers)}"
    for v in vouchers:
        if isinstance(v, dict):
            code = v.get("code") or v.get("voucherCode") or v.get("voucher")
            assert code and isinstance(code, str) and code.strip(), f"Voucher code invalid or empty: {v}"
        else:
            assert isinstance(v, str) and v.strip(), f"Voucher code is invalid or empty: {v}"


test_post_api_vouchers_generate_with_valid_parameters()
