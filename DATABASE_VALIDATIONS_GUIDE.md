# Database Validations & Constraints Guide

## Overview

This guide outlines recommended database-level constraints and application-level validations to enhance data integrity and enforce business rules in the ISP Billing System.

## Recommended Prisma Schema Updates

### 1. User Model - Business Rule Validations

```prisma
model User {
  // Add unique constraint for username per tenant
  @@unique([username, tenantId])
  
  // Add indexes for common queries
  @@index([status])
  @@index([createdAt])
  @@index([role, tenantId])
  @@index([email, tenantId])
}
```

**Business Rules:**
- Username must be unique within a tenant
- Email must be validated format
- Role should be restricted to valid enum values
- Status should be either ACTIVE or INACTIVE

---

### 2. Client Model - Referential Integrity

```prisma
model Client {
  // Ensure unique username per tenant
  @@unique([username, tenantId])
  
  // Add composite indexes for common filters
  @@index([status, serviceType, tenantId])
  @@index([createdAt, tenantId])
  @@index([accountType, tenantId])
}
```

**Business Rules:**
- Client username must be unique per tenant
- Service type must be either HOTSPOT or PPPOE
- Account type must be either PERSONAL or BUSINESS
- Status transitions: ACTIVE → EXPIRED, SUSPENDED, BANNED, DISABLED, LIMITED

---

### 3. Package Model - Numerical Constraints

```prisma
model Package {
  // Add check constraints (Database level)
  // uploadSpeed > 0
  // downloadSpeed > 0
  // price >= 0
  // duration > 0
  
  @@unique([name, routerId, tenantId])
  @@index([status, type, tenantId])
  @@index([price])  // For price-based filtering
}
```

**Business Rules:**
- Upload and download speeds must be positive
- Price must be non-negative
- Duration must be at least 1
- Package name should be unique per router and tenant
- Duration unit must be valid (MINUTES, HOURS, DAYS, MONTHS)

---

### 4. Subscription Model - Temporal Constraints

```prisma
model Subscription {
  // Add check constraints
  // expiresAt > activatedAt
  // expiresAt IS NOT NULL
  // status MUST be one of valid enum values
  
  @@index([status, clientId, tenantId])
  @@index([expiresAt, tenantId])  // For identifying expiring subscriptions
  @@index([status, expiresAt, tenantId])  // For expiry notifications
}
```

**Business Rules:**
- Expiration date must be after activation date
- Status transitions: ACTIVE → EXPIRED, EXTENDED, SUSPENDED
- Online status is read-only (determined by RADIUS system)

---

### 5. Transaction Model - Financial Constraints

```prisma
model Transaction {
  // Use Decimal(15,2) for amount instead of Float
  // Add check constraint: amount > 0
  // Add check constraint: reference IS UNIQUE
  
  @@index([status, type, tenantId])
  @@index([createdAt, tenantId])
  @@index([clientId, createdAt])
  @@index([reference, tenantId])
}
```

**Business Rules:**
- Amount must be positive
- Reference must be unique per transaction
- Type must be MANUAL, MOBILE, or VOUCHER
- Status must be COMPLETED, PENDING, FAILED, or EXPIRED

---

### 6. Router Model - Operational Constraints

```prisma
model Router {
  // Add check constraints
  // port > 0 AND port <= 65535
  // apiPort > 0 AND apiPort <= 65535
  // password must be encrypted
  
  @@unique([name, tenantId])
  @@unique([host, port, tenantId])  // Prevent duplicate connections
  @@index([status, tenantId])
  @@index([lastSeen, tenantId])
}
```

**Business Rules:**
- Router name must be unique per tenant
- Host and port combination must be unique per tenant
- Ports must be valid (1-65535)
- Password should be encrypted in database
- Status is determined by API connectivity

---

### 7. Invoice Model - Financial Constraints

```prisma
model Invoice {
  // Use Decimal(15,2) for amount
  // Add check constraints
  // amount >= 0
  // dueDate > issuedDate
  // invoiceNumber IS UNIQUE per tenant
  
  @@unique([invoiceNumber, tenantId])
  @@index([status, clientId, tenantId])
  @@index([dueDate, tenantId])  // For identifying overdue invoices
  @@index([issuedDate, tenantId])
  @@index([status, dueDate, tenantId])  // For reminders
}
```

**Business Rules:**
- Invoice number must be unique per tenant
- Amount must be non-negative
- Due date must be after issued date
- Status must be PAID, UNPAID, OVERDUE, or DRAFT

---

### 8. Voucher Model - Temporal & State Constraints

