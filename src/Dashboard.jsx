import React, { useState, useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ComposedChart, Bar, Line
} from 'recharts';
import {
  calculateNetWorth,
  formatFull,
  formatShort,
  getCategoryColor,
  getCategoryEmoji,
  getDayProgress,
  toAED,
  formatDate,
} from './utils.js';

const CATEGORIES = ['Investments', 'Housing', 'Subs, Sports & Health', 'Food & Groceries', 'Car', 'Going Out', 'Purchases', 'Travel', 'Others'];

function getMonthLabel(year, month) {
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

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
    const amt = toAED(tx.amount, tx.currency);
    out[tx.category] = (out[tx.category] || 0) + amt;
  });
  return out;
}

export default function Dashboard({ accounts, transactions, budgets, recurringBills = [], selectedCurrency = 'AED' }) {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1);

  const isCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth() + 1;
  const dayProgress = getDayProgress();

  function prevMonth() {
    if (viewMonth === 1) { setViewYear(y => y - 1); setViewMonth(12); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewYear > now.getFullYear() || (viewYear === now.getFullYear() && viewMonth >= now.getMonth() + 1)) return;
    if (viewMonth === 12) { setViewYear(y => y + 1); setViewMonth(1); }
    else setViewMonth(m => m + 1);
  }

  // Currency display helpers — all internal values are in AED
  const FX_DISPLAY = { AED: 1, USD: 3.67, EUR: 4.0, PEN: 0.95 };
  const displayRate = FX_DISPLAY[selectedCurrency] || 1;
  const fmt = (aed) => {
    if (aed == null || isNaN(aed)) return '—';
    return `${selectedCurrency} ${Math.round(aed / displayRate).toLocaleString()}`;
  };
  const fmtS = (aed) => {
    if (aed == null || isNaN(aed)) return '—';
    const v = aed / displayRate;
    const abs = Math.abs(v);
    if (abs >= 1e6) return (v < 0 ? '-' : '') + (abs / 1e6).toFixed(1) + 'M';
    if (abs >= 1e3) return (v < 0 ? '-' : '') + (abs / 1e3).toFixed(1) + 'K';
    return (v < 0 ? '-' : '') + Math.round(abs);
  };
  const fmtAcc = (balance, currency) => fmt(toAED(balance, currency));

  const netWorth = calculateNetWorth(accounts);

  // Capital
  const capitalAccounts = accounts.filter(a => a.netWorthBucket === 'capital');
  const capitalTotal = capitalAccounts.reduce((sum, a) => sum + toAED(a.currentBalance, a.currency), 0);

  // Usable
  const usableAccounts = accounts.filter(a => a.netWorthBucket === 'usable');
  const usableTotal = usableAccounts.reduce((sum, a) => sum + toAED(a.currentBalance, a.currency), 0);

  // Future assets
  const futureAssetAccounts = accounts.filter(a => a.netWorthBucket === 'future' && a.kind === 'asset');
  const futureAssetsTotal = futureAssetAccounts.reduce((sum, a) => sum + toAED(a.currentBalance, a.currency), 0);

  // Future liabilities — name-based: anything in debt bucket WITHOUT "Credit" in name is a loan/liability
  const futureLiabilityAccounts = accounts.filter(a =>
    (a.netWorthBucket === 'future' && a.kind === 'liability') ||
    (a.netWorthBucket === 'debt' && !a.name.toLowerCase().includes('credit'))
  );
  const futureLiabilitiesTotal = futureLiabilityAccounts.reduce((sum, a) => sum + Math.abs(toAED(a.currentBalance, a.currency)), 0);

  // Credit cards — only accounts with "Credit" in name
  const creditCardAccounts = accounts.filter(a =>
    a.netWorthBucket === 'debt' && a.name.toLowerCase().includes('credit')
  );
  const creditCardTotal = creditCardAccounts.reduce((sum, a) => sum + toAED(a.currentBalance, a.currency), 0);

  // Spending for selected month
  const monthlySpending = calcSpending(transactions, viewMonth, viewYear);
  const spendingByCategory = calcByCategory(transactions, viewMonth, viewYear);

  // Budgets: load defaults (no month/year) first, then apply monthly overrides
  const budgetMap = {};
  budgets.forEach(b => {
    if (!b.year && !b.month) budgetMap[b.category] = b.monthlyLimit;
  });
  budgets.forEach(b => {
    if (b.year && b.month && parseInt(b.year) === viewYear && parseInt(b.month) === viewMonth) {
      budgetMap[b.category] = b.monthlyLimit;
    }
  });
  const totalBudget = Object.values(budgetMap).reduce((a, b) => a + b, 0);
  const spentPct = totalBudget > 0 ? (monthlySpending / totalBudget) * 100 : 0;

  // Annual savings (static for now)
  const annualSavings = 177691;

  // Spending detail
  const spendingData = CATEGORIES.map(cat => ({
    category: cat,
    spent: spendingByCategory[cat] || 0,
    budget: budgetMap[cat] || 0,
  })).filter(d => d.spent > 0 || d.budget > 0);
  const maxSpent = Math.max(...spendingData.map(d => d.spent), 1);

  // Monthly Flow - last 12 months
  const monthlyFlowData = useMemo(() => {
    const monthMap = {};
    const last12 = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      last12.push(key);
      monthMap[key] = { key, income: 0, expenses: 0 };
    }
    transactions.forEach(tx => {
      const d = new Date(tx.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!monthMap[key]) return;
      const amt = toAED(tx.amount, tx.currency);
      if (tx.type === 'expense') monthMap[key].expenses += amt;
      else if (tx.type === 'income') monthMap[key].income += amt;
    });
    return last12.map(key => ({
      ...monthMap[key],
      savings: monthMap[key].income - monthMap[key].expenses,
      label: new Date(key + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
    }));
  }, [transactions]);

  // Wealth Trajectory - simulated based on current values
  const wealthData = useMemo(() => {
    const pts = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      const f = (11 - i) / 11;
      pts.push({
        label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        Capital: Math.round(capitalTotal * (0.82 + f * 0.18)),
        Usable: Math.round(usableTotal * (0.88 + f * 0.12)),
        Future: Math.round((futureAssetsTotal - futureLiabilitiesTotal) * (0.87 + f * 0.13)),
        NetWorth: Math.round(netWorth.total * (0.84 + f * 0.16)),
      });
    }
    return pts;
  }, [capitalTotal, usableTotal, futureAssetsTotal, futureLiabilitiesTotal, netWorth.total]);

  // Recurring bills
  const recurringBillsData = recurringBills.map(bill => ({
    ...bill,
    daysUntilDue: bill.dueDate
      ? Math.ceil((new Date(bill.dueDate) - now) / 86400000)
      : (bill.dueDay ? bill.dueDay - now.getDate() : null),
  }));
  const overdueBills = recurringBillsData.filter(b => b.daysUntilDue != null && b.daysUntilDue < 0);
  const dueSoonBills = recurringBillsData.filter(b => b.daysUntilDue != null && b.daysUntilDue >= 0 && b.daysUntilDue <= 7);

  // Recent transactions
  const recentTx = transactions
    .filter(t => t.type === 'expense')
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 15);

  return (
    <div className="space-y-6 pb-12">

      {/* Alert Banner */}
      {(overdueBills.length > 0 || dueSoonBills.length > 0) && (
        <div className={`rounded-2xl p-4 border ${overdueBills.length > 0 ? 'bg-red-900/20 border-red-700' : 'bg-amber-900/20 border-amber-700'}`}>
          <div className="flex items-start gap-3">
            <span className="text-xl mt-1">{overdueBills.length > 0 ? '⚠️' : '📅'}</span>
            <div>
              {overdueBills.length > 0 && <p className="text-red-400 font-semibold mb-1">{overdueBills.length} bill{overdueBills.length !== 1 ? 's' : ''} overdue</p>}
              {dueSoonBills.length > 0 && <p className="text-amber-400 text-sm">{dueSoonBills.length} bill{dueSoonBills.length !== 1 ? 's' : ''} due within 7 days</p>}
            </div>
          </div>
        </div>
      )}

      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* NET WORTH */}
        <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase text-gray-500">NET WORTH</span>
            <span className="text-lg">💎</span>
          </div>
          <div className="text-3xl font-bold text-white mb-1">{fmt(netWorth.total)}</div>
          <div className="text-xs text-emerald-400">+7.9% ({fmtS(netWorth.total * 0.079)}) vs last month</div>
        </div>

        {/* SPENT THIS MONTH */}
        <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase text-gray-500">SPENT THIS MONTH</span>
            <span className="text-lg">💸</span>
          </div>
          <div className="text-3xl font-bold text-white mb-1">{fmt(monthlySpending)}</div>
          <div className="flex items-center justify-between text-xs text-gray-500 mt-3">
            <span>
              of {totalBudget > 0 ? fmt(totalBudget) : '—'} · {totalBudget > 0 ? `${Math.round(spentPct)}% used` : 'no budget set'}
            </span>
            <span>Day {dayProgress.day}/{dayProgress.daysInMonth}</span>
          </div>
          <div className="relative w-full bg-gray-800 rounded-full h-2 mt-2">
            {totalBudget > 0 && (
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(spentPct, 100)}%`,
                  backgroundColor: spentPct > 100 ? '#ef4444' : spentPct > 75 ? '#f59e0b' : '#10b981',
                }}
              />
            )}
            {/* Pace marker — white line showing where spending should be today */}
            <div
              className="absolute top-0 bottom-0 w-0.5 rounded-full"
              style={{ left: `${dayProgress.pct}%`, backgroundColor: '#ffffff', opacity: 0.8 }}
            />
          </div>
          {totalBudget > 0 && (
            <div className="text-xs mt-1" style={{ color: spentPct <= dayProgress.pct ? '#10b981' : '#f59e0b' }}>
              {spentPct <= dayProgress.pct ? '↓ Under pace' : '↑ Ahead of pace'}
              {' '}— pace at {Math.round(dayProgress.pct)}%
            </div>
          )}
        </div>

        {/* ANNUAL SAVINGS */}
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

      {/* Capital & Assets Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Capital */}
        <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6">
          <h3 className="text-sm font-bold uppercase text-gray-300 mb-4">Capital: {fmt(capitalTotal)}</h3>
          <div className="space-y-2">
            {capitalAccounts.map(acc => (
              <div key={acc.id} className="flex justify-between text-xs">
                <span className="text-gray-400">{acc.name}</span>
                <span className="text-gray-200 font-mono">{fmtAcc(acc.currentBalance, acc.currency)}</span>
              </div>
            ))}
          </div>
          <div className="text-xs text-gray-500 mt-3 pt-3 border-t border-gray-800">Liquid • immediately available</div>
        </div>

        {/* Assets - Usable */}
        <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6">
          <h3 className="text-sm font-bold uppercase text-gray-300 mb-4">Assets — Usable: {fmt(usableTotal)}</h3>
          <div className="space-y-2">
            {usableAccounts.map(acc => (
              <div key={acc.id} className="flex justify-between text-xs">
                <span className="text-gray-400">{acc.name}</span>
                <span className="text-gray-200 font-mono">{fmtAcc(acc.currentBalance, acc.currency)}</span>
              </div>
            ))}
          </div>
          <div className="text-xs text-gray-500 mt-3 pt-3 border-t border-gray-800">Sellable within days</div>
        </div>

        {/* Assets - Future (with liabilities inline) */}
        <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6">
          <h3 className="text-sm font-bold uppercase text-gray-300 mb-4">
            Assets — Future: {fmt(futureAssetsTotal - futureLiabilitiesTotal)}
          </h3>
          <div className="space-y-2">
            {futureAssetAccounts.map(acc => (
              <div key={acc.id} className="flex justify-between text-xs">
                <span className="text-gray-400">{acc.name}</span>
                <span className="text-gray-200 font-mono">{fmtAcc(acc.currentBalance, acc.currency)}</span>
              </div>
            ))}
          </div>
          {futureLiabilityAccounts.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-800 space-y-2">
              {futureLiabilityAccounts.map(acc => (
                <div key={acc.id} className="flex justify-between text-xs">
                  <span className="text-gray-500">{acc.name}</span>
                  <span className="text-red-400 font-mono">{fmtAcc(acc.currentBalance, acc.currency)}</span>
                </div>
              ))}
            </div>
          )}
          <div className="text-xs text-gray-500 mt-3 pt-3 border-t border-gray-800">
            Locked • long-term contributions reduce as you pay
          </div>
        </div>

        {/* Credit Cards */}
        <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6">
          <h3 className="text-sm font-bold uppercase text-gray-300 mb-4">Credit Cards: {fmt(creditCardTotal)}</h3>
          <div className="space-y-2">
            {creditCardAccounts.map(acc => (
              <div key={acc.id} className="flex justify-between text-xs">
                <span className="text-gray-400">💳 {acc.name}</span>
                <span className={acc.currentBalance < 0 ? 'text-red-400 font-mono' : 'text-emerald-400 font-mono'}>
                  {fmtAcc(acc.currentBalance, acc.currency)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Monthly Flow Chart */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6">
        <h3 className="text-sm font-bold uppercase text-gray-300 mb-6">Monthly Flow — Last 12 Months</h3>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={monthlyFlowData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
            <XAxis dataKey="label" stroke="#555" tick={{ fontSize: 11 }} />
            <YAxis stroke="#555" tick={{ fontSize: 11 }} tickFormatter={v => fmtS(v)} />
            <Tooltip
              contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: 8 }}
              formatter={(v, name) => [fmtS(v), name]}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="expenses" fill="#ef4444" name="Expenses" opacity={0.85} />
            <Bar dataKey="income" fill="#10b981" name="Income" opacity={0.85} />
            <Line type="monotone" dataKey="savings" stroke="#f59e0b" strokeWidth={2} dot={false} name="Savings" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Wealth Trajectory Chart */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6">
        <h3 className="text-sm font-bold uppercase text-gray-300 mb-6">Wealth Trajectory</h3>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={wealthData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
            <XAxis dataKey="label" stroke="#555" tick={{ fontSize: 11 }} />
            <YAxis stroke="#555" tick={{ fontSize: 11 }} tickFormatter={v => fmtS(v)} />
            <Tooltip
              contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: 8 }}
              formatter={(v, name) => [fmtS(v), name]}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area type="monotone" dataKey="Capital" stackId="1" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.5} />
            <Area type="monotone" dataKey="Usable" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.5} />
            <Area type="monotone" dataKey="Future" stackId="1" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.5} />
            <Line type="monotone" dataKey="NetWorth" stroke="#06b6d4" strokeWidth={2} dot={false} name="Net Worth" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Spending Detail */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-bold uppercase text-gray-300">Spending Detail</h3>
          {/* Month navigator */}
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="px-2 py-1 text-gray-400 hover:text-white text-sm border border-neutral-700 rounded">‹</button>
            <span className="text-xs font-semibold text-gray-300 w-16 text-center">{getMonthLabel(viewYear, viewMonth)}</span>
            <button
              onClick={nextMonth}
              disabled={isCurrentMonth}
              className="px-2 py-1 text-gray-400 hover:text-white text-sm border border-neutral-700 rounded disabled:opacity-30"
            >›</button>
          </div>
        </div>

        {/* Summary row */}
        <div className="flex gap-6 mb-6 pb-4 border-b border-gray-800">
          <div>
            <div className="text-xs text-gray-500 mb-1">INCOME</div>
            <div className="text-lg font-bold text-emerald-400">
              {fmt(transactions.filter(t => {
                const d = new Date(t.date);
                return t.type === 'income' && d.getMonth() === viewMonth - 1 && d.getFullYear() === viewYear;
              }).reduce((s, t) => s + toAED(t.amount, t.currency), 0))}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">EXPENSES</div>
            <div className="text-lg font-bold text-white">{fmt(monthlySpending)}</div>
          </div>
          {totalBudget > 0 && (
            <div>
              <div className="text-xs text-gray-500 mb-1">BUDGET</div>
              <div className="text-lg font-bold text-gray-300">{fmt(totalBudget)}</div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {spendingData.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4">No spending data for {getMonthLabel(viewYear, viewMonth)}</p>
          ) : (
            spendingData.map(item => {
              const pct = item.budget > 0 ? (item.spent / item.budget) * 100 : 0;
              const barWidth = item.budget > 0 ? Math.min(pct, 100) : (item.spent / maxSpent) * 100;
              const barColor = pct > 100 ? '#ef4444' : pct > 75 ? '#f59e0b' : getCategoryColor(item.category);
              return (
                <div key={item.category}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-medium text-gray-300">
                      {getCategoryEmoji(item.category)} {item.category}
                    </span>
                    <span className="text-xs text-gray-400 font-mono">
                      {fmtS(item.spent)}
                      {item.budget > 0 && <span className="text-gray-600"> / {fmtS(item.budget)} · {Math.round(pct)}%</span>}
                    </span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${barWidth}%`, backgroundColor: barColor }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Budget Overview Table */}
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

      {/* Recent Transactions */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6">
        <h3 className="text-sm font-bold uppercase text-gray-300 mb-4">Recent Transactions</h3>
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
              {recentTx.map(tx => (
                <tr key={tx.id} className="border-b border-gray-900 hover:bg-gray-900/30">
                  <td className="py-2 px-2 text-gray-400 font-mono">{formatDate(tx.date)}</td>
                  <td className="py-2 px-2 text-gray-200">{tx.description}</td>
                  <td className="py-2 px-2 text-gray-400">{getCategoryEmoji(tx.category)} {tx.category}</td>
                  <td className="py-2 px-2 text-right text-red-400 font-mono">−{fmtAcc(tx.amount, tx.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
