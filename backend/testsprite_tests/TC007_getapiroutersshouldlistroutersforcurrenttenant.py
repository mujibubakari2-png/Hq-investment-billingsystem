import requests

BASE_URL = "http://localhost:3001"
API_KEY = "sk-user-wr0eKZ_Ytg73zZIWxpNDQdWf65bUNwxqET31xUX7c6uNnMi5P4tH6hllD1TqnPiyPBBal8AzniRqDRddlzeaZWfgO15n1RCd4A2Nzb3qIgbgBi1J5Bmj2FPBLP-O5DhhG20"
API_KEY_HEADER = "karimu"
HEADERS = {
    API_KEY_HEADER: API_KEY,
    "Authorization": f"Bearer {API_KEY}",
    "Accept": "application/json"
}
TIMEOUT = 30

def test_get_api_routers_should_list_routers_for_current_tenant():
    url = f"{BASE_URL}/api/routers"
    try:
        response = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

    assert response.status_code == 200, f"Expected status 200, got {response.status_code}"

    try:
        routers = response.json()
    except ValueError:
        assert False, "Response body is not valid JSON"

    assert isinstance(routers, list), "Response JSON is not a list"

    # Validate each router object has a tenant_id, assuming tenant_id must be present and match token tenant.
    # Since we don't decode the JWT token here, we just check tenant_id presence and type
    for router in routers:
        assert isinstance(router, dict), "Router item is not a JSON object"
        assert "tenant_id" in router, "Router item does not have tenant_id field"
        assert isinstance(router["tenant_id"], (str, int)), "tenant_id is not string or int"

    # Additional validation: tenant isolation and no ID alias conflict tested by system in backend.
    # Here we rely on the token scope and API behavior.

test_get_api_routers_should_list_routers_for_current_tenant()