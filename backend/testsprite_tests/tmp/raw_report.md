
# TestSprite AI Testing Report(MCP)

---

## 1️⃣ Document Metadata
- **Project Name:** kenge-backend
- **Date:** 2026-03-18
- **Prepared by:** TestSprite AI Team

---

## 2️⃣ Requirement Validation Summary

#### Test TC001 post apiauthlogin with valid and invalid credentials
- **Test Code:** [TC001_post_apiauthlogin_with_valid_and_invalid_credentials.py](./TC001_post_apiauthlogin_with_valid_and_invalid_credentials.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/5d82a9fb-248b-4546-b38c-3bd2b313b1e9/331b7760-b934-4abe-8d78-94add197d6b5
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC002 post apiauthregister with valid and invalid payloads
- **Test Code:** [TC002_post_apiauthregister_with_valid_and_invalid_payloads.py](./TC002_post_apiauthregister_with_valid_and_invalid_payloads.py)
- **Test Error:** Traceback (most recent call last):
  File "/var/task/handler.py", line 258, in run_with_retry
    exec(code, exec_env)
  File "<string>", line 76, in <module>
  File "<string>", line 41, in test_post_apiauthregister_with_valid_and_invalid_payloads
AssertionError: Expected 201 Created, got 400

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/5d82a9fb-248b-4546-b38c-3bd2b313b1e9/b7acd47c-5a8a-4d7a-ac15-9c60a361e3ec
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC003 get apiauthme with valid and missing authorization
- **Test Code:** [TC003_get_apiauthme_with_valid_and_missing_authorization.py](./TC003_get_apiauthme_with_valid_and_missing_authorization.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/5d82a9fb-248b-4546-b38c-3bd2b313b1e9/a31369c3-1a5e-4061-a879-1b6c918581ae
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC004 get apidashboard with and without authorization
- **Test Code:** [TC004_get_apidashboard_with_and_without_authorization.py](./TC004_get_apidashboard_with_and_without_authorization.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/5d82a9fb-248b-4546-b38c-3bd2b313b1e9/743ca565-56a9-49e7-9855-ae6b44823077
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC005 get and post apiclients with valid and invalid data
- **Test Code:** [TC005_get_and_post_apiclients_with_valid_and_invalid_data.py](./TC005_get_and_post_apiclients_with_valid_and_invalid_data.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/5d82a9fb-248b-4546-b38c-3bd2b313b1e9/acef096c-2b01-4bee-992b-63a61e737a9d
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC006 get post apirouters with valid and invalid router data
- **Test Code:** [TC006_get_post_apirouters_with_valid_and_invalid_router_data.py](./TC006_get_post_apirouters_with_valid_and_invalid_router_data.py)
- **Test Error:** Traceback (most recent call last):
  File "/var/task/handler.py", line 258, in run_with_retry
    exec(code, exec_env)
  File "<string>", line 81, in <module>
  File "<string>", line 67, in test_get_post_api_routers_valid_invalid
AssertionError: Validation error message missing or incorrect for name 'Invalid Router!'

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/5d82a9fb-248b-4546-b38c-3bd2b313b1e9/53ee6932-8dd8-4554-bf2f-49e45459bece
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC007 post apihotspotpurchase with valid and invalid payment details
- **Test Code:** [TC007_post_apihotspotpurchase_with_valid_and_invalid_payment_details.py](./TC007_post_apihotspotpurchase_with_valid_and_invalid_payment_details.py)
- **Test Error:** Traceback (most recent call last):
  File "/var/task/handler.py", line 258, in run_with_retry
    exec(code, exec_env)
  File "<string>", line 135, in <module>
  File "<string>", line 64, in test_post_apihotspotpurchase_with_valid_and_invalid_payment_details
AssertionError: Expected 200 OK for valid purchase, got 400

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/5d82a9fb-248b-4546-b38c-3bd2b313b1e9/380ebce6-b52d-4d32-96b2-3e74fe34ee2c
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC008 get apipackages list and filtering
- **Test Code:** [TC008_get_apipackages_list_and_filtering.py](./TC008_get_apipackages_list_and_filtering.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/5d82a9fb-248b-4546-b38c-3bd2b313b1e9/13f49858-eb03-43c3-a494-c3475e27a1b1
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC009 post apipackages create new package
- **Test Code:** [TC009_post_apipackages_create_new_package.py](./TC009_post_apipackages_create_new_package.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/5d82a9fb-248b-4546-b38c-3bd2b313b1e9/98d509c2-7489-4d30-9be0-8e256b52e922
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC010 get apitransactions history
- **Test Code:** [TC010_get_apitransactions_history.py](./TC010_get_apitransactions_history.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/5d82a9fb-248b-4546-b38c-3bd2b313b1e9/6df95316-eb2a-436a-8163-1e88067a1f7f
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC011 get apisubscriptions active and expired
- **Test Code:** [TC011_get_apisubscriptions_active_and_expired.py](./TC011_get_apisubscriptions_active_and_expired.py)
- **Test Error:** Traceback (most recent call last):
  File "/var/task/handler.py", line 258, in run_with_retry
    exec(code, exec_env)
  File "<string>", line 98, in <module>
  File "<string>", line 60, in test_get_apisubscriptions_active_and_expired
AssertionError: Subscription 'startDate' is None: {'id': 'cmmv90uaa00145oraa9cks2f0', 'user': 'HS-UG65881', 'username': 'HS-UG65881', 'plan': 'masaa 5', 'package': 'masaa 5', 'type': 'Hotspot', 'device': '', 'macAddress': '', 'created': 'N/A', 'expires': 'N/A', 'expiresAt': None, 'expiryDate': None, 'startDate': None, 'activatedAt': None, 'expiredDate': 'N/A', 'method': 'voucher - 3067', 'router': 'INVESTMENT-123', 'status': 'Expired', 'online': 'Offline', 'sync': 'Synced', 'days': 0}

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/5d82a9fb-248b-4546-b38c-3bd2b313b1e9/357dd716-c549-4578-86b9-8882b3a1f15e
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC012 client detail operations get put delete
- **Test Code:** [TC012_client_detail_operations_get_put_delete.py](./TC012_client_detail_operations_get_put_delete.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/5d82a9fb-248b-4546-b38c-3bd2b313b1e9/4a5374bb-c0a3-4a61-9561-1e6e2e0ba387
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC013 post apivouchersgenerate with valid parameters
- **Test Code:** [TC013_post_apivouchersgenerate_with_valid_parameters.py](./TC013_post_apivouchersgenerate_with_valid_parameters.py)
- **Test Error:** Traceback (most recent call last):
  File "<string>", line 73, in test_post_api_vouchers_generate_with_valid_parameters
  File "/var/task/requests/models.py", line 1024, in raise_for_status
    raise HTTPError(http_error_msg, response=self)
requests.exceptions.HTTPError: 500 Server Error: Internal Server Error for url: http://localhost:3001/api/vouchers

During handling of the above exception, another exception occurred:

Traceback (most recent call last):
  File "/var/task/handler.py", line 258, in run_with_retry
    exec(code, exec_env)
  File "<string>", line 93, in <module>
  File "<string>", line 75, in test_post_api_vouchers_generate_with_valid_parameters
AssertionError: Voucher generation failed with status 500: {"error":"Internal server error","message":"Internal server error","status":"error"}

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/5d82a9fb-248b-4546-b38c-3bd2b313b1e9/ac48ff61-d3c7-49d5-a672-2fb4d28cf1e4
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC014 get and post apiexpenses for financial tracking
- **Test Code:** [TC014_get_and_post_apiexpenses_for_financial_tracking.py](./TC014_get_and_post_apiexpenses_for_financial_tracking.py)
- **Test Error:** Traceback (most recent call last):
  File "<string>", line 47, in test_get_and_post_api_expenses
  File "/var/task/requests/models.py", line 1024, in raise_for_status
    raise HTTPError(http_error_msg, response=self)
requests.exceptions.HTTPError: 400 Client Error: Bad Request for url: http://localhost:3001/api/expenses

During handling of the above exception, another exception occurred:

Traceback (most recent call last):
  File "/var/task/handler.py", line 258, in run_with_retry
    exec(code, exec_env)
  File "<string>", line 70, in <module>
  File "<string>", line 49, in test_get_and_post_api_expenses
AssertionError: POST /api/expenses request failed: 400 Client Error: Bad Request for url: http://localhost:3001/api/expenses

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/5d82a9fb-248b-4546-b38c-3bd2b313b1e9/ca32ddd6-1410-43e5-917f-0e827496e497
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC015 get apireports for system analytics
- **Test Code:** [TC015_get_apireports_for_system_analytics.py](./TC015_get_apireports_for_system_analytics.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/5d82a9fb-248b-4546-b38c-3bd2b313b1e9/33854c56-3fd8-43f9-bb3e-60dcf5e255fa
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC016 post apismsbulk to send messages to clients
- **Test Code:** [TC016_post_apismsbulk_to_send_messages_to_clients.py](./TC016_post_apismsbulk_to_send_messages_to_clients.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/5d82a9fb-248b-4546-b38c-3bd2b313b1e9/9d4d8da2-85b5-4dc0-9c71-80d42034adbb
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC017 get and post apiequipment for inventory management
- **Test Code:** [TC017_get_and_post_apiequipment_for_inventory_management.py](./TC017_get_and_post_apiequipment_for_inventory_management.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/5d82a9fb-248b-4546-b38c-3bd2b313b1e9/795e8dec-fc27-40bb-b4c4-9b287481cc96
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC018 post apiauthforgotpasswordrequestotp with valid identifier
- **Test Code:** [TC018_post_apiauthforgotpasswordrequestotp_with_valid_identifier.py](./TC018_post_apiauthforgotpasswordrequestotp_with_valid_identifier.py)
- **Test Error:** Traceback (most recent call last):
  File "/var/task/handler.py", line 258, in run_with_retry
    exec(code, exec_env)
  File "<string>", line 56, in <module>
  File "<string>", line 48, in test_post_apiauthforgotpasswordrequestotp_with_valid_identifier
AssertionError: Expected 200 OK, got 400 for phone identifier

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/5d82a9fb-248b-4546-b38c-3bd2b313b1e9/7c34b456-f59e-479a-8cf7-b37f15f6a7c2
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC019 get and put apisettings for system configuration
- **Test Code:** [TC019_get_and_put_apisettings_for_system_configuration.py](./TC019_get_and_put_apisettings_for_system_configuration.py)
- **Test Error:** Traceback (most recent call last):
  File "/var/task/handler.py", line 258, in run_with_retry
    exec(code, exec_env)
  File "<string>", line 69, in <module>
  File "<string>", line 50, in test_get_and_put_api_settings_for_system_configuration
AssertionError: Company name was not updated correctly

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/5d82a9fb-248b-4546-b38c-3bd2b313b1e9/34f00d9c-d693-489a-8c04-fb824a21bce8
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC020 get apipaymentchannels list
- **Test Code:** [TC020_get_apipaymentchannels_list.py](./TC020_get_apipaymentchannels_list.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/5d82a9fb-248b-4546-b38c-3bd2b313b1e9/5957bf77-6c4b-42b2-8d6d-69edd253e1b7
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---


## 3️⃣ Coverage & Matching Metrics

- **60.00** of tests passed

| Requirement        | Total Tests | ✅ Passed | ❌ Failed  |
|--------------------|-------------|-----------|------------|
| ...                | ...         | ...       | ...        |
---


## 4️⃣ Key Gaps / Risks
{AI_GNERATED_KET_GAPS_AND_RISKS}
---