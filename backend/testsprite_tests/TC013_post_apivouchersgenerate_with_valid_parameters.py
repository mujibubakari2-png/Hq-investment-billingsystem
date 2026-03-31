import requests
import uuid

BASE_URL = "http://localhost:3001"
TIMEOUT = 30

def login():
    login_url = f"{BASE_URL}/api/auth/login"
    # These credentials must exist in the system; adjust if needed.
    payload = {
        "email": "admin@example.com",
        "password": "adminpassword"
    }
    resp = requests.post(login_url, json=payload, timeout=TIMEOUT)
    resp.raise_for_status()
    token = resp.json().get("token")
    assert token, "Login did not return token"
    return token

def create_package(auth_token):
    packages_url = f"{BASE_URL}/api/packages"
    payload = {
        "type": "Hotspot",
        "name": f"Test Package {uuid.uuid4()}",
        "price": 100,
        "duration": 30,
        "uploadSpeed": 100,
        "downloadSpeed": 100
    }
    headers = {"Authorization": f"Bearer {auth_token}"}
    resp = requests.post(packages_url, json=payload, headers=headers, timeout=TIMEOUT)
    resp.raise_for_status()
    package = resp.json()
    package_id = package.get("id")
    assert package_id, "Created package did not return an ID"
    return package_id

def delete_package(auth_token, package_id):
    package_url = f"{BASE_URL}/api/packages/{package_id}"
    headers = {"Authorization": f"Bearer {auth_token}"}
    resp = requests.delete(package_url, headers=headers, timeout=TIMEOUT)
    assert resp.status_code in (200, 204), f"Failed to delete package {package_id}"

def create_router(auth_token):
    routers_url = f"{BASE_URL}/api/routers"
    payload = {
        "accessCode": "testaccesscode",
        "name": f"Test Router {uuid.uuid4()}",
        "vpnMode": "disabled",
        "description": "Test router created by test",
        "initialStatus": "active"
    }
    headers = {"Authorization": f"Bearer {auth_token}"}
    resp = requests.post(routers_url, json=payload, headers=headers, timeout=TIMEOUT)
    resp.raise_for_status()
    router = resp.json()
    router_id = router.get("id")
    assert router_id, "Created router did not return an ID"
    return router_id

def delete_router(auth_token, router_id):
    router_url = f"{BASE_URL}/api/routers/{router_id}"
    headers = {"Authorization": f"Bearer {auth_token}"}
    resp = requests.delete(router_url, headers=headers, timeout=TIMEOUT)
    assert resp.status_code in (200, 204), f"Failed to delete router {router_id}"

def test_post_api_vouchers_generate_with_valid_parameters():
    token = login()
    headers = {
        "Authorization": f"Bearer {token}"
    }
    package_id = None
    router_id = None
    try:
        # Create package to use for voucher generation
        package_id = create_package(token)
        # Create router for voucher generation
        router_id = create_router(token)

        generate_url = f"{BASE_URL}/api/vouchers"
        payload = {
            "type": "Hotspot",
            "routerId": router_id,
            "planId": package_id,
            "quantity": 5
        }
        resp = requests.post(generate_url, json=payload, headers=headers, timeout=TIMEOUT)
        assert resp.status_code == 201, f"Expected status 201, got {resp.status_code}"

        data = resp.json()
        assert isinstance(data, dict), "Response JSON is not a dict"
        vouchers = data.get("vouchers") or data.get("codes") or data.get("data")
        assert vouchers is not None, "Response does not contain vouchers"
        assert isinstance(vouchers, list), "Vouchers field is not a list"
        assert len(vouchers) == 5, f"Expected 5 vouchers, got {len(vouchers)}"
        for v in vouchers:
            if isinstance(v, dict):
                code = v.get("code")
                assert code and isinstance(code, str) and len(code) > 0, f"Invalid voucher code: {v}"
            else:
                assert isinstance(v, str) and len(v) > 0, f"Invalid voucher code string: {v}"
    finally:
        if package_id:
            delete_package(token, package_id)
        if router_id:
            delete_router(token, router_id)

test_post_api_vouchers_generate_with_valid_parameters()
