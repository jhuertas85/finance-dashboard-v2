# Investment Analysis — Run & Update Dashboard

You are acting as a senior portfolio analyst with full internet access. Run a comprehensive, independent analysis of every position in the portfolio and update the dashboard. Complete all steps autonomously — no questions, no confirmations.

---

## Step 1 — Read the portfolio

Read `src/Investments.jsx` and extract every entry in the `SEED.positions` array (active positions only — not `closedPositions`). Note each position's `id`, `ticker`, `price`, `costPerShare`, `currency`, `shares`, `status`, `addLevels`, `trimLevels`, `notes`.

---

## Step 2 — Deep financial research (mandatory, no exceptions)

For EVERY active ticker — AMD, NVDA, AVGO, META, AMZN, NOW, CAKE, CSPX, SOL, ETH, SHIB, DHER, TALABAT — you MUST use WebSearch to gather current information. Never rely on training knowledge alone. Use your judgment as a financial analyst to decide what to search for, but at a minimum cover every angle that would inform a buy/hold/sell decision:

- **Price & valuation** — current price, P/E, forward multiples, fair value estimates
- **Analyst consensus** — Wall St ratings, price targets, recent upgrades/downgrades, target range (low/avg/high)
- **Earnings & fundamentals** — latest earnings beat/miss, revenue growth, margins, guidance, next earnings date
- **Catalysts & news** — product launches, M&A activity, partnerships, regulatory developments, macro factors
- **Sector & competition** — industry tailwinds/headwinds, competitive positioning vs peers, market share trends
- **Technicals & sentiment** — key support/resistance levels, institutional flows, short interest, options activity
- **Community & forums** — what retail and professional investors are saying, notable bull/bear theses
- **For crypto specifically** — on-chain metrics, network activity, tokenomics, ecosystem developments, regulatory news, fear/greed index, cycle positioning

Search for anything else you believe is relevant that a thorough analyst would consider. More information leads to better recommendations.

Run searches in parallel where possible to save time.

---

## Step 3 — Form an independent view on each position

With all research gathered, think like a portfolio manager who owns these positions. For each ticker produce:

**`status`** — your honest assessment:
- `ACCUMULATE` — compelling upside, below or near cost, strong buy by analysts, or great risk/reward entry
- `HOLD` — fairly valued, no urgent action, let it run
- `WATCH` — speculative, event-driven, heavily underwater, employer/grant stock, or needs monitoring
- `TRIM` — stretched valuation, at/above consensus target, reduce exposure

**`addLevels`** — where you would add if price drops. Base on analyst support levels, technical floors, cost-basis proximity, or valuation re-entry points. Amounts: `'$800'`–`'$1,500'` for stocks, `'DCA'` for crypto. Empty array if there is genuinely no add case.

**`trimLevels`** — where you would reduce. Base on analyst consensus targets, technical resistance, round numbers, or overvaluation signals. Action: `'sell 3 sh'`, `'trim 2 sh'`, `'partial exit'`, `'break-even exit'`, etc. Empty if no trim case.

**`notes`** — one punchy line (max 120 chars) summarising the thesis, key risk, distance to target, or catalyst. Use ` · ` as separator. Be specific — include numbers where relevant.

---

## Step 4 — Update the code

Edit `src/Investments.jsx`. In the `SEED.positions` array update **only**: `status`, `addLevels`, `trimLevels`, `notes`.

**Never touch**: `id`, `ticker`, `name`, `platform`, `type`, `shares`, `price`, `costPerShare`, `currency`, `isGrant`, `isEmployerStock`.

Also update `SEED.config.analysisDate` to the current date/time as an ISO string.

---

## Step 5 — Commit and push

```
git add src/Investments.jsx
git commit -m "Investment analysis update — {DATE}"
git push -u origin master
```

---

## Step 6 — Report to the user

Show a summary table after pushing:

| Ticker | Old Status | New Status | Key finding |
|--------|-----------|------------|-------------|
| ...    | ...       | ...        | ...         |

Flag any major changes (status flipped, levels moved significantly, important catalyst found). Be direct — if something looks risky or exciting, say so.
