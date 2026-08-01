"use client";

import Link from "next/link";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useSidebarStore } from "@/stores/sidebar-store";
import { NAV_ITEMS } from "@/lib/nav-items";
import { NavLink } from "@/components/layout/nav-link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AppSidebar() {
  const collapsed = useSidebarStore((s) => s.collapsed);
  const toggle = useSidebarStore((s) => s.toggle);

  return (
    <aside
      className={cn(
        "bg-sidebar text-sidebar-foreground border-sidebar-border hidden shrink-0 flex-col border-r transition-[width] duration-200 md:flex",
        collapsed ? "w-16" : "w-64",
      )}
    >
      <div className={cn("flex h-16 items-center px-4", collapsed && "justify-center px-2")}>
        <Link href="/dashboard" className="flex items-center gap-2 overflow-hidden">
          <span className="bg-brand text-brand-foreground flex size-7 shrink-0 items-center justify-center rounded-md text-sm font-bold">
            W
          </span>
          <span className={cn("truncate text-base font-semibold tracking-tight", collapsed && "sr-only")}>
            WealthPilot
          </span>
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3 py-2" aria-label="Primary">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.href} item={item} collapsed={collapsed} />
        ))}
      </nav>

      <div className="border-sidebar-border border-t p-3">
        <Button
          variant="ghost"
          size="icon"
          className="w-full justify-center"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={toggle}
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        </Button>
      </div>
    </aside>
  );
}
