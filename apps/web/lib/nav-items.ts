import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, ArrowLeftRight, PiggyBank, LineChart, Sparkles, Settings } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

// Full nav — desktop sidebar.
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/budgets", label: "Budgets", icon: PiggyBank },
  { href: "/portfolio", label: "Portfolio", icon: LineChart },
  { href: "/advisor", label: "AI Advisor", icon: Sparkles },
  { href: "/settings", label: "Settings", icon: Settings },
];

// Thumb-reachable subset — mobile bottom tab bar (§5.2).
export const MOBILE_NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/transactions", label: "Txns", icon: ArrowLeftRight },
  { href: "/budgets", label: "Budget", icon: PiggyBank },
  { href: "/advisor", label: "AI", icon: Sparkles },
  { href: "/settings", label: "Settings", icon: Settings },
];
