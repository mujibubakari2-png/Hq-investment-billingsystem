import requests
from datetime import datetime
import sys

BASE_URL = "http://localhost:3001"
ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "admin123"
TIMEOUT = 30

def test_get_apisubscriptions_active_and_expired():
    session = requests.Session()
    token = None

    # Login to get JWT token
    login_payload = {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    try:
        login_resp = session.post(
            f"{BASE_URL}/api/auth/login",
            json=login_payload,
            timeout=TIMEOUT
        )
        assert login_resp.status_code == 200, f"Login failed with status {login_resp.status_code}, body: {login_resp.text}"
        token = login_resp.json().get("token")
        assert token and isinstance(token, str), "No token in login response"
    except Exception as e:
        sys.exit(f"Authentication failed: {e}")

    headers = {"Authorization": f"Bearer {token}"}

    # Get the subscriptions list
    try:
        resp = session.get(f"{BASE_URL}/api/subscriptions", headers=headers, timeout=TIMEOUT)
        assert resp.status_code == 200, f"Expected 200 OK, got {resp.status_code}, body: {resp.text}"
        obj = resp.json()

        # Adjusted: Check if response is a list or dict containing subscriptions list
        if isinstance(obj, list):
            subscriptions = obj
        elif isinstance(obj, dict):
            # Try common keys for list of subscriptions
            if "subscriptions" in obj and isinstance(obj["subscriptions"], list):
                subscriptions = obj["subscriptions"]
            elif "data" in obj and isinstance(obj["data"], list):
                subscriptions = obj["data"]
            else:
                assert False, f"Subscriptions list not found in response: {obj}"
        else:
            assert False, f"Invalid subscriptions response type: {type(obj)}"

        assert isinstance(subscriptions, list), "Subscriptions response is not a list"

        # Validate each subscription has correct status and startDate (and optionally expiry)
        now = datetime.utcnow()
        for sub in subscriptions:
            # Required fields: status and dates
            assert "status" in sub, f"Subscription missing 'status': {sub}"
            assert isinstance(sub["status"], str), f"Invalid status type: {sub}"

            assert "startDate" in sub, f"Subscription missing 'startDate': {sub}"
            assert sub["startDate"] is not None, f"Subscription 'startDate' is None: {sub}"

            # Validate date format ISO 8601 and parse
            try:
                start_date = datetime.fromisoformat(sub["startDate"].replace("Z", "+00:00"))
            except Exception:
                assert False, f"Invalid startDate format: {sub['startDate']}"

            # Optional expiryDate, if present validate format
            expiry_date = None
            if "expiryDate" in sub and sub["expiryDate"] is not None:
                try:
                    expiry_date = datetime.fromisoformat(sub["expiryDate"].replace("Z", "+00:00"))
                except Exception:
                    assert False, f"Invalid expiryDate format: {sub['expiryDate']}"

            # Status logic checks: if expiryDate passed, status should be expired or similar
            status_lower = sub["status"].lower()
            if expiry_date:
                if expiry_date < now:
                    # Expired subscriptions must have an expired or inactive status
                    assert "expir" in status_lower or "inactiv" in status_lower or "cancel" in status_lower or "disabled" in status_lower, (
                        f"Subscription expired but status not indicating expired: {sub}"
                    )
                else:
                    # Active subscriptions should have active status
                    assert "activ" in status_lower or "valid" in status_lower or "enabled" in status_lower, (
                        f"Subscription active but status not indicating active: {sub}"
                    )
            else:
                # If no expiryDate, status should be active or unknown state could fail this
                assert "activ" in status_lower or "valid" in status_lower or "enabl" in status_lower or "pend" in status_lower, (
                    f"Subscription with no expiryDate has unexpected status: {sub}"
                )

    finally:
        session.close()

test_get_apisubscriptions_active_and_expired()
