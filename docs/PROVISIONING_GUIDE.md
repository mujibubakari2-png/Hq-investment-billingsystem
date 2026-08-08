# Router Provisioning Guide

This guide explains how the platform automatically provisions routers based on their vendor and detected capabilities.

## The Provisioning Engine

The `routerProvisioningEngine.ts` file acts as the intelligence layer that translates abstract goals ("Set up a new ISP site") into actionable steps.

### Workflow

1. **Capability Detection**: 
   When a router is added, the system connects and pulls its capability set using `detectRouterCapabilities()`.

2. **Plan Generation**:
   The `buildProvisioningPlan` function evaluates the router's capabilities and vendor. 
   - For **MikroTik**: It will schedule tasks to configure PPPoE servers, Hotspot servers, Bridges, and DHCP.
   - For **Omada / UniFi**: It will skip PPPoE and schedule controller configuration syncs and VLAN mappings.

3. **Execution**:
   The `routerProvision.worker.ts` processes these steps sequentially using BullMQ.
   It calls the vendor-specific adapter methods (e.g., `adapter.createPPPoEProfile()`) to apply the configuration.

4. **Idempotency**:
   All provisioning steps are designed to be **idempotent**. 
   Running the provisioning plan twice will not result in duplicate records (e.g., the adapter checks if a bridge named 'br-lan' exists before creating it).

## Customizing Provisioning

To add a new step to the provisioning process:

1. Update `RouterCapabilitySet` to track the new feature flag if necessary.
2. Add the abstract method to `RouterAdapter.ts` interface (e.g., `configureOSPF()`).
3. Implement the method in the respective vendor adapters.
4. Add the step mapping inside `buildProvisioningPlan` in `routerProvisioningEngine.ts`.
