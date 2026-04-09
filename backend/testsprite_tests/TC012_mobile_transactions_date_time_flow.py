import requests
import pytest
from datetime import datetime

BASE_URL = "http://localhost:3001"
LOGIN_ENDPOINT = "/api/auth/login"
MOBILE_TRANSACTIONS_ENDPOINT = "/api/mobile-transactions"
TIMEOUT = 30

# Replace these with valid credentials for authentication
VALID_EMAIL = "hqbakari@gmail.com"
VALID_PASSWORD = "Muu@1212"

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

def test_mobile_transactions_date_time_flow():
    token = get_jwt_token(VALID_EMAIL, VALID_PASSWORD)
    headers = {"Authorization": f"Bearer {token}"}
    url = BASE_URL + MOBILE_TRANSACTIONS_ENDPOINT
    
    try:
        resp = requests.get(url, headers=headers, timeout=TIMEOUT)
    except requests.RequestException as e:
        pytest.fail(f"Request to {MOBILE_TRANSACTIONS_ENDPOINT} failed: {e}")
    
    assert resp.status_code == 200, f"Expected 200 OK, got {resp.status_code}"
    try:
        data = resp.json()
    except ValueError:
        pytest.fail("Response is not valid JSON")

    assert isinstance(data, dict), "Expected JSON response to be a dictionary"
    
    # Check for core fields
    assert "data" in data, "Response should contain 'data' (list of transactions)"
    assert "summaries" in data, "Response should contain 'summaries'"
    assert "activeGateways" in data, "Response should contain 'activeGateways'"

    summaries = data["summaries"]
    assert "today" in summaries, "Summaries should contain 'today'"
    assert "month" in summaries, "Summaries should contain 'month'"

    # Verify summary structure
    for period in ["today", "month"]:
        s = summaries[period]
        assert "total" in s
        assert "paid" in s
        assert "revenue" in s
        assert isinstance(s["total"], int)
        assert isinstance(s["paid"], int)
        assert isinstance(s["revenue"], (int, float))
        
        # In month summary, check for expired/pending/unpaid/cancelled
        if period == "month":
            for field in ["expired", "pending", "unpaid", "cancelled"]:
                assert field in s, f"Month summary missing '{field}'"
                assert isinstance(s[field], int)

    # Verify individual transaction date fields
    transactions = data["data"]
    if transactions:
        for tx in transactions[:5]:  # Check first 5 transactions
            assert "date" in tx, f"Transaction missing 'date': {tx.get('id')}"
            assert "timestamp" in tx, f"Transaction missing 'timestamp': {tx.get('id')}"
            
            # Date should be valid ISO string or null
            if tx["date"] is not None:
                try:
                    # fromisoformat handles 'Z' by replacing it or using .replace
                    datetime.fromisoformat(tx["date"].replace("Z", "+00:00"))
                except ValueError:
                    pytest.fail(f"Invalid ISO date format: {tx['date']}")

            # Timestamp should be an integer
            assert isinstance(tx["timestamp"], (int, float)), f"Invalid timestamp type: {type(tx['timestamp'])}"

    print("Mobile transactions date and time flow test passed!")

if __name__ == "__main__":
    test_mobile_transactions_date_time_flow()
