import React, { useState, useEffect, useMemo } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase-config.js';

// ─── FX & helpers ─────────────────────────────────────────────────────────────
const USD_AED = 3.6725;
const EUR_USD = 1.1717;

function toUSD(amount, currency) {
  if (!amount) return 0;
  if (currency === 'USD') return +amount;
  if (currency === 'EUR') return +amount * EUR_USD;
  if (currency === 'AED') return +amount / USD_AED;
  return +amount;
}

function fmtUSD(n, compact = false) {
  const abs = Math.abs(n);
  if (compact && abs >= 1000) return '$' + (abs / 1000).toFixed(1) + 'k';
  return '$' + abs.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtPrice(n, currency) {
  if (n === null || n === undefined) return '—';
  const sym = currency === 'EUR' ? '€' : currency === 'AED' ? 'AED ' : '$';
  const decimals = Math.abs(n) < 0.01 ? 8 : Math.abs(n) < 1 ? 4 : 2;
  return sym + n.toFixed(decimals);
}

function fmtShares(n) {
  if (!n) return '—';
  if (n >= 1000000) return (n / 1000000).toFixed(2) + 'M';
  if (n > 100) return n.toLocaleString('en-US', { maximumFractionDigits: 3 });
  return n.toFixed(n % 1 === 0 ? 0 : 4);
}

// ─── Seed data ────────────────────────────────────────────────────────────────
const SEED = {
  positions: [
    // WIO
    { id: 'amd', ticker: 'AMD', name: 'Adv. Micro Devices', platform: 'WIO', type: 'STK', shares: 25.40, price: 511.57, costPerShare: 137.86, currency: 'USD', addLevels: [{ price: 440, amount: '$1,000' }, { price: 400, amount: '$1,500' }], trimLevels: [{ price: 575, action: 'sell 3 sh' }, { price: 640, action: 'sell 3 sh' }], status: 'HOLD', notes: 'Core winner — only trim above target' },
    { id: 'nvda', ticker: 'NVDA', name: 'NVIDIA', platform: 'WIO', type: 'STK', shares: 30.00, price: 205.19, costPerShare: 179.92, currency: 'USD', addLevels: [{ price: 185, amount: '$1,500' }, { price: 165, amount: '$1,500' }], trimLevels: [{ price: 285, action: 'trim 6 sh' }, { price: 330, action: 'trim 6 sh' }], status: 'HOLD', notes: 'Conviction add name' },
    { id: 'avgo', ticker: 'AVGO', name: 'Broadcom', platform: 'WIO', type: 'STK', shares: 6.00, price: 382.07, costPerShare: 382.07, currency: 'USD', addLevels: [{ price: 350, amount: '$1,200' }, { price: 320, amount: '$1,200' }], trimLevels: [{ price: 490, action: 'trim 2 sh' }], status: 'HOLD', notes: 'Custom AI silicon' },
    { id: 'meta', ticker: 'META', name: 'Meta Platforms', platform: 'WIO', type: 'STK', shares: 5.01, price: 566.98, costPerShare: 584.73, currency: 'USD', addLevels: [{ price: 520, amount: '$1,000' }, { price: 480, amount: '$1,000' }], trimLevels: [{ price: 720, action: 'trim 1.5 sh' }], status: 'HOLD', notes: 'Cheapest mega-cap · near add' },
    { id: 'amzn', ticker: 'AMZN', name: 'Amazon', platform: 'WIO', type: 'STK', shares: 10.01, price: 238.55, costPerShare: 205.69, currency: 'USD', addLevels: [{ price: 215, amount: '$800' }], trimLevels: [{ price: 290, action: 'trim 3 sh' }], status: 'HOLD', notes: '' },
    { id: 'now', ticker: 'NOW', name: 'ServiceNow', platform: 'WIO', type: 'STK', shares: 10.03, price: 102.15, costPerShare: 101.49, currency: 'USD', addLevels: [{ price: 90, amount: '$500' }], trimLevels: [{ price: 140, action: 'trim 3 sh' }], status: 'HOLD', notes: 'Enterprise AI' },
    { id: 'cake', ticker: 'CAKE', name: 'Cheesecake Factory', platform: 'WIO', type: 'STK', shares: 11.00, price: 75.28, costPerShare: 48.50, currency: 'USD', addLevels: [], trimLevels: [{ price: 90, action: 'sell 5 sh' }], status: 'HOLD', notes: 'No adds · trim into strength' },
    { id: 'cspx', ticker: 'CSPX', name: 'iShares S&P 500 UCITS', platform: 'WIO', type: 'ETF', shares: 4.99747, price: 809.73, costPerShare: 809.73, currency: 'USD', addLevels: [], trimLevels: [], status: 'ACCUMULATE', notes: 'The base — add on dips, never trim' },
    { id: 'sol-wio', ticker: 'SOL', name: 'Solana (WIO)', platform: 'WIO', type: 'CRY', shares: 14.0754, price: 68.20, costPerShare: 161.00, currency: 'USD', addLevels: [{ price: 50, amount: 'DCA' }, { price: 40, amount: 'DCA' }], trimLevels: [{ price: 140, action: 'partial exit' }], status: 'WATCH', notes: 'Speculative bucket · separate cash' },
    // DH / Talabat
    { id: 'dher', ticker: 'DHER', name: 'Delivery Hero SE', platform: 'DH/Talabat', type: 'STK', shares: 1683, price: 36.89, costPerShare: 0, currency: 'EUR', addLevels: [], trimLevels: [{ price: 40, action: 'trim into deal strength' }], status: 'WATCH', notes: 'Cost-free grant · event-driven M&A · reduce into strength' },
    { id: 'talabat', ticker: 'TALABAT', name: 'Talabat Holding', platform: 'DH/Talabat', type: 'STK', shares: 6250, price: 0.96, costPerShare: 0.4357, currency: 'AED', addLevels: [], trimLevels: [], status: 'WATCH', notes: 'DFM listed · manual price update' },
    // Binance
    { id: 'shiba', ticker: 'SHIBA', name: 'Shiba Inu', platform: 'Binance', type: 'CRY', shares: 33630400.69, price: 0.00000596, costPerShare: 0.00000684, currency: 'USD', addLevels: [], trimLevels: [], status: 'WATCH', notes: 'Meme — hold or cut, no levels' },
    { id: 'eth', ticker: 'ETH', name: 'Ethereum', platform: 'Binance', type: 'CRY', shares: 1.02972, price: 2258.90, costPerShare: 3431.18, currency: 'USD', addLevels: [], trimLevels: [{ price: 4000, action: 'break-even exit' }], status: 'WATCH', notes: 'Target break-even exit' },
    { id: 'sol-binance', ticker: 'SOL', name: 'Solana (Binance)', platform: 'Binance', type: 'CRY', shares: 39.870013, price: 84.71, costPerShare: 170.08, currency: 'USD', addLevels: [{ price: 50, amount: 'DCA' }, { price: 40, amount: 'DCA' }], trimLevels: [{ price: 140, action: 'partial exit' }], status: 'WATCH', notes: 'Target break-even exit' },
  ],
  closedPositions: [
    { id: 'smci-c', ticker: 'SMCI', platform: 'WIO', type: 'STK', closedDate: '14 May 26', qty: 10, sellPrice: '$32.08', costAED: 568, proceeds: 321, gainLoss: -247, pct: -43.5 },
    { id: 'sofi-c', ticker: 'SOFI', platform: 'WIO', type: 'STK', closedDate: 'Jun 26', qty: 18, sellPrice: '$18.22', costAED: 514, proceeds: 328, gainLoss: -186, pct: -36.2 },
    { id: 'ada-c', ticker: 'ADA', platform: 'Binance', type: 'CRY', closedDate: '03 Oct 24', qty: 2162, sellPrice: '$0.88', costAED: 2065, proceeds: 1903, gainLoss: -162, pct: -7.9 },
    { id: 'xrp2-c', ticker: 'XRP', platform: 'Binance', type: 'CRY', closedDate: '03 Oct 24', qty: 150.2, sellPrice: '$3.08', costAED: 520, proceeds: 463, gainLoss: -57, pct: -11.0 },
    { id: 'dher-c', ticker: 'DHER', platform: 'Talabat/DH', type: 'STK', closedDate: '23 Sep 24', qty: 537, sellPrice: '€27.77', costAED: 0, proceeds: 17310, gainLoss: 17310, pct: null },
    { id: 'doge-c', ticker: 'DOGE', platform: 'Binance', type: 'CRY', closedDate: '08 Aug 24', qty: 3393, sellPrice: '$0.22', costAED: 1200, proceeds: 747, gainLoss: -453, pct: -37.8 },
    { id: 'xrp1-c', ticker: 'XRP', platform: 'Binance', type: 'CRY', closedDate: '22 Jul 24', qty: 520.2, sellPrice: '$3.46', costAED: 520, proceeds: 1800, gainLoss: 1280, pct: 246.1 },
    { id: 'xlm-c', ticker: 'XLM', platform: 'Binance', type: 'CRY', closedDate: '10 Jul 24', qty: 1033, sellPrice: '$0.30', costAED: 300, proceeds: 310, gainLoss: 10, pct: 3.3 },
    { id: 'amat-c', ticker: 'AMAT', platform: 'WIO', type: 'STK', closedDate: '08 Jul 24', qty: 5.71, sellPrice: '$190.46', costAED: 1001, proceeds: 1088, gainLoss: 86, pct: 8.6 },
    { id: 'amd-c', ticker: 'AMD', platform: 'WIO', type: 'STK', closedDate: '01 Jul 24', qty: 7, sellPrice: '$236', costAED: 0, proceeds: 1652, gainLoss: 1652, pct: null },
    { id: 'dot-c', ticker: 'DOT', platform: 'Binance', type: 'CRY', closedDate: '19 Jun 24', qty: 28.3, sellPrice: '$3.58', costAED: 400, proceeds: 101, gainLoss: -299, pct: -74.7 },
    { id: 'sonic-c', ticker: 'SONIC', platform: 'Binance', type: 'CRY', closedDate: '19 Jun 24', qty: 173, sellPrice: '$0.32', costAED: 475, proceeds: 55, gainLoss: -420, pct: -88.3 },
    { id: 'link-c', ticker: 'LINK', platform: 'Binance', type: 'CRY', closedDate: '19 Jun 24', qty: 10.06, sellPrice: '$13.17', costAED: 135, proceeds: 132, gainLoss: -3, pct: -1.9 },
    { id: 'near-c', ticker: 'NEAR', platform: 'Binance', type: 'CRY', closedDate: '18 Jun 24', qty: 23.55, sellPrice: '$2.16', costAED: 75, proceeds: 51, gainLoss: -24, pct: -32.2 },
    { id: 'sand-c', ticker: 'SAND', platform: 'Binance', type: 'CRY', closedDate: '18 Jun 24', qty: 102.2, sellPrice: '$0.25', costAED: 500, proceeds: 26, gainLoss: -474, pct: -94.9 },
    { id: 'c98-c', ticker: 'C98', platform: 'Binance', type: 'CRY', closedDate: '18 Jun 24', qty: 57.99, sellPrice: '$0.05', costAED: 200, proceeds: 3, gainLoss: -197, pct: -98.6 },
    { id: 'luna-c', ticker: 'LUNA', platform: 'Binance', type: 'CRY', closedDate: '12 May 22', qty: 112.1, sellPrice: '$0', costAED: 200, proceeds: 0, gainLoss: -200, pct: -100 },
  ],
  config: { dryCash: 5500, addPriority: 'NVDA → AVGO → META → AMD → AMZN → NOW', lastUpdated: null },
};

// ─── CoinGecko IDs ────────────────────────────────────────────────────────────
const CG_IDS = { SOL: 'solana', ETH: 'ethereum', SHIBA: 'shiba-inu', BTC: 'bitcoin', AVAX: 'avalanche-2' };

// ─── Sub-components ───────────────────────────────────────────────────────────
function TypeBadge({ type }) {
  const s = { STK: 'bg-blue-900/60 text-blue-300 border-blue-700/50', CRY: 'bg-amber-900/60 text-amber-300 border-amber-700/50', ETF: 'bg-purple-900/60 text-purple-300 border-purple-700/50', WLT: 'bg-teal-900/60 text-teal-300 border-teal-700/50' };
  return <span className={`inline-block text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${s[type] || s.STK}`}>{type}</span>;
}

function StatusBadge({ status }) {
  const s = { HOLD: 'bg-neutral-800 text-gray-400 border-neutral-700', ACCUMULATE: 'bg-blue-900/40 text-blue-300 border-blue-700/50', WATCH: 'bg-amber-900/40 text-amber-300 border-amber-700/50', TRIM: 'bg-emerald-900/40 text-emerald-300 border-emerald-700/50' };
  return <span className={`inline-block text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${s[status] || s.HOLD}`}>{status}</span>;
}

function TriggerRail({ price, addLevels, trimLevels, status, currency }) {
  const addLevel = addLevels?.[0]?.price;
  const trimLevel = trimLevels?.[0]?.price;
  const sym = currency === 'EUR' ? '€' : currency === 'AED' ? 'AED ' : '$';
  const fmtLvl = v => sym + (v >= 100 ? Math.round(v) : v.toFixed(2));
  const fmtNow = v => { const d = Math.abs(v) < 0.01 ? 6 : Math.abs(v) < 1 ? 4 : 2; return sym + v.toFixed(d); };

  if (status === 'ACCUMULATE') return <div className="text-[10px] text-blue-400">▲ Accumulate on dips · $1k at −5%, $2k at −10%</div>;
  if (!addLevel && !trimLevel) return <div className="text-[10px] text-gray-600 italic">No trigger levels</div>;

  if (!addLevel && trimLevel) {
    const d = ((trimLevel - price) / price * 100).toFixed(0);
    return <div className="text-[10px]"><span className="text-gray-500">Trim only · </span><span className="text-emerald-400 font-mono">{fmtLvl(trimLevel)}</span><span className="text-gray-500"> (+{d}%) · no adds</span></div>;
  }

  let pct = (price - addLevel) / ((trimLevel || price * 1.2) - addLevel) * 100;
  pct = Math.max(3, Math.min(97, pct));
  const dAdd = ((price - addLevel) / price * 100).toFixed(0);
  const dTrim = trimLevel ? ((trimLevel - price) / price * 100).toFixed(0) : null;

  return (
    <div className="w-full min-w-[160px]">
      <div className="relative h-1.5 rounded-full" style={{ background: 'linear-gradient(90deg,rgba(96,165,250,.5) 0%,rgba(96,165,250,.1) 20%,#1f2937 40%,#1f2937 60%,rgba(52,211,153,.1) 80%,rgba(52,211,153,.5) 100%)', border: '1px solid #374151' }}>
        <div className="absolute w-2.5 h-2.5 rounded-full bg-amber-400 border-2 border-black" style={{ left: `${pct}%`, top: '50%', transform: 'translate(-50%,-50%)', boxShadow: '0 0 6px rgba(245,177,76,.8)' }} />
      </div>
      <div className="flex justify-between text-[9px] mt-1.5 gap-1">
        <span className="text-blue-400">add {fmtLvl(addLevel)}</span>
        <span className="text-amber-400">now {fmtNow(price)}</span>
        {trimLevel && <span className="text-emerald-400">trim {fmtLvl(trimLevel)}</span>}
      </div>
      <div className="text-[9px] text-gray-600 mt-0.5">−{dAdd}% to add{dTrim ? ` · +${dTrim}% to trim` : ''}</div>
    </div>
  );
}

// ─── Edit modal ───────────────────────────────────────────────────────────────
function EditPositionModal({ pos, onSave, onClose, onDelete }) {
  const [form, setForm] = useState({
    ticker: pos?.ticker || '',
    name: pos?.name || '',
    platform: pos?.platform || 'WIO',
    type: pos?.type || 'STK',
    shares: String(pos?.shares || ''),
    price: String(pos?.price || ''),
    costPerShare: String(pos?.costPerShare || ''),
    currency: pos?.currency || 'USD',
    status: pos?.status || 'HOLD',
    notes: pos?.notes || '',
    addLevel1: String(pos?.addLevels?.[0]?.price || ''),
    addAmount1: pos?.addLevels?.[0]?.amount || '',
    addLevel2: String(pos?.addLevels?.[1]?.price || ''),
    addAmount2: pos?.addLevels?.[1]?.amount || '',
    trimLevel1: String(pos?.trimLevels?.[0]?.price || ''),
    trimAction1: pos?.trimLevels?.[0]?.action || '',
    trimLevel2: String(pos?.trimLevels?.[1]?.price || ''),
    trimAction2: pos?.trimLevels?.[1]?.action || '',
  });
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const inp = 'w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-white text-xs focus:border-emerald-600 outline-none';
  const lbl = 'text-[10px] text-gray-500 uppercase font-bold block mb-1';
  const isNew = !pos;

  function handleSave() {
    const addLevels = [];
    if (form.addLevel1) addLevels.push({ price: +form.addLevel1, amount: form.addAmount1 });
    if (form.addLevel2) addLevels.push({ price: +form.addLevel2, amount: form.addAmount2 });
    const trimLevels = [];
    if (form.trimLevel1) trimLevels.push({ price: +form.trimLevel1, action: form.trimAction1 });
    if (form.trimLevel2) trimLevels.push({ price: +form.trimLevel2, action: form.trimAction2 });
    onSave({ ...pos, id: pos?.id || Date.now().toString(), ticker: form.ticker.toUpperCase(), name: form.name, platform: form.platform, type: form.type, shares: +form.shares, price: +form.price, costPerShare: +form.costPerShare, currency: form.currency, status: form.status, notes: form.notes, addLevels, trimLevels });
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-start justify-center z-50 p-4 pt-10 overflow-y-auto">
      <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-5 w-full max-w-lg space-y-3">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-white font-bold text-sm">{isNew ? 'Add Position' : `Edit — ${pos.ticker}`}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div><label className={lbl}>Ticker</label><input className={inp} value={form.ticker} onChange={e => f('ticker', e.target.value)} placeholder="AMD" /></div>
          <div><label className={lbl}>Name</label><input className={inp} value={form.name} onChange={e => f('name', e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div><label className={lbl}>Platform</label>
            <select className={inp} value={form.platform} onChange={e => f('platform', e.target.value)}>
              {['WIO', 'Binance', 'DH/Talabat'].map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div><label className={lbl}>Type</label>
            <select className={inp} value={form.type} onChange={e => f('type', e.target.value)}>
              {['STK', 'CRY', 'ETF', 'WLT'].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div><label className={lbl}>Currency</label>
            <select className={inp} value={form.currency} onChange={e => f('currency', e.target.value)}>
              {['USD', 'EUR', 'AED'].map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div><label className={lbl}>Shares / Units</label><input className={inp} type="number" value={form.shares} onChange={e => f('shares', e.target.value)} /></div>
          <div><label className={lbl}>Current Price</label><input className={inp} type="number" value={form.price} onChange={e => f('price', e.target.value)} /></div>
          <div><label className={lbl}>Cost / Share</label><input className={inp} type="number" value={form.costPerShare} onChange={e => f('costPerShare', e.target.value)} /></div>
        </div>

        <div className="border-t border-neutral-800 pt-3">
          <div className="text-[10px] text-gray-500 uppercase font-bold mb-2">Add Levels</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex gap-1"><input className={inp} type="number" placeholder="Price" value={form.addLevel1} onChange={e => f('addLevel1', e.target.value)} /><input className={`${inp} flex-1`} placeholder="$1,000" value={form.addAmount1} onChange={e => f('addAmount1', e.target.value)} /></div>
            <div className="flex gap-1"><input className={inp} type="number" placeholder="Price" value={form.addLevel2} onChange={e => f('addLevel2', e.target.value)} /><input className={`${inp} flex-1`} placeholder="$1,500" value={form.addAmount2} onChange={e => f('addAmount2', e.target.value)} /></div>
          </div>
        </div>

        <div>
          <div className="text-[10px] text-gray-500 uppercase font-bold mb-2">Trim Levels</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex gap-1"><input className={inp} type="number" placeholder="Price" value={form.trimLevel1} onChange={e => f('trimLevel1', e.target.value)} /><input className={`${inp} flex-1`} placeholder="trim 3 sh" value={form.trimAction1} onChange={e => f('trimAction1', e.target.value)} /></div>
            <div className="flex gap-1"><input className={inp} type="number" placeholder="Price" value={form.trimLevel2} onChange={e => f('trimLevel2', e.target.value)} /><input className={`${inp} flex-1`} placeholder="trim 3 sh" value={form.trimAction2} onChange={e => f('trimAction2', e.target.value)} /></div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div><label className={lbl}>Status</label>
            <select className={inp} value={form.status} onChange={e => f('status', e.target.value)}>
              {['HOLD', 'ACCUMULATE', 'WATCH', 'TRIM'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div><label className={lbl}>Notes</label><input className={inp} value={form.notes} onChange={e => f('notes', e.target.value)} /></div>
        </div>

        <div className="flex gap-2 pt-2">
          {!isNew && <button onClick={() => onDelete(pos.id)} className="px-3 py-2 border border-red-800 text-red-400 rounded-xl text-xs hover:bg-red-900/30 transition">🗑 Remove</button>}
          <button onClick={onClose} className="flex-1 py-2 border border-neutral-700 text-gray-400 rounded-xl text-xs hover:text-white transition">Cancel</button>
          <button onClick={handleSave} className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition">✓ Save</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Investments() {
  const [data, setData] = useState(SEED);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [priceMsg, setPriceMsg] = useState('');
  const [editingPos, setEditingPos] = useState(null);
  const [addingPos, setAddingPos] = useState(false);
  const [showClosed, setShowClosed] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Load from Firestore ──
  useEffect(() => {
    const ref = doc(db, 'investments', 'main');
    getDoc(ref).then(snap => {
      if (snap.exists()) setData(snap.data());
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  async function persist(newData) {
    setSaving(true);
    try {
      await setDoc(doc(db, 'investments', 'main'), newData);
      setData(newData);
    } catch (e) { console.error(e); }
    setSaving(false);
  }

  // ── Refresh prices ──
  async function refreshPrices() {
    setRefreshing(true);
    setPriceMsg('');
    const updated = [...data.positions];
    let ok = 0, fail = 0;

    // 1. Crypto via CoinGecko
    const cryptoTickers = [...new Set(updated.filter(p => p.type === 'CRY').map(p => p.ticker))];
    const cgIds = cryptoTickers.map(t => CG_IDS[t]).filter(Boolean);
    if (cgIds.length) {
      try {
        const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${cgIds.join(',')}&vs_currencies=usd`);
        const prices = await r.json();
        updated.forEach((p, i) => {
          if (p.type === 'CRY' && CG_IDS[p.ticker] && prices[CG_IDS[p.ticker]]?.usd) {
            updated[i] = { ...p, price: prices[CG_IDS[p.ticker]].usd };
            ok++;
          }
        });
      } catch { fail++; }
    }

    // 2. Stocks via Yahoo Finance (try — may fail due to CORS)
    const stockPositions = updated.filter(p => p.type === 'STK' || p.type === 'ETF');
    const yahooMap = { AMD: 'AMD', NVDA: 'NVDA', AVGO: 'AVGO', META: 'META', AMZN: 'AMZN', NOW: 'NOW', CAKE: 'CAKE', CSPX: 'CSPX.L', DHER: 'DHER.DE', SOFI: 'SOFI' };
    const yTickers = [...new Set(stockPositions.map(p => yahooMap[p.ticker]).filter(Boolean))];
    if (yTickers.length) {
      try {
        const r = await fetch(
          `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${yTickers.join(',')}`,
          { headers: { 'User-Agent': 'Mozilla/5.0' } }
        );
        const d = await r.json();
        const quotes = d?.quoteResponse?.result || [];
        quotes.forEach(q => {
          const ticker = Object.entries(yahooMap).find(([, yt]) => yt === q.symbol)?.[0];
          if (!ticker) return;
          const price = q.regularMarketPrice;
          if (!price) return;
          updated.forEach((p, i) => {
            if (p.ticker === ticker) { updated[i] = { ...p, price }; ok++; }
          });
        });
      } catch {
        fail++;
      }
    }

    const now = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const newData = { ...data, positions: updated, config: { ...data.config, lastUpdated: new Date().toISOString() } };
    await persist(newData);
    setPriceMsg(fail > 0 ? `Crypto updated · Stocks need manual update (CORS) · ${now}` : `Prices updated · ${ok} tickers · ${now}`);
    setRefreshing(false);
  }

  function savePosition(pos) {
    const positions = editingPos
      ? data.positions.map(p => p.id === pos.id ? pos : p)
      : [...data.positions, pos];
    persist({ ...data, positions });
    setEditingPos(null);
    setAddingPos(false);
  }

  function deletePosition(id) {
    persist({ ...data, positions: data.positions.filter(p => p.id !== id) });
    setEditingPos(null);
  }

  // ── Computed values ──
  const { platforms, totalValueUSD, totalCostUSD, unrealizedPNL, realizedPNL, actionItems } = useMemo(() => {
    const positions = data.positions || [];
    let totalValueUSD = 0, totalCostUSD = 0;

    const enriched = positions.map(p => {
      const valueUSD = toUSD(p.price * p.shares, p.currency);
      const costUSD = toUSD(p.costPerShare * p.shares, p.currency);
      const pnlUSD = valueUSD - costUSD;
      const pnlPct = costUSD > 0 ? (pnlUSD / costUSD * 100) : null;
      totalValueUSD += valueUSD;
      totalCostUSD += costUSD;
      return { ...p, valueUSD, costUSD, pnlUSD, pnlPct };
    });

    // Equity weight (exclude crypto for concentration)
    const equityUSD = enriched.filter(p => p.type !== 'CRY').reduce((s, p) => s + p.valueUSD, 0);
    enriched.forEach(p => { p.weight = equityUSD > 0 && p.type !== 'CRY' ? (p.valueUSD / equityUSD * 100) : null; });

    const unrealizedPNL = totalValueUSD - totalCostUSD;
    const realizedPNL = (data.closedPositions || []).reduce((s, p) => s + (p.gainLoss || 0), 0);

    // Group by platform
    const platformNames = [...new Set(enriched.map(p => p.platform))];
    const platforms = platformNames.map(name => {
      const pos = enriched.filter(p => p.platform === name);
      const plVal = pos.reduce((s, p) => s + p.valueUSD, 0);
      const plCost = pos.reduce((s, p) => s + p.costUSD, 0);
      return { name, positions: pos, totalUSD: plVal, pnlUSD: plVal - plCost, pnlPct: plCost > 0 ? ((plVal - plCost) / plCost * 100) : 0 };
    });

    // Action framework
    const adds = [], trims = [], holds = [];
    enriched.forEach(p => {
      (p.addLevels || []).forEach(l => adds.push({ ticker: p.ticker, level: l.price, amount: l.amount, currency: p.currency, pctAway: ((p.price - l.price) / p.price * 100).toFixed(0) }));
      (p.trimLevels || []).forEach(l => trims.push({ ticker: p.ticker, level: l.price, action: l.action, currency: p.currency, pctAway: ((l.price - p.price) / p.price * 100).toFixed(0) }));
      if (p.status === 'HOLD' || p.status === 'ACCUMULATE' || p.status === 'WATCH') holds.push(p);
    });
    // Sort adds by priority order
    const PRIORITY = ['NVDA', 'AVGO', 'META', 'AMD', 'AMZN', 'NOW'];
    adds.sort((a, b) => (PRIORITY.indexOf(a.ticker) + 99) % 100 - (PRIORITY.indexOf(b.ticker) + 99) % 100);

    return { platforms, totalValueUSD, totalCostUSD, unrealizedPNL, realizedPNL, actionItems: { adds, trims, holds } };
  }, [data]);

  const lastUpdated = data.config?.lastUpdated
    ? new Date(data.config.lastUpdated).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null;

  if (loading) return <div className="flex items-center justify-center py-20 text-gray-500">Loading investments…</div>;

  const pnlCls = (n) => n >= 0 ? 'text-emerald-400' : 'text-red-400';
  const symCur = (cur) => cur === 'EUR' ? '€' : cur === 'AED' ? 'AED ' : '$';

  return (
    <div className="space-y-5 pb-16">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Investment Command</h2>
          {lastUpdated && <p className="text-xs text-gray-600 mt-0.5">Prices as of {lastUpdated}</p>}
        </div>
        <div className="flex items-center gap-2">
          {saving && <span className="text-xs text-gray-500">Saving…</span>}
          {priceMsg && <span className="text-xs text-gray-500 max-w-xs text-right">{priceMsg}</span>}
          <button onClick={() => setAddingPos(true)}
            className="px-3 py-2 bg-neutral-800 border border-neutral-700 text-gray-300 rounded-xl text-xs font-semibold hover:border-neutral-500 transition">
            + Add Position
          </button>
          <button onClick={refreshPrices} disabled={refreshing}
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 flex items-center gap-1.5">
            {refreshing ? <span className="animate-spin">⟳</span> : '⟳'} Refresh Prices
          </button>
        </div>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Value', value: fmtUSD(totalValueUSD), sub: `${data.positions?.length || 0} open positions`, cls: 'text-white' },
          { label: 'Cost Basis', value: fmtUSD(totalCostUSD), sub: 'Total invested', cls: 'text-gray-300' },
          { label: 'Unrealized P&L', value: (unrealizedPNL >= 0 ? '+' : '') + fmtUSD(unrealizedPNL), sub: totalCostUSD > 0 ? (unrealizedPNL >= 0 ? '+' : '') + (unrealizedPNL / totalCostUSD * 100).toFixed(1) + '%' : '', cls: pnlCls(unrealizedPNL) },
          { label: 'Realized P&L', value: (realizedPNL >= 0 ? '+' : '') + fmtUSD(realizedPNL), sub: `${data.closedPositions?.length || 0} closed positions`, cls: pnlCls(realizedPNL) },
        ].map(c => (
          <div key={c.label} className="bg-neutral-950 border border-neutral-800 rounded-xl p-4">
            <div className="text-[10px] text-gray-500 uppercase font-bold mb-1">{c.label}</div>
            <div className={`text-xl font-bold font-mono ${c.cls}`}>{c.value}</div>
            {c.sub && <div className="text-[11px] text-gray-600 mt-0.5">{c.sub}</div>}
          </div>
        ))}
      </div>

      {/* ── Dry powder ── */}
      <div className="flex items-center gap-3">
        <div className="text-xs text-gray-500">Dry powder:</div>
        <div className="text-xs font-mono text-amber-400 font-bold">${(data.config?.dryCash || 0).toLocaleString()} USD</div>
        <button onClick={() => {
          const v = prompt('Set dry powder (USD):', data.config?.dryCash || 0);
          if (v !== null && !isNaN(+v)) persist({ ...data, config: { ...data.config, dryCash: +v } });
        }} className="text-[10px] text-gray-600 hover:text-gray-400 border border-neutral-800 rounded px-1.5 py-0.5 transition">edit</button>
        <div className="text-[10px] text-gray-600">Priority if several fire: <span className="text-gray-400 font-mono">{data.config?.addPriority}</span></div>
      </div>

      {/* ── Platform sections ── */}
      {platforms.map(platform => (
        <div key={platform.name} className="bg-neutral-950 border border-neutral-800 rounded-xl overflow-hidden">
          {/* Platform header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800 bg-neutral-900/50">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">{platform.name}</span>
              <span className="text-xs text-gray-500 bg-neutral-800 px-2 py-0.5 rounded-full">{platform.positions.length} positions</span>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold font-mono text-white">{fmtUSD(platform.totalUSD)}</div>
              <div className={`text-xs font-mono ${pnlCls(platform.pnlUSD)}`}>
                {platform.pnlUSD >= 0 ? '+' : ''}{fmtUSD(platform.pnlUSD)} ({platform.pnlPct >= 0 ? '+' : ''}{platform.pnlPct.toFixed(1)}%)
              </div>
            </div>
          </div>

          {/* Positions table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] text-gray-600 uppercase font-semibold tracking-wide border-b border-neutral-900">
                  <th className="text-left px-4 py-2">Asset</th>
                  <th className="text-right px-3 py-2 whitespace-nowrap">Units · Price</th>
                  <th className="text-right px-3 py-2">Cost</th>
                  <th className="text-right px-3 py-2">Value</th>
                  <th className="text-right px-3 py-2">P&amp;L</th>
                  <th className="text-right px-3 py-2 hidden sm:table-cell">Wt</th>
                  <th className="px-4 py-2 min-w-[200px]">ADD ◂— now —▸ TRIM</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-2 py-2 w-6"></th>
                </tr>
              </thead>
              <tbody>
                {platform.positions.map(pos => (
                  <tr key={pos.id} className="border-b border-neutral-900 hover:bg-neutral-900/40 group">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <TypeBadge type={pos.type} />
                        <div>
                          <div className="font-bold text-white text-sm leading-none">{pos.ticker}</div>
                          <div className="text-[10px] text-gray-500 mt-0.5 max-w-[120px] truncate">{pos.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="font-mono text-gray-300">{fmtShares(pos.shares)}</div>
                      <div className="text-[10px] text-gray-500 font-mono">{fmtPrice(pos.price, pos.currency)}</div>
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-gray-500">
                      {pos.costPerShare > 0 ? fmtPrice(pos.costPerShare, pos.currency) : <span className="text-emerald-600 text-[10px]">grant</span>}
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-bold text-white">{fmtUSD(pos.valueUSD)}</td>
                    <td className={`px-3 py-3 text-right font-mono ${pnlCls(pos.pnlUSD)}`}>
                      <div>{pos.pnlUSD >= 0 ? '+' : ''}{fmtUSD(pos.pnlUSD)}</div>
                      {pos.pnlPct !== null && <div className="text-[10px]">{pos.pnlPct >= 0 ? '+' : ''}{pos.pnlPct.toFixed(1)}%</div>}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-gray-500 hidden sm:table-cell text-[11px]">
                      {pos.weight !== null ? pos.weight.toFixed(1) + '%' : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <TriggerRail price={pos.price} addLevels={pos.addLevels} trimLevels={pos.trimLevels} status={pos.status} currency={pos.currency} />
                      {pos.notes && <div className="text-[9px] text-gray-600 mt-1 italic">{pos.notes}</div>}
                    </td>
                    <td className="px-3 py-3"><StatusBadge status={pos.status} /></td>
                    <td className="px-2 py-3">
                      <button onClick={() => setEditingPos(pos)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-white rounded transition">
                        ✏️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* ── Action Framework ── */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-neutral-800 bg-neutral-900/50">
          <h3 className="text-sm font-bold text-white">Action Framework — When &amp; How Much</h3>
          <p className="text-[10px] text-gray-600 mt-0.5">Adds are red-day moves · trims are green-day moves · never chase a gap · a level is void if the story breaks</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-neutral-800">
          {/* ADD */}
          <div className="p-4">
            <div className="text-[10px] font-mono font-bold text-blue-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-sm bg-blue-400 inline-block"></span> ADD (on weakness)
            </div>
            {actionItems.adds.length === 0 ? <div className="text-xs text-gray-600">No add levels defined</div> : actionItems.adds.map((a, i) => {
              const sym = a.currency === 'EUR' ? '€' : a.currency === 'AED' ? 'AED ' : '$';
              return (
                <div key={i} className="flex justify-between py-2 border-b border-neutral-900 last:border-0">
                  <span className="font-bold text-white text-xs">{a.ticker}</span>
                  <span className="font-mono text-xs">
                    <span className="text-blue-300">{sym}{a.level}</span>
                    {a.amount && <span className="text-gray-500 ml-2 text-[10px]">{a.amount}</span>}
                    <span className="text-gray-600 ml-1 text-[10px]">−{a.pctAway}%</span>
                  </span>
                </div>
              );
            })}
          </div>

          {/* TRIM */}
          <div className="p-4">
            <div className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-sm bg-emerald-400 inline-block"></span> TRIM (into strength)
            </div>
            {actionItems.trims.length === 0 ? <div className="text-xs text-gray-600">No trim levels defined</div> : actionItems.trims.map((t, i) => {
              const sym = t.currency === 'EUR' ? '€' : t.currency === 'AED' ? 'AED ' : '$';
              return (
                <div key={i} className="flex justify-between py-2 border-b border-neutral-900 last:border-0">
                  <span className="font-bold text-white text-xs">{t.ticker}</span>
                  <span className="font-mono text-xs">
                    <span className="text-emerald-300">{sym}{t.level}</span>
                    {t.action && <span className="text-gray-500 ml-2 text-[10px]">{t.action}</span>}
                    <span className="text-gray-600 ml-1 text-[10px]">+{t.pctAway}%</span>
                  </span>
                </div>
              );
            })}
          </div>

          {/* HOLD / SPECIAL */}
          <div className="p-4">
            <div className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-sm bg-neutral-500 inline-block"></span> HOLD / SPECIAL
            </div>
            <div className="py-2 border-b border-neutral-900"><span className="font-bold text-white text-xs">AMD</span><span className="text-[10px] text-gray-500 ml-2">never sell for concentration</span></div>
            <div className="py-2 border-b border-neutral-900"><span className="font-bold text-white text-xs">CSPX</span><span className="text-[10px] text-gray-500 ml-2">base · only add on −5/−10%</span></div>
            <div className="py-2 border-b border-neutral-900"><span className="font-bold text-white text-xs">CAKE</span><span className="text-[10px] text-gray-500 ml-2">no adds · trim at $90</span></div>
            <div className="py-2 border-b border-neutral-900"><span className="font-bold text-white text-xs">DHER</span><span className="text-[10px] text-gray-500 ml-2">event-driven · reduce into €40+ deal strength</span></div>
            <div className="py-2 border-b border-neutral-900"><span className="font-bold text-amber-400 text-xs">Crypto</span><span className="text-[10px] text-gray-500 ml-2">DCA only at deep levels · target break-even</span></div>
            <div className="py-2"><span className="text-amber-400 text-xs font-mono">Today</span><span className="text-[10px] text-gray-500 ml-2">no triggers active — hold</span></div>
          </div>
        </div>
      </div>

      {/* ── Closed Positions ── */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-xl overflow-hidden">
        <button onClick={() => setShowClosed(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 border-b border-neutral-800 bg-neutral-900/50 hover:bg-neutral-900 transition text-left">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">Realized P&amp;L — Closed Positions</span>
            <span className="text-xs text-gray-500 bg-neutral-800 px-2 py-0.5 rounded-full">{data.closedPositions?.length || 0} closed</span>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-sm font-bold font-mono ${pnlCls(realizedPNL)}`}>Net P&amp;L: {realizedPNL >= 0 ? '+' : ''}{fmtUSD(realizedPNL)}</span>
            <span className="text-gray-500 text-xs">{showClosed ? '▲ Collapse' : '▼ Expand'}</span>
          </div>
        </button>

        {showClosed && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] text-gray-600 uppercase font-semibold tracking-wide border-b border-neutral-900">
                  <th className="text-left px-4 py-2">Asset</th>
                  <th className="text-left px-3 py-2">Platform</th>
                  <th className="text-right px-3 py-2">Closed</th>
                  <th className="text-right px-3 py-2">Qty</th>
                  <th className="text-right px-3 py-2">Sell Price</th>
                  <th className="text-right px-3 py-2">Cost</th>
                  <th className="text-right px-3 py-2">Proceeds</th>
                  <th className="text-right px-4 py-2">G/L</th>
                </tr>
              </thead>
              <tbody>
                {(data.closedPositions || []).map(p => (
                  <tr key={p.id} className="border-b border-neutral-900 hover:bg-neutral-900/30">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <TypeBadge type={p.type} />
                        <span className="font-bold text-white">{p.ticker}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-gray-500">{p.platform}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-gray-500">{p.closedDate}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-gray-400">{fmtShares(p.qty)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-gray-400">{p.sellPrice}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-gray-500">{p.costAED > 0 ? '$' + p.costAED : <span className="text-emerald-600 text-[10px]">grant</span>}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-gray-300">${(p.proceeds || 0).toLocaleString()}</td>
                    <td className={`px-4 py-2.5 text-right font-mono font-bold ${pnlCls(p.gainLoss)}`}>
                      {p.gainLoss >= 0 ? '+' : ''}{fmtUSD(p.gainLoss)}
                      {p.pct !== null && p.pct !== undefined && <span className="text-[10px] ml-1">({p.pct > 0 ? '+' : ''}{p.pct?.toFixed(1)}%)</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Edit / Add modal ── */}
      {(editingPos || addingPos) && (
        <EditPositionModal
          pos={editingPos || undefined}
          onSave={savePosition}
          onClose={() => { setEditingPos(null); setAddingPos(false); }}
          onDelete={deletePosition}
        />
      )}
    </div>
  );
}
