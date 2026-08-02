import type { Metadata } from "next";
import { AdvisorChatPanel } from "@/features/advisor/components/advisor-chat-panel";

export const metadata: Metadata = { title: "AI Advisor — WealthPilot" };

export default function AdvisorPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">AI Advisor</h1>
        <p className="text-sm text-muted-foreground">
          Spending, portfolio, and month-in-review questions — grounded in your own data.
        </p>
      </div>
      <AdvisorChatPanel />
    </div>
  );
}
