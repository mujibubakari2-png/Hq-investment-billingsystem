import requests
import json

BASE_URL = "http://localhost:3001"
ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "admin123"
TIMEOUT = 30

def get_auth_token():
    try:
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            timeout=TIMEOUT
        )
        response.raise_for_status()
        data = response.json()
        token = data.get("token")
        assert token, "No token in login response"
        return token
    except requests.RequestException as e:
        raise AssertionError(f"Authentication failed: {e}")
    except (ValueError, AssertionError) as e:
        raise AssertionError(f"Authentication response invalid: {e}")

def get_clients(auth_token):
    headers = {"Authorization": f"Bearer {auth_token}"}
    try:
        response = requests.get(f"{BASE_URL}/api/clients", headers=headers, timeout=TIMEOUT)
        response.raise_for_status()
        clients = response.json()
        assert isinstance(clients, list), "Clients response is not a list"
        return clients
    except requests.RequestException as e:
        raise AssertionError(f"Failed to get clients: {e}")
    except (ValueError, AssertionError) as e:
        raise AssertionError(f"Invalid clients response: {e}")

def test_post_apismsbulk_send_messages_to_clients():
    auth_token = get_auth_token()
    headers = {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }

    clients = get_clients(auth_token)
    if not clients:
        raise AssertionError("No clients available to send messages to")

    client_ids = [client.get("id") for client in clients if client.get("id") is not None]
    assert client_ids, "No valid client IDs found"

    payload = {
        "clientIds": client_ids,
        "message": "Test message from automated test"
    }

    try:
        response = requests.post(
            f"{BASE_URL}/api/sms/bulk",
            headers=headers,
            json=payload,
            timeout=TIMEOUT
        )
        assert response.status_code in (200, 201), f"Expected 200 OK or 201 Created, got {response.status_code}"
        resp_json = response.json()
        # Assuming response includes a success field or similar confirmation
        assert resp_json.get("success") is True or resp_json.get("status") == "success", \
            "Bulk SMS response does not indicate success"
    except requests.RequestException as e:
        raise AssertionError(f"Request failed: {e}")
    except (ValueError, AssertionError) as e:
        raise AssertionError(f"Response validation failed: {e}")

test_post_apismsbulk_send_messages_to_clients()
