import requests

BASE_URL = "http://localhost:3001"
TIMEOUT = 30

def test_get_and_post_api_expenses():
    # Step 1: GET /api/expenses to list all expenses
    try:
        get_response = requests.get(f"{BASE_URL}/api/expenses", timeout=TIMEOUT)
        assert get_response.status_code == 200, f"Expected 200 OK, got {get_response.status_code}"
        expenses_list = get_response.json()
        assert isinstance(expenses_list, list), "Expected response to be a list"
    except requests.RequestException as e:
        assert False, f"GET /api/expenses request failed: {e}"
    except ValueError:
        assert False, "GET /api/expenses response is not valid JSON"

    # Step 2: POST /api/expenses to create a new expense entry
    new_expense_payload = {
        "category": "Office Supplies",
        "amount": 123.45,
        "description": "Printer ink cartridges"
    }

    try:
        post_response = requests.post(
            f"{BASE_URL}/api/expenses",
            json=new_expense_payload,
            timeout=TIMEOUT
        )
        assert post_response.status_code == 201, f"Expected 201 Created, got {post_response.status_code}"
        created_expense = post_response.json()
        assert "id" in created_expense, "Response JSON should contain 'id'"
        assert created_expense.get("category") == new_expense_payload["category"], "Category mismatch"
        assert abs(created_expense.get("amount", 0) - new_expense_payload["amount"]) < 0.0001, "Amount mismatch"
        assert created_expense.get("description") == new_expense_payload["description"], "Description mismatch"
    except requests.RequestException as e:
        assert False, f"POST /api/expenses request failed: {e}"
    except ValueError:
        assert False, "POST /api/expenses response is not valid JSON"
    finally:
        # Cleanup: Delete the created expense to not pollute test data, if created
        try:
            if 'created_expense' in locals() and "id" in created_expense:
                expense_id = created_expense["id"]
                delete_response = requests.delete(f"{BASE_URL}/api/expenses/{expense_id}", timeout=TIMEOUT)
                # Expect 200 OK or 204 No Content on successful delete
                assert delete_response.status_code in (200, 204), f"Failed to delete expense with id {expense_id}"
        except requests.RequestException:
            pass  # If deletion fails, ignore to not hide main test results

test_get_and_post_api_expenses()