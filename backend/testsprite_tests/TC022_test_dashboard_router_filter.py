import requests
import pytest

BASE_URL = "http://localhost:3001"
LOGIN_ENDPOINT = "/api/auth/login"
DASHBOARD_ENDPOINT = "/api/dashboard"
ROUTERS_ENDPOINT = "/api/routers"
TIMEOUT = 30

# Valid credentials for authentication
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

def test_dashboard_router_filter():
    token = get_jwt_token(VALID_EMAIL, VALID_PASSWORD)
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. Get list of routers to find a valid router ID
    try:
        routers_resp = requests.get(BASE_URL + ROUTERS_ENDPOINT, headers=headers, timeout=TIMEOUT)
        routers_resp.raise_for_status()
        routers = routers_resp.json()
    except requests.RequestException as e:
        pytest.fail(f"Failed to fetch routers: {e}")

    assert isinstance(routers, list), "Expected routers to be a list"
    
    # 2. Fetch dashboard stats without filter
    try:
        dash_resp_all = requests.get(DASHBOARD_ENDPOINT, headers=headers, timeout=TIMEOUT)
        dash_resp_all.raise_for_status()
        stats_all = dash_resp_all.json()
    except requests.RequestException as e:
        pytest.fail(f"Failed to fetch dashboard stats: {e}")

    print(f"Total Routers (All): {stats_all.get('totalRouters')}")
    print(f"Active Subscribers (All): {stats_all.get('activeSubscribers')}")

    if routers:
        router = routers[0]
        router_id = router["id"]
        router_name = router.get("name")
        print(f"\nFiltering dashboard by router: {router_name} ({router_id})")
        
        # 3. Fetch dashboard stats with router filter
        try:
            filter_url = f"{DASHBOARD_ENDPOINT}?routerId={router_id}"
            dash_resp_filtered = requests.get(filter_url, headers=headers, timeout=TIMEOUT)
            dash_resp_filtered.raise_for_status()
            stats_filtered = dash_resp_filtered.json()
        except requests.RequestException as e:
            pytest.fail(f"Failed to fetch filtered dashboard stats: {e}")

        # 4. Assertions for filtered stats
        assert stats_filtered.get('totalRouters') == 1, f"Expected totalRouters to be 1 when filtered, got {stats_filtered.get('totalRouters')}"
        
        # Usually, filtered subscribers should be <= total subscribers
        # (Unless there are no subscriptions at all)
        all_subs = stats_all.get('activeSubscribers', 0)
        filtered_subs = stats_filtered.get('activeSubscribers', 0)
        print(f"Active Subscribers (Filtered): {filtered_subs}")
        assert filtered_subs <= all_subs, "Filtered active subscribers should not exceed total"

        print(f"Dashboard filtering by router works as expected!")
    else:
        print("No routers available to test filtering. Skipping filtered assertions.")

if __name__ == "__main__":
    test_dashboard_router_filter()
