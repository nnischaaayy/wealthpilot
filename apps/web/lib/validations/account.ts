import { z } from "zod";

export const accountTypes = ["checking", "savings", "credit", "brokerage"] as const;

export const createAccountSchema = z.object({
  name: z.string().trim().min(1, "Account name is required").max(100),
  institution: z.string().trim().max(100).optional(),
  type: z.enum(accountTypes),
  currency: z
    .string()
    .trim()
    .length(3, "Use a 3-letter currency code")
    .toUpperCase()
    .default("INR"),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
