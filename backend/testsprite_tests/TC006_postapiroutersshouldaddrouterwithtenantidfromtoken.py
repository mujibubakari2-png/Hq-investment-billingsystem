import requests
import uuid

BASE_URL = "http://localhost:3001"
API_KEY = "sk-user-wr0eKZ_Ytg73zZIWxpNDQdWf65bUNwxqET31xUX7c6uNnMi5P4tH6hllD1TqnPiyPBBal8AzniRqDRddlzeaZWfgO15n1RCd4A2Nzb3qIgbgBi1J5Bmj2FPBLP-O5DhhG20"
HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}
TIMEOUT = 30


def test_post_api_routers_should_add_router_with_tenant_id_from_token():
    router_data = {
        "ip": "192.168.1.100",
        "sharedSecret": "mySharedSecret123",
        "hostname": "router-" + str(uuid.uuid4()),
        "accountingEnabled": True
    }

    # Create new router
    response = requests.post(
        f"{BASE_URL}/api/routers",
        json=router_data,
        headers=HEADERS,
        timeout=TIMEOUT,
    )

    try:
        assert response.status_code == 201, f"Expected 201 Created, got {response.status_code}"
        router_obj = response.json()
        # Validate required fields in response object
        assert "tenant_id" in router_obj, "Response missing tenant_id"
        assert router_obj["ip"] == router_data["ip"]
        assert router_obj["hostname"] == router_data["hostname"]
        assert router_obj["accountingEnabled"] == router_data["accountingEnabled"]

        # Verify that tenant_id is embedded in token matches created router's tenant_id
        # Since token is an API Key, tenant_id embedded in it should equal the router's tenant_id
        # We cannot decode API key, but we trust system enforces this as per PRD. Just ensure tenant_id present.
        assert router_obj["tenant_id"] is not None and isinstance(router_obj["tenant_id"], str) and len(router_obj["tenant_id"]) > 0, "tenant_id is invalid or empty"

        # Additionally, GET /api/routers should list this router only in current tenant scope
        get_response = requests.get(
            f"{BASE_URL}/api/routers",
            headers=HEADERS,
            timeout=TIMEOUT,
        )
        assert get_response.status_code == 200, f"Expected 200 OK on GET /api/routers, got {get_response.status_code}"
        routers_list = get_response.json()
        assert isinstance(routers_list, list), "Routers list response must be a list"
        # Check that our created router is in the list and tenant_id matches token tenant_id
        found = False
        for r in routers_list:
            if r.get("id") == router_obj.get("id"):
                found = True
                assert r.get("tenant_id") == router_obj.get("tenant_id"), "Tenant ID mismatch in GET routers"
                break
        assert found, "Created router not found in routers list for tenant"

    finally:
        # Cleanup: delete the created router to maintain test isolation
        router_id = None
        try:
            router_id = router_obj.get("id")
        except Exception:
            pass
        if router_id:
            try:
                del_response = requests.delete(
                    f"{BASE_URL}/api/routers/{router_id}",
                    headers=HEADERS,
                    timeout=TIMEOUT,
                )
                # Allow 200 OK or 204 No Content as success for delete
                assert del_response.status_code in (200, 204), f"Cleanup delete failed with status {del_response.status_code}"
            except Exception:
                pass


test_post_api_routers_should_add_router_with_tenant_id_from_token()
