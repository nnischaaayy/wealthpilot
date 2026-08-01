import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata: Metadata = { title: "Transactions — WealthPilot" };

export default function TransactionsPage() {
  return (
    <PlaceholderPage
      title="Transactions"
      description="Upload a bank statement to see a sortable, filterable, categorized transaction table here."
      phase="Phase 2"
    />
  );
}
