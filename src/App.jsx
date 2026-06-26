import React, { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from './firebase-config.js';
import Dashboard from './Dashboard.jsx';
import Transactions from './Transactions.jsx';
import Investments from './Investments.jsx';
import AddTransactionModal from './AddTransactionModal.jsx';
import ReconcileModal from './ReconcileModal.jsx';

const CURRENCIES = ['AED', 'USD', 'EUR', 'PEN', 'OWN'];
const CURRENCY_LABELS = { OWN: 'Own' };
const DEFAULT_FX = { AED: 1, USD: 3.67, EUR: 4.0, PEN: 0.95 };
const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'transactions', label: 'Transactions', icon: '📋' },
  { id: 'investments', label: 'Investments', icon: '📈' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [recurringBills, setRecurringBills] = useState([]);
  const [selectedCurrency, setSelectedCurrency] = useState('OWN');
  const [fxRates, setFxRates] = useState(DEFAULT_FX);
  const [fxLastUpdated, setFxLastUpdated] = useState(null);
  const [fxLoading, setFxLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddTx, setShowAddTx] = useState(false);
  const [addTxInitialTab, setAddTxInitialTab] = useState('manual');
  const [showReconcile, setShowReconcile] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [txFilter, setTxFilter] = useState(null);

  function navigateToTx(filter) {
    setTxFilter(filter);
    setActiveTab('transactions');
  }

  // Date/time info for header
  const now = new Date();
  const monthLabel = now.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  const day = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const timeLabel = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

  useEffect(() => {
    const unsub = setupListeners();
    return unsub;
  }, []);

  function setupListeners() {
    setLoading(true);
    setError('');
    let loaded = { accounts: false, tx: false, budgets: false, bills: false };

    function checkDone() {
      if (Object.values(loaded).every(Boolean)) setLoading(false);
    }

    const unsubAccounts = onSnapshot(collection(db, 'accounts'), snap => {
      setAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      loaded.accounts = true; checkDone();
    }, err => { setError(err.message); setLoading(false); });

    const unsubTx = onSnapshot(collection(db, 'transactions'), snap => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      loaded.tx = true; checkDone();
    }, err => { setError(err.message); setLoading(false); });

    const unsubBudgets = onSnapshot(collection(db, 'budgets'), snap => {
      setBudgets(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      loaded.budgets = true; checkDone();
    }, err => { setError(err.message); setLoading(false); });

    const unsubBills = onSnapshot(collection(db, 'recurringBills'), snap => {
      setRecurringBills(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      loaded.bills = true; checkDone();
    }, err => { setError(err.message); setLoading(false); });

    return () => { unsubAccounts(); unsubTx(); unsubBudgets(); unsubBills(); };
  }

  async function fetchFxRates() {
    if (fxLoading) return;
    setFxLoading(true);
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/AED');
      if (!res.ok) throw new Error('fetch failed');
      const data = await res.json();
      if (data.result === 'success' && data.rates) {
        const r = data.rates;
        setFxRates({
          AED: 1,
          USD: r.USD ? 1 / r.USD : DEFAULT_FX.USD,
          EUR: r.EUR ? 1 / r.EUR : DEFAULT_FX.EUR,
          PEN: r.PEN ? 1 / r.PEN : DEFAULT_FX.PEN,
        });
        setFxLastUpdated(new Date());
      }
    } catch {
      // keep current rates on failure
    }
    setFxLoading(false);
  }

  function handleRefresh() {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1200);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">💰</div>
          <p className="text-gray-400">Loading Finance Dashboard…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-2 font-semibold">Error loading data</p>
          <p className="text-gray-500 text-sm mb-4">{error}</p>
          <button onClick={() => location.reload()}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm">Try Again</button>
        </div>
      </div>
    );
  }

  const rootClass = darkMode
    ? 'min-h-screen bg-black text-gray-200'
    : 'min-h-screen bg-gray-100 text-gray-900';

  const headerClass = darkMode
    ? 'border-b border-neutral-800 sticky top-0 z-40 bg-black/95 backdrop-blur'
    : 'border-b border-gray-300 sticky top-0 z-40 bg-white/95 backdrop-blur';

  return (
    <div className={rootClass}>
      <header className={headerClass}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Top row */}
          <div className="flex items-center justify-between h-14 gap-2">
            {/* Date info */}
            <span className={`text-xs font-mono hidden sm:block ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              {monthLabel} · Day {day}/{daysInMonth} · {timeLabel}
            </span>

            {/* Currency pills + FX refresh */}
            <div className="flex items-center gap-1.5">
              <div className={`flex items-center gap-1 rounded-xl p-1 ${darkMode ? 'bg-neutral-900' : 'bg-gray-200'}`}>
                {CURRENCIES.map(cur => (
                  <button
                    key={cur}
                    onClick={() => setSelectedCurrency(cur)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      selectedCurrency === cur
                        ? 'bg-emerald-500 text-white shadow'
                        : darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >{CURRENCY_LABELS[cur] || cur}</button>
                ))}
              </div>
              <button
                onClick={fetchFxRates}
                disabled={fxLoading}
                title={fxLastUpdated
                  ? `FX rates live · updated ${fxLastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
                  : 'Rates: hardcoded — click to fetch live'}
                className={`text-sm px-1.5 py-1 rounded-lg transition ${
                  fxLoading ? 'text-emerald-400 animate-spin' : darkMode ? 'text-gray-600 hover:text-emerald-400' : 'text-gray-400 hover:text-emerald-600'
                }`}
              >↻</button>
              {fxLastUpdated && (
                <span className="text-[10px] text-gray-600 hidden sm:block">
                  {fxLastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAddTx(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold transition"
              >➕ Add Transaction</button>

              <button
                onClick={() => setShowReconcile(true)}
                className={`px-3 py-2 text-xs font-semibold rounded-lg border transition ${darkMode ? 'border-neutral-700 text-gray-300 hover:text-white hover:border-neutral-500' : 'border-gray-300 text-gray-600 hover:text-gray-900'}`}
              >⚖️ Reconcile</button>

              <button
                onClick={() => setDarkMode(d => !d)}
                className={`px-2.5 py-2 rounded-lg text-sm transition ${darkMode ? 'text-gray-400 hover:text-yellow-400' : 'text-gray-500 hover:text-gray-800'}`}
                title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              >{darkMode ? '🌙' : '☀️'}</button>

              <button
                onClick={handleRefresh}
                className={`px-2.5 py-2 rounded-lg text-sm transition ${refreshing ? 'text-emerald-400 animate-spin' : darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}
                title="Refresh data"
              >🔄</button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className={`flex gap-1 border-t -mx-4 -mb-px px-4 ${darkMode ? 'border-neutral-800' : 'border-gray-200'}`}>
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-semibold transition border-b-2 ${
                  activeTab === tab.id
                    ? 'border-emerald-500 text-emerald-400'
                    : darkMode
                      ? 'border-transparent text-gray-500 hover:text-gray-300'
                      : 'border-transparent text-gray-400 hover:text-gray-700'
                }`}
              >{tab.icon} {tab.label}</button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'dashboard' && (
          <Dashboard
            accounts={accounts}
            transactions={transactions}
            budgets={budgets}
            recurringBills={recurringBills}
            selectedCurrency={selectedCurrency}
            fxRates={fxRates}
            darkMode={darkMode}
            onReviewBills={() => { setAddTxInitialTab('recurring'); setShowAddTx(true); }}
            onNavigateToTx={navigateToTx}
          />
        )}
        {activeTab === 'transactions' && (
          <Transactions
            transactions={transactions}
            accounts={accounts}
            budgets={budgets}
            selectedCurrency={selectedCurrency}
            externalFilter={txFilter}
            onClearExternalFilter={() => setTxFilter(null)}
          />
        )}
        {activeTab === 'investments' && <Investments accounts={accounts} />}
      </main>

      {showAddTx && (
        <AddTransactionModal
          accounts={accounts}
          transactions={transactions}
          recurringBills={recurringBills}
          initialTab={addTxInitialTab}
          onClose={() => { setShowAddTx(false); setAddTxInitialTab('manual'); }}
        />
      )}

      {showReconcile && (
        <ReconcileModal
          accounts={accounts}
          onClose={() => setShowReconcile(false)}
        />
      )}
    </div>
  );
}
