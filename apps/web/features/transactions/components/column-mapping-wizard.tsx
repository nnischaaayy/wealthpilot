"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { confirmMappingAction } from "@/features/transactions/actions";
import type { UploadOutcome } from "@/features/transactions/server/service";
import type { ColumnMapping, DateFormat } from "@/features/transactions/lib/types";

type AmountMode = "single" | "debit-credit";

const DATE_FORMAT_ITEMS: Record<DateFormat, string> = {
  "day-first": "Day first (31/12/2025)",
  "month-first": "Month first (12/31/2025)",
  iso: "ISO (2025-12-31)",
};

const AMOUNT_MODE_ITEMS: Record<AmountMode, string> = {
  single: "Single signed amount",
  "debit-credit": "Separate debit/credit",
};

function ColumnField({
  label,
  headers,
  value,
  onChange,
}: {
  label: string;
  headers: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <Select
        items={Object.fromEntries(headers.map((h, i) => [i.toString(), h || `Column ${i + 1}`]))}
        value={value}
        onValueChange={(v) => v && onChange(v)}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select column" />
        </SelectTrigger>
        <SelectContent>
          {headers.map((h, i) => (
            <SelectItem key={i} value={i.toString()}>
              {h || `Column ${i + 1}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function ColumnMappingWizard({
  outcome,
  onClose,
  onSuccess,
}: {
  outcome: UploadOutcome;
  onClose: () => void;
  onSuccess: (message: string) => void;
}) {
  const headers = outcome.headers ?? [];
  const suggested = outcome.suggestedMapping;
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();

  const [dateColumn, setDateColumn] = useState(suggested?.dateColumn?.toString() ?? "");
  const [descriptionColumn, setDescriptionColumn] = useState(suggested?.descriptionColumn?.toString() ?? "");
  const [dateFormat, setDateFormat] = useState<DateFormat>(suggested?.dateFormat ?? "day-first");
  const [amountMode, setAmountMode] = useState<AmountMode>(
    suggested?.debitColumn !== undefined ? "debit-credit" : "single",
  );
  const [amountColumn, setAmountColumn] = useState(suggested?.amountColumn?.toString() ?? "");
  const [debitColumn, setDebitColumn] = useState(suggested?.debitColumn?.toString() ?? "");
  const [creditColumn, setCreditColumn] = useState(suggested?.creditColumn?.toString() ?? "");

  const isValid =
    dateColumn !== "" &&
    descriptionColumn !== "" &&
    (amountMode === "single" ? amountColumn !== "" : debitColumn !== "" && creditColumn !== "");

  function handleSubmit() {
    const mapping: ColumnMapping = {
      dateColumn: Number(dateColumn),
      descriptionColumn: Number(descriptionColumn),
      dateFormat,
      ...(amountMode === "single"
        ? { amountColumn: Number(amountColumn) }
        : { debitColumn: Number(debitColumn), creditColumn: Number(creditColumn) }),
    };

    startTransition(async () => {
      const result = await confirmMappingAction({ jobId: outcome.jobId, mapping });
      if (result.error || result.outcome?.status === "error") {
        setError(result.error ?? result.outcome?.errorDetail ?? "Import failed.");
        return;
      }
      onSuccess(`Imported ${result.outcome?.transactionCount ?? 0} transactions.`);
    });
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>We couldn&apos;t automatically read this statement</DialogTitle>
          <DialogDescription>
            Match each column to a field below. Here&apos;s a preview of the first few rows.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-40 overflow-auto rounded-md border">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted sticky top-0">
                {headers.map((h, i) => (
                  <th key={i} className="px-2 py-1.5 text-left font-medium whitespace-nowrap">
                    {h || `Column ${i + 1}`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(outcome.previewRows ?? []).slice(0, 5).map((row, i) => (
                <tr key={i} className="border-t">
                  {row.map((cell, j) => (
                    <td key={j} className="max-w-40 truncate px-2 py-1.5">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <ColumnField label="Date column" headers={headers} value={dateColumn} onChange={setDateColumn} />
          <div className="grid gap-2">
            <Label>Date format</Label>
            <Select
              items={DATE_FORMAT_ITEMS}
              value={dateFormat}
              onValueChange={(v) => v && setDateFormat(v as DateFormat)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day-first">Day first (31/12/2025)</SelectItem>
                <SelectItem value="month-first">Month first (12/31/2025)</SelectItem>
                <SelectItem value="iso">ISO (2025-12-31)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <ColumnField
            label="Description column"
            headers={headers}
            value={descriptionColumn}
            onChange={setDescriptionColumn}
          />
          <div className="grid gap-2">
            <Label>Amount format</Label>
            <Select
              items={AMOUNT_MODE_ITEMS}
              value={amountMode}
              onValueChange={(v) => v && setAmountMode(v as AmountMode)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single">Single signed amount</SelectItem>
                <SelectItem value="debit-credit">Separate debit/credit</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {amountMode === "single" ? (
            <ColumnField label="Amount column" headers={headers} value={amountColumn} onChange={setAmountColumn} />
          ) : (
            <>
              <ColumnField label="Debit column" headers={headers} value={debitColumn} onChange={setDebitColumn} />
              <ColumnField label="Credit column" headers={headers} value={creditColumn} onChange={setCreditColumn} />
            </>
          )}
        </div>

        {error && (
          <p role="alert" className="text-negative text-sm">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid || isPending}>
            {isPending ? "Importing…" : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
