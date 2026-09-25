import React, { useState, useMemo } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from './firebase-config.js';
import { toAED, getCategoryEmoji } from './utils.js';

const CATEGORIES = ['Investments', 'Housing', 'Subs, Sports & Health', 'Food & Groceries', 'Car', 'Going Out', 'Purchases', 'Travel', 'Others'];
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmtAmt(aed, rate = 1) {
  const v = Math.round((aed ?? 0) / rate);
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
  return String(v);
}

// Green < 60%, yellow 60–100%, red > 100%
// 0-50%: light green · 50-75%: green · 75-100%: yellow · ≥100%: red (intensifies)
function pctColor(pct) {
  if (pct >= 100) {
    const over = Math.min((pct - 100) / 80, 1);
    return `hsl(0, ${70 + over * 25}%, ${50 - over * 12}%)`;
  }
  if (pct >= 75) {
    const t = (pct - 75) / 25;
    return `hsl(${Math.round(45 - t * 7)}, 95%, 50%)`;
  }
  if (pct >= 50) {
    return 'hsl(142, 72%, 42%)';
  }
  return 'hsl(142, 60%, 62%)';
}

export default function BudgetGrid({ budgets, transactions, selectedCurrency = 'AED' }) {
  const now = new Date();
  const GRID_YEAR = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const [modal, setModal] = useState(null); // { category, month (null=default), amount, reason }
  const [collapsed, setCollapsed] = useState(false);
  const [tooltip, setTooltip] = useState(null); // { text, x, y }

  const FX = { AED: 1, USD: 3.67, EUR: 4.0, PEN: 0.95 };
  const rate = FX[selectedCurrency] || 1;
  const fmt = (aed) => fmtAmt(aed, rate);

  const spending = useMemo(() => {
    const map = {};
    transactions.forEach(tx => {
      const d = new Date(tx.date);
      if (d.getFullYear() !== GRID_YEAR || tx.type !== 'expense') return;
      const key = `${tx.category}:${d.getMonth() + 1}`;
      map[key] = (map[key] || 0) + toAED(tx.amount, tx.currency);
    });
    return map;
  }, [transactions, GRID_YEAR]);

  function getDefault(category) {
    return budgets.find(b => b.category === category && !b.month) ?? null;
  }
  function getOverride(category, month) {
    return budgets.find(b =>
      b.category === category && b.month &&
      parseInt(b.month) === month && parseInt(b.year) === GRID_YEAR
    ) ?? null;
  }
  function effective(category, month) {
    const ov = getOverride(category, month);
    if (ov) return { amount: ov.monthlyLimit, isOverride: true, docId: ov.id, reason: ov.reason ?? '' };
    const def = getDefault(category);
    return { amount: def?.monthlyLimit ?? 0, isOverride: false, docId: null, reason: '' };
  }

  function openModal(category, month) {
    const existing = month === null
      ? getDefault(category)
      : getOverride(category, month);
    const current = month === null
      ? (getDefault(category)?.monthlyLimit ?? 0)
      : effective(category, month).amount;
    setModal({
      category,
      month,
      amount: String(current),
      reason: existing?.reason ?? '',
    });
  }

  async function commitModal() {
    if (!modal) return;
    const { category, month, amount, reason } = modal;
    const newAmount = parseFloat(amount);
    setModal(null);
    if (isNaN(newAmount) || newAmount < 0) return;
    try {
      if (month === null) {
        const def = getDefault(category);
        if (def) {
          await updateDoc(doc(db, 'budgets', def.id), { monthlyLimit: newAmount, reason });
        } else {
          await addDoc(collection(db, 'budgets'), { category, monthlyLimit: newAmount, year: GRID_YEAR, reason });
        }
      } else {
        const ov = getOverride(category, month);
        if (ov) {
          await updateDoc(doc(db, 'budgets', ov.id), { monthlyLimit: newAmount, reason });
        } else {
          await addDoc(collection(db, 'budgets'), {
            category, monthlyLimit: newAmount, month: String(month), year: GRID_YEAR, reason,
          });
        }
      }
    } catch (e) { console.error(e); }
  }

  async function removeOverride(e, docId) {
    e.stopPropagation();
    try { await deleteDoc(doc(db, 'budgets', docId)); } catch (err) { console.error(err); }
  }

  function showTooltip(e, text) {
    if (!text) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({ text, x: rect.left + rect.width / 2, y: rect.top - 8 });
  }

  return (
    <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span>📋</span>
            <h3 className="text-sm font-bold text-white">Budget Overview {GRID_YEAR}</h3>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Click any cell to edit · <span className="text-yellow-400">●</span> = override · × = revert to default
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <p className="text-xs text-gray-600 hidden xl:block text-right">
            Default column = every month. Month column = that month only (override).
          </p>
          <button onClick={() => setCollapsed(c => !c)}
            className="text-xs text-gray-400 hover:text-white border border-neutral-700 rounded-lg px-3 py-1.5 transition">
            {collapsed ? '▼ Expand' : '▲ Collapse'}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="overflow-x-auto">
          <table className="text-xs border-collapse" style={{ minWidth: 1050 }}>
            <colgroup>
              <col style={{ minWidth: 148 }} />
              <col style={{ minWidth: 68 }} />
              {MONTH_LABELS.map((_, i) => <col key={i} style={{ minWidth: 70 }} />)}
              <col style={{ minWidth: 78 }} />
            </colgroup>
            <thead>
              <tr className="border-b border-neutral-800">
                <th className="text-left py-2 px-2 text-gray-500 font-semibold tracking-wide">CATEGORY</th>
                <th className="py-2 px-2 text-blue-400 font-bold text-center">DEFAULT</th>
                {MONTH_LABELS.map((m, i) => (
                  <th key={m} className={`py-2 px-2 font-bold text-center ${i + 1 === currentMonth ? 'text-emerald-400' : 'text-gray-400'}`}>
                    {m.toUpperCase()}
                  </th>
                ))}
                <th className="py-2 px-2 text-yellow-400 font-bold text-right">YEAR</th>
              </tr>
            </thead>
            <tbody>
              {CATEGORIES.map(cat => {
                const def = getDefault(cat);
                const yearTotal = MONTH_LABELS.reduce((s, _, i) => s + effective(cat, i + 1).amount, 0);
                return (
                  <tr key={cat} className="border-b border-neutral-900 hover:bg-neutral-900/20">
                    <td className="py-2 px-2 text-gray-300 font-medium whitespace-nowrap">
                      {getCategoryEmoji(cat)} {cat}
                    </td>

                    {/* Default cell */}
                    <td className="py-1 px-2 text-center">
                      <button onClick={() => openModal(cat, null)}
                        className="text-blue-400 font-mono hover:text-blue-200 transition px-1 py-0.5 rounded hover:bg-neutral-800">
                        {fmt(def?.monthlyLimit ?? 0)}
                      </button>
                    </td>

                    {/* Month cells */}
                    {MONTH_LABELS.map((_, i) => {
                      const m = i + 1;
                      const { amount, isOverride, docId, reason } = effective(cat, m);
                      const spent = spending[`${cat}:${m}`] ?? 0;
                      const isPast = m < currentMonth;
                      const isCurrent = m === currentMonth;
                      const pct = amount > 0 ? (spent / amount) * 100 : 0;

                      return (
                        <td key={m} className={`py-1 px-1 text-center ${isCurrent ? 'bg-emerald-950/25' : ''}`}>
                          <div
                            onClick={() => openModal(cat, m)}
                            onMouseEnter={reason ? e => showTooltip(e, reason) : undefined}
                            onMouseLeave={() => setTooltip(null)}
                            className="cursor-pointer rounded px-1 py-0.5 hover:bg-neutral-800 transition inline-block w-full"
                          >
                            <div className={`font-mono flex items-center justify-center gap-0.5 leading-tight ${isOverride ? 'text-yellow-400' : 'text-gray-200'}`}>
                              <span>{fmt(amount)}</span>
                              {isOverride && (
                                <button onClick={e => removeOverride(e, docId)}
                                  className="text-gray-500 hover:text-red-400 ml-0.5 text-[11px] leading-none font-bold"
                                  title="Revert to default">×</button>
                              )}
                            </div>
                            {(isPast || isCurrent) && amount > 0 && (
                              <div className="text-[10px] font-bold leading-tight mt-0.5"
                                style={{ color: pctColor(pct) }}>
                                {Math.round(pct)}%
                              </div>
                            )}
                          </div>
                        </td>
                      );
                    })}

                    <td className="py-1 px-2 text-right text-yellow-400 font-mono font-bold">
                      {fmt(yearTotal)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-neutral-700">
                <td className="py-2.5 px-2 font-bold text-white uppercase tracking-wide text-xs">Total</td>
                <td className="py-1 px-2 text-center font-mono font-bold text-blue-400">
                  {fmt(CATEGORIES.reduce((s, cat) => s + (getDefault(cat)?.monthlyLimit ?? 0), 0))}
                </td>
                {MONTH_LABELS.map((_, i) => {
                  const m = i + 1;
                  const total = CATEGORIES.reduce((s, cat) => s + effective(cat, m).amount, 0);
                  const spent = CATEGORIES.reduce((s, cat) => s + (spending[`${cat}:${m}`] ?? 0), 0);
                  const isPast = m < currentMonth;
                  const isCurrent = m === currentMonth;
                  const pct = total > 0 ? (spent / total) * 100 : 0;
                  const color = (isPast || isCurrent) && total > 0 ? pctColor(pct) : '#6b7280';
                  return (
                    <td key={m} className={`py-1 px-1 text-center ${isCurrent ? 'bg-emerald-950/25' : ''}`}>
                      <div className="font-mono font-bold" style={{ color }}>{fmt(total)}</div>
                      {(isPast || isCurrent) && total > 0 && (
                        <div className="text-[10px] font-bold leading-tight mt-0.5" style={{ color: pctColor(pct) }}>
                          {Math.round(pct)}%
                        </div>
                      )}
                    </td>
                  );
                })}
                <td className="py-1 px-2 text-right font-mono font-bold text-yellow-400">
                  {fmt(CATEGORIES.reduce((s, cat) =>
                    s + MONTH_LABELS.reduce((ms, _, i) => ms + effective(cat, i + 1).amount, 0), 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Reason tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{ left: tooltip.x, top: tooltip.y, transform: 'translate(-50%, -100%)' }}
        >
          <div className="bg-neutral-800 border border-neutral-600 rounded-lg px-3 py-2 text-xs text-gray-200 max-w-xs shadow-xl">
            💬 {tooltip.text}
          </div>
          <div className="w-2 h-2 bg-neutral-800 border-r border-b border-neutral-600 rotate-45 mx-auto -mt-1" />
        </div>
      )}

      {/* Edit modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-neutral-800">
              <div>
                <h2 className="text-white font-bold text-sm">
                  {getCategoryEmoji(modal.category)} {modal.category}
                </h2>
                <p className="text-gray-500 text-xs mt-0.5">
                  {modal.month === null ? 'Default (all months)' : `${MONTH_LABELS[modal.month - 1]} ${GRID_YEAR}`}
                </p>
              </div>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-white text-lg">✕</button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="text-xs font-bold uppercase text-gray-500 mb-1 block">Budget amount (AED)</label>
                <input
                  type="number"
                  value={modal.amount}
                  onChange={e => setModal(m => ({ ...m, amount: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') commitModal(); if (e.key === 'Escape') setModal(null); }}
                  autoFocus
                  className="w-full bg-neutral-800 border border-neutral-700 focus:border-emerald-500 rounded-xl px-3 py-2.5 text-white text-sm outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-gray-500 mb-1 block">Reason for change</label>
                <textarea
                  value={modal.reason}
                  onChange={e => setModal(m => ({ ...m, reason: e.target.value }))}
                  placeholder="Why is this budget being set or changed?"
                  rows={3}
                  className="w-full bg-neutral-800 border border-neutral-700 focus:border-emerald-500 rounded-xl px-3 py-2.5 text-white text-sm outline-none resize-none placeholder-gray-600"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setModal(null)}
                  className="flex-1 py-2.5 border border-neutral-700 text-gray-400 hover:text-white rounded-xl text-sm transition">
                  Cancel
                </button>
                <button onClick={commitModal}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold transition">
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
