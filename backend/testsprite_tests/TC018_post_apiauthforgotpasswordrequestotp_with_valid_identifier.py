import requests

BASE_URL = "http://localhost:3001"
ENDPOINT = "/api/auth/forgot-password/request-otp"
TIMEOUT = 30

def test_post_apiauthforgotpasswordrequestotp_with_valid_identifier():
    # We will test with a valid email and then with a valid phone number.
    test_identifiers = [
        {"identifier": "validuser@example.com"},
        {"identifier": "+12345678901"}
    ]

    headers = {
        "Content-Type": "application/json"
    }

    for payload in test_identifiers:
        try:
            response = requests.post(
                BASE_URL + ENDPOINT,
                json=payload,
                headers=headers,
                timeout=TIMEOUT
            )
            # Expecting a successful response (200 or 201)
            assert response.status_code in (200, 201), f"Unexpected status code: {response.status_code}, response: {response.text}"
            json_resp = response.json()
            # Validate response has success indication, message containing "OTP" or similar
            assert "message" in json_resp, "Response JSON missing 'message' field"
            assert isinstance(json_resp["message"], str) and ("otp" in json_resp["message"].lower() or "sent" in json_resp["message"].lower()), \
                f"Unexpected message content: {json_resp['message']}"
        except requests.RequestException as e:
            assert False, f"Request failed: {str(e)}"

test_post_apiauthforgotpasswordrequestotp_with_valid_identifier()