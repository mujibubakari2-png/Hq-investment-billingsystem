import requests

BASE_URL = "http://localhost:3001"
ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "admin123"
TIMEOUT = 30


def test_get_and_post_api_expenses():
    # Authenticate and get JWT token
    login_url = f"{BASE_URL}/api/auth/login"
    login_payload = {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    try:
        login_resp = requests.post(login_url, json=login_payload, timeout=TIMEOUT)
        login_resp.raise_for_status()
    except requests.RequestException as e:
        assert False, f"Login request failed: {e}"
    login_json = login_resp.json()
    assert "token" in login_json, "Login response missing token"
    token = login_json["token"]

    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    expenses_url = f"{BASE_URL}/api/expenses"

    # GET /api/expenses - List all expenses
    try:
        get_resp = requests.get(expenses_url, headers=headers, timeout=TIMEOUT)
        get_resp.raise_for_status()
    except requests.RequestException as e:
        assert False, f"GET /api/expenses request failed: {e}"
    assert get_resp.status_code == 200, f"Expected 200 OK, got {get_resp.status_code}"
    expenses_list = get_resp.json()
    assert isinstance(expenses_list, list), "GET /api/expenses response is not a list"

    new_expense = {
        "category": "office supplies",
        "amount": 123.45,
        "description": "Purchased printer ink cartridges"
    }

    created_expense_id = None

    # POST /api/expenses - Create a new expense
    try:
        post_resp = requests.post(expenses_url, headers=headers, json=new_expense, timeout=TIMEOUT)
        post_resp.raise_for_status()
    except requests.RequestException as e:
        assert False, f"POST /api/expenses request failed: {e}"

    assert post_resp.status_code == 201, f"Expected 201 Created on expense creation, got {post_resp.status_code}"
    expense_created = post_resp.json()
    assert "id" in expense_created, "Created expense response missing 'id'"
    assert expense_created.get("category") == new_expense["category"], "Category mismatch"
    assert abs(expense_created.get("amount", 0) - new_expense["amount"]) < 0.0001, "Amount mismatch"
    assert expense_created.get("description") == new_expense["description"], "Description mismatch"

    created_expense_id = expense_created["id"]

    # Cleanup: delete the created expense if DELETE /api/expenses/[id] supported
    if created_expense_id:
        del_url = f"{expenses_url}/{created_expense_id}"
        try:
            del_resp = requests.delete(del_url, headers=headers, timeout=TIMEOUT)
            # Not asserting on delete status, as endpoint support unknown
        except requests.RequestException:
            pass


test_get_and_post_api_expenses()