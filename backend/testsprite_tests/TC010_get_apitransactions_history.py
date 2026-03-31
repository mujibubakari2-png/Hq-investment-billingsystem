import requests
import pytest

BASE_URL = "http://localhost:3001"
LOGIN_ENDPOINT = "/api/auth/login"
TRANSACTIONS_ENDPOINT = "/api/transactions"
TIMEOUT = 30

# Replace these with valid credentials for authentication
VALID_EMAIL = "admin@example.com"
VALID_PASSWORD = "adminpassword"

def get_jwt_token(email: str, password: str) -> str:
    url = BASE_URL + LOGIN_ENDPOINT
    try:
        resp = requests.post(
            url,
            json={"email": email, "password": password},
            timeout=TIMEOUT
        )
        resp.raise_for_status()
        data = resp.json()
        token = data.get("token") or data.get("jwt") or data.get("accessToken")
        assert token, "JWT token not found in login response"
        return token
    except requests.RequestException as e:
        pytest.fail(f"Failed to log in and obtain JWT token: {e}")

def test_get_api_transactions_history():
    token = get_jwt_token(VALID_EMAIL, VALID_PASSWORD)
    headers = {"Authorization": f"Bearer {token}"}
    url = BASE_URL + TRANSACTIONS_ENDPOINT
    try:
        resp = requests.get(url, headers=headers, timeout=TIMEOUT)
    except requests.RequestException as e:
        pytest.fail(f"Request to {TRANSACTIONS_ENDPOINT} failed: {e}")
    
    assert resp.status_code == 200, f"Expected 200 OK, got {resp.status_code}"
    try:
        data = resp.json()
    except ValueError:
        pytest.fail("Response is not valid JSON")

    assert isinstance(data, dict) or isinstance(data, list), "Expected JSON response to be dict or list"

    # Handle both paginated responses (dict with keys) or list directly
    transactions = None
    if isinstance(data, dict):
        # Check for common pagination keys presence if dict
        if "items" in data and isinstance(data["items"], list):
            transactions = data["items"]
        elif "data" in data and isinstance(data["data"], list):
            transactions = data["data"]
        else:
            transactions = data
    else:
        transactions = data

    assert isinstance(transactions, list), "Transactions data should be a list"

    if transactions:
        sample = transactions[0]
        assert isinstance(sample, dict), "Each transaction should be a dictionary"
        # Verify key fields expected in a transaction record
        expected_keys = {"user", "plan", "amount", "method"}
        missing_keys = expected_keys - sample.keys()
        assert not missing_keys, f"Transaction entry missing keys: {missing_keys}"

        # Additional type checks
        assert isinstance(sample["amount"], (int, float)), "Transaction amount should be a number"
        assert isinstance(sample["method"], str) and sample["method"], "Transaction method should be a non-empty string"
        assert sample["user"] is not None, "Transaction user field should not be None"
        assert sample["plan"] is not None, "Transaction plan field should not be None"

test_get_api_transactions_history()