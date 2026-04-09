import requests

BASE_URL = "http://localhost:3001"
LOGIN_PATH = "/api/auth/login"
INVOICES_PATH = "/api/invoices"
TIMEOUT = 30


def test_get_api_invoices_list_invoices_for_tenant():
    # Login with valid credentials to obtain JWT token
    login_url = BASE_URL + LOGIN_PATH
    login_payload = {"email": "hqbakari@gmail.com", "password": "Muu@1212"}
    try:
        login_resp = requests.post(login_url, json=login_payload, timeout=TIMEOUT)
        assert login_resp.status_code == 200, f"Login failed with status {login_resp.status_code}"
        login_data = login_resp.json()
        assert "token" in login_data, "Login response missing token"
        token = login_data["token"]
    except (requests.RequestException, AssertionError) as e:
        raise AssertionError(f"Login request failed: {e}")

    headers = {
        "Authorization": f"Bearer {token}"
    }

    invoices_url = BASE_URL + INVOICES_PATH

    # Test: GET /api/invoices with valid Authorization Bearer token
    try:
        resp = requests.get(invoices_url, headers=headers, timeout=TIMEOUT)
        assert resp.status_code == 200, f"Expected 200 OK for authorized GET /api/invoices but got {resp.status_code}"
        data = resp.json()
        # The invoices list should be a list (array)
        assert isinstance(data, list), "Invoices response is not a list"
    except (requests.RequestException, AssertionError) as e:
        raise AssertionError(f"Authorized GET /api/invoices failed: {e}")

    # Test: GET /api/invoices without Authorization header
    try:
        resp_no_auth = requests.get(invoices_url, timeout=TIMEOUT)
        assert resp_no_auth.status_code == 401, f"Expected 401 Unauthorized without auth header but got {resp_no_auth.status_code}"
    except (requests.RequestException, AssertionError) as e:
        raise AssertionError(f"Unauthorized GET /api/invoices failed: {e}")


test_get_api_invoices_list_invoices_for_tenant()
