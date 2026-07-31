export const MOBILE_MONEY_PROVIDERS = ["PALMPESA", "ZENOPAY", "MONGIKE", "HARAKAPAY"] as const;

export type MobileMoneyProvider = (typeof MOBILE_MONEY_PROVIDERS)[number];

export const mobileMoneyProviderOptions: ReadonlyArray<{
  value: MobileMoneyProvider;
  label: string;
  tone: "emerald" | "sky" | "amber" | "violet";
}> = [
  { value: "PALMPESA", label: "PalmPesa", tone: "emerald" },
  { value: "ZENOPAY", label: "ZenoPay", tone: "sky" },
  { value: "MONGIKE", label: "Mongike", tone: "amber" },
  { value: "HARAKAPAY", label: "HarakaPay", tone: "violet" },
];
