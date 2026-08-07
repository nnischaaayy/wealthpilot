"use server";

import { revalidatePath } from "next/cache";
import { requireActiveWorkspace } from "@/lib/workspace-context";
import { categoryBudgetSchema } from "@/lib/validations/category-budget";
import { deleteCategoryBudget, upsertCategoryBudget } from "@/features/budgets/server/service";

export interface CategoryBudgetActionResult {
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
}

export async function setCategoryBudgetAction(
  currency: string,
  input: unknown,
): Promise<CategoryBudgetActionResult> {
  const { userId, workspaceId } = await requireActiveWorkspace();

  const parsed = categoryBudgetSchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    await upsertCategoryBudget(
      workspaceId,
      userId,
      parsed.data.category,
      Math.round(parsed.data.limit * 100),
      currency,
    );
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't save that budget." };
  }

  revalidatePath("/budgets");
  return {};
}

export async function deleteCategoryBudgetAction(id: string): Promise<CategoryBudgetActionResult> {
  const { userId, workspaceId } = await requireActiveWorkspace();

  try {
    await deleteCategoryBudget(workspaceId, userId, id);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't delete that budget." };
  }

  revalidatePath("/budgets");
  return {};
}
