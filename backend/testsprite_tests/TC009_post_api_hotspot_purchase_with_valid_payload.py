import requests
import uuid

BASE_URL = "http://localhost:3000"
TIMEOUT = 30


def test_post_api_hotspot_purchase_with_valid_payload():
    # Helper to create router
    def create_router():
        router_payload = {
            "accessCode": str(uuid.uuid4())[:8],
            "name": "TestRouterHotspotPurchase",
            "vpnMode": "disabled",
            "description": "Router for hotspot purchase test",
            "initialStatus": "active"
        }
        resp = requests.post(f"{BASE_URL}/api/routers", json=router_payload, timeout=TIMEOUT)
        resp.raise_for_status()
        return resp.json()

    # Helper to create package (requires routerId)
    def create_package(router_id):
        package_payload = {
            "type": "Hotspot",
            "name": "TestPackageHotspotPurchase",
            "price": 10,
            "duration": 30,
            "routerId": router_id,
            "uploadSpeed": 1000,
            "downloadSpeed": 1000,
            "hotspotSettings": {
                "someSetting": "value"
            }
        }
        resp = requests.post(f"{BASE_URL}/api/packages", json=package_payload, timeout=TIMEOUT)
        resp.raise_for_status()
        return resp.json()

    router = None
    package = None

    try:
        # Create router resource
        router = create_router()
        router_id = router.get("id")
        assert router_id is not None, "Router creation failed to return id"

        # Create package resource
        package = create_package(router_id)
        package_id = package.get("id")
        assert package_id is not None, "Package creation failed to return id"

        # Prepare purchase payload
        purchase_payload = {
            "username": f"user_{uuid.uuid4().hex[:8]}",
            "routerId": router_id,
            "packageId": package_id,
            "paymentInfo": {
                "method": "manual",
                "transactionId": str(uuid.uuid4()),
                "amount": 10
            }
        }

        # Call hotspot purchase API
        resp = requests.post(f"{BASE_URL}/api/hotspot/purchase", json=purchase_payload, timeout=TIMEOUT)
        resp.raise_for_status()
        data = resp.json()

        # Validate response contains voucher or activation details (example keys)
        assert resp.status_code == 200
        assert isinstance(data, dict)
        has_voucher = "voucherCode" in data or "activationDetails" in data
        assert has_voucher, "Response missing voucherCode or activationDetails"

    finally:
        # Cleanup created package and router if possible
        if package and "id" in package:
            try:
                requests.delete(f"{BASE_URL}/api/packages/{package['id']}", timeout=TIMEOUT)
            except Exception:
                pass
        if router and "id" in router:
            try:
                requests.delete(f"{BASE_URL}/api/routers/{router['id']}", timeout=TIMEOUT)
            except Exception:
                pass


test_post_api_hotspot_purchase_with_valid_payload()
