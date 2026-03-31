import requests
from datetime import datetime

BASE_URL = "http://localhost:3001"
TIMEOUT = 30

# Use existing valid credentials to obtain a JWT token for Authorization
AUTH_LOGIN_ENDPOINT = "/api/auth/login"
SUBSCRIPTIONS_ENDPOINT = "/api/subscriptions"

# These credentials must exist in the system or be replaced accordingly
VALID_USER_CREDENTIALS = {
    "email": "admin@example.com",
    "password": "password123"
}

def test_get_apisubscriptions_active_and_expired():
    # Authenticate to get JWT token
    token = None
    try:
        login_resp = requests.post(
            BASE_URL + AUTH_LOGIN_ENDPOINT,
            json=VALID_USER_CREDENTIALS,
            timeout=TIMEOUT
        )
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        login_data = login_resp.json()
        token = login_data.get("token")
        assert token, "JWT token not found in login response"

        headers = {"Authorization": f"Bearer {token}"}

        # Get subscriptions
        subs_resp = requests.get(
            BASE_URL + SUBSCRIPTIONS_ENDPOINT,
            headers=headers,
            timeout=TIMEOUT
        )
        assert subs_resp.status_code == 200, f"Failed to get subscriptions: {subs_resp.text}"
        subscriptions = subs_resp.json()

        assert isinstance(subscriptions, list), "Subscriptions response is not a list"

        # Validate each subscription for required fields and correct dates
        for sub in subscriptions:
            assert "status" in sub, "Subscription missing 'status'"
            assert sub["status"] in ("active", "expired"), f"Invalid subscription status: {sub['status']}"

            # Dates validation - ISO8601 expected for startDate and expiryDate
            for date_field in ("startDate", "expiryDate"):
                assert date_field in sub, f"Subscription missing '{date_field}'"
                date_str = sub[date_field]
                try:
                    # Parse date string to confirm valid date format
                    dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
                except Exception:
                    assert False, f"Invalid date format in {date_field}: {date_str}"

            # Additional logical checks: expired if expiryDate < today; active if expiryDate >= today
            expiry_date = datetime.fromisoformat(sub["expiryDate"].replace("Z", "+00:00"))
            now = datetime.utcnow()
            if sub["status"] == "expired":
                assert expiry_date < now, f"Subscription status 'expired' but expiryDate {expiry_date} not in past"
            elif sub["status"] == "active":
                assert expiry_date >= now, f"Subscription status 'active' but expiryDate {expiry_date} in past"

    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

test_get_apisubscriptions_active_and_expired()