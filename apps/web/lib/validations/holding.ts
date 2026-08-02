import { z } from "zod";
import { ASSET_CLASSES, type AssetClassId } from "@/lib/asset-classes";

const ASSET_CLASS_IDS = ASSET_CLASSES.map((a) => a.id) as [AssetClassId, ...AssetClassId[]];

export const holdingSchema = z.object({
  accountId: z.string().min(1, "Choose an account"),
  symbol: z
    .string()
    .trim()
    .min(1, "Symbol is required")
    .max(20)
    .transform((s) => s.toUpperCase()),
  name: z.string().trim().max(100).optional(),
  quantity: z.coerce.number().positive("Quantity must be greater than 0"),
  costBasis: z.coerce.number().nonnegative("Cost basis can't be negative"),
  currentPrice: z.coerce.number().nonnegative("Price can't be negative").optional(),
  assetClass: z.enum(ASSET_CLASS_IDS),
});

export type HoldingInput = z.infer<typeof holdingSchema>;
