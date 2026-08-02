"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format-money";
import { getAssetClassLabel } from "@/lib/asset-classes";
import { cn } from "@/lib/utils";
import { HoldingEditDialog } from "@/features/portfolio/components/holding-edit-dialog";
import { deleteHoldingAction } from "@/features/portfolio/actions";
import type { HoldingAnalytics } from "@/features/portfolio/lib/analytics";
import type { Account, Holding } from "@wealthpilot/db";

type HoldingRow = Holding & { account: Pick<Account, "name"> };

function DeleteHoldingButton({ holdingId, symbol }: { holdingId: string; symbol: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="destructive"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              await deleteHoldingAction(holdingId);
              router.refresh();
            })
          }
        >
          {isPending ? "Deleting…" : "Confirm"}
        </Button>
        <Button size="sm" variant="ghost" disabled={isPending} onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <Button
      size="icon-sm"
      variant="ghost"
      aria-label={`Delete ${symbol}`}
      onClick={() => setConfirming(true)}
    >
      <Trash2 className="size-4" />
    </Button>
  );
}

export function PortfolioHoldingsTable({
  holdings,
  analytics,
  accounts,
}: {
  holdings: HoldingRow[];
  analytics: HoldingAnalytics[];
  accounts: Account[];
}) {
  const analyticsById = new Map(analytics.map((a) => [a.id, a]));

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Symbol</TableHead>
            <TableHead>Account</TableHead>
            <TableHead>Asset class</TableHead>
            <TableHead className="text-right">Quantity</TableHead>
            <TableHead className="text-right">Avg. cost</TableHead>
            <TableHead className="text-right">Value</TableHead>
            <TableHead className="text-right">Gain/loss</TableHead>
            <TableHead className="w-20" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {holdings.map((h) => {
            const a = analyticsById.get(h.id);
            return (
              <TableRow key={h.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{h.symbol}</span>
                    {h.name && <span className="text-muted-foreground text-xs">{h.name}</span>}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground whitespace-nowrap">{h.account.name}</TableCell>
                <TableCell className="whitespace-nowrap">{getAssetClassLabel(h.assetClass)}</TableCell>
                <TableCell className="tabular-nums text-right">{h.quantity}</TableCell>
                <TableCell className="tabular-nums text-right whitespace-nowrap">
                  {formatMoney(h.costBasisMinor, h.currency)}
                </TableCell>
                <TableCell className="tabular-nums text-right whitespace-nowrap">
                  {a ? formatMoney(a.marketValueMinor, h.currency) : "—"}
                  {a && !a.hasLivePrice && (
                    <span className="text-muted-foreground ml-1 text-xs">(at cost)</span>
                  )}
                </TableCell>
                <TableCell
                  className={cn(
                    "tabular-nums text-right whitespace-nowrap",
                    a && a.gainLossMinor < 0 ? "text-negative" : a && a.gainLossMinor > 0 ? "text-positive" : "",
                  )}
                >
                  {a ? (
                    <>
                      {formatMoney(a.gainLossMinor, h.currency)}
                      {a.gainLossPct !== null && (
                        <span className="ml-1 text-xs">
                          ({a.gainLossPct >= 0 ? "+" : ""}
                          {a.gainLossPct}%)
                        </span>
                      )}
                    </>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <HoldingEditDialog
                      accounts={accounts}
                      holding={h}
                      trigger={
                        <Button size="icon-sm" variant="ghost" aria-label={`Edit ${h.symbol}`}>
                          <Pencil className="size-4" />
                        </Button>
                      }
                    />
                    <DeleteHoldingButton holdingId={h.id} symbol={h.symbol} />
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
