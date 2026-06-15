import React, { useState, useMemo } from 'react';
import { formatDate, formatFull, toAED, getCategoryEmoji, calculateSpendingByCategory } from './utils.js';

const CATEGORIES = ['Investments', 'Housing', 'Subs, Sports & Health', 'Food & Groceries', 'Car', 'Going Out', 'Purchases', 'Travel', 'Others'];

export default function Transactions({ transactions, budgets }) {
  const [selectedMonth, setSelectedMonth] = useState('2026-06');
  const [selectedCategory, setSelectedCategory] = useState('');

  const months = useMemo(() => {
    const seen = new Set();
    const monthList = [];
    transactions.forEach(tx => {
      const date = new Date(tx.date);
      const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!seen.has(iso)) {
        seen.add(iso);
        monthList.push(iso);
      }
    });
    return monthList.sort().reverse();
  }, [transactions]);

  const [year, month] = selectedMonth.split('-').map(Number);

  const filtered = useMemo(() => {
    return transactions.filter(tx => {
      const date = new Date(tx.date);
      const txMonth = date.getMonth() + 1;
      const txYear = date.getFullYear();
      if (txYear !== year || txMonth !== month) return false;
      if (selectedCategory && tx.category !== selectedCategory) return false;
      return true;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [transactions, year, month, selectedCategory]);

  const monthBudgets = useMemo(() => {
    const map = {};
    budgets.forEach(b => {
      if (b.year === year && b.month === month) {
        map[b.category] = b.monthlyLimit;
      }
    });
    return map;
  }, [budgets, year, month]);

  const spendingByCategory = calculateSpendingByCategory(transactions, month, year);

  const totalIncome = filtered.filter(t => t.type === 'income').reduce((sum, t) => sum + toAED(t.amount, t.currency), 0);
  const totalExpense = filtered.filter(t => t.type === 'expense').reduce((sum, t) => sum + toAED(t.amount, t.currency), 0);
  const netSavings = totalIncome - totalExpense;

  return (
    <div className="space-y-6 pb-12">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 bg-neutral-950 border border-neutral-800 rounded-xl p-3 flex-wrap items-center">
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-xs font-semibold text-gray-300 cursor-pointer"
        >
          {months.map(m => {
            const [y, mo] = m.split('-').map(Number);
            const date = new Date(y, mo - 1, 1);
            const label = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
            return <option key={m} value={m}>{label}</option>;
          })}
        </select>

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-xs font-semibold text-gray-300 cursor-pointer"
        >
          <option value="">All Categories</option>
          {CATEGORIES.map(cat => (
            <option key={cat} value={cat}>{getCategoryEmoji(cat)} {cat}</option>
          ))}
        </select>

        <button
          onClick={() => setSelectedCategory('')}
          className="px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-gray-400 hover:text-gray-300 transition"
        >
          Clear
        </button>

        <div className="flex-1" />

        <span className="text-xs text-gray-500">
          {filtered.length} transactions · Income: {formatFull(totalIncome)} · Expenses: {formatFull(totalExpense)} · Net: {netSavings >= 0 ? '+' : ''}{formatFull(netSavings)}
        </span>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4">
          <div className="text-xs text-gray-500 uppercase font-semibold mb-1">Income</div>
          <div className="text-2xl font-bold text-emerald-400">{formatFull(totalIncome)}</div>
        </div>
        <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4">
          <div className="text-xs text-gray-500 uppercase font-semibold mb-1">Expenses</div>
          <div className="text-2xl font-bold text-red-400">- {formatFull(totalExpense)}</div>
        </div>
        <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4">
          <div className="text-xs text-gray-500 uppercase font-semibold mb-1">Net Savings</div>
          <div className={`text-2xl font-bold ${netSavings >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {netSavings >= 0 ? '+' : '-'}{formatFull(Math.abs(netSavings))}
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Description</th>
                <th>Category</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-8 text-gray-500 text-sm">
                    No transactions found
                  </td>
                </tr>
              ) : (
                filtered.map(tx => (
                  <tr key={tx.id} className="clickable-row">
                    <td className="text-gray-400 text-xs">{formatDate(tx.date)}</td>
                    <td className="text-xs">
                      <span className={`px-2 py-1 rounded text-[10px] font-semibold ${
                        tx.type === 'income' ? 'bg-emerald-900/20 text-emerald-400' :
                        tx.type === 'expense' ? 'bg-red-900/20 text-red-400' :
                        'bg-gray-900/20 text-gray-400'
                      }`}>
                        {tx.type.toUpperCase()}
                      </span>
                    </td>
                    <td className="text-gray-200 text-sm">{tx.description}</td>
                    <td className="text-xs">
                      {tx.category && (
                        <span>{getCategoryEmoji(tx.category)} {tx.category}</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }} className={`font-mono text-xs ${tx.type === 'income' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {tx.type === 'income' ? '+' : '-'} {formatFull(tx.amount, tx.currency)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
