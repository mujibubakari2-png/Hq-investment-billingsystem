import requests

BASE_URL = "http://localhost:3001"
LOGIN_ENDPOINT = "/api/auth/login"
FORGOT_PASSWORD_OTP_ENDPOINT = "/api/auth/forgot-password/request-otp"
ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "admin123"
TIMEOUT = 30

def test_post_apiauthforgotpasswordrequestotp_with_valid_identifier():
    session = requests.Session()
    try:
        # Get auth token by logging in as admin (not required for forgot-password OTP, but instruction to handle authorization properly)
        login_resp = session.post(
            BASE_URL + LOGIN_ENDPOINT,
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            timeout=TIMEOUT
        )
        # login endpoint does not require auth per PRD, but get token for possible headers if needed
        assert login_resp.status_code == 200, f"Login failed with status {login_resp.status_code}"
        login_data = login_resp.json()
        token = login_data.get("token") or login_data.get("jwt") or login_data.get("accessToken") or login_data.get("access_token")
        # Prepare headers: forgot-password endpoint authentication not required per PRD, so omit token headers
        
        # Test with valid email identifier
        email_payload = {"email": ADMIN_EMAIL}
        resp_email = session.post(
            BASE_URL + FORGOT_PASSWORD_OTP_ENDPOINT,
            json=email_payload,
            timeout=TIMEOUT
        )
        assert resp_email.status_code == 200, f"Expected 200 OK, got {resp_email.status_code} for email identifier"
        resp_email_json = resp_email.json()
        assert "success" in resp_email_json or "message" in resp_email_json, "Response missing success/message field for email"
        # You might check typical message content or success status
        assert any(keyword in resp_email_json.get("message", "").lower() for keyword in ["otp", "sent", "success"]), \
            "OTP dispatch success message missing or incorrect for email identifier"
        
        # Test with valid phone number identifier
        # Use a plausible phone number format matching system expectations
        valid_phone = "+1234567890"
        phone_payload = {"phone": valid_phone}
        resp_phone = session.post(
            BASE_URL + FORGOT_PASSWORD_OTP_ENDPOINT,
            json=phone_payload,
            timeout=TIMEOUT
        )
        assert resp_phone.status_code == 200, f"Expected 200 OK, got {resp_phone.status_code} for phone identifier"
        resp_phone_json = resp_phone.json()
        assert "success" in resp_phone_json or "message" in resp_phone_json, "Response missing success/message field for phone"
        assert any(keyword in resp_phone_json.get("message", "").lower() for keyword in ["otp", "sent", "success"]), \
            "OTP dispatch success message missing or incorrect for phone identifier"
    finally:
        session.close()

test_post_apiauthforgotpasswordrequestotp_with_valid_identifier()
