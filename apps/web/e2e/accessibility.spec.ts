import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// axe-core scan on every core journey page (architecture.md §15), asserting
// zero violations at the wcag2a/wcag2aa level — the same bar §6.2's
// accessibility rules (contrast, keyboard reachability, focus rings,
// aria-live form errors) are meant to hold the whole app to.
const PROTECTED_PAGES = [
  { name: "dashboard", path: "/dashboard" },
  { name: "transactions", path: "/transactions" },
  { name: "budgets", path: "/budgets" },
  { name: "portfolio", path: "/portfolio" },
  { name: "advisor", path: "/advisor" },
  { name: "settings", path: "/settings" },
];

for (const { name, path } of PROTECTED_PAGES) {
  test(`${name} has no automatically-detectable accessibility violations`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();

    expect(results.violations, formatViolations(results.violations)).toEqual([]);
  });
}

test.describe("unauthenticated pages", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const { name, path } of [
    { name: "login", path: "/login" },
    { name: "signup", path: "/signup" },
  ]) {
    test(`${name} has no automatically-detectable accessibility violations`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");

      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();

      expect(results.violations, formatViolations(results.violations)).toEqual([]);
    });
  }
});

function formatViolations(violations: { id: string; help: string; nodes: { html: string }[] }[]): string {
  if (violations.length === 0) return "";
  return violations
    .map((v) => `${v.id} (${v.help}):\n${v.nodes.map((n) => `  ${n.html}`).join("\n")}`)
    .join("\n\n");
}
