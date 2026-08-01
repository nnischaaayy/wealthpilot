"use server";

import { revalidatePath } from "next/cache";
import { requireActiveWorkspace } from "@/lib/workspace-context";
import { createAccountSchema } from "@/lib/validations/account";
import { createAccount } from "@/features/accounts/server/service";

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
