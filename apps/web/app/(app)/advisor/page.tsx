import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata: Metadata = { title: "AI Advisor — WealthPilot" };

export default function AdvisorPage() {
  return (
    <PlaceholderPage
      title="AI Advisor"
      description="A grounded chat advisor — budget coaching, portfolio analysis, and statement summaries with cited sources — lands with the ai-service."
      phase="Phase 5 / Phase 6"
    />
  );
}
