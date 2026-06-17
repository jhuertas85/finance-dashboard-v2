import React, { useState, useMemo } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from './firebase-config.js';
import { toAED, getCategoryEmoji } from './utils.js';

const CATEGORIES = ['Investments', 'Housing', 'Subs, Sports & Health', 'Food & Groceries', 'Car', 'Going Out', 'Purchases', 'Travel', 'Others'];
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const GRID_YEAR = 2026;

function fmtAmt(aed, rate = 1) {
  const v = Math.round((aed ?? 0) / rate);
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
  return String(v);
}

// Gradient color: green (low) → amber (approaching) → red (over)
function pctColor(pct) {
  if (pct >= 100) {
    const over = Math.min((pct - 100) / 80, 1);
    return `hsl(0, ${70 + over * 25}%, ${50 - over * 12}%)`;
  }
  if (pct >= 80) {
    const t = (pct - 80) / 20;
    return `hsl(${Math.round(38 - t * 38)}, 90%, 50%)`;
  }
  const t = pct / 80;
  return `hsl(${Math.round(142 - t * 90)}, 80%, ${Math.round(48 - t * 8)}%)`;
}

export default function BudgetGrid({ budgets, transactions, selectedCurrency = 'AED' }) {
  const now = new Date();
  const currentMonth = now.getFullYear() === GRID_YEAR ? now.getMonth() + 1 : null;

  const [editingCell, setEditingCell] = useState(null); // { category, month (null=default) }
  const [editValue, setEditValue] = useState('');
  const [collapsed, setCollapsed] = useState(false);

  const FX = { AED: 1, USD: 3.67, EUR: 4.0, PEN: 0.95 };
  const rate = FX[selectedCurrency] || 1;
  const fmt = (aed) => fmtAmt(aed, rate);

  // Spending per category per month for GRID_YEAR
  const spending = useMemo(() => {
    const map = {};
    transactions.forEach(tx => {
      const d = new Date(tx.date);
      if (d.getFullYear() !== GRID_YEAR || tx.type !== 'expense') return;
      const key = `${tx.category}:${d.getMonth() + 1}`;
      map[key] = (map[key] || 0) + toAED(tx.amount, tx.currency);
    });
    return map;
  }, [transactions]);

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
    if (ov) return { amount: ov.monthlyLimit, isOverride: true, docId: ov.id };
    const def = getDefault(category);
    return { amount: def?.monthlyLimit ?? 0, isOverride: false, docId: null };
  }

  function startEdit(category, month) {
    const val = month === null
      ? (getDefault(category)?.monthlyLimit ?? 0)
      : effective(category, month).amount;
    setEditingCell({ category, month });
    setEditValue(String(val));
  }

  async function commitEdit() {
    if (!editingCell) return;
    const { category, month } = editingCell;
    const newAmount = parseFloat(editValue);
    setEditingCell(null);
    if (isNaN(newAmount) || newAmount < 0) return;
    try {
      if (month === null) {
        const def = getDefault(category);
        if (def) {
          await updateDoc(doc(db, 'budgets', def.id), { monthlyLimit: newAmount });
        } else {
          await addDoc(collection(db, 'budgets'), { category, monthlyLimit: newAmount, year: GRID_YEAR });
        }
      } else {
        const ov = getOverride(category, month);
        if (ov) {
          await updateDoc(doc(db, 'budgets', ov.id), { monthlyLimit: newAmount });
        } else {
          await addDoc(collection(db, 'budgets'), {
            category, monthlyLimit: newAmount, month: String(month), year: GRID_YEAR,
          });
        }
      }
    } catch (e) { console.error(e); }
  }

  async function removeOverride(e, docId) {
    e.stopPropagation();
    try { await deleteDoc(doc(db, 'budgets', docId)); } catch (err) { console.error(err); }
  }

  function EditInput({ category, month }) {
    return (
      <input
        type="number"
        value={editValue}
        onChange={e => setEditValue(e.target.value)}
        onBlur={commitEdit}
        onKeyDown={e => {
          if (e.key === 'Enter') commitEdit();
          if (e.key === 'Escape') setEditingCell(null);
        }}
        autoFocus
        className="w-16 bg-neutral-800 border border-emerald-500 rounded px-1 py-0.5 text-white text-center text-xs outline-none"
      />
    );
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
                    {/* Category label */}
                    <td className="py-2 px-2 text-gray-300 font-medium whitespace-nowrap">
                      {getCategoryEmoji(cat)} {cat}
                    </td>

                    {/* Default cell */}
                    <td className="py-1 px-2 text-center">
                      {editingCell?.category === cat && editingCell?.month === null ? (
                        <EditInput category={cat} month={null} />
                      ) : (
                        <button onClick={() => startEdit(cat, null)}
                          className="text-blue-400 font-mono hover:text-blue-200 transition px-1 py-0.5 rounded hover:bg-neutral-800">
                          {fmt(def?.monthlyLimit ?? 0)}
                        </button>
                      )}
                    </td>

                    {/* Month cells */}
                    {MONTH_LABELS.map((_, i) => {
                      const m = i + 1;
                      const { amount, isOverride, docId } = effective(cat, m);
                      const spent = spending[`${cat}:${m}`] ?? 0;
                      const isPast = currentMonth != null && m < currentMonth;
                      const isCurrent = m === currentMonth;
                      const isFuture = currentMonth == null || m > currentMonth;
                      const pct = amount > 0 ? (spent / amount) * 100 : 0;
                      const isEditing = editingCell?.category === cat && editingCell?.month === m;

                      return (
                        <td key={m} className={`py-1 px-1 text-center ${isCurrent ? 'bg-emerald-950/25' : ''}`}>
                          {isEditing ? (
                            <EditInput category={cat} month={m} />
                          ) : (
                            <div onClick={() => startEdit(cat, m)}
                              className="cursor-pointer rounded px-1 py-0.5 hover:bg-neutral-800 transition inline-block w-full">
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
                          )}
                        </td>
                      );
                    })}

                    {/* Year total */}
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
                  const isPast = currentMonth != null && m < currentMonth;
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
    </div>
  );
}
