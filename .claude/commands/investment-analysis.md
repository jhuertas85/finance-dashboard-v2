# Investment Analysis — Run & Update Dashboard

You are running a full investment analysis on the user's portfolio. Follow every step below without asking for confirmation. Do not skip web searches — they are mandatory.

## Step 1 — Read current positions

Read `src/Investments.jsx` and extract every entry in the `SEED.positions` array (the active ones, not the `closedPositions` array). Note each position's: `id`, `ticker`, `price`, `costPerShare`, `currency`, `shares`, `status`, `addLevels`, `trimLevels`, `notes`.

## Step 2 — Web search for EVERY position (mandatory)

For each active position run at minimum these searches. You MUST use the WebSearch tool — never skip this step or rely only on training knowledge.

For stocks (STK/ETF):
- `"{TICKER} stock price analyst target forecast {CURRENT_MONTH} {CURRENT_YEAR}"`
- `"{TICKER} stock news {CURRENT_MONTH} {CURRENT_YEAR}"`

For crypto (CRY):
- `"{TICKER} crypto price prediction analyst {CURRENT_MONTH} {CURRENT_YEAR}"`

Tickers to cover: AMD, NVDA, AVGO, META, AMZN, NOW, CAKE, CSPX, SOL, ETH, SHIB, DHER, TALABAT

Run searches in parallel where possible to save time.

## Step 3 — Analyse each position

Using the web data + the position's current P&L, determine for each position:

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
