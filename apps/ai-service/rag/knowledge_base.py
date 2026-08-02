"""Curated financial-education content (architecture.md §13.3) — budgeting
frameworks, investment-risk concepts, and glossary terms. Small and static
by design: this is reference material an editor curates, not user data, so
it's a plain Python list rather than something admin-editable in v1.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class KnowledgeArticle:
    slug: str
    title: str
    content: str


ARTICLES: list[KnowledgeArticle] = [
    KnowledgeArticle(
        slug="emergency-fund",
        title="What is an emergency fund?",
        content=(
            "An emergency fund is cash set aside to cover unexpected expenses — a job loss, "
            "medical bill, or urgent repair — without going into debt. A common guideline is "
            "3 to 6 months of essential expenses (housing, food, utilities, insurance), kept "
            "somewhere accessible like a savings account rather than invested in the market, "
            "since it needs to be available on short notice, not growing at the cost of risk."
        ),
    ),
    KnowledgeArticle(
        slug="50-30-20-rule",
        title="The 50/30/20 budgeting rule",
        content=(
            "The 50/30/20 rule is a simple framework for splitting after-tax income: 50% to "
            "needs (housing, groceries, utilities, minimum debt payments), 30% to wants "
            "(dining out, entertainment, subscriptions), and 20% to savings and extra debt "
            "paydown. It's a starting point, not a hard rule — someone with high housing costs "
            "or aggressive debt-payoff goals will reasonably deviate from the exact split."
        ),
    ),
    KnowledgeArticle(
        slug="diversification",
        title="What is diversification?",
        content=(
            "Diversification means spreading investments across different assets — asset "
            "classes (stocks, bonds, cash), sectors, and geographies — so that a decline in any "
            "one holding doesn't sink the whole portfolio. It doesn't eliminate risk, but it "
            "reduces the impact of any single company or sector underperforming. A portfolio "
            "concentrated in one stock or one sector carries more risk than one spread across many."
        ),
    ),
    KnowledgeArticle(
        slug="risk-tolerance",
        title="Understanding investment risk and risk tolerance",
        content=(
            "Investment risk is the chance an asset's value moves against you, including losing "
            "money. Riskier assets (like individual stocks or crypto) tend to have higher "
            "potential returns but larger swings; safer assets (like cash or government bonds) "
            "have lower expected returns but far less volatility. Risk tolerance is how much of "
            "that swing someone can handle financially and emotionally — it depends on time "
            "horizon, income stability, and other savings, not just appetite for growth."
        ),
    ),
    KnowledgeArticle(
        slug="compound-interest",
        title="How compound interest works",
        content=(
            "Compound interest is interest earned on both the original principal and on "
            "previously earned interest, so growth accelerates over time rather than staying "
            "flat. The same effect works in reverse for debt: unpaid interest gets added to the "
            "balance and starts earning its own interest. The earlier money is invested (or debt "
            "is paid down), the more time compounding has to work, which is why time in the "
            "market tends to matter more than trying to time it."
        ),
    ),
    KnowledgeArticle(
        slug="debt-snowball-vs-avalanche",
        title="Debt snowball vs. debt avalanche",
        content=(
            "Both are strategies for paying off multiple debts while making minimum payments on "
            "all of them. The snowball method pays off the smallest balance first, for quick "
            "psychological wins that build momentum. The avalanche method pays off the "
            "highest-interest-rate debt first, which minimizes total interest paid over time. "
            "Avalanche saves more money mathematically; snowball is often easier to stick with."
        ),
    ),
    KnowledgeArticle(
        slug="index-funds-vs-individual-stocks",
        title="Index funds vs. individual stocks",
        content=(
            "An index fund holds many companies at once, tracking a market index like the S&P "
            "500, so its performance mirrors the broad market rather than any single company. "
            "Buying individual stocks concentrates risk in specific companies — potential for "
            "higher returns if you pick well, but also higher risk if you don't. Index funds are "
            "generally lower-cost and lower-effort, which is why they're a common default for "
            "long-term, hands-off investing."
        ),
    ),
    KnowledgeArticle(
        slug="dollar-cost-averaging",
        title="What is dollar-cost averaging?",
        content=(
            "Dollar-cost averaging means investing a fixed amount at regular intervals (e.g. "
            "monthly) regardless of the asset's price, rather than investing a lump sum all at "
            "once. It buys more shares when prices are low and fewer when prices are high, "
            "smoothing out the average purchase price over time and reducing the risk of "
            "investing everything right before a downturn — at the cost of potentially lower "
            "returns than a lump sum in a rising market."
        ),
    ),
    KnowledgeArticle(
        slug="net-worth",
        title="What is net worth?",
        content=(
            "Net worth is total assets (cash, investments, property, anything of value) minus "
            "total liabilities (debts and other obligations). It's a single snapshot number for "
            "overall financial position — unlike income, which measures cash flow, net worth "
            "measures accumulated wealth. Tracking it over time shows whether savings and "
            "investments are outpacing debt, independent of any single month's spending."
        ),
    ),
    KnowledgeArticle(
        slug="expense-ratio",
        title="What is an expense ratio?",
        content=(
            "An expense ratio is the annual fee a fund charges, expressed as a percentage of "
            "assets invested — for example, a 0.5% expense ratio costs $5/year per $1,000 "
            "invested. It's deducted automatically from the fund's returns, so it directly "
            "reduces what an investor keeps. Small differences compound significantly over "
            "decades, which is why cost is one of the first things to compare between similar "
            "funds."
        ),
    ),
]
