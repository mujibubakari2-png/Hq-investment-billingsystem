import requests

BASE_URL = "http://localhost:3001"
ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "admin123"
TIMEOUT = 30

def test_get_api_transactions_history():
    # Step 1: Authenticate and get JWT token
    login_url = f"{BASE_URL}/api/auth/login"
    login_payload = {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    try:
        login_resp = requests.post(login_url, json=login_payload, timeout=TIMEOUT)
        login_resp.raise_for_status()
    except requests.RequestException as e:
        assert False, f"Login request failed: {e}"
    
    token = None
    try:
        login_data = login_resp.json()
        token = login_data.get("token") or login_data.get("accessToken") or login_data.get("jwt")
    except Exception as e:
        assert False, f"Login response is not valid JSON or missing token: {e}"
    
    assert token, "No token found in login response"

    headers = {
        "Authorization": f"Bearer {token}"
    }

    # Step 2: Call the /api/transactions endpoint using GET
    transactions_url = f"{BASE_URL}/api/transactions"
    try:
        resp = requests.get(transactions_url, headers=headers, timeout=TIMEOUT)
        resp.raise_for_status()
    except requests.HTTPError as http_err:
        assert False, f"HTTP error during GET /api/transactions: {http_err}"
    except requests.RequestException as e:
        assert False, f"Request failed during GET /api/transactions: {e}"

    # Step 3: Validate the response
    try:
        data = resp.json()
    except Exception as e:
        assert False, f"Response JSON decoding failed: {e}"

    # Response should be a paginated list or list of transactions
    assert isinstance(data, dict) or isinstance(data, list), "Response should be a dict or list"

    # If response is dict with pagination properties, validate structure
    if isinstance(data, dict):
        # Common pagination keys: items, data, results, or transactions; totalCount, page, pageSize, etc.
        # We try to find the transactions list in common keys
        transactions_list = None
        for key in ["items", "data", "transactions", "results"]:
            if key in data and isinstance(data[key], list):
                transactions_list = data[key]
                break
        
        assert transactions_list is not None, "No transactions list found in response"
        assert isinstance(transactions_list, list), "Transactions is not a list"

        # Validate each item structure if any
        if transactions_list:
            for tx in transactions_list:
                assert isinstance(tx, dict), "Each transaction item should be a dict"
                # Check required fields exist: user, plan, amount, method
                for field in ["user", "plan", "amount", "method"]:
                    assert field in tx, f"Transaction missing expected field: {field}"
                # Validate types
                assert isinstance(tx["user"], (dict, str)), "Transaction user field should be dict or str"
                assert isinstance(tx["plan"], (dict, str)), "Transaction plan field should be dict or str"
                assert isinstance(tx["amount"], (int, float)), "Transaction amount should be numeric"
                assert isinstance(tx["method"], str), "Transaction method should be string"
    else:
        # If response is a list, validate each item for expected structure
        transactions_list = data
        assert len(transactions_list) > 0, "Transactions list is empty"
        for tx in transactions_list:
            assert isinstance(tx, dict), "Each transaction item should be a dict"
            for field in ["user", "plan", "amount", "method"]:
                assert field in tx, f"Transaction missing expected field: {field}"
            assert isinstance(tx["user"], (dict, str)), "Transaction user field should be dict or str"
            assert isinstance(tx["plan"], (dict, str)), "Transaction plan field should be dict or str"
            assert isinstance(tx["amount"], (int, float)), "Transaction amount should be numeric"
            assert isinstance(tx["method"], str), "Transaction method should be string"

test_get_api_transactions_history()