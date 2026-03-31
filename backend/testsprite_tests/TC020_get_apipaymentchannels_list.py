import requests

BASE_URL = "http://localhost:3001"
TIMEOUT = 30

def test_get_apipaymentchannels_list():
    url = f"{BASE_URL}/api/payment-channels"
    try:
        response = requests.get(url, timeout=TIMEOUT)
        response.raise_for_status()
    except requests.exceptions.RequestException as e:
        assert False, f"Request to {url} failed: {e}"

    # Validate response status code
    assert response.status_code == 200, f"Expected status code 200, got {response.status_code}"

    # Validate content-type is JSON
    content_type = response.headers.get("Content-Type", "")
    assert "application/json" in content_type, f"Expected JSON response, got Content-Type: {content_type}"

    # Validate response JSON structure
    try:
        data = response.json()
    except ValueError:
        assert False, "Response is not valid JSON"

    # Expected to be a list of payment channels
    assert isinstance(data, list), f"Expected response to be a list, got {type(data)}"

    # Each item should have expected fields like name, id or code or similar
    for item in data:
        assert isinstance(item, dict), "Each payment channel item should be a dictionary"
        # Check at least a 'name' field exists
        assert "name" in item, "Payment channel missing 'name' field"
        # Optional: Check name is a non-empty string
        assert isinstance(item["name"], str) and item["name"].strip(), "Payment channel 'name' must be a non-empty string"

test_get_apipaymentchannels_list()