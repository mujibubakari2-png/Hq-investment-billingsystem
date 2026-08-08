# Router Adapter Architecture

## Overview

The router integration layer now uses a vendor adapter pattern so business logic can operate through a stable interface instead of embedding vendor-specific commands in route handlers or workers.

## Adapters

- MikroTikAdapter: wraps the existing MikroTik service and preserves backward compatibility for RouterOS deployments.
- OmadaAdapter: provides a vendor-neutral placeholder for Omada controller-based workflows.
- UniFiAdapter: provides a vendor-neutral placeholder for UniFi controller-based workflows.
- TPLinkAdapter: provides a vendor-neutral placeholder for TP-Link business-router workflows.
- FutureVendorAdapter: serves as a scaffold for future vendors.

## Capability Model

Router capability detection is centralized in the adapter layer and stored as JSON in the router record. Supported features are derived from the detected vendor and firmware version.

## Version Awareness

The compatibility layer evaluates firmware and vendor combinations to determine whether features like REST API, WireGuard, CAPsMAN, and SNMP are supported.
