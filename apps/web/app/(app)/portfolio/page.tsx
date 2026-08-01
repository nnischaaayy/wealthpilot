import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata: Metadata = { title: "Portfolio — WealthPilot" };

export default function PortfolioPage() {
  return (
    <PlaceholderPage
      title="Portfolio"
      description="Add holdings manually to see allocation, performance, and risk analytics here."
      phase="Phase 4"
    />
  );
}
