import React, { useState } from 'react';
import { doc, updateDoc, addDoc, collection } from 'firebase/firestore';
import { db } from './firebase-config.js';

const FX = { AED: 1, USD: 3.67, EUR: 4.0, PEN: 0.95 };

function toNative(aedAmount, currency) {
  return aedAmount / (FX[currency] || 1);
}

export default function ReconcileModal({ accounts, onClose }) {
  const [selectedId, setSelectedId] = useState('');
  const [realBalance, setRealBalance] = useState('');
  const [currency, setCurrency] = useState('AED');
  const [diff, setDiff] = useState(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [silent, setSilent] = useState(false);

  const account = accounts.find(a => a.id === selectedId);

  const currentInCurrency = account
    ? (account.currentBalance * (FX[currency] || 1)) / (FX[account.currency] || 1)
    : 0;

  function checkDiff() {
    if (!account) return;
    const val = realBalance === '' ? 0 : parseFloat(realBalance);
    setDiff(val - currentInCurrency);
  }

  async function applyAdjustment() {
    if (!account || diff === null) return;
    setSaving(true);
    setError('');
    try {
      const realVal = realBalance === '' ? 0 : parseFloat(realBalance);
      const realNative = realVal / ((FX[currency] || 1) / (FX[account.currency] || 1));
      const adjAmountInCurrency = Math.abs(realVal - currentInCurrency);

      if (!silent) {
        const isCreditCardExpense = diff < 0 && account.netWorthBucket === 'debt';
        await addDoc(collection(db, 'transactions'), {
          date: new Date().toISOString(),
          description: `Reconciliation — ${account.name}`,
          amount: adjAmountInCurrency,
          type: diff >= 0 ? 'income' : 'expense',
          category: 'Others',
          currency,
          fromAccount: diff < 0 ? account.id : null,
          toAccount: diff >= 0 ? account.id : null,
          notes: 'Reconciliation adjustment',
          ...(isCreditCardExpense && { reconciled: false }),
        });
      }

      await updateDoc(doc(db, 'accounts', account.id), { currentBalance: realNative });
      setDone(true);
    } catch (e) {
      setError(e.message);
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-neutral-800">
          <h2 className="text-white font-bold">⚖️ Reconcile Account</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-lg">✕</button>
        </div>

        <div className="p-4 space-y-4">
          {done ? (
            <div className="text-center py-8">
              <div className="text-5xl mb-3">✅</div>
              <p className="text-emerald-400 font-semibold">Account reconciled!</p>
              <button onClick={onClose} className="mt-4 px-6 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold">Close</button>
            </div>
          ) : (
            <>
              {/* Account selector */}
              <div>
                <label className="text-xs font-bold uppercase text-gray-500 mb-1 block">Account</label>
                <select
                  value={selectedId}
                  onChange={e => {
                    setSelectedId(e.target.value);
                    setDiff(null);
                    setRealBalance('');
                    const a = accounts.find(x => x.id === e.target.value);
                    if (a) setCurrency(a.currency);
                  }}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2.5 text-white text-sm"
                >
                  <option value="">— Select —</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({a.currency} {Number(a.currentBalance).toLocaleString(undefined, { maximumFractionDigits: 2 })})</option>
                  ))}
                </select>
              </div>

              {/* Current recorded balance */}
              {account && (
                <div className="bg-neutral-800 rounded-xl px-4 py-3 text-xs">
                  <span className="text-gray-500">Recorded balance: </span>
                  <span className="text-white font-mono font-semibold">
                    {currency} {currentInCurrency.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              {/* Real balance input */}
              <div>
                <label className="text-xs font-bold uppercase text-gray-500 mb-1 block">Your Real Balance</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={realBalance}
                    onChange={e => { setRealBalance(e.target.value); setDiff(null); }}
                    placeholder="0.00"
                    className="flex-1 bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2.5 text-white text-sm"
                  />
                  <select value={currency} onChange={e => { setCurrency(e.target.value); setDiff(null); }}
                    className="bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2.5 text-white text-sm">
                    {['AED', 'USD', 'EUR', 'PEN'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {/* Difference result */}
              {diff !== null && (
                <div className={`rounded-xl px-4 py-3 border text-sm ${
                  Math.abs(diff) < 0.01
                    ? 'bg-emerald-900/30 border-emerald-700'
                    : diff > 0 ? 'bg-blue-900/30 border-blue-700' : 'bg-red-900/30 border-red-700'
                }`}>
                  {Math.abs(diff) < 0.01 ? (
                    <p className="text-emerald-400 font-semibold">✓ Balances match — no adjustment needed</p>
                  ) : (
                    <>
                      <p className={diff > 0 ? 'text-blue-400' : 'text-red-400'}>
                        Difference: {diff > 0 ? '+' : ''}{diff.toFixed(2)} {currency}
                      </p>
                      <p className="text-gray-500 text-xs mt-0.5">
                        {diff > 0 ? 'Account is under-recorded — will add income adjustment' : 'Account is over-recorded — will add expense adjustment'}
                      </p>
                      <label className="flex items-center gap-2 mt-3 cursor-pointer select-none">
                        <input type="checkbox" checked={silent} onChange={e => setSilent(e.target.checked)}
                          className="accent-amber-500 w-3.5 h-3.5" />
                        <span className="text-xs text-gray-400">
                          Silent correction — update balance only, <span className="text-gray-500">no adjustment transaction</span>
                        </span>
                      </label>
                      <button onClick={applyAdjustment} disabled={saving}
                        className="mt-2 w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold disabled:opacity-40">
                        {saving ? 'Saving…' : silent ? 'Set Balance Directly' : 'Apply Adjustment & Update Balance'}
                      </button>
                    </>
                  )}
                </div>
              )}

              {error && <p className="text-red-400 text-xs">{error}</p>}

              <button onClick={checkDiff} disabled={!selectedId}
                className="w-full py-3 bg-neutral-700 hover:bg-neutral-600 text-white rounded-xl text-sm font-bold disabled:opacity-40 transition">
                ⚖️ Check Difference
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
