import React, { useState } from 'react';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase-config.js';
import { toAED, getCategoryEmoji } from './utils.js';

const CATEGORIES = ['Investments', 'Housing', 'Subs, Sports & Health', 'Food & Groceries', 'Car', 'Going Out', 'Purchases', 'Travel', 'Others'];
const CURRENCIES = ['AED', 'USD', 'EUR', 'PEN'];
const FX = { AED: 1, USD: 3.67, EUR: 4.0, PEN: 0.95 };

function evalExpr(str) {
  const s = String(str).trim();
  if (!s) return 0;
  if (/^[\d+\-*/.() ]+$/.test(s)) {
    try { return Math.abs(Function('"use strict";return(' + s + ')')()) || 0; } catch {}
  }
  return Math.abs(parseFloat(s)) || 0;
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getLastTx(transactions, accountId) {
  const txs = transactions
    .filter(t => t.fromAccount === accountId || t.toAccount === accountId)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  return txs[0] || null;
}

export default function AddTransactionModal({ accounts, transactions = [], recurringBills = [], onClose, initialTab = 'manual' }) {
  const [tab, setTab] = useState(initialTab);
  const [type, setType] = useState('expense');
  const [date, setDate] = useState(todayISO());
  const [description, setDescription] = useState('');
  const [amountExpr, setAmountExpr] = useState('');
  const [currency, setCurrency] = useState('AED');
  const [category, setCategory] = useState('Others');
  const [fromAccount, setFromAccount] = useState(accounts[0]?.id || '');
  const [toAccount, setToAccount] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedCount, setSavedCount] = useState(0);

  const activeAccount = accounts.find(a => a.id === fromAccount);
  const lastTx = activeAccount ? getLastTx(transactions, activeAccount.id) : null;

  function reset() {
    setDescription('');
    setAmountExpr('');
    setNotes('');
    setError('');
  }

  async function save(keepOpen = false) {
    const amount = evalExpr(amountExpr);
    if (!amount || amount <= 0) { setError('Enter a valid amount'); return; }
    const acct = accounts.find(a => a.id === fromAccount);
    if (type !== 'income' && !acct) { setError('Select an account'); return; }

    setSaving(true);
    setError('');
    try {
      await addDoc(collection(db, 'transactions'), {
        date: new Date(date + 'T12:00:00').toISOString(),
        description: description.trim() || category,
        amount,
        type,
        category: type === 'transfer' ? 'Transfer' : category,
        currency,
        fromAccount: type === 'income' ? null : fromAccount,
        toAccount: type === 'income' ? fromAccount : (type === 'transfer' ? toAccount : null),
        notes: notes.trim(),
      });

      // Update account balances
      const aedAmt = toAED(amount, currency);

      if (type === 'expense' && acct) {
        const newBal = acct.currentBalance - (aedAmt / (FX[acct.currency] || 1));
        await updateDoc(doc(db, 'accounts', acct.id), { currentBalance: newBal });
      } else if (type === 'income' && acct) {
        const newBal = acct.currentBalance + (aedAmt / (FX[acct.currency] || 1));
        await updateDoc(doc(db, 'accounts', acct.id), { currentBalance: newBal });
      } else if (type === 'transfer') {
        if (acct) {
          const newBal = acct.currentBalance - (aedAmt / (FX[acct.currency] || 1));
          await updateDoc(doc(db, 'accounts', acct.id), { currentBalance: newBal });
        }
        const toAcct = accounts.find(a => a.id === toAccount);
        if (toAcct) {
          const newBal = toAcct.currentBalance + (aedAmt / (FX[toAcct.currency] || 1));
          await updateDoc(doc(db, 'accounts', toAcct.id), { currentBalance: newBal });
        }
      }

      setSavedCount(n => n + 1);
      if (keepOpen) { reset(); }
      else { onClose(); }
    } catch (e) {
      setError(e.message);
    }
    setSaving(false);
  }

  async function postRecurringBill(bill) {
    setSaving(true);
    setError('');
    try {
      await addDoc(collection(db, 'transactions'), {
        date: new Date().toISOString(),
        description: bill.name,
        amount: bill.amount,
        type: 'expense',
        category: bill.category || 'Others',
        currency: bill.currency || 'AED',
        fromAccount: null,
        toAccount: null,
        notes: 'Recurring bill',
      });
      setSavedCount(n => n + 1);
    } catch (e) {
      setError(e.message);
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-start justify-center z-50 p-4 pt-12 overflow-y-auto">
      <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-neutral-800">
          <div>
            <h2 className="text-white font-bold text-sm">🧾 + Add Transactions</h2>
            {activeAccount && (
              <p className="text-xs text-gray-500 mt-0.5">
                💳 {activeAccount.name}
                {lastTx && ` — last: ${new Date(lastTx.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })} · ${lastTx.description} · ${lastTx.currency} ${lastTx.amount}`}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white ml-4 text-lg leading-none">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-neutral-800">
          {[['manual', '✏️ Manual Entry'], ['recurring', '🔄 Recurring Bills']].map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3 text-xs font-semibold transition ${tab === t ? 'text-emerald-400 border-b-2 border-emerald-500' : 'text-gray-500 hover:text-gray-300'}`}
            >{label}</button>
          ))}
        </div>

        {savedCount > 0 && (
          <div className="mx-4 mt-3 px-3 py-2 bg-emerald-900/30 border border-emerald-700 rounded-lg text-xs text-emerald-400">
            ✓ {savedCount} transaction{savedCount > 1 ? 's' : ''} saved
          </div>
        )}

        {tab === 'manual' ? (
          <div className="p-4 space-y-4">
            {/* Type Toggle */}
            <div className="flex gap-2">
              {[['expense', '💸 Expense', 'bg-emerald-600'], ['income', '💰 Income', 'bg-blue-600'], ['transfer', '🔄 Transfer', 'bg-purple-600']].map(([t, label, col]) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition ${type === t ? `${col} text-white` : 'bg-neutral-800 text-gray-400 hover:text-gray-200'}`}
                >{label}</button>
              ))}
            </div>

            {/* Date */}
            <div>
              <label className="text-xs font-bold uppercase text-gray-500 mb-1 block">Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2.5 text-white text-sm" />
            </div>

            {/* Description */}
            <div>
              <label className="text-xs font-bold uppercase text-gray-500 mb-1 block">Description</label>
              <input type="text" value={description} onChange={e => setDescription(e.target.value)}
                placeholder="What was this for?"
                className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2.5 text-white text-sm placeholder-gray-600" />
            </div>

            {/* Amount */}
            <div>
              <label className="text-xs font-bold uppercase text-gray-500 mb-1 block">Amount (supports expressions: 45+30)</label>
              <div className="flex gap-2">
                <input type="text" value={amountExpr} onChange={e => setAmountExpr(e.target.value)}
                  placeholder="0 or 45+30"
                  className="flex-1 bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2.5 text-white text-sm placeholder-gray-600" />
                <select value={currency} onChange={e => setCurrency(e.target.value)}
                  className="bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2.5 text-white text-sm">
                  {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              {amountExpr && /[+\-*/]/.test(amountExpr) && (
                <p className="text-xs text-gray-500 mt-1">= {evalExpr(amountExpr).toFixed(2)}</p>
              )}
            </div>

            {/* Category */}
            {type !== 'transfer' && (
              <div>
                <label className="text-xs font-bold uppercase text-gray-500 mb-1 block">Category</label>
                <select value={category} onChange={e => setCategory(e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2.5 text-white text-sm">
                  {CATEGORIES.map(c => <option key={c} value={c}>{getCategoryEmoji(c)} {c}</option>)}
                </select>
              </div>
            )}

            {/* From / Paid From */}
            <div>
              <label className="text-xs font-bold uppercase text-gray-500 mb-1 block">
                {type === 'income' ? 'To Account' : type === 'transfer' ? 'From Account' : 'Paid From'}
              </label>
              <select value={fromAccount} onChange={e => setFromAccount(e.target.value)}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2.5 text-white text-sm">
                <option value="">— Select —</option>
                {accounts.map(a => <option key={a.id} value={a.id}>🔵 {a.name}</option>)}
              </select>
            </div>

            {/* To Account (transfer only) */}
            {type === 'transfer' && (
              <div>
                <label className="text-xs font-bold uppercase text-gray-500 mb-1 block">To Account</label>
                <select value={toAccount} onChange={e => setToAccount(e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2.5 text-white text-sm">
                  <option value="">— Select —</option>
                  {accounts.filter(a => a.id !== fromAccount).map(a => <option key={a.id} value={a.id}>🔵 {a.name}</option>)}
                </select>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="text-xs font-bold uppercase text-gray-500 mb-1 block">Notes</label>
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2.5 text-white text-sm" />
            </div>

            {error && <p className="text-red-400 text-xs">{error}</p>}

            <button onClick={() => save(true)} disabled={saving}
              className="w-full py-3 border border-neutral-700 text-gray-300 rounded-xl text-sm font-medium hover:bg-neutral-800 disabled:opacity-40 transition">
              + Add Another
            </button>
            <button onClick={() => save(false)} disabled={saving}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold disabled:opacity-50 transition">
              {saving ? 'Saving…' : '✓ Save & Close'}
            </button>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {recurringBills.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-6">No recurring bills configured</p>
            ) : (
              recurringBills.map(bill => (
                <div key={bill.id} className="flex items-center justify-between bg-neutral-800 rounded-xl px-4 py-3">
                  <div>
                    <p className="text-sm text-white font-medium">{bill.name}</p>
                    <p className="text-xs text-gray-500">{bill.currency} {bill.amount} · {bill.category}</p>
                  </div>
                  <button onClick={() => postRecurringBill(bill)} disabled={saving}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold disabled:opacity-40">
                    Post
                  </button>
                </div>
              ))
            )}
            {error && <p className="text-red-400 text-xs">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