```prisma
model Voucher {
  // Add unique constraint on code per tenant
  // Add check constraint: USED vouchers must have usedAt populated
  // Add check constraint: USED vouchers must have usedBy populated
  
  @@unique([code, tenantId])
  @@index([status, tenantId])
  @@index([packageId, tenantId])
  @@index([createdAt, tenantId])
  @@index([usedAt, tenantId])  // For reporting
}
```

**Business Rules:**
- Code must be unique per tenant
- Status must be UNUSED, ACTIVE, USED, EXPIRED, or REVOKED
- Used vouchers must have usedBy and usedAt populated
- Status transitions: UNUSED → ACTIVE → USED or EXPIRED

---

### 9. RadAcct Model - Accounting Integrity

```prisma
model RadAcct {
  // Add unique constraint on acctuniqueid
  // Add check constraints for times:
  // acctupdatetime >= acctstarttime
  // acctstoptime >= acctstarttime (if populated)
  
  @@unique([acctuniqueid])
  @@index([username, acctstarttime])
  @@index([acctstoptime, tenantId])  // For session expiry
  @@index([acctstarttime, acctstoptime])
  @@index([nasipaddress, acctstoptime])
}
```

**Business Rules:**
- Each session has a unique accounting ID
- Update time must be >= start time
- Stop time must be >= start time
- Session must have proper start/stop times for billing

---

## Application-Level Validations

All input validations are handled via Zod schemas in `src/lib/validation.ts`:

### Key Validations:

1. **Package Validation**
   - Name: 1-100 characters
   - Speed: Positive numbers
   - Price: Non-negative
   - Duration: At least 1

2. **Client Validation**
   - Username: 1-50 characters
   - Full name: Required, 1-100 characters
   - Email: Valid format (optional)
   - Service type: HOTSPOT or PPPOE

3. **User Validation**
   - Username: 1-50 characters
   - Email: Valid format, unique
   - Password: At least 8 characters
   - Role: Valid enum value

4. **Transaction Validation**
   - Client ID: Required, valid reference
   - Amount: Positive number
   - Method: Not empty
   - Reference: Unique

5. **Router Validation**
   - Name: 1-50 characters
   - Host: Valid IP or hostname
   - Port: 1-65535
   - API Port: 1-65535

---

## Migration Recommendations

### Phase 1: Add Indexes (Low Risk)
```sql
-- Improves query performance
CREATE INDEX idx_user_status ON users(status);
CREATE INDEX idx_client_status_type ON clients(status, service_type);
CREATE INDEX idx_subscription_expiry ON subscriptions(expires_at);
```

### Phase 2: Add Check Constraints (Medium Risk)
```sql
-- Validates data integrity at database level
ALTER TABLE packages ADD CONSTRAINT chk_speed_positive CHECK (upload_speed > 0);
ALTER TABLE packages ADD CONSTRAINT chk_price_positive CHECK (price >= 0);
ALTER TABLE invoices ADD CONSTRAINT chk_amount_positive CHECK (amount >= 0);
```

### Phase 3: Add Unique Constraints (Higher Risk)
```sql
-- Ensure uniqueness - requires data cleanup first
ALTER TABLE users ADD CONSTRAINT uq_user_tenant_username UNIQUE(username, tenant_id);
ALTER TABLE routers ADD CONSTRAINT uq_router_host_port UNIQUE(host, port, tenant_id);
```

---

## Testing Validations

### Unit Tests for Validations
```typescript
import { validatePackage, validateTransaction } from '@/lib/validation';

describe('Package Validation', () => {
  it('should reject zero or negative prices', () => {
    const result = validatePackage({ price: -10, /* ... */ });
    expect(result.valid).toBe(false);
  });
});
```

### Integration Tests for Constraints
```typescript
describe('Database Constraints', () => {
  it('should prevent duplicate usernames per tenant', async () => {
    // Create first user
    // Attempt to create second with same username
    // Should fail with unique constraint error
  });
});
```

---

## Monitoring & Enforcement

### Add Application-Level Checks:
1. **Pre-insert validation** using Zod schemas
2. **Transaction integrity** for multi-step operations
3. **Audit logging** for sensitive changes
4. **Soft deletes** for important records
5. **Versioning** for critical data

### Suggested Middleware:
- Validate all inputs before database operations
- Log all validation failures
- Monitor constraint violation rates
- Alert on unusual patterns

---

## References

- [Prisma Schema Documentation](https://www.prisma.io/docs/concepts/components/prisma-schema)
- [Zod Validation Library](https://zod.dev)
- [Database Constraints Best Practices](https://www.postgresql.org/docs/current/ddl-constraints.html)
