import React, { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from './firebase-config.js';
import Dashboard from './Dashboard.jsx';
import Transactions from './Transactions.jsx';

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'transactions', label: 'Transactions', icon: '📋' },
];

const CURRENCIES = ['AED', 'USD', 'EUR', 'PEN'];

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [recurringBills, setRecurringBills] = useState([]);
  const [selectedCurrency, setSelectedCurrency] = useState('AED');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const unsubscribe = loadData();
    return unsubscribe;
  }, []);

  const loadData = () => {
    setLoading(true);
    setError('');

    let loadedAccounts = false, loadedTx = false, loadedBudgets = false, loadedBills = false;

    // Real-time listeners for instant updates
    const unsubscribeAccounts = onSnapshot(collection(db, 'accounts'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAccounts(data);
      loadedAccounts = true;
      console.log('Accounts loaded:', data.length);
      if (loadedAccounts && loadedTx && loadedBudgets && loadedBills) setLoading(false);
    }, (err) => {
      console.error('Error loading accounts:', err);
      setError(err.message);
      setLoading(false);
    });

    const unsubscribeTx = onSnapshot(collection(db, 'transactions'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTransactions(data);
      loadedTx = true;
      console.log('Transactions loaded:', data.length);
      if (loadedAccounts && loadedTx && loadedBudgets && loadedBills) setLoading(false);
    }, (err) => {
      console.error('Error loading transactions:', err);
      setError(err.message);
      setLoading(false);
    });

    const unsubscribeBudgets = onSnapshot(collection(db, 'budgets'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBudgets(data);
      loadedBudgets = true;
      console.log('Budgets loaded:', data.length);
      if (loadedAccounts && loadedTx && loadedBudgets && loadedBills) setLoading(false);
    }, (err) => {
      console.error('Error loading budgets:', err);
      setError(err.message);
      setLoading(false);
    });

    const unsubscribeBills = onSnapshot(collection(db, 'recurringBills'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRecurringBills(data);
      loadedBills = true;
      console.log('Recurring bills loaded:', data.length);
      if (loadedAccounts && loadedTx && loadedBudgets && loadedBills) setLoading(false);
    }, (err) => {
      console.error('Error loading recurring bills:', err);
      setError(err.message);
      setLoading(false);
    });

    return () => {
      unsubscribeAccounts();
      unsubscribeTx();
      unsubscribeBudgets();
      unsubscribeBills();
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">💰</div>
          <p className="text-gray-400">Loading Finance Dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">Error loading data</p>
          <p className="text-gray-500 text-sm">{error}</p>
          <button
            onClick={() => location.reload()}
            className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-gray-200">
      {/* Header */}
      <header className="border-b border-neutral-800 sticky top-0 z-50 bg-black/95">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <span className="text-2xl">💰</span>
              <h1 className="text-xl font-bold text-white">Finance Command Center</h1>
            </div>

            <div className="flex items-center gap-3">
              {/* Currency Selector */}
              <select
                value={selectedCurrency}
                onChange={(e) => setSelectedCurrency(e.target.value)}
                className="px-2 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-xs font-semibold text-gray-300 cursor-pointer hover:border-emerald-600 transition"
              >
                {CURRENCIES.map(cur => (
                  <option key={cur} value={cur}>{cur}</option>
                ))}
              </select>

              {/* Action Buttons */}
              <button className="px-3 py-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition">
                ➕ Add
              </button>

              <button className="px-3 py-2 text-xs text-gray-400 hover:text-gray-200 transition border border-neutral-700 rounded-lg">
                ↔️ Reconcile
              </button>

              <button onClick={loadData} className="px-3 py-2 text-xs text-gray-400 hover:text-gray-200 transition">
                🔄 Refresh
              </button>

              <button className="px-3 py-2 text-xs text-gray-400 hover:text-gray-200 transition">
                🌙
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex gap-1 border-t border-neutral-800 -mx-4 -mb-px px-4">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-semibold transition border-b-2 ${
                  activeTab === tab.id
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'dashboard' && (
          <Dashboard
            accounts={accounts}
            transactions={transactions}
            budgets={budgets}
            recurringBills={recurringBills}
          />
        )}
        {activeTab === 'transactions' && <Transactions transactions={transactions} budgets={budgets} />}
      </main>
    </div>
  );
}
