import React, { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebase-config.js';
import Dashboard from './Dashboard.jsx';
import Transactions from './Transactions.jsx';

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'transactions', label: 'Transactions', icon: '📋' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');

      // Load accounts
      const accountsSnapshot = await getDocs(collection(db, 'accounts'));
      const accountsData = accountsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setAccounts(accountsData);

      // Load transactions
      const txSnapshot = await getDocs(collection(db, 'transactions'));
      const txData = txSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setTransactions(txData);

      // Load budgets
      const budgetsSnapshot = await getDocs(collection(db, 'budgets'));
      const budgetsData = budgetsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setBudgets(budgetsData);

      setLoading(false);
    } catch (err) {
      console.error('Error loading data:', err);
      setError(err.message);
      setLoading(false);
    }
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
            onClick={loadData}
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
            <button
              onClick={loadData}
              className="px-3 py-2 text-xs text-gray-400 hover:text-gray-200 transition"
              title="Refresh data"
            >
              🔄 Refresh
            </button>
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
        {activeTab === 'dashboard' && <Dashboard accounts={accounts} transactions={transactions} budgets={budgets} />}
        {activeTab === 'transactions' && <Transactions transactions={transactions} budgets={budgets} />}
      </main>
    </div>
  );
}
