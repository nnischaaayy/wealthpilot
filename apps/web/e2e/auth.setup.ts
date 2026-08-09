import { test as setup } from "@playwright/test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import path from "node:path";

const authFile = path.join(import.meta.dirname, ".auth/user.json");

const TEST_NAME = "E2E Test User";
const TEST_EMAIL = `e2e-${Date.now()}@example.test`;
const TEST_PASSWORD = "e2e-test-password-123";

setup("create a test user and seed data, then authenticate", async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("Name").fill(TEST_NAME);
  await page.getByLabel("Email").fill(TEST_EMAIL);
  await page.getByLabel("Password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/dashboard");

  await seedWorkspaceData();

  await page.context().storageState({ path: authFile });
});

/**
 * Populates the freshly-signed-up workspace with an account, transactions,
 * a holding, and a category budget so the a11y scan covers populated views
 * (charts, tables, alert states) rather than only empty states.
 */
async function seedWorkspaceData() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  const user = await prisma.user.findUniqueOrThrow({
    where: { email: TEST_EMAIL },
    include: { memberships: true },
  });
  const workspaceId = user.memberships[0].workspaceId;

  const account = await prisma.account.create({
    data: { workspaceId, name: "E2E Checking", type: "checking", currency: "USD" },
  });

  const today = new Date();
  await prisma.transaction.createMany({
    data: [
      {
        workspaceId,
        accountId: account.id,
        postedAt: new Date(today.getFullYear(), today.getMonth(), 1),
        amountMinor: 300_000,
        currency: "USD",
        description: "Salary",
        category: "income",
      },
      {
        workspaceId,
        accountId: account.id,
        postedAt: new Date(today.getFullYear(), today.getMonth(), 3),
        amountMinor: -100_000,
        currency: "USD",
        description: "Rent",
        category: "housing",
      },
      {
        workspaceId,
        accountId: account.id,
        postedAt: new Date(today.getFullYear(), today.getMonth(), 5),
        amountMinor: -12_000,
        currency: "USD",
        description: "Dinner out",
        category: "dining",
      },
      {
        workspaceId,
        accountId: account.id,
        postedAt: new Date(today.getFullYear(), today.getMonth(), 7),
        amountMinor: -8_000,
        currency: "USD",
        description: "Groceries",
        category: "groceries",
      },
    ],
  });

  await prisma.holding.create({
    data: {
      workspaceId,
      accountId: account.id,
      symbol: "AAPL",
      name: "Apple Inc.",
      quantity: 10,
      costBasisMinor: 15000,
      currentPriceMinor: 18000,
      currency: "USD",
      assetClass: "equity",
    },
  });

  await prisma.categoryBudget.create({
    data: { workspaceId, category: "dining", limitMinor: 10_000, currency: "USD" },
  });

  await prisma.$disconnect();
}
