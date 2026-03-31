import requests

BASE_URL = "http://localhost:3001"
TIMEOUT = 30

def test_get_and_post_apiequipment():
    # Test GET /api/equipment - List all equipment
    try:
        get_response = requests.get(f"{BASE_URL}/api/equipment", timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"GET /api/equipment request failed: {e}"

    assert get_response.status_code == 200, f"Expected 200 OK, got {get_response.status_code}"
    try:
        equipment_list = get_response.json()
    except ValueError:
        assert False, "GET /api/equipment did not return valid JSON"
    assert isinstance(equipment_list, list), "Expected response to be a list of equipment"

    # Test POST /api/equipment - Add a new equipment item
    new_equipment_payload = {
        "serialNumber": "SN1234567890",
        "model": "Model-X1000"
    }
    headers = {"Content-Type": "application/json"}
    post_response = None
    equipment_id = None

    try:
        post_response = requests.post(
            f"{BASE_URL}/api/equipment",
            json=new_equipment_payload,
            headers=headers,
            timeout=TIMEOUT
        )
    except requests.RequestException as e:
        assert False, f"POST /api/equipment request failed: {e}"

    assert post_response is not None, "No response received from POST /api/equipment"
    assert post_response.status_code == 201, f"Expected 201 Created, got {post_response.status_code}"
    try:
        post_data = post_response.json()
    except ValueError:
        assert False, "POST /api/equipment did not return valid JSON"

    assert "id" in post_data, "Created equipment response must contain 'id'"
    assert post_data.get("serialNumber") == new_equipment_payload["serialNumber"], "Serial number mismatch"
    assert post_data.get("model") == new_equipment_payload["model"], "Model mismatch"

    equipment_id = post_data["id"]

    # Cleanup: delete the created equipment after test
    try:
        delete_response = requests.delete(f"{BASE_URL}/api/equipment/{equipment_id}", timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"DELETE /api/equipment/{equipment_id} request failed: {e}"

    assert delete_response.status_code in (200, 204), f"Expected 200 OK or 204 No Content on delete, got {delete_response.status_code}"


test_get_and_post_apiequipment()