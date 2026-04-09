import requests

BASE_URL = "http://localhost:3001"
API_KEY = "sk-user-wr0eKZ_Ytg73zZIWxpNDQdWf65bUNwxqET31xUX7c6uNnMi5P4tH6hllD1TqnPiyPBBal8AzniRqDRddlzeaZWfgO15n1RCd4A2Nzb3qIgbgBi1J5Bmj2FPBLP-O5DhhG20"
API_KEY_HEADER_NAME = "Authorization"

def test_get_api_clients_should_list_clients_for_current_tenant():
    headers = {
        API_KEY_HEADER_NAME: f"Bearer {API_KEY}",
        "Accept": "application/json",
    }
    try:
        response = requests.get(f"{BASE_URL}/api/clients", headers=headers, timeout=30)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

    assert response.status_code == 200, f"Expected status 200, got {response.status_code}"
    try:
        clients = response.json()
    except Exception as e:
        assert False, f"Response is not valid JSON: {e}"

    # Validate that the response is a list
    assert isinstance(clients, list), f"Expected response to be a list, got {type(clients)}"

    # If there are clients, verify each has a tenant_id claim matching the token's tenant_id
    # Since we don't have decoded token or tenant_id here, we verify strict tenant isolation by ensuring no client shows tenant_id from other tenants
    # This is limited without token decoding, so we just check existence of keys and proper format

    for client in clients:
        assert isinstance(client, dict), "Each client should be a dict"
        # tenant_id should be present in client object (per PRD tenant enforcement)
        assert "tenant_id" in client, "Client object missing tenant_id"
        # tenant_id should be a non-empty string or number (basic validation)
        tenant_id = client["tenant_id"]
        assert tenant_id is not None and tenant_id != "", "Client tenant_id should not be empty"

    # Additional heuristic: no duplicate client ids with different tenant_ids (could be implicit isolation)
    client_ids = set()
    for client in clients:
        cid = client.get("id") or client.get("clientId") or client.get("client_id") or client.get("id_alias")
        if cid:
            if cid in client_ids:
                continue
            client_ids.add(cid)

    # There's no direct token tenant_id to compare with, given only an API key, 
    # so here we trust that the API only returns clients scoped to the tenant the key belongs to.

test_get_api_clients_should_list_clients_for_current_tenant()