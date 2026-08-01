import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata: Metadata = { title: "Dashboard — WealthPilot" };

export default function DashboardPage() {
  return (
    <PlaceholderPage
      title="Dashboard"
      description="Net worth, cash flow, spending by category, and your 50/30/20 budget will render here once transactions exist."
      phase="Phase 3"
    />
  );
}
