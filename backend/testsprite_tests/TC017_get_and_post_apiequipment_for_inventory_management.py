import requests
import uuid

BASE_URL = "http://localhost:3001"
LOGIN_URL = f"{BASE_URL}/api/auth/login"
EQUIPMENT_URL = f"{BASE_URL}/api/equipment"
ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "admin123"
TIMEOUT = 30


def test_get_and_post_apiequipment():
    # Authenticate to get token
    try:
        login_resp = requests.post(
            LOGIN_URL,
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            timeout=TIMEOUT,
        )
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        token = login_resp.json().get("token")
        assert token, "No token received on login"
    except Exception as e:
        raise AssertionError(f"Authentication failed: {e}")

    headers = {"Authorization": f"Bearer {token}"}

    # 1. GET /api/equipment list existing equipment
    try:
        get_resp = requests.get(EQUIPMENT_URL, headers=headers, timeout=TIMEOUT)
        assert get_resp.status_code == 200, f"Failed to list equipment: {get_resp.text}"
        equipment_list = get_resp.json()
        assert isinstance(equipment_list, list), "Equipment list is not a list"
    except Exception as e:
        raise AssertionError(f"GET /api/equipment failed: {e}")

    # 2. POST /api/equipment add new equipment item
    # Compose unique serialNumber to avoid collisions
    new_equipment = {
        "serialNumber": f"SN-{uuid.uuid4()}",
        "model": "ModelX-Test"
    }

    created_equipment_id = None
    try:
        post_resp = requests.post(
            EQUIPMENT_URL, json=new_equipment, headers=headers, timeout=TIMEOUT
        )
        assert post_resp.status_code == 201, f"Failed to create equipment: {post_resp.text}"
        created = post_resp.json()
        assert "id" in created, "Created equipment response missing 'id'"
        created_equipment_id = created["id"]
        assert created.get("serialNumber") == new_equipment["serialNumber"], "Serial number mismatch in created equipment"
        assert created.get("model") == new_equipment["model"], "Model mismatch in created equipment"

        # Verify new item is listed in equipment GET
        get_after_post_resp = requests.get(EQUIPMENT_URL, headers=headers, timeout=TIMEOUT)
        assert get_after_post_resp.status_code == 200, f"Failed to list equipment after POST: {get_after_post_resp.text}"
        equipment_after_post = get_after_post_resp.json()
        assert any(e["id"] == created_equipment_id for e in equipment_after_post), "New equipment not found in list after creation"

    except Exception as e:
        raise AssertionError(f"POST /api/equipment failed: {e}")

    # Cleanup: delete created equipment
    if created_equipment_id:
        try:
            del_resp = requests.delete(
                f"{EQUIPMENT_URL}/{created_equipment_id}", headers=headers, timeout=TIMEOUT
            )
            assert del_resp.status_code in (200, 204), f"Failed to delete equipment: {del_resp.text}"
        except Exception as e:
            raise AssertionError(f"Cleanup deletion of equipment failed: {e}")


test_get_and_post_apiequipment()