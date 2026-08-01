"use server";

import { revalidatePath } from "next/cache";
import { requireActiveWorkspace } from "@/lib/workspace-context";
import { isValidCategory } from "@/lib/categories";
import {
  confirmMapping,
  updateTransactionCategory,
  uploadStatement,
  type UploadOutcome,
} from "@/features/transactions/server/service";
import type { ColumnMapping } from "@/features/transactions/lib/types";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_EXTENSIONS = ["csv", "xlsx", "xls"];

export interface UploadActionResult {
  error?: string;
  outcome?: UploadOutcome;
}

export async function uploadStatementAction(formData: FormData): Promise<UploadActionResult> {
  const { workspaceId } = await requireActiveWorkspace();

  const file = formData.get("file");
  const accountId = formData.get("accountId");
  const idempotencyKey = formData.get("idempotencyKey");

  if (!(file instanceof File)) return { error: "No file was provided." };
  if (typeof accountId !== "string" || !accountId) return { error: "Choose an account first." };
  if (typeof idempotencyKey !== "string" || !idempotencyKey) {
    return { error: "Missing upload key — please retry." };
  }

  const ext = file.name.toLowerCase().split(".").pop();
  if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
    return { error: "Only .csv, .xlsx, and .xls files are supported." };
  }
  if (file.size === 0) return { error: "That file is empty." };
  if (file.size > MAX_FILE_SIZE_BYTES) return { error: "File is larger than the 10MB limit." };

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const outcome = await uploadStatement(workspaceId, accountId, file.name, buffer, idempotencyKey);
    revalidatePath("/transactions");
    return { outcome };
  } catch {
    return { error: "Something went wrong reading that file. Please try again." };
  }
}

export interface ConfirmMappingInput {
  jobId: string;
  mapping: ColumnMapping;
}

export async function confirmMappingAction(input: ConfirmMappingInput): Promise<UploadActionResult> {
  const { workspaceId } = await requireActiveWorkspace();

  try {
    const outcome = await confirmMapping(workspaceId, input.jobId, input.mapping);
    revalidatePath("/transactions");
    return { outcome };
  } catch {
    return { error: "Couldn't import with that column mapping. Please check your selections." };
  }
}

export interface UpdateCategoryResult {
  error?: string;
}

export async function updateTransactionCategoryAction(
  transactionId: string,
  category: string,
  learnRule: boolean,
): Promise<UpdateCategoryResult> {
  const { workspaceId } = await requireActiveWorkspace();

  if (!isValidCategory(category)) return { error: "Not a valid category." };

  try {
    await updateTransactionCategory(workspaceId, transactionId, category, learnRule);
    revalidatePath("/transactions");
    return {};
  } catch {
    return { error: "Couldn't update the category." };
  }
}
