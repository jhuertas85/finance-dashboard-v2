import React, { useState, useRef } from 'react';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase-config.js';
import { toAED, getCategoryEmoji } from './utils.js';

const CATEGORIES = ['Investments', 'Housing', 'Subs, Sports & Health', 'Food & Groceries', 'Car', 'Going Out', 'Purchases', 'Travel', 'Others'];
const CURRENCIES = ['AED', 'USD', 'EUR', 'PEN'];
const FX = { AED: 1, USD: 3.67, EUR: 4.0, PEN: 0.95 };

const CATEGORY_KEYWORDS = {
  'Car':                    ['bolt', 'careem', 'uber', 'taxi', 'hertz', 'trnsp', 'salik', 'parking', 'petrol', 'adnoc', 'enoc', 'emarat', 'nol card', 'rta', 'dubai taxi'],
  'Food & Groceries':       ['talabat', 'deliveroo', 'grocery', 'supermarket', 'lulu', 'spinneys', 'waitrose', 'geant', 'carrefour', 'hypermarket', 'mcdonalds', 'kfc', 'subway', 'domino', 'pizza', 'shawarma', 'burger', 'bakery'],
  'Going Out':              ['lounge', 'restaurant', 'cafe', 'bar', 'pub', 'millennium', 'swissotel', 'hilton', 'marriott', 'jumeirah', 'ceviche', 'dmcc', 'mcgettigans', 'fusion', 'grand millennium', 'starbucks', 'cinema', 'vox', 'reel', 'bowling', 'entertainment'],
  'Housing':                ['dewa', 'etisalat', 'du internet', 'du google', 'emaar', 'empower', 'chiller', 'maintenance', 'municipality', 'addc', 'fewa', 'sewa', 'smartpayments'],
  'Subs, Sports & Health':  ['netflix', 'spotify', 'gym', 'fitness', 'audible', 'youtube', 'chatgpt', 'chat gpt', 'apple.com', 'google one', 'microsoft', 'adobe', 'clinic', 'pharmacy', 'medical', 'doctor', 'hospital'],
  'Travel':                 ['flight', 'airline', 'emirates', 'flydubai', 'airblue', 'airbnb', 'booking.com', 'expedia', 'visa fee', 'holiday', 'tour', 'hotel'],
  'Investments':            ['mapfre', 'pacifico', 'insurance', 'invest', 'brokerage', 'transfer to'],
  'Purchases':              ['amazon', 'noon', 'ikea', 'aliexpress', 'zara', 'h&m', 'gap', 'decathlon', 'ace hardware', 'talabat mart', 'shein', 'namshi'],
};

function suggestCategory(description) {
  const desc = description.toLowerCase();
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => desc.includes(kw))) return cat;
  }
  return 'Others';
}

// Parse ordinal suffix: 1 → "1st", 12 → "12th", 22 → "22nd"
function ordinal(n) {
  const s = ['th','st','nd','rd'];
  const v = n % 100;
  return n + (s[(v-20)%10] || s[v] || s[0]);
}

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

// ── CSV parser ────────────────────────────────────────────────────────────────
const MONTH_IDX = { jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11 };

