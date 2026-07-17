# Investment Analysis — Run & Update Dashboard

You are running a full investment analysis on the user's portfolio. Follow every step below without asking for confirmation. Do not skip web searches — they are mandatory.

## Step 1 — Read current positions

Read `src/Investments.jsx` and extract every entry in the `SEED.positions` array (the active ones, not the `closedPositions` array). Note each position's: `id`, `ticker`, `price`, `costPerShare`, `currency`, `shares`, `status`, `addLevels`, `trimLevels`, `notes`.

## Step 2 — Web search for EVERY position (mandatory)

You MUST use the WebSearch tool for every position. Never rely solely on training knowledge — always get current online data. Run searches in parallel where possible.

For each **stock / ETF** ticker, run ALL of the following:
1. `"{TICKER} stock price today {CURRENT_MONTH} {CURRENT_YEAR}"` — current price
2. `"{TICKER} analyst price target consensus {CURRENT_MONTH} {CURRENT_YEAR}"` — Wall St consensus, upgrades/downgrades, price target range
3. `"{TICKER} earnings results forecast {CURRENT_YEAR}"` — latest earnings beat/miss, next earnings date, revenue/EPS trajectory
4. `"{TICKER} news catalyst {CURRENT_MONTH} {CURRENT_YEAR}"` — recent news, product launches, M&A, macro events affecting the stock
5. `"{TICKER} stock outlook sector trend {CURRENT_YEAR}"` — sector tailwinds/headwinds, competitive positioning, institutional sentiment

For each **crypto** ticker, run ALL of the following:
1. `"{TICKER} crypto price {CURRENT_MONTH} {CURRENT_YEAR}"` — current price
2. `"{TICKER} price prediction analyst target {CURRENT_YEAR}"` — analyst/fund targets, on-chain metrics
3. `"{TICKER} crypto news catalyst {CURRENT_MONTH} {CURRENT_YEAR}"` — network upgrades, regulatory news, adoption news
4. `"{TICKER} crypto market sentiment {CURRENT_MONTH} {CURRENT_YEAR}"` — fear/greed, community sentiment, trending narrative

Tickers to cover: AMD, NVDA, AVGO, META, AMZN, NOW, CAKE, CSPX, SOL, ETH, SHIB, DHER, TALABAT

## Step 3 — Analyse each position

Using ALL web data gathered — current price, analyst consensus, earnings trajectory, recent news/catalysts, sector trends, competitive positioning, community sentiment, technical levels, and the position's current P&L vs cost basis — determine for each position:

**`status`** — one of:
- `ACCUMULATE` — meaningful upside to consensus, near/below cost, or strong buy by analysts
- `HOLD` — at fair value, in profit, no urgent action
- `WATCH` — speculative, event-driven, heavily underwater, or employer/grant stock
- `TRIM` — at or above analyst consensus target, reduce exposure

**`addLevels`** — array of `{ price, amount }`. Set realistic dip levels where adding makes sense (use analyst support levels, % below current, or cost-basis area). Use `'$800'`–`'$1,500'` amounts or `'DCA'` for crypto. Empty array if no add case exists.

**`trimLevels`** — array of `{ price, action }`. Set at or near analyst consensus targets, round numbers, or technical resistance. Action strings like `'sell 3 sh'`, `'trim 2 sh'`, `'partial exit'`, `'break-even exit'`. Empty if no trim case.

**`notes`** — one concise line (max 120 chars) capturing: key thesis, distance to consensus, catalyst, or risk. Use ` · ` as separator. Examples:
- `"Dominant AI infra · Blackwell ramp · 44% to consensus $305 · add on weakness"`
- `"Uber takeover bid €41.50 · hold to deal close · pure grant profit"`

## Step 4 — Update the code

Edit `src/Investments.jsx`. In the `SEED.positions` array, update **only these fields** for each position: `status`, `addLevels`, `trimLevels`, `notes`. Do NOT change: `id`, `ticker`, `name`, `platform`, `type`, `shares`, `price`, `costPerShare`, `currency`, `isGrant`, `isEmployerStock`.

Also update the `analysisDate` in `SEED.config` to the current date/time ISO string.

## Step 5 — Commit and push

```
git add src/Investments.jsx
git commit -m "Investment analysis update — {DATE}"
git push -u origin master
```

## Step 6 — Report

After pushing, show the user a brief summary table:

| Ticker | Status | Key note |
|--------|--------|----------|
| ...    | ...    | ...      |

Note any positions where the analysis changed significantly from the previous run (status change, major level shift).

---

**Rules:**
- Web search is non-negotiable — always run it before forming any view
- Never ask the user questions during the run — complete it autonomously
- Never modify shares, price, costPerShare — those are trade data owned by Firestore
- Always push to `master` at the end
