"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { MOBILE_NAV_ITEMS } from "@/lib/nav-items";
import { cn } from "@/lib/utils";

export function MobileTabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="bg-background safe-area-inset-bottom fixed inset-x-0 bottom-0 z-40 flex border-t md:hidden"
    >
      {MOBILE_NAV_ITEMS.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
              active ? "text-brand" : "text-muted-foreground",
            )}
          >
            <Icon className="size-5" strokeWidth={1.5} aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
