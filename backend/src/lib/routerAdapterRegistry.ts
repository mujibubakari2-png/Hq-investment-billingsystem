import { createRouterAdapter, type RouterAdapter, type RouterAdapterContext } from "./routerAdapters";

export const routerAdapterRegistry = {
  create: (context: RouterAdapterContext): RouterAdapter => createRouterAdapter(context),
};

export function getRouterAdapterType(context: RouterAdapterContext): string {
  const vendor = (context.vendor || "MikroTik").toLowerCase();
  if (vendor.includes("omada")) return "OmadaAdapter";
  if (vendor.includes("unifi") || vendor.includes("ubiquiti")) return "UniFiAdapter";
  if (vendor.includes("tplink") || vendor.includes("tp-link")) return "TPLinkAdapter";
  if (vendor.includes("future")) return "FutureVendorAdapter";
  return "MikroTikAdapter";
}
