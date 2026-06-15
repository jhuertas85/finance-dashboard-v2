import React from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
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

export default function Dashboard({ accounts, transactions, budgets }) {
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

  // Calculate budget limits
  const totalBudget = Object.values(budgetMap).reduce((a, b) => a + b, 0);
  const spentPct = totalBudget > 0 ? (monthlySpending / totalBudget) * 100 : 0;

  // Annual savings (Jan-May actual savings)
  const annualSavings = 177691;

  // Capital breakdown
  const capitalAccounts = accounts.filter(a => a.netWorthBucket === 'capital');
  const capitalTotal = capitalAccounts.reduce((sum, a) => sum + toAED(a.currentBalance, a.currency), 0);

  // Assets breakdown
  const usableAccounts = accounts.filter(a => a.netWorthBucket === 'usable');
  const usableTotal = usableAccounts.reduce((sum, a) => sum + toAED(a.currentBalance, a.currency), 0);

  // Future assets
  const futureAccounts = accounts.filter(a => a.netWorthBucket === 'future');
  let futureAssets = 0, liabilities = 0;
  futureAccounts.forEach(a => {
    const aedBal = toAED(a.currentBalance, a.currency);
    if (a.kind === 'asset') futureAssets += aedBal;
    else liabilities += Math.abs(aedBal);
  });

  // Spending detail data
  const spendingData = CATEGORIES.map(cat => ({
    category: cat,
    spent: spendingByCategory[cat] || 0,
    budget: budgetMap[cat] || 0,
  })).filter(d => d.spent > 0 || d.budget > 0);

  // Recent transactions
  const recentTx = transactions
    .filter(t => t.type === 'expense')
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 15);

  return (
    <div className="space-y-6 pb-12">
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
          <div className="w-full bg-gray-800 rounded-full h-2 mt-2 overflow-hidden">
            <div
              className={`h-full transition-all ${spentPct > 85 ? 'bg-red-500' : spentPct > 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}
              style={{ width: `${Math.min(spentPct, 100)}%` }}
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
          <h3 className="text-sm font-bold uppercase text-gray-300 mb-4">Assets — Future: {formatFull(futureAssets - liabilities)}</h3>
          <div className="space-y-2">
            {futureAccounts.filter(a => a.kind === 'asset').map(acc => (
              <div key={acc.id} className="flex justify-between text-xs">
                <span className="text-gray-400">{acc.name}</span>
                <span className="text-gray-200 font-mono">{formatFull(acc.currentBalance, acc.currency)}</span>
              </div>
            ))}
          </div>
          <div className="text-xs text-gray-500 mt-3 pt-3 border-t border-gray-800">
            Locked • long-term contributions reduce as you pay
          </div>
        </div>

        {/* Liabilities */}
        {liabilities > 0 && (
          <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6">
            <h3 className="text-sm font-bold uppercase text-gray-300 mb-4">Outstanding Contributions: {formatFull(-liabilities)}</h3>
            <div className="space-y-2">
              {futureAccounts.filter(a => a.kind === 'liability').map(acc => (
                <div key={acc.id} className="flex justify-between text-xs">
                  <span className="text-gray-400">{acc.name}</span>
                  <span className="text-red-400 font-mono">{formatFull(acc.currentBalance, acc.currency)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Credit Cards */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6">
        <h3 className="text-sm font-bold uppercase text-gray-300 mb-4">Credit Cards</h3>
        <div className="space-y-2">
          {accounts
            .filter(a => a.netWorthBucket === 'debt')
            .map(acc => (
              <div key={acc.id} className="flex justify-between text-xs">
                <span className="text-gray-400">💳 {acc.name}</span>
                <span className={acc.currentBalance < 0 ? 'text-red-400' : 'text-emerald-400'} style={{ fontFamily: 'monospace' }}>
                  {formatFull(acc.currentBalance, acc.currency)}
                </span>
              </div>
            ))}
        </div>
      </div>

      {/* Spending Detail */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6">
        <h3 className="text-sm font-bold uppercase text-gray-300 mb-6">Spending Detail</h3>
        <div className="space-y-3">
          {spendingData.map(item => {
            const pct = item.budget > 0 ? (item.spent / item.budget) * 100 : 0;
            const isOverBudget = pct > 100;
            const color = pct > 85 ? 'bg-red-500' : pct > 50 ? 'bg-amber-500' : 'bg-emerald-500';

            return (
              <div key={item.category}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-medium text-gray-300">
                    {getCategoryEmoji(item.category)} {item.category}
                  </span>
                  <span className="text-xs text-gray-400">
                    {formatShort(item.spent)} / {formatShort(item.budget)} {Math.round(pct)}%
                  </span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                  <div className={`h-full transition-all ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                </div>
              </div>
            );
          })}
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
