import requests
import jwt

BASE_URL = "http://localhost:3001"
LOGIN_PATH = "/api/auth/login"
TIMEOUT = 30

API_KEY = "sk-user-wr0eKZ_Ytg73zZIWxpNDQdWf65bUNwxqET31xUX7c6uNnMi5P4tH6hllD1TqnPiyPBBal8AzniRqDRddlzeaZWfgO15n1RCd4A2Nzb3qIgbgBi1J5Bmj2FPBLP-O5DhhG20"
API_USER_KEY = "karimu"


def test_postapiauthloginshouldauthenticateuserandreturnjwttoken():
    url = BASE_URL + LOGIN_PATH
    headers = {
        "Content-Type": "application/json",
        "x-api-key": API_KEY  # Assuming API key header name is x-api-key based on authType
    }
    payload = {
        "email": API_USER_KEY,
        "password": API_KEY
    }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"Request to {url} failed with exception: {e}"

    # Validate HTTP status code
    assert response.status_code == 200, f"Expected status 200 but got {response.status_code}"

    # Validate response JSON content
    try:
        data = response.json()
    except ValueError:
        assert False, "Response is not a valid JSON"

    # Expected response contains a token and user object
    assert "token" in data, "Response JSON does not contain 'token'"
    assert "user" in data, "Response JSON does not contain 'user'"

    token = data["token"]
    user = data["user"]
    assert isinstance(user, dict), "'user' should be an object"

    # Decode JWT token (without verification) to inspect payload claims
    try:
        decoded_token = jwt.decode(token, options={"verify_signature": False})
    except Exception as e:
        assert False, f"Failed to decode JWT token: {e}"

    # Validate tenant_id existence in the token payload
    assert "tenant_id" in decoded_token, "JWT token payload does not contain 'tenant_id'"

    # Validate that user object includes tenant_id and matches the token tenant_id
    assert "tenant_id" in user, "'user' object does not contain 'tenant_id'"
    assert user["tenant_id"] == decoded_token["tenant_id"], "tenant_id in user object does not match tenant_id in token"

    # Additional basic user property checks (id or email)
    assert "email" in user, "'user' object does not contain 'email'"
    assert user["email"] == API_USER_KEY, "User email does not match login email"


test_postapiauthloginshouldauthenticateuserandreturnjwttoken()