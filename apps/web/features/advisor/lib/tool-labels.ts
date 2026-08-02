const TOOL_LABELS: Record<string, string> = {
  get_transactions: "Your transactions",
  calculate_budget_projection: "Budget projection calculator",
  calculate_emergency_fund: "Emergency fund calculator",
  calculate_loan_payment: "Loan payment calculator",
  calculate_investment_growth: "Investment growth calculator",
};

export function formatToolName(name: string): string {
  return TOOL_LABELS[name] ?? name;
}
