import requests

BASE_URL = "http://localhost:3001"
TIMEOUT = 30

def test_post_api_sms_bulk_send_messages_to_clients():
    """
    Test the /api/sms/bulk endpoint by sending a test message to a list of client IDs
    and verifying the success response.
    """

    url_clients = f"{BASE_URL}/api/clients"
    url_sms_bulk = f"{BASE_URL}/api/sms/bulk"

    login_url = f"{BASE_URL}/api/auth/login"
    login_payload = {
        "email": "admin@example.com",
        "password": "password123"
    }

    token = None
    try:
        resp_login = requests.post(login_url, json=login_payload, timeout=TIMEOUT)
        resp_login.raise_for_status()
        data_login = resp_login.json()
        token = data_login.get("token") or data_login.get("jwt") or data_login.get("accessToken") or data_login.get("access_token")
    except Exception:
        pass

    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    try:
        resp_clients = requests.get(url_clients, headers=headers, timeout=TIMEOUT)
        resp_clients.raise_for_status()
        clients_data = resp_clients.json()
        clients = clients_data if isinstance(clients_data, list) else clients_data.get("clients", [])
    except Exception:
        clients = []

    if not clients:
        # Add required planId with placeholder value
        client_payload = {
            "username": "testuser_smsbulk",
            "fullName": "Test User SMS Bulk",
            "phone": "+1234567890",
            "planId": 1
        }
        try:
            resp_create_client = requests.post(url_clients, json=client_payload, headers=headers, timeout=TIMEOUT)
            resp_create_client.raise_for_status()
            created_client = resp_create_client.json()
            client_id = created_client.get("id") or created_client.get("clientId") or None
        except Exception:
            client_id = None
        if client_id:
            clients = [{"id": client_id}]
        else:
            clients = []

    if not clients:
        raise AssertionError("No clients available to send SMS bulk message.")

    client_ids = [client["id"] for client in clients if "id" in client]
    if not client_ids:
        raise AssertionError("Client IDs not found in client data.")

    sms_payload = {
        "clientIds": client_ids,
        "message": "Test message from automated SMS bulk API test."
    }

    resp_sms_bulk = requests.post(url_sms_bulk, json=sms_payload, headers=headers, timeout=TIMEOUT)

    try:
        resp_sms_bulk.raise_for_status()
    except requests.HTTPError as e:
        raise AssertionError(f"SMS bulk sending failed: {resp_sms_bulk.status_code}, response: {resp_sms_bulk.text}") from e

    try:
        response_data = resp_sms_bulk.json()
    except ValueError:
        raise AssertionError("SMS bulk API response is not a valid JSON.")

    assert response_data.get("success") is True, \
        f"Expected success in response but got: {response_data}"


test_post_api_sms_bulk_send_messages_to_clients()
