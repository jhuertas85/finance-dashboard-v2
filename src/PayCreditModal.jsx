import React, { useState } from 'react';
import { doc, collection, writeBatch } from 'firebase/firestore';
import { db } from './firebase-config.js';
import { toAED } from './utils.js';

const FX = { AED: 1, USD: 3.67, EUR: 4.0, PEN: 0.95 };

function fmt2(amount, currency = 'AED') {
  return `${currency} ${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function PayCreditModal({ creditCard, accounts, transactions, onClose }) {
  // Outstanding balance in native currency (positive = what you owe)
  const outstandingNative = Math.abs(creditCard.currentBalance);
  const outstandingAED = toAED(outstandingNative, creditCard.currency);

  // Linked pending transactions: expenses charged to this credit card not yet paid
  // reconciled=false means pending payment; match by name (imported data) or ID
  const pendingTxs = transactions
    .filter(tx =>
      (tx.fromAccount === creditCard.id || tx.fromAccount === creditCard.name) &&
      tx.reconciled === false
    )
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const hasLinkedTxs = pendingTxs.length > 0;

  // Any gap between outstanding balance and sum of tracked charges
  // Positive gap = untracked charges (e.g. cash purchases not logged)
  // Negative gap = reconciliation credits reduce the balance below tracked expenses
  const trackedTotal = pendingTxs.reduce((sum, tx) => sum + toAED(tx.amount, tx.currency), 0);
  const untrackedAED = outstandingAED - trackedTotal;
  const hasUntracked = untrackedAED > 0.01;
  const hasCreditGap = untrackedAED < -0.01;      // tracked expenses > outstanding → credits exist
  const creditGapAED = hasCreditGap ? Math.abs(untrackedAED) : 0;

  const [selected, setSelected] = useState(new Set(pendingTxs.map(t => t.id)));
  const [includeUntracked, setIncludeUntracked] = useState(true);
  const [includeCreditGap, setIncludeCreditGap] = useState(true);
  const [payFromId, setPayFromId] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const payableAccounts = accounts.filter(a =>
    a.id !== creditCard.id && (a.netWorthBucket === 'capital' || a.netWorthBucket === 'usable')
  );

  const selectedTxs = pendingTxs.filter(t => selected.has(t.id));
  const selectedTotal = selectedTxs.reduce((sum, tx) => sum + toAED(tx.amount, tx.currency), 0);

  const payAmountAED = (hasLinkedTxs || hasUntracked || hasCreditGap)
    ? selectedTotal
      + (hasUntracked && includeUntracked ? untrackedAED : 0)
      - (hasCreditGap && includeCreditGap ? creditGapAED : 0)
    : outstandingAED;

  const allTxsSelected = selected.size === pendingTxs.length;
  const allSelected = allTxsSelected
    && (!hasUntracked || includeUntracked)
    && (!hasCreditGap || includeCreditGap);

  function toggleTx(id) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
      setIncludeUntracked(false);
      setIncludeCreditGap(false);
    } else {
      setSelected(new Set(pendingTxs.map(t => t.id)));
      if (hasUntracked) setIncludeUntracked(true);
      if (hasCreditGap) setIncludeCreditGap(true);
    }
  }

  async function pay() {
    if (!payFromId || payAmountAED <= 0) return;
    setSaving(true);
    setError('');
    try {
      const payFromAccount = accounts.find(a => a.id === payFromId);
      const batch = writeBatch(db);

      // Mark selected transactions as reconciled (paid off)
      if (hasLinkedTxs) {
        selectedTxs.forEach(tx => {
          batch.update(doc(db, 'transactions', tx.id), { reconciled: true });
        });
      }

      // Create transfer transaction record
      const newTxRef = doc(collection(db, 'transactions'));
      batch.set(newTxRef, {
        date: new Date().toISOString(),
        description: `Credit card payment — ${creditCard.name}`,
        amount: payAmountAED / (FX[creditCard.currency] || 1),
        type: 'transfer',
        category: 'Transfer',
        currency: creditCard.currency,
        fromAccount: payFromId,
        toAccount: creditCard.id,
        notes: hasLinkedTxs
          ? `Payment for ${selectedTxs.length} transaction(s)`
          : 'Outstanding balance payment',
      });

      // Deduct from payment account
      const payFromNewBal = payFromAccount.currentBalance - (payAmountAED / (FX[payFromAccount.currency] || 1));
      batch.update(doc(db, 'accounts', payFromId), { currentBalance: payFromNewBal });

      // Update credit card balance; zero exactly when paying everything to avoid drift
      const cardNewBal = allSelected ? 0 : creditCard.currentBalance + (payAmountAED / (FX[creditCard.currency] || 1));
      batch.update(doc(db, 'accounts', creditCard.id), { currentBalance: cardNewBal });

      await batch.commit();
      setDone(true);
    } catch (e) {
      setError(e.message);
    }
    setSaving(false);
  }

  const canPay = payFromId && payAmountAED > 0 && (selectedTxs.length > 0 || (!hasLinkedTxs) || (hasUntracked && includeUntracked));

  const totalItemCount = pendingTxs.length + (hasUntracked ? 1 : 0) + (hasCreditGap ? 1 : 0);

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
            <p className="text-gray-500 text-sm mt-1">
              {hasLinkedTxs
                ? `${selectedTxs.length} transaction${selectedTxs.length !== 1 ? 's' : ''} marked as paid`
                : 'Outstanding balance cleared'}
            </p>
            <button onClick={onClose} className="mt-4 px-6 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold">Close</button>
          </div>
        ) : (
          <>
            {/* Outstanding balance summary — always visible */}
            <div className="px-4 pt-4">
              <div className="bg-neutral-800 rounded-xl px-4 py-3 flex justify-between items-center">
                <span className="text-xs text-gray-500 uppercase font-bold">Outstanding balance</span>
                <span className="text-red-400 font-bold text-lg">{fmt2(outstandingNative, creditCard.currency)}</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {!hasLinkedTxs && !hasUntracked ? (
                /* No individual transactions tracked — direct balance payment */
                <div className="bg-neutral-800/50 border border-neutral-700 rounded-xl p-4 text-sm text-gray-400">
                  <p className="font-medium text-gray-300 mb-1">No individual charges tracked</p>
                  <p className="text-xs">
                    This balance was set directly. Paying will transfer the full outstanding amount
                    from your chosen account and bring {creditCard.name} to zero.
                  </p>
                </div>
              ) : (
                /* Linked transactions found — show with checkboxes */
                <>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-gray-500 uppercase font-bold">{totalItemCount} pending charge{totalItemCount !== 1 ? 's' : ''}</span>
                    <button onClick={toggleAll} className="text-xs text-emerald-400 hover:text-emerald-300">
                      {allSelected ? 'Deselect all' : 'Select all'}
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
                        {fmt2(tx.amount, tx.currency)}
                      </span>
                    </label>
                  ))}

                  {/* Untracked charges gap row */}
                  {hasUntracked && (
                    <label className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer border transition ${
                      includeUntracked ? 'bg-amber-900/20 border-amber-800' : 'bg-neutral-800 border-neutral-700'
                    }`}>
                      <input
                        type="checkbox"
                        checked={includeUntracked}
                        onChange={() => setIncludeUntracked(v => !v)}
                        className="accent-amber-500 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-300 text-sm">Other charges / reconciliation</p>
                        <p className="text-gray-500 text-xs">Balance adjustments not individually tracked</p>
                      </div>
                      <span className="text-amber-400 text-sm font-mono shrink-0">
                        {fmt2(untrackedAED, 'AED')}
                      </span>
                    </label>
                  )}

                  {/* Reconciliation credits row — positive adjustments that REDUCE what's owed */}
                  {hasCreditGap && (
                    <label className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer border transition ${
                      includeCreditGap ? 'bg-emerald-900/20 border-emerald-800' : 'bg-neutral-800 border-neutral-700'
                    }`}>
                      <input
                        type="checkbox"
                        checked={includeCreditGap}
                        onChange={() => setIncludeCreditGap(v => !v)}
                        className="accent-emerald-500 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-emerald-300 text-sm">Reconciliation credits</p>
                        <p className="text-gray-500 text-xs">Positive adjustments that reduce your balance</p>
                      </div>
                      <span className="text-emerald-400 text-sm font-mono shrink-0">
                        −{fmt2(creditGapAED, 'AED')}
                      </span>
                    </label>
                  )}
                </>
              )}
            </div>

            {/* Payment footer — always visible */}
            <div className="p-4 border-t border-neutral-800 space-y-3">
              {(hasLinkedTxs || hasUntracked) && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-400">{selectedTxs.length + (hasUntracked && includeUntracked ? 1 : 0)} selected</span>
                  <span className="text-white font-bold">{fmt2(payAmountAED, 'AED')}</span>
                </div>
              )}

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
                disabled={saving || !canPay}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold disabled:opacity-40 transition"
              >
                {saving ? 'Processing…' : `Pay ${fmt2(payAmountAED, 'AED')} →`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