function parseDateStr(str) {
  // "19 Jun 2026" or "19/06/2026" or "2026-06-19"
  str = str.trim();
  const parts = str.split(/[\s/\-]/);
  if (parts.length === 3) {
    // "DD Mon YYYY"
    const mIdx = MONTH_IDX[parts[1]?.toLowerCase().slice(0,3)];
    if (mIdx !== undefined) {
      const d = parseInt(parts[0]), y = parseInt(parts[2]);
      if (!isNaN(d) && !isNaN(y)) return `${y}-${String(mIdx+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    }
    // "YYYY-MM-DD"
    if (parts[0].length === 4) return str.slice(0,10);
    // "DD/MM/YYYY"
    const d2 = parseInt(parts[0]), m2 = parseInt(parts[1]), y2 = parseInt(parts[2]);
    if (!isNaN(d2) && !isNaN(m2) && !isNaN(y2)) {
      return `${y2}-${String(m2).padStart(2,'0')}-${String(d2).padStart(2,'0')}`;
    }
  }
  const fallback = new Date(str);
  return isNaN(fallback) ? null : fallback.toISOString().slice(0,10);
}

function parseCSVLine(line) {
  const result = [];
  let field = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') { inQ = !inQ; }
    else if (line[i] === ',' && !inQ) { result.push(field.trim()); field = ''; }
    else { field += line[i]; }
  }
  result.push(field.trim());
  return result;
}

function parseStatementCSV(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  // Find header row (contains "date" AND "amount")
  let headerIdx = -1;
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const low = lines[i].toLowerCase();
    if (low.includes('date') && (low.includes('amount') || low.includes('debit'))) {
      headerIdx = i; break;
    }
  }
  if (headerIdx === -1) return { error: 'Could not find header row. Expected columns: Date, Details/Description, Amount.' };

  const headers = parseCSVLine(lines[headerIdx]).map(h => h.toLowerCase());
  const col = (kws) => headers.findIndex(h => kws.some(kw => h.includes(kw)));
  const dateC    = col(['date']);
  const detailC  = col(['detail', 'description', 'narration', 'particulars', 'merchant', 'payee']);
  const amountC  = col(['amount', 'debit amount', 'withdrawal']);
  const currencyC= col(['currency', 'ccy']);
  const statusC  = col(['status', 'state']);
  const debitC   = col(['debit/credit', 'dr/cr', 'type']);

  if (dateC === -1 || detailC === -1 || amountC === -1) {
    return { error: `Could not identify columns. Found: ${headers.join(', ')}` };
  }

  const rows = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length <= Math.max(dateC, detailC, amountC)) continue;

    const dateStr   = cols[dateC] || '';
    const details   = cols[detailC] || '';
    const amountRaw = (cols[amountC] || '').replace(/,/g, '').replace(/[^0-9.-]/g, '');
    const currency  = currencyC >= 0 ? (cols[currencyC] || 'AED') : 'AED';
    const status    = statusC >= 0 ? (cols[statusC] || '') : '';
    const debitCredit = debitC >= 0 ? cols[debitC] : 'Debit';

    const date   = parseDateStr(dateStr);
    const amount = parseFloat(amountRaw);

    if (!date || isNaN(amount) || amount <= 0 || !details) continue;
    // Skip credit entries (money coming in, e.g. refunds/payments to card)
    if (debitCredit && debitCredit.toLowerCase().includes('credit') && !debitCredit.toLowerCase().includes('debit/credit')) continue;

    rows.push({
      id: `r${i}`,
      date,
      description: details,
      amount,
      currency: currency.trim().toUpperCase(),
      status: status.toUpperCase(),
      category: suggestCategory(details),
      include: status.toUpperCase() !== 'REVERSED',
      isDuplicate: false,
      matchedBill: null,
    });
  }

  if (rows.length === 0) return { error: 'No expense rows found after header. Check the file format.' };
  return { rows };
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AddTransactionModal({ accounts, transactions = [], recurringBills = [], onClose, initialTab = 'manual' }) {
  const now = new Date();
  const todayDay = now.getDate();

  const nbdCreditAccount = accounts.find(a => a.name?.toLowerCase().includes('nbd') && a.name?.toLowerCase().includes('credit'))
    || accounts.find(a => a.name?.toLowerCase().includes('credit'));

  // ── Manual tab state
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

  // ── Recurring bills tab state
  const [billAmounts, setBillAmounts] = useState(() => {
    const m = {};
    recurringBills.forEach(b => { m[b.id] = String(b.amount || ''); });
    return m;
  });

  // ── Import tab state
  const [importRows, setImportRows] = useState([]);
  const [importAccountId, setImportAccountId] = useState(nbdCreditAccount?.id || accounts[0]?.id || '');
  const [importError, setImportError] = useState('');
  const [importSaving, setImportSaving] = useState(false);
  const [importDoneCount, setImportDoneCount] = useState(0);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef();

  const activeAccount = accounts.find(a => a.id === fromAccount);
  const lastTx = activeAccount ? getLastTx(transactions, activeAccount.id) : null;

  // Paid-this-month detection: match by description OR by 'Recurring bill' note
  const thisMonthDescs = transactions
    .filter(tx => { const d = new Date(tx.date); return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth(); })
    .map(tx => (tx.description || '').toLowerCase().trim());

  function isBillPaid(billName) {
    const name = billName.toLowerCase().trim();
    return thisMonthDescs.some(desc => desc === name || desc.includes(name) || name.includes(desc));
  }

  function reset() { setDescription(''); setAmountExpr(''); setNotes(''); setError(''); }

  // ── Manual save
  async function save(keepOpen = false) {
    const amount = evalExpr(amountExpr);
    if (!amount || amount <= 0) { setError('Enter a valid amount'); return; }
    const acct = accounts.find(a => a.id === fromAccount);
    if (type !== 'income' && !acct) { setError('Select an account'); return; }
    const isCreditCard = acct && acct.netWorthBucket === 'debt' && acct.name.toLowerCase().includes('credit');
    const reconciled = !(type === 'expense' && isCreditCard);
    setSaving(true); setError('');
    try {
      await addDoc(collection(db, 'transactions'), {
        date: new Date(date + 'T12:00:00').toISOString(),
        description: description.trim() || category,
        amount, type,
        category: type === 'transfer' ? 'Transfer' : category,
        currency,
        fromAccount: type === 'income' ? null : fromAccount,
        toAccount: type === 'income' ? fromAccount : (type === 'transfer' ? toAccount : null),
        notes: notes.trim(),
        reconciled,
      });
      const aedAmt = toAED(amount, currency);
      if (type === 'expense' && acct) await updateDoc(doc(db, 'accounts', acct.id), { currentBalance: acct.currentBalance - aedAmt / (FX[acct.currency] || 1) });
      else if (type === 'income' && acct) await updateDoc(doc(db, 'accounts', acct.id), { currentBalance: acct.currentBalance + aedAmt / (FX[acct.currency] || 1) });
      else if (type === 'transfer') {
        if (acct) await updateDoc(doc(db, 'accounts', acct.id), { currentBalance: acct.currentBalance - aedAmt / (FX[acct.currency] || 1) });
        const toAcct = accounts.find(a => a.id === toAccount);
        if (toAcct) await updateDoc(doc(db, 'accounts', toAcct.id), { currentBalance: toAcct.currentBalance + aedAmt / (FX[toAcct.currency] || 1) });
      }
      setSavedCount(n => n + 1);
      if (keepOpen) reset(); else onClose();
    } catch (e) { setError(e.message); }
    setSaving(false);
  }

  // ── Pay recurring bill
  async function payRecurringBill(bill, keepOpen = false) {
    const amount = parseFloat(billAmounts[bill.id]);
    if (!amount || amount <= 0) { setError(`Enter a valid amount for ${bill.name}`); return; }
    const acct = nbdCreditAccount;
    const isCreditCard = acct && acct.netWorthBucket === 'debt';
    setSaving(true); setError('');
    try {
      await addDoc(collection(db, 'transactions'), {
        date: new Date().toISOString(),
        description: bill.name, amount,
        type: 'expense',
        category: bill.category || 'Others',
        currency: bill.currency || 'AED',
        fromAccount: acct?.id || null,
        toAccount: null,
        notes: 'Recurring bill',
        reconciled: !isCreditCard,
      });
      if (acct) {
        const aedAmt = toAED(amount, bill.currency || 'AED');
        await updateDoc(doc(db, 'accounts', acct.id), { currentBalance: acct.currentBalance - aedAmt / (FX[acct.currency] || 1) });
      }
      setSavedCount(n => n + 1);
      if (!keepOpen) onClose();
    } catch (e) { setError(e.message); }
    setSaving(false);
  }

  // ── Import: parse file
  function handleFile(file) {
    if (!file) return;
    setImportError(''); setImportRows([]); setImportDoneCount(0);
    const reader = new FileReader();
    reader.onload = (e) => {
      const { rows, error } = parseStatementCSV(e.target.result);
      if (error) { setImportError(error); return; }

      const enriched = rows.map(row => {
        // Duplicate detection: same amount ± 0.01 within 3 days
        const isDuplicate = transactions.some(tx => {
          if (tx.type !== 'expense') return false;
          const diff = Math.abs(new Date(tx.date) - new Date(row.date));
          return diff < 86400000 * 3 && Math.abs((tx.amount || 0) - row.amount) < 0.01;
        });

        // Recurring bill match
        const matchedBill = recurringBills.find(bill => {
          const billLow = bill.name.toLowerCase();
          const descLow = row.description.toLowerCase();
          return descLow.includes(billLow) || billLow.includes(descLow) ||
            billLow.split(/\s+/).filter(w => w.length > 3).some(w => descLow.includes(w));
        });

        return {
          ...row,
          isDuplicate,
          matchedBill: matchedBill || null,
          include: !isDuplicate && row.status !== 'REVERSED',
          category: matchedBill?.category || row.category,
        };
      });
      setImportRows(enriched);
    };
    reader.onerror = () => setImportError('Failed to read file');
    reader.readAsText(file);
  }

  function updateImportRow(id, changes) {
    setImportRows(prev => prev.map(r => r.id === id ? { ...r, ...changes } : r));
  }

  // ── Import: save to Firestore
  async function doImport() {
    const toImport = importRows.filter(r => r.include);
    if (!toImport.length) return;
    setImportSaving(true); setImportError('');
    const acct = accounts.find(a => a.id === importAccountId);
    let totalAED = 0;
    try {
      for (const row of toImport) {
        const aedAmt = toAED(row.amount, row.currency);
        await addDoc(collection(db, 'transactions'), {
          date: new Date(row.date + 'T12:00:00').toISOString(),
          description: row.description,
          amount: row.amount,
          type: 'expense',
          category: row.category,
          currency: row.currency,
          fromAccount: acct?.id || importAccountId,
          toAccount: null,
          notes: row.matchedBill ? `Recurring: ${row.matchedBill.name}` : '',
          reconciled: false,
          source: 'import',
        });
        totalAED += aedAmt;
      }
      if (acct) {
        const delta = totalAED / (FX[acct.currency] || 1);
        await updateDoc(doc(db, 'accounts', acct.id), { currentBalance: acct.currentBalance - delta });
      }
      setImportDoneCount(toImport.length);
      setImportRows([]);
    } catch (e) { setImportError(e.message); }
    setImportSaving(false);
  }

  // ── Derived import stats
  const includedRows  = importRows.filter(r => r.include);
  const dupRows       = importRows.filter(r => r.isDuplicate);
  const billRows      = importRows.filter(r => r.matchedBill);
  const reversedRows  = importRows.filter(r => r.status === 'REVERSED');

  const isImportTab = tab === 'import';

  return (
    <div className="fixed inset-0 bg-black/80 flex items-start justify-center z-50 p-4 pt-8 overflow-y-auto">
      <div className={`bg-neutral-900 border border-neutral-700 rounded-2xl w-full ${isImportTab && importRows.length > 0 ? 'max-w-4xl' : 'max-w-md'} transition-all`}>

        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-neutral-800">
          <div>
            <h2 className="text-white font-bold text-sm">🧾 + Add Transactions</h2>
            {tab === 'manual' && activeAccount && (
              <p className="text-xs text-gray-500 mt-0.5">
                💳 {activeAccount.name}
                {lastTx && ` — last: ${new Date(lastTx.date).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'2-digit' })} · ${lastTx.description} · ${lastTx.currency} ${lastTx.amount}`}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white ml-4 text-lg leading-none">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-neutral-800">
          {[['manual','✏️ Manual Entry'],['recurring','🔄 Recurring Bills'],['import','📥 Import']].map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-3 text-xs font-semibold transition ${tab === t ? 'text-emerald-400 border-b-2 border-emerald-500' : 'text-gray-500 hover:text-gray-300'}`}>
              {label}
            </button>
          ))}
        </div>

        {savedCount > 0 && tab !== 'import' && (
          <div className="mx-4 mt-3 px-3 py-2 bg-emerald-900/30 border border-emerald-700 rounded-lg text-xs text-emerald-400">
            ✓ {savedCount} transaction{savedCount > 1 ? 's' : ''} saved
          </div>
        )}

        {/* ── MANUAL TAB ── */}
        {tab === 'manual' && (
          <div className="p-4 space-y-4">
            <div className="flex gap-2">
              {[['expense','💸 Expense','bg-emerald-600'],['income','💰 Income','bg-blue-600'],['transfer','🔄 Transfer','bg-purple-600']].map(([t, label, col]) => (
                <button key={t} onClick={() => setType(t)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition ${type === t ? `${col} text-white` : 'bg-neutral-800 text-gray-400 hover:text-gray-200'}`}>
                  {label}
                </button>
              ))}
            </div>

            <div>
              <label className="text-xs font-bold uppercase text-gray-500 mb-1 block">Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2.5 text-white text-sm" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-gray-500 mb-1 block">Description</label>
              <input type="text" value={description} onChange={e => setDescription(e.target.value)}
                placeholder="What was this for?"
                className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2.5 text-white text-sm placeholder-gray-600" />
            </div>
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
            {type !== 'transfer' && (
              <div>
                <label className="text-xs font-bold uppercase text-gray-500 mb-1 block">Category</label>
                <select value={category} onChange={e => setCategory(e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2.5 text-white text-sm">
                  {CATEGORIES.map(c => <option key={c} value={c}>{getCategoryEmoji(c)} {c}</option>)}
                </select>
              </div>
            )}
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
        )}

        {/* ── RECURRING BILLS TAB ── */}
        {tab === 'recurring' && (
          <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
            {recurringBills.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-6">No recurring bills configured</p>
            ) : (() => {
              const overdue  = recurringBills.filter(b => b.dueDay != null && parseInt(b.dueDay) <= todayDay);
              const upcoming = recurringBills.filter(b => b.dueDay == null || parseInt(b.dueDay) > todayDay);

              function BillRow({ bill }) {
                const isPaid = isBillPaid(bill.name);
                return (
                  <div className={`rounded-xl border px-4 py-3 ${isPaid ? 'border-neutral-700 opacity-50' : 'border-neutral-700 bg-neutral-800'}`}>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <p className="text-sm text-white font-medium">{bill.name}</p>
                        <p className="text-xs text-gray-500">
                          {bill.category}
                          {nbdCreditAccount ? ` · ${nbdCreditAccount.name}` : ''}
                          {bill.dueDay != null ? ` · Due: ${ordinal(parseInt(bill.dueDay))}` : ''}
                        </p>
                      </div>
                      {isPaid && <span className="text-xs text-emerald-500 font-semibold shrink-0">✓ Paid</span>}
                    </div>
                    {!isPaid && (
                      <div className="flex gap-2 items-center">
                        <input type="number"
                          value={billAmounts[bill.id] ?? ''}
                          onChange={e => setBillAmounts(prev => ({ ...prev, [bill.id]: e.target.value }))}
                          className="w-28 bg-neutral-700 border border-neutral-600 rounded-lg px-3 py-1.5 text-white text-sm font-mono" />
                        <span className="text-xs text-gray-500">{bill.currency || 'AED'}</span>
                        <button onClick={() => payRecurringBill(bill, true)} disabled={saving}
                          className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold disabled:opacity-40 transition">
                          + Add Another
                        </button>
                        <button onClick={() => payRecurringBill(bill, false)} disabled={saving}
                          className="flex-1 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold disabled:opacity-40 transition">
                          ✓ Pay Now
                        </button>
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <>
                  {overdue.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-red-400 uppercase tracking-wide">⚠ Overdue</p>
                      {overdue.map(b => <BillRow key={b.id} bill={b} />)}
                    </div>
                  )}
                  {upcoming.length > 0 && (
                    <div className="space-y-2 mt-2">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Upcoming</p>
                      {upcoming.map(b => <BillRow key={b.id} bill={b} />)}
                    </div>
                  )}
                </>
              );
            })()}
            {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
          </div>
        )}

        {/* ── IMPORT TAB ── */}
        {tab === 'import' && (
          <div className="p-4 space-y-4">

            {/* Account selector */}
            <div>
              <label className="text-xs font-bold uppercase text-gray-500 mb-1 block">Source Account</label>
              <select value={importAccountId} onChange={e => setImportAccountId(e.target.value)}
                className="w-full bg-neutral-800 border border-emerald-600 rounded-xl px-3 py-2.5 text-white text-sm">
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>

            {/* Success message */}
            {importDoneCount > 0 && (
              <div className="px-4 py-3 bg-emerald-900/30 border border-emerald-700 rounded-xl text-sm text-emerald-400 text-center">
                ✓ {importDoneCount} transactions imported successfully
              </div>
            )}

            {/* Drop zone (only when no rows loaded) */}
            {importRows.length === 0 && (
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition ${dragging ? 'border-emerald-500 bg-emerald-900/10' : 'border-neutral-700 hover:border-neutral-500'}`}>
                <div className="text-4xl mb-3">📄</div>
                <p className="text-gray-300 text-sm font-medium">Drop statement here or click to browse</p>
                <p className="text-gray-600 text-xs mt-1">CSV format · Date, Details, Amount, Currency, Debit/Credit, Status</p>
                <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden"
                  onChange={e => { const f = e.target.files[0]; if (f) handleFile(f); e.target.value = ''; }} />
              </div>
            )}

            {importError && (
              <p className="text-red-400 text-xs px-1">{importError}</p>
            )}

            {/* Review table */}
            {importRows.length > 0 && (
              <>
                {/* Summary bar */}
                <div className="flex flex-wrap gap-3 text-xs items-center">
                  <span className="text-emerald-400 font-semibold">{includedRows.length} to import</span>
                  {dupRows.length > 0 && <span className="text-amber-400">⚠ {dupRows.length} possible duplicate{dupRows.length > 1 ? 's' : ''}</span>}
                  {billRows.length > 0 && <span className="text-purple-400">🔄 {billRows.length} match recurring bill{billRows.length > 1 ? 's' : ''}</span>}
                  {reversedRows.length > 0 && <span className="text-gray-500">{reversedRows.length} reversed (excluded)</span>}
                  <button onClick={() => { setImportRows([]); setImportDoneCount(0); }}
                    className="ml-auto text-gray-500 hover:text-white border border-neutral-700 rounded-lg px-2 py-1 transition">
                    ✕ Clear
                  </button>
                </div>

                <div className="overflow-auto max-h-[50vh] rounded-xl border border-neutral-800">
                  <table className="w-full text-xs min-w-[700px]">
                    <thead className="sticky top-0 bg-neutral-900 z-10">
                      <tr className="border-b border-neutral-800">
                        <th className="py-2 px-2 w-8">
                          <input type="checkbox"
                            checked={importRows.every(r => r.include)}
                            onChange={e => setImportRows(prev => prev.map(r => ({ ...r, include: e.target.checked })))}
                            className="accent-emerald-500" />
                        </th>
                        <th className="py-2 px-2 text-left text-gray-500 font-semibold">Date</th>
                        <th className="py-2 px-2 text-left text-gray-500 font-semibold">Description</th>
                        <th className="py-2 px-2 text-gray-500 font-semibold w-20">Status</th>
                        <th className="py-2 px-2 text-right text-gray-500 font-semibold">Amount</th>
                        <th className="py-2 px-2 text-left text-gray-500 font-semibold w-44">Category</th>
                        <th className="py-2 px-2 text-gray-500 font-semibold w-28">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importRows.map(row => (
                        <tr key={row.id}
                          className={`border-b border-neutral-900 ${!row.include ? 'opacity-40' : row.isDuplicate ? 'bg-amber-950/20' : row.matchedBill ? 'bg-purple-950/20' : ''}`}>
                          <td className="py-2 px-2 text-center">
                            <input type="checkbox" checked={row.include}
                              onChange={e => updateImportRow(row.id, { include: e.target.checked })}
                              className="accent-emerald-500" />
                          </td>
                          <td className="py-2 px-2 text-gray-400 whitespace-nowrap font-mono">{row.date}</td>
                          <td className="py-2 px-2 text-gray-200 max-w-[200px]">
                            <span className="block truncate" title={row.description}>{row.description}</span>
                          </td>
                          <td className="py-2 px-2 text-center">
                            {row.status === 'REVERSED' && <span className="px-1.5 py-0.5 bg-red-900/40 text-red-400 rounded text-[10px]">REVERSED</span>}
                            {row.status === 'AUTHORIZED' && <span className="px-1.5 py-0.5 bg-amber-900/40 text-amber-400 rounded text-[10px]">AUTH</span>}
                            {row.status === 'SETTLED' && <span className="px-1.5 py-0.5 bg-emerald-900/40 text-emerald-500 rounded text-[10px]">SETTLED</span>}
                          </td>
                          <td className="py-2 px-2 text-right font-mono text-red-400 whitespace-nowrap">
                            −{row.currency} {row.amount.toFixed(2)}
                          </td>
                          <td className="py-2 px-2">
                            <select value={row.category}
                              onChange={e => updateImportRow(row.id, { category: e.target.value })}
                              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-1.5 py-1 text-white text-[11px]">
                              {CATEGORIES.map(c => <option key={c} value={c}>{getCategoryEmoji(c)} {c}</option>)}
                            </select>
                          </td>
                          <td className="py-2 px-2 text-[11px]">
                            {row.isDuplicate && <span className="text-amber-400" title="Possible duplicate — already exists near this date/amount">⚠ Duplicate?</span>}
                            {!row.isDuplicate && row.matchedBill && <span className="text-purple-400" title={`Matches recurring bill: ${row.matchedBill.name}`}>🔄 {row.matchedBill.name}</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {importError && <p className="text-red-400 text-xs">{importError}</p>}

                <div className="flex gap-3">
                  <button
                    onClick={() => setImportRows(prev => prev.map(r => ({ ...r, include: !r.isDuplicate && r.status !== 'REVERSED' })))}
                    className="px-4 py-2.5 border border-neutral-700 text-gray-400 rounded-xl text-xs hover:text-white transition">
                    Reset selection
                  </button>
                  <button onClick={doImport} disabled={importSaving || includedRows.length === 0}
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold disabled:opacity-40 transition">
                    {importSaving ? 'Importing…' : `✓ Import ${includedRows.length} transaction${includedRows.length !== 1 ? 's' : ''}`}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
