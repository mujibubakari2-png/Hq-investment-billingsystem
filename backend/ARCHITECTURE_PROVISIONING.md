# Vendor Adapter Architecture & Idempotent Provisioning

## Overview

The HQ INVESTMENT backend now supports multiple router vendors (MikroTik, TP-Link Omada, Ubiquiti UniFi, TP-Link Business) through a **vendor-agnostic adapter pattern**. All router operations flow through the `RouterAdapter` interface, enabling capability detection, version-aware command generation, and idempotent provisioning with automatic rollback on failure.

## Architecture

### 1. Vendor Adapters (`backend/src/lib/routerAdapters.ts`)

Each vendor has a dedicated adapter class implementing the `RouterAdapter` interface:

```
RouterAdapter (interface)
├── MikroTikAdapter (fully featured)
├── OmadaAdapter (partial — controller features ready)
├── UniFiAdapter (partial — controller features ready)
└── TPLinkAdapter (partial — controller features ready)
```

**Key Methods:**
- `connect()` — test connection and auth
- `discoverCapabilities()` — live capability detection + DB persistence
- `createUser()`, `deleteUser()`, `createPPPoE()`, `createHotspot()` — user management
- `createQueue()`, `createFirewall()`, `createDHCP()`, `createDNS()` — network config
- `createBridge()`, `createVLAN()` — L2/L3 topology
- `monitor()`, `backup()`, `restore()`, `reboot()`, `healthCheck()` — admin
- `apiRequestPublic()` — low-level REST/SSH passthrough for advanced ops

**Capability Detection:**
Each adapter calls `discoverCapabilities()` which queries the router live and persists metadata:
- `firmwareVersion`, `architecture`, `apiType`
- `capabilities` (JSON) — boolean map of supported features (PPPoE, Hotspot, WireGuard, DHCP, etc.)
- `supportedFeatures` (CSV) — human-readable list
- `lastDiscovery` — timestamp

Example capabilities map (MikroTik v7+):
```json
{
  "pppoe": true,
  "hotspot": true,
  "radius": true,
  "dhcp": true,
  "dns": true,
  "wireguard": true,
  "firewall": true,
  "queue": true,
  "bridge": true,
  "vlan": true,
  "ipv6": true
}
```

### 2. Idempotent Provisioning (`backend/src/lib/idempotentProvisioning.ts`)

**Workflow:**

1. **Detect Existing Resources** (`detectExistingResources()`)
   - Query router for HQ INVESTMENT–named bridges, pools, profiles, rules, etc.
   - Build a skip-list of what already exists

2. **Build Plan** (`buildProvisioningPlan()`)
   - Define steps: bridge, pools, profiles, firewall, WireGuard, etc.
   - Mark dependencies: bridge must exist before pool
   - Skip steps for resources that already exist (idempotence)

3. **Generate Idempotent Script** (`generateScriptFromPlan()`)
   - Wrap commands with existence checks (RouterOS syntax):
     ```bash
     :if ([:len [/interface bridge find name="bridge-lan"]] = 0) do={
         /interface bridge add name=bridge-lan
     }
     ```
   - Filter by capabilities (skip Hotspot commands on routers without Hotspot)
   - Add version comments for traceability

4. **Dry-Run Preview** (`dryRunProvisioning()`)
   - Return plan summary without executing
   - Useful for human review before apply

5. **Execute with Retries** (`backend/src/lib/provisionExecutor.ts`)
   - Create temporary script on router
   - Run it with exponential backoff retry (transient failures only)
   - Persist logs to DB
   - On failure, generate and store rollback script

6. **Rollback** (`generateRollbackScript()`)
   - Safe cleanup script that removes all HQ INVESTMENT resources
   - Stored in error logs for manual review/execution

### 3. Capability-Aware API Routes

All router action routes (`/api/routers/[id]/pppoe-users`, `/api/routers/[id]/bandwidth-profiles`, etc.) now:
- Resolve the adapter: `getRouterAdapter(routerId, tenantId)`
- Check capabilities: `adapter.discoverCapabilities()`
- Reject unsupported operations: "PPPoE not supported on this router"
- Call adapter methods instead of direct service calls
- Log actions to `RouterLog` for audit trail

### 4. Discovery & Persistence Worker

`backend/src/workers/routerDiscovery.worker.ts`
- Enqueued when a router is created/updated
- Calls `adapter.discoverCapabilities()`
- Persists capabilities, firmware version, architecture, health status to DB
- Enables offline capacity planning and UI capability gating

### 5. Provisioning Execution Worker

`backend/src/workers/provisionExecution.worker.ts`
- Builds a provisioning plan (idempotent)
- Generates vendor/version-aware script
- Calls `executeProvisioningPlan()` (retries + rollback on failure)
- Persists execution logs for audit

### 6. Capabilities Endpoint

`GET /api/routers/[id]/capabilities`
- Returns stored capabilities from DB
- Frontend uses this to gate UI (hide Hotspot tab if not supported)

`POST /api/routers/[id]/capabilities/refresh`
- Triggers live discovery (expensive, call sparingly)
- Stores result in DB

## Encryption & Security

All router passwords, secrets, and keys are encrypted at rest using AES-256-GCM:
- `encryptRouterFields()` — before DB write
- `decryptRouterFields()` — after DB read
- Migration script: `scripts/encrypt-routers.ts --dry-run` to check, then run without flag to apply

Radius secret is now a separate field (not reused from admin password).

## Testing

**Unit Tests:**
- `src/__tests__/router-adapters.test.ts` — adapter interface, capability detection
- `src/__tests__/router-provisioning-engine.test.ts` — plan building
- `src/__tests__/provision-executor.test.ts` — execution, retries, rollback
- `src/__tests__/capabilities-route.test.ts` — API endpoint

**Integration Tests:**
- Full test suite covers adapter + route + worker flows

Run tests:
```bash
pnpm jest --runInBand
```

## Deployment Checklist

- [ ] Generate and set `FIELD_ENCRYPTION_KEY` in all environments
- [ ] Run `scripts/encrypt-routers.ts --dry-run` to verify no failures
- [ ] Run `scripts/encrypt-routers.ts` to migrate plaintext fields
- [ ] Deploy backend (adapters + routes + workers)
- [ ] Deploy discovery worker (enqueue on router create/update)
- [ ] Update frontend to fetch capabilities and gate UI
- [ ] Monitor router health: `GET /api/routers?status=OFFLINE` to find unreachable routers
- [ ] Test provisioning dry-run first: `POST /api/routers/[id]/provision?dry-run=true`

## Future Enhancements

- Per-step rollback (undo only executed steps, not entire config)
- Multi-router provisioning (batch apply same plan to 10 routers)
- Provision templates (save/reuse common plans)
- Native Omada/UniFi/TP-Link controller integrations (currently read-only)
- Policy-based provisioning (assign plans to tenants automatically)
