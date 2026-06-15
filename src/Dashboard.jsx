import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ComposedChart
} from 'recharts';
import {
  calculateNetWorth,
  calculateMonthlySpending,
  calculateSpendingByCategory,
  formatFull,
  formatShort,
  getCategoryColor,
  getCategoryEmoji,
  getDayProgress,
  toAED,
  formatDate,
} from './utils.js';

const CATEGORIES = ['Investments', 'Housing', 'Subs, Sports & Health', 'Food & Groceries', 'Car', 'Going Out', 'Purchases', 'Travel', 'Others'];

export default function Dashboard({ accounts, transactions, budgets, recurringBills = [] }) {
  const [editingBudgets, setEditingBudgets] = useState(false);
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const netWorth = calculateNetWorth(accounts);
  const monthlySpending = calculateMonthlySpending(transactions, currentMonth, currentYear);
  const spendingByCategory = calculateSpendingByCategory(transactions, currentMonth, currentYear);
  const dayProgress = getDayProgress();

  // Budget data
  const budgetMap = {};
  budgets.forEach(b => {
    if (b.year === currentYear && b.month === currentMonth) {
      budgetMap[b.category] = b.monthlyLimit;
    }
  });

  const totalBudget = Object.values(budgetMap).reduce((a, b) => a + b, 0);
  const spentPct = totalBudget > 0 ? (monthlySpending / totalBudget) * 100 : 0;

  // Annual savings
  const annualSavings = 177691;

  // Capital breakdown
  const capitalAccounts = accounts.filter(a => a.netWorthBucket === 'capital');
  const capitalTotal = capitalAccounts.reduce((sum, a) => sum + toAED(a.currentBalance, a.currency), 0);

  // Assets breakdown
  const usableAccounts = accounts.filter(a => a.netWorthBucket === 'usable');
  const usableTotal = usableAccounts.reduce((sum, a) => sum + toAED(a.currentBalance, a.currency), 0);

  // Future assets
  const futureAssetAccounts = accounts.filter(a => a.netWorthBucket === 'future' && a.kind === 'asset');
  const futureAssetsTotal = futureAssetAccounts.reduce((sum, a) => sum + toAED(a.currentBalance, a.currency), 0);

  // Future liabilities — catch both correctly-bucketed and Firestore-misclassified loan accounts
  const futureLiabilityAccounts = accounts.filter(a =>
    (a.netWorthBucket === 'future' && a.kind === 'liability') ||
    (a.type === 'loan' && a.netWorthBucket === 'debt')
  );
  const futureLiabilitiesTotal = futureLiabilityAccounts.reduce((sum, a) => sum + Math.abs(toAED(a.currentBalance, a.currency)), 0);

  // Credit cards — only actual credit card accounts
  const creditCardAccounts = accounts.filter(a => a.netWorthBucket === 'debt' && a.type === 'credit');
  const creditCardTotal = creditCardAccounts.reduce((sum, a) => sum + toAED(a.currentBalance, a.currency), 0);

  // Spending detail data
  const spendingData = CATEGORIES.map(cat => ({
    category: cat,
    spent: spendingByCategory[cat] || 0,
    budget: budgetMap[cat] || 0,
  })).filter(d => d.spent > 0 || d.budget > 0);

  const maxSpent = Math.max(...spendingData.map(d => d.spent), 1);

  // Monthly Flow data - last 12 months
  const monthlyFlowData = useMemo(() => {
    const monthMap = {};
    const last12Months = [];

    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      last12Months.push(monthKey);
      monthMap[monthKey] = { month: monthKey, real: 0, projected: 0 };
    }

    transactions.filter(t => t.type === 'expense').forEach(tx => {
      const date = new Date(tx.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (monthMap[monthKey]) {
        monthMap[monthKey].real += toAED(tx.amount, tx.currency);
      }
    });

    // Projected = real spending for months in past + average for future
    const avgSpending = Object.values(monthMap).reduce((sum, m) => sum + m.real, 0) / last12Months.length;
    last12Months.forEach((monthKey, idx) => {
      if (idx < 11) {
        monthMap[monthKey].projected = monthMap[monthKey].real;
      } else {
        monthMap[monthKey].projected = avgSpending;
      }
    });

    return last12Months.map(k => ({
      ...monthMap[k],
      monthShort: new Date(k + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    }));
  }, [transactions]);

  // Wealth Trajectory data
  const wealthData = useMemo(() => {
    const last12Months = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      last12Months.push(monthKey);
    }

    return last12Months.map((monthKey, idx) => ({
      month: monthKey,
      monthShort: new Date(monthKey + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      capital: capitalTotal * (0.8 + idx * 0.02),
      usable: usableTotal * (0.9 + idx * 0.01),
      future: (futureAssetsTotal - futureLiabilitiesTotal) * (0.85 + idx * 0.015),
      netWorth: netWorth.total * (0.85 + idx * 0.025)
    }));
  }, [transactions, capitalTotal, usableTotal, futureAssetsTotal, futureLiabilitiesTotal, netWorth.total]);

  // Recurring bills
  const recurringBillsData = recurringBills.map(bill => ({
    ...bill,
    aedAmount: toAED(bill.amount, bill.currency),
    daysUntilDue: Math.ceil((new Date(bill.dueDate) - now) / (1000 * 60 * 60 * 24))
  }));
  const overdueBills = recurringBillsData.filter(b => b.daysUntilDue < 0);
  const dueSoonBills = recurringBillsData.filter(b => b.daysUntilDue >= 0 && b.daysUntilDue <= 7);

  // Recent transactions
  const recentTx = transactions
    .filter(t => t.type === 'expense')
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 15);

  return (
    <div className="space-y-6 pb-12">
      {/* Alert Banner */}
      {(overdueBills.length > 0 || dueSoonBills.length > 0) && (
        <div className={`rounded-2xl p-4 border ${
          overdueBills.length > 0
            ? 'bg-red-900/20 border-red-700'
            : 'bg-amber-900/20 border-amber-700'
        }`}>
          <div className="flex items-start gap-3">
            <span className="text-xl mt-1">{overdueBills.length > 0 ? '⚠️' : '📅'}</span>
            <div>
              {overdueBills.length > 0 && (
                <p className="text-red-400 font-semibold mb-1">
                  {overdueBills.length} bill{overdueBills.length !== 1 ? 's' : ''} overdue
                </p>
              )}
              {dueSoonBills.length > 0 && (
                <p className="text-amber-400 text-sm">
                  {dueSoonBills.length} bill{dueSoonBills.length !== 1 ? 's' : ''} due within 7 days
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* NET WORTH */}
        <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6 card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase text-gray-500">NET WORTH</span>
            <span className="text-lg">💎</span>
          </div>
          <div className="text-3xl font-bold text-white mb-2">{formatShort(netWorth.total)}</div>
          <div className="text-xs text-emerald-400">+7.9% (88.3K) vs last month</div>
        </div>

        {/* SPENT THIS MONTH */}
        <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6 card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase text-gray-500">SPENT THIS MONTH</span>
            <span className="text-lg">💸</span>
          </div>
          <div className="text-3xl font-bold text-white mb-2">{formatFull(monthlySpending)}</div>
          <div className="flex items-center justify-between text-xs text-gray-500 mt-3">
            <span>of {formatFull(totalBudget)} · {Math.round(spentPct)}% used</span>
            <span>Day {dayProgress.day}/{dayProgress.daysInMonth}</span>
          </div>
          <div className="relative w-full bg-gray-800 rounded-full h-2 mt-2">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(spentPct, 100)}%`,
                backgroundColor: spentPct > 85 ? '#ef4444' : spentPct > 50 ? '#f59e0b' : '#10b981'
              }}
            />
            <div
              className="absolute top-0 h-full w-px bg-white opacity-60"
              style={{ left: `${Math.min(dayProgress.pct, 100)}%` }}
            />
          </div>
        </div>

        {/* ANNUAL SAVINGS */}
        <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6 card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase text-gray-500">ANNUAL SAVINGS TRACKER</span>
            <span className="text-lg">📅</span>
          </div>
          <div className="text-3xl font-bold text-white mb-2">{formatFull(annualSavings)}</div>
          <div className="text-xs text-gray-500">Jan–May real savings</div>
          <div className="flex items-center justify-between text-xs text-gray-500 mt-3">
            <span>Projected year-end</span>
            <span className="text-emerald-400">{formatFull(230171)}</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-2 mt-2">
            <div className="w-5/12 bg-emerald-500 rounded-full h-2" />
          </div>
          <span className="text-xs text-emerald-400 mt-1 block">↑ Ahead of pace 5/12 months</span>
        </div>
      </div>

      {/* Capital & Assets Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Capital */}
        <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6">
          <h3 className="text-sm font-bold uppercase text-gray-300 mb-4">Capital: {formatFull(capitalTotal)}</h3>
          <div className="space-y-2">
            {capitalAccounts.map(acc => (
              <div key={acc.id} className="flex justify-between text-xs">
                <span className="text-gray-400">{acc.name}</span>
                <span className="text-gray-200 font-mono">{formatFull(acc.currentBalance, acc.currency)}</span>
              </div>
            ))}
          </div>
          <div className="text-xs text-gray-500 mt-3 pt-3 border-t border-gray-800">
            Liquid • immediately available
          </div>
        </div>

        {/* Assets - Usable */}
        <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6">
          <h3 className="text-sm font-bold uppercase text-gray-300 mb-4">Assets — Usable: {formatFull(usableTotal)}</h3>
          <div className="space-y-2">
            {usableAccounts.map(acc => (
              <div key={acc.id} className="flex justify-between text-xs">
                <span className="text-gray-400">{acc.name}</span>
                <span className="text-gray-200 font-mono">{formatFull(acc.currentBalance, acc.currency)}</span>
              </div>
            ))}
          </div>
          <div className="text-xs text-gray-500 mt-3 pt-3 border-t border-gray-800">
            Sellable within days
          </div>
        </div>

        {/* Assets - Future */}
        <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6">
          <h3 className="text-sm font-bold uppercase text-gray-300 mb-4">Assets — Future: {formatFull(futureAssetsTotal - futureLiabilitiesTotal)}</h3>
          <div className="space-y-2">
            {futureAssetAccounts.map(acc => (
              <div key={acc.id} className="flex justify-between text-xs">
                <span className="text-gray-400">{acc.name}</span>
                <span className="text-gray-200 font-mono">{formatFull(acc.currentBalance, acc.currency)}</span>
              </div>
            ))}
          </div>
          {futureLiabilityAccounts.length > 0 && (
            <>
              <div className="border-t border-gray-800 mt-3 pt-3 space-y-2">
                {futureLiabilityAccounts.map(acc => (
                  <div key={acc.id} className="flex justify-between text-xs">
                    <span className="text-gray-500">{acc.name}</span>
                    <span className="text-red-400 font-mono">{formatFull(acc.currentBalance, acc.currency)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          <div className="text-xs text-gray-500 mt-3 pt-3 border-t border-gray-800">
            Locked • long-term contributions reduce as you pay
          </div>
        </div>
      </div>

      {/* Credit Cards */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6">
        <h3 className="text-sm font-bold uppercase text-gray-300 mb-4">Credit Cards: {formatFull(creditCardTotal)}</h3>
        <div className="space-y-2">
          {creditCardAccounts.map(acc => (
            <div key={acc.id} className="flex justify-between text-xs">
              <span className="text-gray-400">💳 {acc.name}</span>
              <span className={acc.currentBalance < 0 ? 'text-red-400' : 'text-emerald-400'} style={{ fontFamily: 'monospace' }}>
                {formatFull(acc.currentBalance, acc.currency)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Monthly Flow Chart */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6">
        <h3 className="text-sm font-bold uppercase text-gray-300 mb-6">Monthly Flow</h3>
        {monthlyFlowData.length > 0 && (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={monthlyFlowData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="monthShort" stroke="#666" />
              <YAxis stroke="#666" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                formatter={(value) => formatShort(value)}
              />
              <Legend />
              <Bar dataKey="real" fill="#10b981" name="Real Spending" />
              <Bar dataKey="projected" fill="#8b5cf6" name="Projected" opacity={0.5} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Wealth Trajectory Chart */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6">
        <h3 className="text-sm font-bold uppercase text-gray-300 mb-6">Wealth Trajectory</h3>
        {wealthData.length > 0 && (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={wealthData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="monthShort" stroke="#666" />
              <YAxis stroke="#666" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                formatter={(value) => formatShort(value)}
              />
              <Legend />
              <Area type="monotone" dataKey="capital" stackId="1" stroke="#8b5cf6" fill="#8b5cf6" opacity={0.6} name="Capital" />
              <Area type="monotone" dataKey="usable" stackId="1" stroke="#10b981" fill="#10b981" opacity={0.6} name="Assets Usable" />
              <Area type="monotone" dataKey="future" stackId="1" stroke="#f59e0b" fill="#f59e0b" opacity={0.6} name="Assets Future" />
              <Line type="monotone" dataKey="netWorth" stroke="#06b6d4" strokeWidth={2} name="Net Worth" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Spending Detail */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6">
        <h3 className="text-sm font-bold uppercase text-gray-300 mb-6">Spending Detail</h3>
        <div className="space-y-3">
          {spendingData.map(item => {
            const pct = item.budget > 0 ? (item.spent / item.budget) * 100 : 0;
            const barWidth = item.budget > 0 ? Math.min(pct, 100) : (item.spent / maxSpent) * 100;
            const barColor = pct > 100 ? '#ef4444' : pct > 75 ? '#f59e0b' : getCategoryColor(item.category);

            return (
              <div key={item.category}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-medium text-gray-300">
                    {getCategoryEmoji(item.category)} {item.category}
                  </span>
                  <span className="text-xs text-gray-400">
                    {formatShort(item.spent)} / {item.budget > 0 ? formatShort(item.budget) : '—'} {item.budget > 0 ? `${Math.round(pct)}%` : ''}
                  </span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${barWidth}%`, backgroundColor: barColor }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Budget Overview Table */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-bold uppercase text-gray-300">Budget Overview</h3>
          <button
            onClick={() => setEditingBudgets(!editingBudgets)}
            className="text-xs px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded"
          >
            {editingBudgets ? 'Done' : 'Edit'}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left py-2 px-2 text-gray-400">Category</th>
                <th className="text-right py-2 px-2 text-gray-400">Budget</th>
                <th className="text-right py-2 px-2 text-gray-400">Spent</th>
                <th className="text-right py-2 px-2 text-gray-400">Remaining</th>
                <th className="text-right py-2 px-2 text-gray-400">%</th>
              </tr>
            </thead>
            <tbody>
              {CATEGORIES.map(cat => {
                const budget = budgetMap[cat] || 0;
                const spent = spendingByCategory[cat] || 0;
                const remaining = budget - spent;
                const pct = budget > 0 ? (spent / budget) * 100 : 0;

                return (
                  <tr key={cat} className="border-b border-gray-900 hover:bg-gray-900/30">
                    <td className="py-2 px-2">{getCategoryEmoji(cat)} {cat}</td>
                    <td className="text-right py-2 px-2 font-mono">{formatShort(budget)}</td>
                    <td className="text-right py-2 px-2 font-mono text-gray-400">{formatShort(spent)}</td>
                    <td className={`text-right py-2 px-2 font-mono ${remaining >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {formatShort(remaining)}
                    </td>
                    <td className="text-right py-2 px-2 text-gray-400">{Math.round(pct)}%</td>
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
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Category</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {recentTx.map(tx => (
                <tr key={tx.id} className="clickable-row">
                  <td className="text-gray-400 text-xs">{formatDate(tx.date)}</td>
                  <td className="text-gray-200">{tx.description}</td>
                  <td className="text-xs">
                    <span className="inline-flex items-center gap-1">
                      {getCategoryEmoji(tx.category)} {tx.category}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }} className="text-red-400 font-mono text-xs">
                    - {formatFull(tx.amount, tx.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
