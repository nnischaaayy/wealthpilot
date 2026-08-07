"use server";

import { revalidatePath } from "next/cache";
import { requireActiveWorkspace } from "@/lib/workspace-context";
import { createAccountSchema } from "@/lib/validations/account";
import { createAccount, deleteAccount, renameAccount } from "@/features/accounts/server/service";

export interface CreateAccountResult {
  error?: string;
  accountId?: string;
}

export async function createAccountAction(input: unknown): Promise<CreateAccountResult> {
  const { userId, workspaceId } = await requireActiveWorkspace();

  const parsed = createAccountSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid account details." };
  }

  const account = await createAccount(workspaceId, userId, parsed.data);
  revalidatePath("/transactions");
  return { accountId: account.id };
}

export interface AccountActionResult {
  error?: string;
}

export async function renameAccountAction(accountId: string, name: string): Promise<AccountActionResult> {
  const { userId, workspaceId } = await requireActiveWorkspace();

  const trimmed = name.trim();
  if (!trimmed) return { error: "Name can't be empty." };

  try {
    await renameAccount(workspaceId, userId, accountId, trimmed);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't rename that account." };
  }

  revalidatePath("/settings");
  revalidatePath("/transactions");
  return {};
}

export async function deleteAccountAction(accountId: string): Promise<AccountActionResult> {
  const { userId, workspaceId } = await requireActiveWorkspace();

  try {
    await deleteAccount(workspaceId, userId, accountId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't delete that account." };
  }

  revalidatePath("/settings");
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  return {};
}
