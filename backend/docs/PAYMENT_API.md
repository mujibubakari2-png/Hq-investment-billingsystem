# Payment API Reference

> Base URL: `https://your-server.com/api`  
> Auth: `Authorization: Bearer <JWT_TOKEN>` on all endpoints except webhooks.

---

## POST `/payments/initiate`

Initiate a mobile money payment via any provider.

### Request Body

```json
{
  "provider": "ZENOPAY",
  "phone": "0712345678",
  "amount": 5000,
  "description": "Hotspot Package - 1 Day",
  "reference": "HP-CUSTOM-REF-001",
  "buyerName": "Mujibu Bakari",
  "buyerEmail": "muu@gmail.com"
}
```

| Field         | Type    | Required | Description                                               |
|---------------|---------|----------|-----------------------------------------------------------|
| `provider`    | string  | ✅       | `PALMPESA`, `ZENOPAY`, `MONGIKE`, or `HARAKAPAY`         |
| `phone`       | string  | ✅       | TZ phone — any format (`0712...`, `255712...`, `+255712..`) |
| `amount`      | number  | ✅       | Amount in TZS (100 – 10,000,000)                          |
| `description` | string  | ❌       | Payment description shown on USSD prompt                  |
| `reference`   | string  | ❌       | Custom ref (auto-generated if not provided)               |
| `buyerName`   | string  | ❌       | Customer name (required by some providers)                |
| `buyerEmail`  | string  | ❌       | Customer email (required by some providers)               |

### Response `200 OK`

```json
{
  "success": true,
  "reference": "ZE-A1B2C3D4E5F6G7H8",
  "providerRef": "ws_CO_22052026_1234567890",
  "provider": "ZENOPAY",
  "message": "Payment initiated",
  "status": "PENDING"
}
```

### Response `400` — Validation Error

```json
{
  "error": "amount must be between 100 and 10,000,000 TZS"
}
```

### Response `502` — Provider Error

```json
{
  "error": "ZenoPay error: Invalid account configuration"
}
```

---

## GET `/payments/status/{reference}`

Check the current status of a payment by our internal reference.

### Path Params

| Param       | Description                         |
|-------------|-------------------------------------|
| `reference` | Our internal reference (HP-XXXXXXX) |

### Query Params (optional)

| Param        | Description                                         |
|--------------|-----------------------------------------------------|
| `provider`   | Provider name — triggers live API poll              |
| `providerRef`| Provider's checkout ID — used for live API poll     |

### Response `200` — Pending

```json
{
  "reference": "HP-A1B2C3D4E5F6G7H8",
  "status": "PENDING",
  "amount": 5000,
  "packageName": "1 Day Hotspot",
  "method": "MOBILE_MONEY",
  "createdAt": "2026-05-22T13:00:00.000Z",
  "message": "Waiting for payment confirmation..."
}
```

### Response `200` — Completed

```json
{
  "reference": "HP-A1B2C3D4E5F6G7H8",
  "status": "COMPLETED",
  "amount": 5000,
  "packageName": "1 Day Hotspot",
  "username": "HS-0712345678",
  "password": "0712345678",
  "expiresAt": "2026-05-23T13:00:00.000Z",
  "autoConnect": true,
  "message": "Payment confirmed! You can now connect."
}
```

### Response `200` — Failed

```json
{
  "reference": "HP-A1B2C3D4E5F6G7H8",
  "status": "FAILED",
  "message": "Payment failed. Please try again."
}
```

### Response `404`

```json
{ "error": "Transaction not found" }
```

---

## POST `/webhooks/palmpesa`

PalmPesa payment callback. Called automatically by PalmPesa after payment.

### Headers (set by PalmPesa)

| Header               | Description                    |
|----------------------|--------------------------------|
| `x-webhook-secret`   | Shared secret for verification |
| `Content-Type`       | `application/json`             |

### Example Payload

```json
{
  "TransactionId": "LGR219G3EY",
  "AccountReference": "HP-A1B2C3D4E5F6G7H8",
  "PhoneNumber": "255712345678",
  "Amount": "5000.00",
  "ResultCode": "0",
  "ResultDesc": "The service request is processed successfully."
}
```

---

## POST `/webhooks/zenopay`

ZenoPay payment callback. Called automatically by ZenoPay after payment.

### Headers (set by ZenoPay)

| Header             | Description                    |
|--------------------|--------------------------------|
| `x-zeno-signature` | HMAC-SHA256 signature          |
| `x-api-key`        | ZenoPay API key (fallback)     |

### Example Payload

```json
{
  "order_id": "HP-A1B2C3D4E5F6G7H8",
  "transaction_id": "ZNP-TXN-20260522-001",
  "status": "COMPLETED",
  "amount": 5000,
  "buyer_phone": "0712345678",
  "message": "Payment successful"
}
```

---

## POST `/webhooks/mongike`

Mongike payment callback.

### Headers (set by Mongike)

| Header                  | Description           |
|-------------------------|-----------------------|
| `x-mongike-signature`   | HMAC-SHA256 signature |
| `x-webhook-secret`      | Fallback shared secret|

### Example Payload

```json
{
  "reference": "HP-A1B2C3D4E5F6G7H8",
  "transaction_id": "MGK-20260522-001",
  "status": "COMPLETED",
  "amount": 5000,
  "phone_number": "255712345678",
  "message": "Payment successful"
}
```

---

## POST `/webhooks/harakapay`

HarakaPay payment callback.

### Headers (set by HarakaPay)

| Header                | Description           |
|-----------------------|-----------------------|
| `x-haraka-signature`  | HMAC-SHA256 signature |
| `x-webhook-secret`    | Fallback shared secret|

### Example Payload

```json
{
  "reference": "HP-A1B2C3D4E5F6G7H8",
  "transaction_id": "HRK-20260522-001",
  "status": "COMPLETED",
  "amount": 5000,
  "msisdn": "255712345678",
  "message": "Payment received"
}
```

---

## Webhook Response

All webhook endpoints return `200 OK` on success (even if payment failed).  
Always return 200 to acknowledge receipt — providers retry on non-200.

```json
{ "message": "Payment confirmed and service activated", "status": "COMPLETED" }
```

Return `401` only if signature verification fails:
```json
{ "error": "Webhook rejected: HMAC signature mismatch" }
```

---

## Status Values

| Status      | Description                                      |
|-------------|--------------------------------------------------|
| `PENDING`   | Payment initiated, waiting for user confirmation |
| `COMPLETED` | Payment confirmed, service activated             |
| `FAILED`    | Payment declined or cancelled                    |
| `EXPIRED`   | Payment timed out (no response within ~3 mins)   |

---

## Error Codes

| HTTP | Meaning                                           |
|------|---------------------------------------------------|
| 400  | Validation error (bad input)                      |
| 401  | Unauthorized (missing/invalid JWT or webhook sig) |
| 404  | Transaction not found                             |
| 502  | Provider API error (upstream failure)             |
| 500  | Internal server error                             |
