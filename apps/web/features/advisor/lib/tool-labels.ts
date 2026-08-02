const TOOL_LABELS: Record<string, string> = {
  get_transactions: "Your transactions",
  calculate_budget_projection: "Budget projection calculator",
  calculate_emergency_fund: "Emergency fund calculator",
  calculate_loan_payment: "Loan payment calculator",
  calculate_investment_growth: "Investment growth calculator",
  get_holdings: "Your portfolio holdings",
  calculate_allocation: "Allocation calculator",
  calculate_risk_score: "Risk score calculator",
  get_dashboard_snapshot: "Your dashboard summary",
  rag_lookup: "Financial glossary",
};

export function formatToolName(name: string): string {
  return TOOL_LABELS[name] ?? name;
}
