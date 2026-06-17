import React, { useState, useMemo, useRef } from 'react';
import {
  XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ComposedChart, Area, Bar, Line,
  ReferenceLine, Cell,
} from 'recharts';
import {
  calculateNetWorth,
  getCategoryEmoji,
  getDayProgress,
  toAED,
  formatDate,
} from './utils.js';
import PayCreditModal from './PayCreditModal.jsx';

const CATEGORIES = ['Investments', 'Housing', 'Subs, Sports & Health', 'Food & Groceries', 'Car', 'Going Out', 'Purchases', 'Travel', 'Others'];

function getMonthLabel(year, month) {
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

// Returns expense total filtered to a month
function calcSpending(transactions, month, year) {
  return transactions.filter(tx => {
    const d = new Date(tx.date);
    return d.getMonth() === month - 1 && d.getFullYear() === year && tx.type === 'expense';
  }).reduce((sum, tx) => sum + toAED(tx.amount, tx.currency), 0);
}

function calcByCategory(transactions, month, year) {
  const out = {};
  transactions.filter(tx => {
    const d = new Date(tx.date);
    return d.getMonth() === month - 1 && d.getFullYear() === year && tx.type === 'expense';
  }).forEach(tx => {
    out[tx.category] = (out[tx.category] || 0) + toAED(tx.amount, tx.currency);
  });
  return out;
}

function spendBarColor(pct) {
  if (pct > 85) return '#ef4444';
  if (pct > 50) return '#f59e0b';
  return '#10b981';
}

export default function Dashboard({ accounts, transactions, budgets, recurringBills = [], selectedCurrency = 'AED', onReviewBills }) {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1);
  const [viewMode, setViewMode] = useState('month');   // 'month' | 'ytd' | 'year'
  const [displayMode, setDisplayMode] = useState('budget'); // 'budget' | 'absolute'
  const [payingCard, setPayingCard] = useState(null);
  const [txFilter, setTxFilter] = useState(null);
  const [wealthRange, setWealthRange] = useState('12M');
  const spendingDetailRef = useRef(null);
  const txSectionRef = useRef(null);

  const dayProgress = getDayProgress();

  // ─── Period navigation ───────────────────────────────────────────────────────
  function prevPeriod() {
    if (viewMode === 'month') {
      if (viewMonth === 1) { setViewYear(y => y - 1); setViewMonth(12); }
      else setViewMonth(m => m - 1);
    } else {
      setViewYear(y => y - 1);
    }
  }
  function nextPeriod() {
    if (viewMode === 'month') {
      const atCurrent = viewYear === now.getFullYear() && viewMonth >= now.getMonth() + 1;
      if (atCurrent) return;
      if (viewMonth === 12) { setViewYear(y => y + 1); setViewMonth(1); }
      else setViewMonth(m => m + 1);
    } else {
      if (viewYear >= now.getFullYear()) return;
      setViewYear(y => y + 1);
    }
  }
  const isLatestPeriod = viewMode === 'month'
    ? viewYear === now.getFullYear() && viewMonth === now.getMonth() + 1
    : viewYear >= now.getFullYear();

  // ─── Currency display helpers ────────────────────────────────────────────────
  const FX_DISPLAY = { AED: 1, USD: 3.67, EUR: 4.0, PEN: 0.95 };
  const displayRate = FX_DISPLAY[selectedCurrency] || 1;
  const fmt = (aed) => {
    if (aed == null || isNaN(aed)) return '—';
    return `${selectedCurrency} ${Math.round(aed / displayRate).toLocaleString()}`;
  };
  const fmtFull = (aed) => {
    if (aed == null || isNaN(aed)) return '—';
    return `${selectedCurrency} ${(aed / displayRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };
  const fmtS = (aed) => {
    if (aed == null || isNaN(aed)) return '—';
    const v = aed / displayRate;
    const abs = Math.abs(v);
    if (abs >= 1e6) return (v < 0 ? '-' : '') + (abs / 1e6).toFixed(1) + 'M';
    if (abs >= 1e3) return (v < 0 ? '-' : '') + (abs / 1e3).toFixed(1) + 'K';
    return (v < 0 ? '-' : '') + Math.round(abs);
  };
  const fmtAccFull = (balance, currency) => fmtFull(toAED(balance, currency));

  // ─── Net worth & account groups ─────────────────────────────────────────────
  const netWorth = calculateNetWorth(accounts);

  const capitalAccounts = accounts
    .filter(a => a.netWorthBucket === 'capital')
    .sort((a, b) => toAED(b.currentBalance, b.currency) - toAED(a.currentBalance, a.currency));
  const capitalTotal = capitalAccounts.reduce((s, a) => s + toAED(a.currentBalance, a.currency), 0);

  const usableAccounts = accounts
    .filter(a => a.netWorthBucket === 'usable')
    .sort((a, b) => toAED(b.currentBalance, b.currency) - toAED(a.currentBalance, a.currency));
  const usableTotal = usableAccounts.reduce((s, a) => s + toAED(a.currentBalance, a.currency), 0);

  const futureAssetAccounts = accounts
    .filter(a => a.netWorthBucket === 'future' && a.kind === 'asset')
    .sort((a, b) => toAED(b.currentBalance, b.currency) - toAED(a.currentBalance, a.currency));
  const futureAssetsTotal = futureAssetAccounts.reduce((s, a) => s + toAED(a.currentBalance, a.currency), 0);

  const futureLiabilityAccounts = accounts
    .filter(a =>
      (a.netWorthBucket === 'future' && a.kind === 'liability') ||
      (a.netWorthBucket === 'debt' && !a.name.toLowerCase().includes('credit'))
    )
    .sort((a, b) => Math.abs(toAED(b.currentBalance, b.currency)) - Math.abs(toAED(a.currentBalance, a.currency)));
  const futureLiabilitiesTotal = futureLiabilityAccounts.reduce((s, a) => s + Math.abs(toAED(a.currentBalance, a.currency)), 0);

  const creditCardAccounts = accounts
    .filter(a => a.netWorthBucket === 'debt' && a.name.toLowerCase().includes('credit'))
    .sort((a, b) => toAED(a.currentBalance, a.currency) - toAED(b.currentBalance, b.currency));
  const creditCardTotal = creditCardAccounts.reduce((s, a) => s + toAED(a.currentBalance, a.currency), 0);

  // ─── Monthly spending for top KPI card & budget table ───────────────────────
  const monthlySpending = calcSpending(transactions, viewMonth, viewYear);
  const spendingByCategory = calcByCategory(transactions, viewMonth, viewYear);

  // Monthly budget map
  const budgetMap = {};
  budgets.forEach(b => { if (!b.month) budgetMap[b.category] = b.monthlyLimit; });
  budgets.forEach(b => {
    if (b.month && parseInt(b.month) === viewMonth && parseInt(b.year) === viewYear)
      budgetMap[b.category] = b.monthlyLimit;
  });
  const totalMonthlyBudget = Object.values(budgetMap).reduce((a, b) => a + b, 0);
  const spentPct = totalMonthlyBudget > 0 ? (monthlySpending / totalMonthlyBudget) * 100 : 0;

  // ─── Period-specific calculations for Spending Detail ────────────────────────
  // How many months does this period cover?
  const periodMonths = viewMode === 'month' ? 1
    : viewMode === 'ytd' ? (viewYear === now.getFullYear() ? now.getMonth() + 1 : 12)
    : 12;

  // Which transactions fall in this period?
  const periodTxFilter = (tx) => {
    const d = new Date(tx.date);
    const y = d.getFullYear(), m = d.getMonth() + 1;
    if (viewMode === 'month') return y === viewYear && m === viewMonth;
    if (viewMode === 'ytd') return y === viewYear && m <= periodMonths;
    return y === viewYear;
  };

  const periodIncome = transactions
    .filter(tx => tx.type === 'income' && periodTxFilter(tx))
    .reduce((s, tx) => s + toAED(tx.amount, tx.currency), 0);
  const periodExpenses = transactions
    .filter(tx => tx.type === 'expense' && periodTxFilter(tx))
    .reduce((s, tx) => s + toAED(tx.amount, tx.currency), 0);
  const periodSavings = periodIncome - periodExpenses;
  const periodBudget = totalMonthlyBudget * periodMonths;

  // Per-category spending for this period
  const periodByCat = {};
  transactions.filter(tx => tx.type === 'expense' && periodTxFilter(tx)).forEach(tx => {
    periodByCat[tx.category] = (periodByCat[tx.category] || 0) + toAED(tx.amount, tx.currency);
  });

  // Per-category budget scaled to period
  const periodBudgetCat = {};
  Object.entries(budgetMap).forEach(([cat, v]) => { periodBudgetCat[cat] = v * periodMonths; });

  // Pace % for the current period (how far through it are we?)
  const rawPacePct = (() => {
    if (viewYear < now.getFullYear()) return 100; // past year: 100%
    if (viewMode === 'month') return dayProgress.pct;
    // YTD / Year: fraction of year elapsed (month-accurate)
    const monthsDone = now.getMonth(); // 0-based complete months
    const dayFrac = now.getDate() / new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return ((monthsDone + dayFrac) / 12) * 100;
  })();

  // For YTD, pace is relative to the budget period (periodMonths months), not the full year
  const pacePct = viewMode === 'ytd'
    ? Math.min(rawPacePct / (periodMonths / 12) / 100 * periodMonths / 12 * 100, 100)
    : rawPacePct;
  // Simpler: pace % = how far through the period length we are
  const periodPacePct = viewMode === 'month'
    ? dayProgress.pct
    : viewYear < now.getFullYear()
      ? 100
      : Math.min(((now.getMonth() + now.getDate() / new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()) / periodMonths) * 100, 100);

  // Period label for navigation
  const periodLabel = viewMode === 'month'
    ? getMonthLabel(viewYear, viewMonth)
    : viewMode === 'ytd'
      ? `YTD ${viewYear}`
      : String(viewYear);

  // Build category data for period spending detail
  const periodSpendingData = CATEGORIES
    .map(cat => ({
      category: cat,
      spent: periodByCat[cat] || 0,
      budget: periodBudgetCat[cat] || 0,
      pct: periodBudgetCat[cat] > 0 ? ((periodByCat[cat] || 0) / periodBudgetCat[cat]) * 100 : 0,
    }))
    .filter(d => d.spent > 0 || d.budget > 0);

  // Sort based on displayMode
  const sortedPeriodData = [...periodSpendingData].sort((a, b) =>
    displayMode === 'budget'
      ? (b.budget > 0 ? b.pct : -1) - (a.budget > 0 ? a.pct : -1)
      : b.spent - a.spent
  );

  const maxPeriodSpent = Math.max(...periodSpendingData.map(d => d.spent), 1);
  const totalPct = periodBudget > 0 ? (periodExpenses / periodBudget) * 100 : 0;
  const annualSavings = 177691;

  // ─── Charts ──────────────────────────────────────────────────────────────────
  const monthlyFlowData = useMemo(() => {
    const CHART_YEAR = 2026;
    const dataMap = {};
    for (let m = 1; m <= 12; m++) {
      const key = `${CHART_YEAR}-${String(m).padStart(2, '0')}`;
      dataMap[key] = { key, month: m, income: 0, expenses: 0 };
    }
    transactions.forEach(tx => {
      const d = new Date(tx.date);
      if (d.getFullYear() !== CHART_YEAR) return;
      const key = `${CHART_YEAR}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!dataMap[key]) return;
      const amt = toAED(tx.amount, tx.currency);
      if (tx.type === 'expense') dataMap[key].expenses += amt;
      else if (tx.type === 'income') dataMap[key].income += amt;
    });
    const currentKey = now.getFullYear() === CHART_YEAR
      ? `${CHART_YEAR}-${String(now.getMonth() + 1).padStart(2, '0')}`
      : now.getFullYear() < CHART_YEAR ? `${CHART_YEAR}-01` : `${CHART_YEAR}-12`;
    const pastKeys = Object.keys(dataMap).filter(k => k < currentKey);
    const incomeMonths = pastKeys.filter(k => dataMap[k].income > 0);
    const expMonths = pastKeys.filter(k => dataMap[k].expenses > 0);
    const estIncome = incomeMonths.length > 0
      ? incomeMonths.reduce((s, k) => s + dataMap[k].income, 0) / incomeMonths.length : 0;
    const estExpenses = expMonths.length > 0
      ? expMonths.reduce((s, k) => s + dataMap[k].expenses, 0) / expMonths.length : 0;
    function getMonthBudget(m) {
      const map = {};
      budgets.forEach(b => { if (!b.month) map[b.category] = b.monthlyLimit; });
      budgets.forEach(b => {
        if (b.month && parseInt(b.month) === m && parseInt(b.year) === CHART_YEAR)
          map[b.category] = b.monthlyLimit;
      });
      return Object.values(map).reduce((a, v) => a + v, 0);
    }
    return Object.values(dataMap).map(({ key, month: m, income, expenses }) => {
      const isCurrent = key === currentKey;
      const isFuture = key > currentKey;
      const inc = isFuture ? estIncome : income;
      const exp = isFuture ? estExpenses : expenses;
      return {
        key, month: m, income: inc, expenses: exp,
        budget: getMonthBudget(m),
        savings: inc - exp,
        isFuture, isCurrent,
        label: new Date(key + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      };
    });
  }, [transactions, budgets]);

  const wealthData = useMemo(() => {
    const makeKey = (y, m) => `${y}-${String(m).padStart(2, '0')}`;
    const nowKey = makeKey(now.getFullYear(), now.getMonth() + 1);

    // Monthly net cash flows (income – expenses) from real transactions
    const monthFlows = {};
    transactions.forEach(tx => {
      const d = new Date(tx.date);
      const key = makeKey(d.getFullYear(), d.getMonth() + 1);
      if (!monthFlows[key]) monthFlows[key] = 0;
      const amt = toAED(tx.amount, tx.currency);
      if (tx.type === 'income') monthFlows[key] += amt;
      else if (tx.type === 'expense') monthFlows[key] -= amt;
    });

    // Estimate monthly savings from past 2026 months with positive net flow
    const past2026 = Object.keys(monthFlows).filter(k => k.startsWith('2026-') && k < nowKey);
    const posFlows = past2026.filter(k => monthFlows[k] > 0);
    const estSavings = posFlows.length > 0
      ? posFlows.reduce((s, k) => s + monthFlows[k], 0) / posFlows.length : 0;

    // Determine start key from range
    let startKey;
    const projEndYear = Math.max(now.getFullYear(), 2026);
    if (wealthRange === 'YTD') {
      startKey = makeKey(now.getFullYear(), 1);
    } else if (wealthRange === 'ALL') {
      const allKeys = Object.keys(monthFlows).sort();
      startKey = allKeys[0] || makeKey(now.getFullYear() - 1, now.getMonth() + 1);
    } else {
      const back = wealthRange === '6M' ? 5 : wealthRange === '12M' ? 11 : 23;
      const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
      startKey = makeKey(d.getFullYear(), d.getMonth() + 1);
    }
    const endKey = makeKey(projEndYear, 12);

    // Build month list from startKey to endKey
    const months = [];
    let [sy, sm] = startKey.split('-').map(Number);
    const [ey, em] = endKey.split('-').map(Number);
    while (sy < ey || (sy === ey && sm <= em)) {
      months.push(makeKey(sy, sm));
      if (++sm > 12) { sm = 1; sy++; }
    }

    // Reconstruct historical capital by walking backwards from current
    const capByKey = {};
    const histMonths = months.filter(k => k <= nowKey).sort();
    let cap = capitalTotal;
    for (let i = histMonths.length - 1; i >= 0; i--) {
      capByKey[histMonths[i]] = Math.round(cap);
      if (i > 0) cap -= (monthFlows[histMonths[i]] || 0);
    }
    // Project capital forward using estimated savings
    cap = capitalTotal;
    for (const key of months.filter(k => k > nowKey).sort()) {
      cap += estSavings;
      capByKey[key] = Math.round(cap);
    }

    const futNet = futureAssetsTotal - futureLiabilitiesTotal;
    const u = Math.round(usableTotal);
    const f = Math.round(futNet);

    return months.map(key => {
      const isFuture = key > nowKey;
      const isCurrent = key === nowKey;
      const isHist = !isFuture;
      const isProj = isFuture || isCurrent;
      const c = capByKey[key] ?? Math.round(capitalTotal);
      const nw = c + u + f;
      const label = new Date(key + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      return {
        key, label, isFuture, isCurrent,
        // Historical stacked areas (solid)
        CapHist: isHist ? c : undefined,
        UsableHist: isHist ? u : undefined,
        FutHist: isHist ? f : undefined,
        NWHist: isHist ? nw : undefined,
        // Projected boundary lines (dashed) — top edge of each stacked band
        CapPB: isProj ? c : undefined,
        CapUsablePB: isProj ? (c + u) : undefined,
        NWProj: isProj ? nw : undefined,
      };
    });
  }, [transactions, capitalTotal, usableTotal, futureAssetsTotal, futureLiabilitiesTotal, wealthRange]);

  // ─── Recurring bills alerts ──────────────────────────────────────────────────
  const recurringBillsData = recurringBills.map(bill => ({
    ...bill,
    daysUntilDue: bill.dueDate
      ? Math.ceil((new Date(bill.dueDate) - now) / 86400000)
      : (bill.dueDay ? bill.dueDay - now.getDate() : null),
  }));
  const overdueBills = recurringBillsData.filter(b => b.daysUntilDue != null && b.daysUntilDue < 0);
  const dueSoonBills = recurringBillsData.filter(b => b.daysUntilDue != null && b.daysUntilDue >= 0 && b.daysUntilDue <= 7);

  function handleMonthClick(data) {
    if (!data || data.isFuture) return;
    setViewMode('month');
    setViewMonth(data.month);
    setViewYear(2026);
    setTimeout(() => spendingDetailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  function openTxFilter(filter) {
    setTxFilter(filter);
    setTimeout(() => txSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  const displayedTxs = useMemo(() => {
    if (!txFilter) {
      return transactions
        .filter(t => t.type === 'expense')
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 20);
    }
    const ytdMonths = txFilter.year === now.getFullYear() ? now.getMonth() + 1 : 12;
    return transactions.filter(tx => {
      const d = new Date(tx.date);
      const y = d.getFullYear(), m = d.getMonth() + 1;
      if (txFilter.mode === 'month') {
        if (y !== txFilter.year || m !== txFilter.month) return false;
      } else if (txFilter.mode === 'ytd') {
        if (y !== txFilter.year || m > ytdMonths) return false;
      } else {
        if (y !== txFilter.year) return false;
      }
      if (txFilter.type && tx.type !== txFilter.type) return false;
      if (txFilter.category && tx.category !== txFilter.category) return false;
      return true;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [transactions, txFilter]);

  const cardsWithPending = creditCardAccounts.filter(acc =>
    transactions.some(tx =>
      (tx.fromAccount === acc.id || tx.fromAccount === acc.name) && tx.reconciled === false
    )
  );

  return (
    <div className="space-y-6 pb-12">

      {/* Alert Banner */}
      {(overdueBills.length > 0 || dueSoonBills.length > 0) && (
        <div className={`rounded-2xl px-5 py-4 border flex items-center justify-between gap-4 ${
          overdueBills.length > 0 ? 'bg-red-950/30 border-red-800' : 'bg-amber-950/30 border-amber-800'
        }`}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔔</span>
            <div>
              <p className={`font-bold text-sm ${overdueBills.length > 0 ? 'text-red-400' : 'text-amber-400'}`}>
                {overdueBills.length > 0 && `${overdueBills.length} bill${overdueBills.length !== 1 ? 's' : ''} overdue`}
                {overdueBills.length > 0 && dueSoonBills.length > 0 && ' · '}
                {dueSoonBills.length > 0 && `${dueSoonBills.length} due soon`}
              </p>
              <p className="text-gray-500 text-xs mt-0.5">Open Add Transaction → Recurring Bills to review and pay</p>
            </div>
          </div>
          <button onClick={onReviewBills} className={`shrink-0 px-4 py-2 rounded-xl text-xs font-semibold border transition ${
            overdueBills.length > 0 ? 'border-red-700 text-red-400 hover:bg-red-900/30' : 'border-amber-700 text-amber-400 hover:bg-amber-900/30'
          }`}>📋 Review Bills →</button>
        </div>
      )}

      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase text-gray-500">NET WORTH</span>
            <span className="text-lg">💎</span>
          </div>
          <div className="text-3xl font-bold text-white mb-1">{fmt(netWorth.total)}</div>
          <div className="text-xs text-emerald-400">+7.9% ({fmtS(netWorth.total * 0.079)}) vs last month</div>
        </div>

        <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase text-gray-500">SPENT THIS MONTH</span>
            <span className="text-lg">💸</span>
          </div>
          <div className="text-3xl font-bold text-white mb-1">{fmt(monthlySpending)}</div>
          <div className="flex items-center justify-between text-xs text-gray-500 mt-3">
            <span>of {totalMonthlyBudget > 0 ? fmt(totalMonthlyBudget) : '—'} · {totalMonthlyBudget > 0 ? `${Math.round(spentPct)}% used` : 'no budget set'}</span>
            <span>Day {dayProgress.day}/{dayProgress.daysInMonth}</span>
          </div>
          <div className="relative w-full bg-gray-800 rounded-full h-2 mt-2">
            {totalMonthlyBudget > 0 && (
              <div className="h-full rounded-full transition-all" style={{
                width: `${Math.min(spentPct, 100)}%`,
                backgroundColor: spentPct > 100 ? '#ef4444' : spentPct > 75 ? '#f59e0b' : '#10b981',
              }} />
            )}
            <div className="absolute top-0 bottom-0 w-0.5 rounded-full" style={{ left: `${dayProgress.pct}%`, backgroundColor: '#ffffff', opacity: 0.8 }} />
          </div>
          {totalMonthlyBudget > 0 && (
            <div className="text-xs mt-1" style={{ color: spentPct <= dayProgress.pct ? '#10b981' : '#f59e0b' }}>
              {spentPct <= dayProgress.pct ? '↓ Under pace' : '↑ Ahead of pace'} — pace at {Math.round(dayProgress.pct)}%
            </div>
          )}
        </div>

        <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase text-gray-500">ANNUAL SAVINGS TRACKER</span>
            <span className="text-lg">📅</span>
          </div>
          <div className="text-3xl font-bold text-white mb-1">{fmt(annualSavings)}</div>
          <div className="text-xs text-gray-500">Jan–May real savings</div>
          <div className="flex items-center justify-between text-xs text-gray-500 mt-3">
            <span>Projected year-end</span>
            <span className="text-emerald-400">{fmt(230171)}</span>
          </div>
          <div className="relative w-full bg-gray-800 rounded-full h-2 mt-2">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(5 / 12) * 100}%` }} />
            <div className="absolute top-0 bottom-0 w-0.5 rounded-full" style={{ left: `${(now.getMonth() / 12) * 100}%`, backgroundColor: '#ffffff', opacity: 0.7 }} />
          </div>
          <span className="text-xs text-emerald-400 mt-1 block">↑ Ahead of pace 5/12 months</span>
        </div>
      </div>

      {/* Asset Buckets — 4 columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">

        {/* Capital */}
        <div className="bg-purple-950/20 border border-purple-800/50 rounded-2xl p-5 flex flex-col">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-base bg-purple-900/50 rounded-lg p-1.5">🏦</span>
            <span className="text-xs font-bold uppercase text-gray-400">Capital</span>
          </div>
          <div className="text-2xl font-bold text-cyan-400 mb-4">{fmt(capitalTotal)}</div>
          <div className="space-y-1.5 flex-1">
            {capitalAccounts.map(acc => (
              <div key={acc.id} className="flex justify-between text-xs gap-2">
                <span className="text-gray-400 truncate">{acc.name}</span>
                <span className="text-gray-200 font-mono shrink-0">{fmtAccFull(acc.currentBalance, acc.currency)}</span>
              </div>
            ))}
          </div>
          <div className="text-xs text-gray-600 mt-4 pt-3 border-t border-purple-900/40">Liquid · immediately available</div>
        </div>

        {/* Assets — Usable */}
        <div className="bg-blue-950/20 border border-blue-800/50 rounded-2xl p-5 flex flex-col">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-base bg-blue-900/50 rounded-lg p-1.5">📊</span>
            <span className="text-xs font-bold uppercase text-gray-400">Assets — Usable</span>
          </div>
          <div className="text-2xl font-bold text-blue-400 mb-4">{fmt(usableTotal)}</div>
          <div className="space-y-1.5 flex-1">
            {usableAccounts.map(acc => (
              <div key={acc.id} className="flex justify-between text-xs gap-2">
                <span className="text-gray-400 truncate">{acc.name}</span>
                <span className="text-gray-200 font-mono shrink-0">{fmtAccFull(acc.currentBalance, acc.currency)}</span>
              </div>
            ))}
          </div>
          <div className="text-xs text-gray-600 mt-4 pt-3 border-t border-blue-900/40">Sellable within days</div>
        </div>

        {/* Assets — Future */}
        <div className="bg-neutral-950 border border-neutral-700 rounded-2xl p-5 flex flex-col">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-base bg-neutral-800 rounded-lg p-1.5">🔒</span>
            <span className="text-xs font-bold uppercase text-gray-400">Assets — Future</span>
          </div>
          <div className="text-2xl font-bold text-emerald-400 mb-1">{fmt(futureAssetsTotal - futureLiabilitiesTotal)}</div>
          <div className="text-xs text-gray-500 mb-4">gross {fmt(futureAssetsTotal)} – {fmt(futureLiabilitiesTotal)}</div>
          <div className="space-y-1.5 flex-1">
            {futureAssetAccounts.map(acc => (
              <div key={acc.id} className="flex justify-between text-xs gap-2">
                <span className="text-gray-400 truncate">{acc.name}</span>
                <span className="text-gray-200 font-mono shrink-0">{fmtAccFull(acc.currentBalance, acc.currency)}</span>
              </div>
            ))}
          </div>
          {futureLiabilityAccounts.length > 0 && (
            <div className="mt-3 pt-3 border-t border-neutral-800">
              <p className="text-xs text-gray-600 mb-1.5">Outstanding contributions:</p>
              <div className="space-y-1">
                {futureLiabilityAccounts.map(acc => (
                  <div key={acc.id} className="flex justify-between text-xs gap-2">
                    <span className="text-gray-600 truncate">{acc.name}</span>
                    <span className="text-red-500/70 font-mono shrink-0">–{fmtFull(Math.abs(toAED(acc.currentBalance, acc.currency)))}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="text-xs text-gray-600 mt-4 pt-3 border-t border-neutral-800">Locked · long-term · contributions reduce as you pay</div>
        </div>

        {/* Credit Cards */}
        <div className="bg-red-950/10 border border-red-900/40 rounded-2xl p-5 flex flex-col">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-base bg-red-900/30 rounded-lg p-1.5">💳</span>
            <span className="text-xs font-bold uppercase text-gray-400">Credit Cards</span>
          </div>
          <div className="text-2xl font-bold text-red-400 mb-4">{fmt(creditCardTotal)}</div>
          <div className="space-y-2 flex-1">
            {creditCardAccounts.map(acc => (
              <div key={acc.id} className="flex justify-between items-center text-xs gap-2">
                <span className="text-gray-400 truncate">💳 {acc.name}</span>
                <span className={acc.currentBalance < 0 ? 'text-red-400 font-mono' : 'text-emerald-400 font-mono'}>
                  {fmtAccFull(acc.currentBalance, acc.currency)}
                </span>
              </div>
            ))}
          </div>
          {cardsWithPending.length > 0 && (
            <div className="mt-4 space-y-2">
              {cardsWithPending.map(acc => {
                const pendingCount = transactions.filter(tx =>
                  (tx.fromAccount === acc.id || tx.fromAccount === acc.name) && tx.reconciled === false
                ).length;
                return (
                  <button key={acc.id} onClick={() => setPayingCard(acc)}
                    className="w-full flex items-center justify-between px-4 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-semibold transition">
                    <span>💳 Pay {acc.name}</span>
                    <span>{pendingCount} charge{pendingCount !== 1 ? 's' : ''} · {fmt(Math.abs(toAED(acc.currentBalance, acc.currency)))} →</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Spending Detail ──────────────────────────────────────────────────── */}
      <div ref={spendingDetailRef} className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6">

        {/* Header row */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h3 className="text-sm font-bold uppercase text-gray-300">Spending Detail</h3>
          <div className="flex flex-wrap items-center gap-2">

            {/* Period type toggle */}
            <div className="flex bg-neutral-800 rounded-lg p-0.5">
              {[['month', 'Month'], ['ytd', 'YTD'], ['year', 'Year']].map(([m, label]) => (
                <button key={m} onClick={() => setViewMode(m)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${viewMode === m ? 'bg-emerald-500 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
                  {label}
                </button>
              ))}
            </div>

            {/* Period navigation */}
            <button onClick={prevPeriod} className="px-2.5 py-1.5 text-gray-400 hover:text-white text-sm border border-neutral-700 rounded-lg">‹</button>
            <span className="text-xs font-semibold text-gray-300 min-w-[72px] text-center">{periodLabel}</span>
            <button onClick={nextPeriod} disabled={isLatestPeriod}
              className="px-2.5 py-1.5 text-gray-400 hover:text-white text-sm border border-neutral-700 rounded-lg disabled:opacity-30">›</button>

            {/* Display mode toggle */}
            <div className="flex bg-neutral-800 rounded-lg p-0.5">
              <button onClick={() => setDisplayMode('budget')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${displayMode === 'budget' ? 'bg-emerald-500 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
                Budget pace
              </button>
              <button onClick={() => setDisplayMode('absolute')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${displayMode === 'absolute' ? 'bg-emerald-500 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
                Absolute spend
              </button>
            </div>
          </div>
        </div>

        {/* 4 KPI boxes */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <button onClick={() => openTxFilter({ type: 'income', category: null, year: viewYear, month: viewMonth, mode: viewMode })}
            className="bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-left hover:border-emerald-700 transition">
            <div className="text-xs text-gray-500 uppercase mb-1">Income ↗</div>
            <div className="text-lg font-bold text-emerald-400">{fmt(periodIncome)}</div>
          </button>
          <button onClick={() => openTxFilter({ type: 'expense', category: null, year: viewYear, month: viewMonth, mode: viewMode })}
            className="bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-left hover:border-red-700 transition">
            <div className="text-xs text-gray-500 uppercase mb-1">Expenses ↗</div>
            <div className="text-lg font-bold text-red-400">{fmt(periodExpenses)}</div>
          </button>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3">
            <div className="text-xs text-gray-500 uppercase mb-1">Savings</div>
            <div className={`text-lg font-bold ${periodSavings >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {periodSavings < 0 ? '-' : ''}{fmt(Math.abs(periodSavings))}
            </div>
          </div>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3">
            <div className="text-xs text-gray-500 uppercase mb-1">Budget</div>
            <div className="text-lg font-bold text-purple-400">{periodBudget > 0 ? fmt(periodBudget) : '—'}</div>
          </div>
        </div>

        {/* Total vs Budget bar */}
        {periodBudget > 0 && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 mb-5">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-semibold text-gray-400">Total vs Budget</span>
              <span className="text-xs font-mono">
                <span className={totalPct > 85 ? 'text-red-400 font-bold' : 'text-white font-bold'}>{fmt(periodExpenses)}</span>
                <span className="text-gray-500"> / {fmt(periodBudget)}{'  '}</span>
                <span className={`font-bold ${totalPct > 85 ? 'text-red-400' : totalPct > 50 ? 'text-amber-400' : 'text-emerald-400'}`}>{Math.round(totalPct)}%</span>
              </span>
            </div>
            <div className="relative h-3 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{
                width: `${Math.min(totalPct, 100)}%`,
                backgroundColor: totalPct > 85 ? '#ef4444' : totalPct > 50 ? '#f59e0b' : '#10b981',
              }} />
              <div className="absolute top-0 bottom-0 w-0.5 bg-white/70 rounded-full" style={{ left: `${Math.min(periodPacePct, 99)}%` }} />
            </div>
          </div>
        )}

        {/* Category rows */}
        <div className="space-y-3">
          {sortedPeriodData.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4">No spending data for {periodLabel}</p>
          ) : sortedPeriodData.map(item => {
            const catBudgetPct = item.budget > 0 ? item.pct : 0;
            const barColor = spendBarColor(catBudgetPct);

            const catFilter = () => openTxFilter({ type: 'expense', category: item.category, year: viewYear, month: viewMonth, mode: viewMode });
            if (displayMode === 'budget') {
              const barWidth = item.budget > 0 ? Math.min(item.pct, 100) : (item.spent / maxPeriodSpent) * 100;
              return (
                <div key={item.category} onClick={catFilter} className="cursor-pointer group">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-medium text-gray-300 group-hover:text-white transition">{getCategoryEmoji(item.category)} {item.category}</span>
                    <span className="text-xs font-mono text-gray-400">
                      {fmt(item.spent)}
                      {item.budget > 0 && (
                        <span className="text-gray-600"> / {fmt(item.budget)}
                          <span className={`ml-2 font-bold ${item.pct > 85 ? 'text-red-400' : item.pct > 50 ? 'text-amber-400' : 'text-gray-400'}`}>
                            {' '}{Math.round(item.pct)}%
                          </span>
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="relative h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${barWidth}%`, backgroundColor: barColor }} />
                    {item.budget > 0 && (
                      <div className="absolute top-0 bottom-0 w-px bg-white/40" style={{ left: `${Math.min(periodPacePct, 99)}%` }} />
                    )}
                  </div>
                </div>
              );
            } else {
              const pctOfTotal = periodExpenses > 0 ? (item.spent / periodExpenses) * 100 : 0;
              const barWidth = (item.spent / maxPeriodSpent) * 100;
              return (
                <div key={item.category} onClick={catFilter} className="cursor-pointer group">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-medium text-gray-300 group-hover:text-white transition">
                      {getCategoryEmoji(item.category)} {item.category}
                      <span className="text-gray-500 ml-2">{fmt(item.spent)}</span>
                    </span>
                    <span className="text-xs text-gray-400 font-mono">{Math.round(pctOfTotal)}%</span>
                  </div>
                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${barWidth}%`, backgroundColor: barColor }} />
                  </div>
                </div>
              );
            }
          })}
        </div>

        {/* Legend */}
        {sortedPeriodData.length > 0 && (
          <div className="flex gap-5 mt-4 pt-3 border-t border-neutral-800 text-xs text-gray-500">
            <span><span className="text-emerald-400">●</span> &lt;50% budget</span>
            <span><span className="text-amber-400">●</span> 50–85% budget</span>
            <span><span className="text-red-400">●</span> &gt;85% budget</span>
          </div>
        )}
      </div>

      {/* Monthly Flow Chart */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-bold uppercase text-gray-300">Monthly Flow — 2026</h3>
          <span className="text-xs text-gray-600">Click a month to drill in · future months = estimated</span>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={monthlyFlowData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}
            onClick={e => e?.activePayload?.[0] && handleMonthClick(e.activePayload[0].payload)}>
            <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
            <XAxis dataKey="label" stroke="#555" tick={{ fontSize: 11 }} />
            <YAxis stroke="#555" tick={{ fontSize: 11 }} tickFormatter={v => fmtS(v)} />
            <Tooltip
              contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: 8 }}
              formatter={(v, name, props) => {
                const isFuture = props?.payload?.isFuture;
                return [`${fmtS(v)}${isFuture ? ' (est.)' : ''}`, name];
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {monthlyFlowData.find(d => d.isCurrent) && (
              <ReferenceLine
                x={monthlyFlowData.find(d => d.isCurrent)?.label}
                stroke="#ffffff"
                strokeDasharray="4 4"
                strokeOpacity={0.5}
                label={{ value: 'now', position: 'insideTopRight', fill: '#9ca3af', fontSize: 9 }}
              />
            )}
            <Bar dataKey="budget" name="Budget" fill="#a855f7" barSize={6} cursor="pointer">
              {monthlyFlowData.map((entry, i) => (
                <Cell key={i} fill="#a855f7" opacity={entry.isFuture ? 0.3 : 0.7} />
              ))}
            </Bar>
            <Bar dataKey="expenses" name="Expenses" fill="#ef4444" barSize={18} cursor="pointer">
              {monthlyFlowData.map((entry, i) => (
                <Cell key={i} fill="#ef4444" opacity={entry.isFuture ? 0.3 : 0.85} />
              ))}
            </Bar>
            <Bar dataKey="income" name="Income" fill="#10b981" barSize={18} cursor="pointer">
              {monthlyFlowData.map((entry, i) => (
                <Cell key={i} fill="#10b981" opacity={entry.isFuture ? 0.3 : 0.85} />
              ))}
            </Bar>
            <Line type="monotone" dataKey="savings" stroke="#f59e0b" strokeWidth={2} dot={false} name="Savings"
              strokeDasharray={monthlyFlowData.map(d => d.isFuture ? '4 4' : '0').find(Boolean) ? undefined : undefined} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Wealth Trajectory Chart */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-bold uppercase text-gray-300">Wealth Trajectory</h3>
          <div className="flex bg-neutral-800 rounded-lg p-0.5">
            {['6M', '12M', '24M', 'YTD', 'ALL'].map(r => (
              <button key={r} onClick={() => setWealthRange(r)}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${wealthRange === r ? 'bg-emerald-500 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
                {r}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={wealthData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
            <XAxis dataKey="label" stroke="#555" tick={{ fontSize: 11 }} />
            <YAxis stroke="#555" tick={{ fontSize: 11 }} tickFormatter={v => fmtS(v)} />
            <Tooltip
              contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: 8 }}
              formatter={(v, name, props) => [fmtS(v) + (props?.payload?.isFuture ? ' (est.)' : ''), name]}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {/* Historical: solid stacked areas */}
            <Area type="monotone" dataKey="CapHist" stackId="1" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.55} name="Capital" />
            <Area type="monotone" dataKey="UsableHist" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.55} name="Usable" />
            <Area type="monotone" dataKey="FutHist" stackId="1" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.55} name="Future" />
            {/* Historical NW line */}
            <Line type="monotone" dataKey="NWHist" stroke="#06b6d4" strokeWidth={2} dot={false} name="Net Worth" />
            {/* Projected dashed boundary lines (show where each stack band extends) */}
            <Line type="monotone" dataKey="CapPB" stroke="#8b5cf6" strokeWidth={1} strokeDasharray="5 5" dot={false} legendType="none" connectNulls={false} />
            <Line type="monotone" dataKey="CapUsablePB" stroke="#10b981" strokeWidth={1} strokeDasharray="5 5" dot={false} legendType="none" connectNulls={false} />
            <Line type="monotone" dataKey="NWProj" stroke="#06b6d4" strokeWidth={1.5} strokeDasharray="5 5" dot={false} legendType="none" connectNulls={false} />
            {/* Current month marker */}
            {wealthData.find(d => d.isCurrent) && (
              <ReferenceLine
                x={wealthData.find(d => d.isCurrent)?.label}
                stroke="#ffffff" strokeDasharray="4 4" strokeOpacity={0.5}
                label={{ value: 'now', position: 'insideTopRight', fill: '#9ca3af', fontSize: 9 }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Budget Overview Table (monthly) */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6">
        <h3 className="text-sm font-bold uppercase text-gray-300 mb-4">Budget Overview — {getMonthLabel(viewYear, viewMonth)}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left py-2 px-2 text-gray-500 font-medium">Category</th>
                <th className="text-right py-2 px-2 text-gray-500 font-medium">Budget</th>
                <th className="text-right py-2 px-2 text-gray-500 font-medium">Spent</th>
                <th className="text-right py-2 px-2 text-gray-500 font-medium">Left</th>
                <th className="text-right py-2 px-2 text-gray-500 font-medium">%</th>
              </tr>
            </thead>
            <tbody>
              {CATEGORIES.map(cat => {
                const budget = budgetMap[cat] || 0;
                const spent = spendingByCategory[cat] || 0;
                if (budget === 0 && spent === 0) return null;
                const remaining = budget - spent;
                const pct = budget > 0 ? (spent / budget) * 100 : null;
                return (
                  <tr key={cat} className="border-b border-gray-900 hover:bg-gray-900/30">
                    <td className="py-2 px-2 text-gray-300">{getCategoryEmoji(cat)} {cat}</td>
                    <td className="text-right py-2 px-2 font-mono text-gray-400">{budget > 0 ? fmtS(budget) : '—'}</td>
                    <td className="text-right py-2 px-2 font-mono text-white">{fmtS(spent)}</td>
                    <td className={`text-right py-2 px-2 font-mono ${remaining >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {budget > 0 ? (remaining >= 0 ? fmtS(remaining) : '-' + fmtS(Math.abs(remaining))) : '—'}
                    </td>
                    <td className="text-right py-2 px-2 text-gray-400">{pct != null ? `${Math.round(pct)}%` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transactions */}
      <div ref={txSectionRef} className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <div>
            <h3 className="text-sm font-bold uppercase text-gray-300">
              {txFilter ? 'Transactions' : 'Recent Transactions'}
            </h3>
            {txFilter && (
              <p className="text-xs text-gray-500 mt-0.5">
                {[
                  txFilter.type && txFilter.type.charAt(0).toUpperCase() + txFilter.type.slice(1),
                  txFilter.category,
                  txFilter.mode === 'month' ? getMonthLabel(txFilter.year, txFilter.month)
                    : txFilter.mode === 'ytd' ? `YTD ${txFilter.year}`
                    : String(txFilter.year),
                ].filter(Boolean).join(' · ')}
                {' '}— {displayedTxs.length} transaction{displayedTxs.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
          {txFilter && (
            <button onClick={() => setTxFilter(null)}
              className="text-xs text-gray-500 hover:text-white border border-neutral-700 rounded-lg px-3 py-1.5 transition shrink-0">
              ✕ Clear filter
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left py-2 px-2 text-gray-500 font-medium">Date</th>
                <th className="text-left py-2 px-2 text-gray-500 font-medium">Description</th>
                <th className="text-left py-2 px-2 text-gray-500 font-medium">Category</th>
                <th className="text-right py-2 px-2 text-gray-500 font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {displayedTxs.length === 0 ? (
                <tr><td colSpan={4} className="py-6 text-center text-gray-600">No transactions found</td></tr>
              ) : displayedTxs.map(tx => (
                <tr key={tx.id} className="border-b border-gray-900 hover:bg-gray-900/30">
                  <td className="py-2 px-2 text-gray-400 font-mono">{formatDate(tx.date)}</td>
                  <td className="py-2 px-2 text-gray-200">{tx.description}</td>
                  <td className="py-2 px-2 text-gray-400">{getCategoryEmoji(tx.category)} {tx.category}</td>
                  <td className={`py-2 px-2 text-right font-mono ${tx.type === 'income' ? 'text-emerald-400' : tx.type === 'transfer' ? 'text-blue-400' : 'text-red-400'}`}>
                    {tx.type === 'income' ? '+' : tx.type === 'transfer' ? '↔' : '−'}{fmtAccFull(tx.amount, tx.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pay Credit Card Modal */}
      {payingCard && (
        <PayCreditModal
          creditCard={payingCard}
          accounts={accounts}
          transactions={transactions}
          onClose={() => setPayingCard(null)}
        />
      )}
    </div>
  );
}
