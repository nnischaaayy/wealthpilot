import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata: Metadata = { title: "Budgets — WealthPilot" };

export default function BudgetsPage() {
  return (
    <PlaceholderPage
      title="Budgets"
      description="Set category budgets and threshold alerts once transactions and categories exist."
      phase="Phase 3 / Phase 7"
    />
  );
}
