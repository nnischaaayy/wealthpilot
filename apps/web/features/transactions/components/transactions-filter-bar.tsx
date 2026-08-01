"use client";

import { useQueryStates, parseAsString, parseAsInteger, debounce } from "nuqs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATEGORIES, CATEGORY_ITEMS } from "@/lib/categories";

export function TransactionsFilterBar() {
  // shallow: false — this page's data is fetched server-side from
  // searchParams, so the URL update must trigger a real Next.js navigation
  // (nuqs defaults to a client-only History API update, which would leave
  // the table showing stale results).
  const [{ q, category }, setFilters] = useQueryStates(
    {
      q: parseAsString.withDefault(""),
      category: parseAsString.withDefault(""),
      page: parseAsInteger.withDefault(1),
    },
    { shallow: false, limitUrlUpdates: debounce(300) },
  );

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Input
        value={q}
        onChange={(e) => setFilters({ q: e.target.value || null, page: 1 })}
        placeholder="Search description or merchant…"
        className="max-w-xs"
        aria-label="Search transactions"
      />
      <Select
        items={{ all: "All categories", ...CATEGORY_ITEMS }}
        value={category || "all"}
        onValueChange={(v) => setFilters({ category: v === "all" ? null : v, page: 1 })}
      >
        <SelectTrigger className="w-48">
          <SelectValue placeholder="All categories" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All categories</SelectItem>
          {CATEGORIES.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
