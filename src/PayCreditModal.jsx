import React, { useState } from 'react';
import { doc, collection, writeBatch } from 'firebase/firestore';
import { db } from './firebase-config.js';
import { toAED } from './utils.js';

const FX = { AED: 1, USD: 3.67, EUR: 4.0, PEN: 0.95 };

export default function PayCreditModal({ creditCard, accounts, transactions, onClose }) {
  const pendingTxs = transactions
    .filter(tx => tx.fromAccount === creditCard.id && !tx.paid)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const [selected, setSelected] = useState(new Set(pendingTxs.map(t => t.id)));
  const [payFromId, setPayFromId] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const payableAccounts = accounts.filter(a =>
    a.id !== creditCard.id && (a.netWorthBucket === 'capital' || a.netWorthBucket === 'usable')
  );

  const selectedTxs = pendingTxs.filter(t => selected.has(t.id));
  const totalAED = selectedTxs.reduce((sum, tx) => sum + toAED(tx.amount, tx.currency), 0);

  function toggleTx(id) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(selected.size === pendingTxs.length ? new Set() : new Set(pendingTxs.map(t => t.id)));
  }

  async function pay() {
    if (!payFromId || selectedTxs.length === 0 || totalAED === 0) return;
    setSaving(true);
    setError('');
    try {
      const payFromAccount = accounts.find(a => a.id === payFromId);
      const batch = writeBatch(db);

      // Mark selected transactions as paid
      selectedTxs.forEach(tx => {
        batch.update(doc(db, 'transactions', tx.id), { paid: true });
      });

      // Create transfer transaction record
      const newTxRef = doc(collection(db, 'transactions'));
      batch.set(newTxRef, {
        date: new Date().toISOString(),
        description: `Credit card payment — ${creditCard.name}`,
        amount: totalAED / (FX[creditCard.currency] || 1),
        type: 'transfer',
        category: 'Transfer',
        currency: creditCard.currency,
        fromAccount: payFromId,
        toAccount: creditCard.id,
        notes: `Payment for ${selectedTxs.length} transaction(s)`,
      });

      // Update payment account balance (deduct amount)
      const payFromNewBal = payFromAccount.currentBalance - (totalAED / (FX[payFromAccount.currency] || 1));
      batch.update(doc(db, 'accounts', payFromId), { currentBalance: payFromNewBal });

      // Update credit card balance (add back — makes it less negative toward 0)
      const cardNewBal = creditCard.currentBalance + (totalAED / (FX[creditCard.currency] || 1));
      batch.update(doc(db, 'accounts', creditCard.id), { currentBalance: cardNewBal });

      await batch.commit();
      setDone(true);
    } catch (e) {
      setError(e.message);
    }
    setSaving(false);
  }

  const totalDisplay = `AED ${totalAED.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-neutral-800">
          <h2 className="text-white font-bold">💳 Pay {creditCard.name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-lg">✕</button>
        </div>

        {done ? (
          <div className="p-8 text-center">
            <div className="text-5xl mb-3">✅</div>
            <p className="text-emerald-400 font-semibold">Payment applied!</p>
            <p className="text-gray-500 text-sm mt-1">{selectedTxs.length} transaction{selectedTxs.length !== 1 ? 's' : ''} marked as paid</p>
            <button onClick={onClose} className="mt-4 px-6 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold">Close</button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {pendingTxs.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-3">✓</div>
                  <p className="text-emerald-400 font-semibold">No pending transactions</p>
                  <p className="text-gray-500 text-sm mt-1">{creditCard.name} has no unpaid charges</p>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs text-gray-500 uppercase font-bold">{pendingTxs.length} pending</span>
                    <button onClick={toggleAll} className="text-xs text-emerald-400 hover:text-emerald-300">
                      {selected.size === pendingTxs.length ? 'Deselect all' : 'Select all'}
                    </button>
                  </div>
                  {pendingTxs.map(tx => (
                    <label key={tx.id} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer border transition ${
                      selected.has(tx.id) ? 'bg-emerald-900/20 border-emerald-800' : 'bg-neutral-800 border-neutral-700'
                    }`}>
                      <input
                        type="checkbox"
                        checked={selected.has(tx.id)}
                        onChange={() => toggleTx(tx.id)}
                        className="accent-emerald-500 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm truncate">{tx.description}</p>
                        <p className="text-gray-500 text-xs">
                          {new Date(tx.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                          {tx.category && ` · ${tx.category}`}
                        </p>
                      </div>
                      <span className="text-red-400 text-sm font-mono shrink-0">
                        {tx.currency} {Number(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </label>
                  ))}
                </>
              )}
            </div>

            {pendingTxs.length > 0 && (
              <div className="p-4 border-t border-neutral-800 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">{selectedTxs.length} selected</span>
                  <span className="text-white font-bold">{totalDisplay}</span>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-gray-500 mb-1 block">Pay from account</label>
                  <select
                    value={payFromId}
                    onChange={e => setPayFromId(e.target.value)}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2.5 text-white text-sm"
                  >
                    <option value="">— Select account —</option>
                    {payableAccounts.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.currency} {Number(a.currentBalance).toLocaleString(undefined, { maximumFractionDigits: 0 })})
                      </option>
                    ))}
                  </select>
                </div>

                {error && <p className="text-red-400 text-xs">{error}</p>}

                <button
                  onClick={pay}
                  disabled={saving || !payFromId || selectedTxs.length === 0}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold disabled:opacity-40 transition"
                >
                  {saving ? 'Processing…' : `Pay ${totalDisplay} →`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
