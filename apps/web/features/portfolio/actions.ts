"use server";

import { revalidatePath } from "next/cache";
import { requireActiveWorkspace } from "@/lib/workspace-context";
import { holdingSchema } from "@/lib/validations/holding";
import { createHolding, deleteHolding, updateHolding } from "@/features/portfolio/server/service";

export interface HoldingActionResult {
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
}

export async function createHoldingAction(input: unknown): Promise<HoldingActionResult> {
  const { userId, workspaceId } = await requireActiveWorkspace();

  const parsed = holdingSchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    await createHolding(workspaceId, userId, parsed.data);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't add that holding." };
  }

  revalidatePath("/portfolio");
  return {};
}

export async function updateHoldingAction(holdingId: string, input: unknown): Promise<HoldingActionResult> {
  const { userId, workspaceId } = await requireActiveWorkspace();

  const parsed = holdingSchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    await updateHolding(workspaceId, userId, holdingId, parsed.data);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't update that holding." };
  }

  revalidatePath("/portfolio");
  return {};
}

export async function deleteHoldingAction(holdingId: string): Promise<HoldingActionResult> {
  const { userId, workspaceId } = await requireActiveWorkspace();

  try {
    await deleteHolding(workspaceId, userId, holdingId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't delete that holding." };
  }

  revalidatePath("/portfolio");
  return {};
}
