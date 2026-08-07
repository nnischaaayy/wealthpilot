import { z } from "zod";
import { isValidCategory } from "@/lib/categories";

export const categoryBudgetSchema = z.object({
  category: z.string().min(1, "Choose a category").refine(isValidCategory, "Unknown category"),
  limit: z.coerce.number().positive("Limit must be greater than 0"),
});

export type CategoryBudgetInput = z.infer<typeof categoryBudgetSchema>;
