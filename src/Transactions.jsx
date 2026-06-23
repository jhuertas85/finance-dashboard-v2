import React, { useState, useMemo, useEffect } from 'react';
import { doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase-config.js';
import { formatDate, toAED, getCategoryEmoji } from './utils.js';
import AccountSelect, { AccountBadge } from './AccountSelect.jsx';
import { sortAndFilterAccounts, getAccountBrand } from './accountConfig.js';

const CATEGORIES = ['Investments', 'Housing', 'Subs, Sports & Health', 'Food & Groceries', 'Car', 'Going Out', 'Purchases', 'Travel', 'Loan', 'Others'];
const FX = { AED: 1, USD: 3.67, EUR: 4.0, PEN: 0.95 };
const CURRENCIES = ['AED', 'USD', 'EUR', 'PEN'];

function fmtAED(aed) {
  return `AED ${Math.round(Math.abs(aed)).toLocaleString()}`;
}

export default function Transactions({ transactions, accounts = [], selectedCurrency, externalFilter, onClearExternalFilter }) {
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [search, setSearch] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey);
  const [selectedType, setSelectedType] = useState('');
  const [selectedAccount, setSelectedAccount] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  const [editingTx, setEditingTx] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [deletingTx, setDeletingTx] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Sync external filter from Dashboard/Overview tab
  useEffect(() => {
    if (!externalFilter) return;
    setSelectedType(externalFilter.type || '');
    setSelectedCategory(externalFilter.category || '');
    setSelectedAccount('');
    setSearch('');
    if (externalFilter.mode === 'month' && externalFilter.year && externalFilter.month) {
      setSelectedMonth(`${externalFilter.year}-${String(externalFilter.month).padStart(2, '0')}`);
    } else {
      setSelectedMonth('');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [externalFilter]);

  const months = useMemo(() => {
    const seen = new Set();
    const list = [];
    transactions.forEach(tx => {
      const d = new Date(tx.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!seen.has(key)) {
        seen.add(key);
        list.push({ key, label: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) });
      }
    });
    return list.sort((a, b) => b.key.localeCompare(a.key));
  }, [transactions]);

  const accountMap = useMemo(() => {
    const m = {};
    accounts.forEach(a => { m[a.id] = a; });
    return m;
  }, [accounts]);

  const txAccounts = useMemo(() => sortAndFilterAccounts(accounts), [accounts]);

  const filtered = useMemo(() => {
    return transactions.filter(tx => {
      const d = new Date(tx.date);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (selectedMonth && monthKey !== selectedMonth) return false;
      if (selectedType && tx.type !== selectedType) return false;
      if (selectedAccount) {
        const acctName = accountMap[selectedAccount]?.name;
        const matchFrom = tx.fromAccount === selectedAccount || (acctName && tx.fromAccount === acctName);
        const matchTo = tx.toAccount === selectedAccount || (acctName && tx.toAccount === acctName);
        if (!matchFrom && !matchTo) return false;
      }
      if (selectedCategory && tx.category !== selectedCategory) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !(tx.description || '').toLowerCase().includes(q) &&
          !(tx.notes || '').toLowerCase().includes(q) &&
          !(tx.category || '').toLowerCase().includes(q)
        ) return false;
      }
      return true;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [transactions, selectedMonth, selectedType, selectedAccount, selectedCategory, search]);

  const totalIncome = filtered.filter(t => t.type === 'income').reduce((s, t) => s + toAED(t.amount, t.currency), 0);
  const totalExpense = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + toAED(t.amount, t.currency), 0);

  function getAccountName(idOrName) {
    if (!idOrName) return null;
    // Try lookup by ID first; fall back to treating the value as already a name
    return accountMap[idOrName]?.name || idOrName;
  }

  function resolveAccountId(idOrName) {
    if (!idOrName) return '';
    if (accountMap[idOrName]) return idOrName;
    return accounts.find(a => a.name === idOrName)?.id || '';
  }

  function startEdit(tx) {
    setEditingTx(tx);
    setEditForm({
      date: tx.date ? new Date(tx.date).toISOString().slice(0, 10) : '',
      description: tx.description || '',
      amount: String(tx.amount),
      currency: tx.currency || 'AED',
      amountTo: tx.amountTo != null ? String(tx.amountTo) : '',
      category: tx.category || 'Others',
      notes: tx.notes || '',
      fromAccount: resolveAccountId(tx.fromAccount),
      toAccount: resolveAccountId(tx.toAccount),
      borrower: tx.borrower || '',
    });
    setError('');
  }

  async function saveEdit() {
    if (!editingTx) return;
    const newAmount = parseFloat(editForm.amount);
    if (isNaN(newAmount) || newAmount <= 0) { setError('Enter a valid amount'); return; }

    // Derive currencies from accounts (same convention as Add Transaction)
    const editFromAcct = accountMap[editForm.fromAccount];
    const editToAcct   = accountMap[editForm.toAccount];
    const editFromCur  = editFromAcct?.currency || editingTx.currency || 'AED';
    const editToCur    = editToAcct?.currency   || editingTx.currencyTo || editFromCur;
    const editIsXCur   = editingTx.type === 'transfer' && !!editToAcct && editFromCur !== editToCur;

    if (editIsXCur && (!editForm.amountTo || parseFloat(editForm.amountTo) <= 0)) {
      setError('Enter the amount received'); return;
    }

    setSaving(true);
    setError('');
    try {
      // ── helper: convert to AED via stored FX rates
      const aed = (amt, cur) => toAED(amt, cur);

      if (editingTx.type === 'expense') {
        const oldAED = aed(editingTx.amount, editingTx.currency);
        const newAED = aed(newAmount, editFromCur);
        const oldId = resolveAccountId(editingTx.fromAccount);
        const newId = editForm.fromAccount;
        if (oldId === newId) {
          const acct = accountMap[oldId];
          if (acct && Math.abs(newAED - oldAED) > 0.001)
            await updateDoc(doc(db, 'accounts', acct.id), { currentBalance: acct.currentBalance - (newAED - oldAED) / (FX[acct.currency] || 1) });
        } else {
          const o = accountMap[oldId], n = accountMap[newId];
          if (o) await updateDoc(doc(db, 'accounts', o.id), { currentBalance: o.currentBalance + oldAED / (FX[o.currency] || 1) });
          if (n) await updateDoc(doc(db, 'accounts', n.id), { currentBalance: n.currentBalance - newAED / (FX[n.currency] || 1) });
        }

      } else if (editingTx.type === 'income') {
        const oldAED = aed(editingTx.amount, editingTx.currency);
        const newAED = aed(newAmount, editFromCur);
        const oldId = resolveAccountId(editingTx.toAccount);
        const newId = editForm.toAccount;
        if (oldId === newId) {
          const acct = accountMap[oldId];
          if (acct && Math.abs(newAED - oldAED) > 0.001)
            await updateDoc(doc(db, 'accounts', acct.id), { currentBalance: acct.currentBalance + (newAED - oldAED) / (FX[acct.currency] || 1) });
        } else {
          const o = accountMap[oldId], n = accountMap[newId];
          if (o) await updateDoc(doc(db, 'accounts', o.id), { currentBalance: o.currentBalance - oldAED / (FX[o.currency] || 1) });
          if (n) await updateDoc(doc(db, 'accounts', n.id), { currentBalance: n.currentBalance + newAED / (FX[n.currency] || 1) });
        }

      } else if (editingTx.type === 'transfer') {
        const oldFromId = resolveAccountId(editingTx.fromAccount);
        const oldToId   = resolveAccountId(editingTx.toAccount);
        const newFromId = editForm.fromAccount;
        const newToId   = editForm.toAccount;

        const oldFromAED = aed(editingTx.amount, editingTx.currency);
        const oldToAmt   = editingTx.amountTo ?? editingTx.amount;
        const oldToCur   = editingTx.currencyTo || editingTx.currency;
        const oldToAED   = aed(oldToAmt, oldToCur);

        const newFromAED = aed(newAmount, editFromCur);
        const newToAmt   = editIsXCur ? parseFloat(editForm.amountTo) : newAmount;
        const newToAED   = aed(newToAmt, editToCur);

        const oF = accountMap[oldFromId], nF = accountMap[newFromId];
        const oT = accountMap[oldToId],   nT = accountMap[newToId];

        // From account
        if (oldFromId === newFromId) {
          if (oF && Math.abs(newFromAED - oldFromAED) > 0.001)
            await updateDoc(doc(db, 'accounts', oF.id), { currentBalance: oF.currentBalance - (newFromAED - oldFromAED) / (FX[oF.currency] || 1) });
        } else {
          if (oF) await updateDoc(doc(db, 'accounts', oF.id), { currentBalance: oF.currentBalance + oldFromAED / (FX[oF.currency] || 1) });
          if (nF) await updateDoc(doc(db, 'accounts', nF.id), { currentBalance: nF.currentBalance - newFromAED / (FX[nF.currency] || 1) });
        }
        // To account
        if (oldToId === newToId) {
          if (oT && Math.abs(newToAED - oldToAED) > 0.001)
            await updateDoc(doc(db, 'accounts', oT.id), { currentBalance: oT.currentBalance + (newToAED - oldToAED) / (FX[oT.currency] || 1) });
        } else {
          if (oT) await updateDoc(doc(db, 'accounts', oT.id), { currentBalance: oT.currentBalance - oldToAED / (FX[oT.currency] || 1) });
          if (nT) await updateDoc(doc(db, 'accounts', nT.id), { currentBalance: nT.currentBalance + newToAED / (FX[nT.currency] || 1) });
        }
      }

      await updateDoc(doc(db, 'transactions', editingTx.id), {
        date: new Date(editForm.date + 'T12:00:00').toISOString(),
        description: editForm.description.trim(),
        amount: newAmount,
        currency: editFromCur,
        category: editingTx.type === 'transfer' ? 'Transfer' : editForm.category,
        notes: editForm.notes.trim(),
        ...(editingTx.type === 'expense'  && editForm.fromAccount && { fromAccount: editForm.fromAccount }),
        ...(editingTx.type === 'income'   && editForm.toAccount   && { toAccount:   editForm.toAccount }),
        ...(editingTx.type === 'transfer' && editForm.fromAccount && { fromAccount: editForm.fromAccount }),
        ...(editingTx.type === 'transfer' && editForm.toAccount   && { toAccount:   editForm.toAccount }),
        ...(editIsXCur && { amountTo: parseFloat(editForm.amountTo), currencyTo: editToCur }),
        ...(!editIsXCur && editingTx.type === 'transfer' && { amountTo: null, currencyTo: null }),
        ...(editForm.category === 'Loan' && { borrower: editForm.borrower || '' }),
      });
      setEditingTx(null);
    } catch (e) {
      setError(e.message);
    }
    setSaving(false);
  }

  async function confirmDelete() {
    if (!deletingTx) return;
    const tx = deletingTx;
    setSaving(true);
    setError('');
    try {
      const aed = toAED(tx.amount, tx.currency);
      if (tx.type === 'expense' && tx.fromAccount) {
        const acct = accountMap[tx.fromAccount];
        if (acct) await updateDoc(doc(db, 'accounts', acct.id), { currentBalance: acct.currentBalance + aed / (FX[acct.currency] || 1) });
      } else if (tx.type === 'income' && tx.toAccount) {
        const acct = accountMap[tx.toAccount];
        if (acct) await updateDoc(doc(db, 'accounts', acct.id), { currentBalance: acct.currentBalance - aed / (FX[acct.currency] || 1) });
      } else if (tx.type === 'transfer') {
        const from = accountMap[tx.fromAccount];
        const to   = accountMap[tx.toAccount];
        const fromAED = toAED(tx.amount, tx.currency);
        const toAmt   = tx.amountTo ?? tx.amount;
        const toAED_  = toAED(toAmt, tx.currencyTo || tx.currency);
        if (from) await updateDoc(doc(db, 'accounts', from.id), { currentBalance: from.currentBalance + fromAED / (FX[from.currency] || 1) });
        if (to)   await updateDoc(doc(db, 'accounts', to.id),   { currentBalance: to.currentBalance   - toAED_  / (FX[to.currency]   || 1) });
      }
      await deleteDoc(doc(db, 'transactions', tx.id));
      setDeletingTx(null);
    } catch (e) {
      setError(e.message);
    }
    setSaving(false);
  }

  const hasActiveFilters = !!(selectedType || selectedAccount || selectedCategory || search || externalFilter);

  function clearAllFilters() {
    setSelectedType('');
    setSelectedAccount('');
    setSelectedCategory('');
    setSearch('');
    setSelectedMonth(currentMonthKey);
    onClearExternalFilter?.();
  }

  return (
    <div className="space-y-4 pb-12">
      {/* Filter bar */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-3 space-y-3">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search description, notes, category…"
          className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-emerald-600 transition"
        />
        <div className="flex flex-wrap gap-2 items-center">
          <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
            className="px-3 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-gray-300 cursor-pointer">
            <option value="">All months</option>
            {months.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>

          <select value={selectedType} onChange={e => setSelectedType(e.target.value)}
            className="px-3 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-gray-300 cursor-pointer">
            <option value="">All types</option>
            <option value="expense">💸 Expense</option>
            <option value="income">💰 Income</option>
            <option value="transfer">🔄 Transfer</option>
          </select>

          <AccountSelect
            value={selectedAccount}
            onChange={setSelectedAccount}
            accounts={txAccounts}
            placeholder="All accounts"
            compact
          />

          <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}
            className="px-3 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-gray-300 cursor-pointer">
            <option value="">All categories</option>
            {CATEGORIES.map(cat => <option key={cat} value={cat}>{getCategoryEmoji(cat)} {cat}</option>)}
          </select>

          {hasActiveFilters && (
            <button onClick={clearAllFilters}
              className="px-3 py-1.5 text-xs text-gray-400 hover:text-white border border-neutral-700 rounded-lg transition">
              ✕ Clear filters
            </button>
          )}

          <div className="flex-1" />
          <span className="text-xs text-gray-600">{filtered.length} transactions</span>
        </div>
      </div>

      {/* KPI summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4">
          <div className="text-xs text-gray-500 uppercase font-semibold mb-1">Income</div>
          <div className="text-xl font-bold text-emerald-400">{fmtAED(totalIncome)}</div>
        </div>
        <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4">
          <div className="text-xs text-gray-500 uppercase font-semibold mb-1">Expenses</div>
          <div className="text-xl font-bold text-red-400">{fmtAED(totalExpense)}</div>
        </div>
        <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4">
          <div className="text-xs text-gray-500 uppercase font-semibold mb-1">Net</div>
          <div className={`text-xl font-bold ${totalIncome - totalExpense >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {totalIncome - totalExpense >= 0 ? '+' : '−'}{fmtAED(totalIncome - totalExpense)}
          </div>
        </div>
      </div>

      {/* Transactions table */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-neutral-800 bg-neutral-900/50">
                <th className="text-left py-2.5 px-3 text-gray-500 font-semibold uppercase tracking-wide">Date</th>
                <th className="text-left py-2.5 px-3 text-gray-500 font-semibold uppercase tracking-wide">Description</th>
                <th className="text-left py-2.5 px-3 text-gray-500 font-semibold uppercase tracking-wide">Category</th>
                <th className="text-left py-2.5 px-3 text-gray-500 font-semibold uppercase tracking-wide">Account</th>
                <th className="text-right py-2.5 px-3 text-gray-500 font-semibold uppercase tracking-wide">Amount</th>
                <th className="text-left py-2.5 px-3 text-gray-500 font-semibold uppercase tracking-wide">Notes</th>
                <th className="py-2.5 px-3 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-gray-600 text-sm">No transactions found</td>
                </tr>
              ) : filtered.map(tx => {
                const fromName = getAccountName(tx.fromAccount);
                const toName = getAccountName(tx.toAccount);
                const accountDisplay = tx.type === 'transfer'
                  ? `${fromName || '?'} → ${toName || '?'}`
                  : tx.type === 'income'
                  ? toName
                  : fromName;

                return (
                  <tr key={tx.id} className="border-b border-neutral-900 hover:bg-neutral-900/40 group">
                    <td className="py-2.5 px-3 text-gray-400 font-mono whitespace-nowrap">{formatDate(tx.date)}</td>
                    <td className="py-2.5 px-3 text-gray-200 max-w-[180px]">
                      <span className="block truncate">{tx.description}</span>
                    </td>
                    <td className="py-2.5 px-3 text-gray-400 whitespace-nowrap">
                      {tx.category ? `${getCategoryEmoji(tx.category)} ${tx.category}` : '—'}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-[11px]">
                      {accountDisplay ? (
                        <span className="flex items-center gap-1.5 text-gray-500">
                          <AccountBadge name={tx.type === 'transfer' ? (getAccountName(tx.fromAccount) || '') : accountDisplay} size="sm" />
                          {accountDisplay}
                        </span>
                      ) : '—'}
                    </td>
                    <td className={`py-2.5 px-3 text-right font-mono font-semibold whitespace-nowrap ${
                      tx.type === 'income' ? 'text-emerald-400' : tx.type === 'transfer' ? 'text-blue-400' : 'text-red-400'
                    }`}>
                      {tx.type === 'income' ? '+' : tx.type === 'transfer' ? '' : '−'}{tx.currency} {Number(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      {tx.type === 'transfer' && tx.amountTo && tx.currencyTo && tx.currencyTo !== tx.currency && (
                        <span className="block text-[10px] text-blue-300 font-normal">
                          → {tx.currencyTo} {Number(tx.amountTo).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-gray-600 max-w-[140px]">
                      <span className="block truncate">{tx.notes || ''}</span>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => startEdit(tx)}
                          title="Edit"
                          className="p-1 text-gray-500 hover:text-white rounded hover:bg-neutral-700 transition">
                          ✏️
                        </button>
                        <button onClick={() => { setDeletingTx(tx); setError(''); }}
                          title="Delete"
                          className="p-1 text-gray-500 hover:text-red-400 rounded hover:bg-neutral-700 transition">
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete confirmation */}
      {deletingTx && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 max-w-sm w-full">
            <h3 className="text-white font-bold mb-1">Delete transaction?</h3>
            <p className="text-gray-300 text-sm mb-1">{deletingTx.description}</p>
            <p className="text-gray-500 text-xs mb-4">
              This will reverse the account balance change. This cannot be undone.
            </p>
            {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
            <div className="flex gap-3">
              <button onClick={() => setDeletingTx(null)}
                className="flex-1 py-2.5 border border-neutral-700 text-gray-400 rounded-xl text-sm hover:text-white transition">
                Cancel
              </button>
              <button onClick={confirmDelete} disabled={saving}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold disabled:opacity-40 transition">
                {saving ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editingTx && (() => {
        // Derive currencies from selected accounts in edit form
        const editFromAcct = accountMap[editForm.fromAccount];
        const editToAcct   = accountMap[editForm.toAccount];
        const editFromCur  = editFromAcct?.currency || editingTx.currency || 'AED';
        const editToCur    = editToAcct?.currency   || editingTx.currencyTo || editFromCur;
        const editIsXCur   = editingTx.type === 'transfer' && !!editToAcct && editFromCur !== editToCur;

        // Currency badge to show next to the amount (always follows the account)
        const amtCurrency = editingTx.type === 'income'
          ? (editFromAcct?.currency || editingTx.currency || 'AED')
          : editFromCur;

        return (
        <div className="fixed inset-0 bg-black/80 flex items-start justify-center z-50 p-4 pt-16 overflow-y-auto">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-bold">Edit Transaction</h3>
              <button onClick={() => setEditingTx(null)} className="text-gray-400 hover:text-white text-lg leading-none">✕</button>
            </div>

            <div>
              <label className="text-xs text-gray-500 uppercase font-bold block mb-1">Date</label>
              <input type="date" value={editForm.date}
                onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2.5 text-white text-sm" />
            </div>

            <div>
              <label className="text-xs text-gray-500 uppercase font-bold block mb-1">Description</label>
              <input type="text" value={editForm.description}
                onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2.5 text-white text-sm" />
            </div>

            <div>
              <label className="text-xs text-gray-500 uppercase font-bold block mb-1">
                {editIsXCur ? 'Amount Sent' : 'Amount'}
              </label>
              <div className="flex gap-2">
                <input type="number" value={editForm.amount} min="0"
                  onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))}
                  className="flex-1 bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2.5 text-white text-sm" />
                <span className="bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2.5 text-gray-400 text-sm font-mono min-w-[64px] text-center">
                  {amtCurrency}
                </span>
              </div>
            </div>

            {editIsXCur && (
              <div>
                <label className="text-xs text-gray-500 uppercase font-bold block mb-1">Amount Received</label>
                <div className="flex gap-2">
                  <input type="number" value={editForm.amountTo} min="0"
                    onChange={e => setEditForm(f => ({ ...f, amountTo: e.target.value }))}
                    className="flex-1 bg-neutral-800 border border-emerald-700 rounded-xl px-3 py-2.5 text-white text-sm" />
                  <span className="bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2.5 text-gray-400 text-sm font-mono min-w-[64px] text-center">
                    {editToCur}
                  </span>
                </div>
                {editForm.amount && editForm.amountTo && parseFloat(editForm.amount) > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    Implied rate: 1 {editFromCur} = {(parseFloat(editForm.amountTo) / parseFloat(editForm.amount)).toFixed(4)} {editToCur}
                  </p>
                )}
              </div>
            )}

            {editingTx.type !== 'transfer' && (
              <div>
                <label className="text-xs text-gray-500 uppercase font-bold block mb-1">Category</label>
                <select value={editForm.category}
                  onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2.5 text-white text-sm">
                  {CATEGORIES.map(cat => <option key={cat} value={cat}>{getCategoryEmoji(cat)} {cat}</option>)}
                </select>
              </div>
            )}

            {(editingTx.type === 'expense' || editingTx.type === 'transfer') && (
              <div>
                <label className="text-xs text-gray-500 uppercase font-bold block mb-1">
                  {editingTx.type === 'transfer' ? 'From Account' : 'Paid From'}
                </label>
                <AccountSelect
                  value={editForm.fromAccount}
                  onChange={v => setEditForm(f => ({ ...f, fromAccount: v }))}
                  accounts={txAccounts}
                  placeholder="— None —"
                />
              </div>
            )}

            {(editingTx.type === 'income' || editingTx.type === 'transfer') && (
              <div>
                <label className="text-xs text-gray-500 uppercase font-bold block mb-1">To Account</label>
                <AccountSelect
                  value={editForm.toAccount}
                  onChange={v => setEditForm(f => ({ ...f, toAccount: v }))}
                  accounts={txAccounts.filter(a => a.id !== editForm.fromAccount)}
                  placeholder="— None —"
                />
              </div>
            )}

            {editForm.category === 'Loan' && (
              <div>
                <label className="text-xs text-gray-500 uppercase font-bold block mb-1">Borrower</label>
                <input type="text" value={editForm.borrower}
                  onChange={e => setEditForm(f => ({ ...f, borrower: e.target.value }))}
                  placeholder="Who borrowed this?"
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2.5 text-white text-sm" />
              </div>
            )}

            <div>
              <label className="text-xs text-gray-500 uppercase font-bold block mb-1">Notes</label>
              <input type="text" value={editForm.notes}
                onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2.5 text-white text-sm" />
            </div>

            {error && <p className="text-red-400 text-xs">{error}</p>}

            <div className="flex gap-3 pt-1">
              <button onClick={() => setEditingTx(null)}
                className="flex-1 py-2.5 border border-neutral-700 text-gray-400 rounded-xl text-sm hover:text-white transition">
                Cancel
              </button>
              <button onClick={saveEdit} disabled={saving}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold disabled:opacity-40 transition">
                {saving ? 'Saving…' : '✓ Save'}
              </button>
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
}
