export const ASSET_CLASSES = [
  { id: "equity", label: "Equity" },
  { id: "bond", label: "Bonds" },
  { id: "cash", label: "Cash" },
  { id: "real_estate", label: "Real Estate" },
  { id: "commodity", label: "Commodities" },
  { id: "crypto", label: "Crypto" },
  { id: "other", label: "Other" },
] as const;

export type AssetClassId = (typeof ASSET_CLASSES)[number]["id"];

const ASSET_CLASS_MAP = new Map(ASSET_CLASSES.map((a) => [a.id, a]));

export function getAssetClassLabel(id: string): string {
  return ASSET_CLASS_MAP.get(id as AssetClassId)?.label ?? id;
}

/** value -> label map for Base UI Select's `items` prop (shows labels, not raw ids). */
export const ASSET_CLASS_ITEMS: Record<string, string> = Object.fromEntries(
  ASSET_CLASSES.map((a) => [a.id, a.label]),
);
