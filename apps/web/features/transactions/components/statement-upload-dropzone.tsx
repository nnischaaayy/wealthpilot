"use client";

import { useRef, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AccountSelect } from "@/features/accounts/components/account-select";
import { ColumnMappingWizard } from "@/features/transactions/components/column-mapping-wizard";
import { uploadStatementAction } from "@/features/transactions/actions";
import type { Account } from "@wealthpilot/db";
import type { UploadOutcome } from "@/features/transactions/server/service";

export function StatementUploadDropzone({ accounts }: { accounts: Account[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [accountId, setAccountId] = useState<string | undefined>(accounts[0]?.id);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [successMessage, setSuccessMessage] = useState<string | undefined>();
  const [mappingOutcome, setMappingOutcome] = useState<UploadOutcome | null>(null);

  async function handleFile(file: File) {
    if (!accountId) {
      setError("Choose or add an account first.");
      return;
    }
    setError(undefined);
    setSuccessMessage(undefined);
    setIsUploading(true);

    const formData = new FormData();
    formData.set("file", file);
    formData.set("accountId", accountId);
    formData.set("idempotencyKey", crypto.randomUUID());

    const result = await uploadStatementAction(formData);
    setIsUploading(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    if (!result.outcome) return;

    if (result.outcome.status === "done") {
      const skipped = result.outcome.skippedRows ? ` (${result.outcome.skippedRows} rows skipped)` : "";
      setSuccessMessage(`Imported ${result.outcome.transactionCount ?? 0} transactions${skipped}.`);
      router.refresh();
    } else if (result.outcome.status === "mapping_required") {
      setMappingOutcome(result.outcome);
    } else {
      setError(result.outcome.errorDetail ?? "We couldn't process that file.");
    }
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <AccountSelect accounts={accounts} value={accountId} onChange={setAccountId} />

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          className={cn(
            "flex min-w-64 flex-1 items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-3 text-sm transition-colors",
            isDragging ? "border-brand bg-brand/5" : "border-border",
          )}
        >
          <Upload className="text-muted-foreground size-4" aria-hidden="true" />
          <span className="text-muted-foreground">Drag a CSV/XLSX statement here, or</span>
          <Button
            variant="link"
            className="h-auto p-0"
            disabled={isUploading}
            onClick={() => inputRef.current?.click()}
          >
            browse
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="sr-only"
            aria-label="Upload statement file"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {isUploading && <p className="text-muted-foreground text-sm">Parsing statement…</p>}
      {error && (
        <p role="alert" className="text-negative text-sm">
          {error}
        </p>
      )}
      {successMessage && (
        <p role="status" className="text-positive text-sm">
          {successMessage}
        </p>
      )}

      {mappingOutcome && (
        <ColumnMappingWizard
          outcome={mappingOutcome}
          onClose={() => setMappingOutcome(null)}
          onSuccess={(message) => {
            setMappingOutcome(null);
            setSuccessMessage(message);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
