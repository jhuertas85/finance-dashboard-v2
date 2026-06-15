// Currency rates from correct-data-v2.json
const FX_RATES = {
  AED: 1,
  USD: 3.67,
  EUR: 4.0,
  PEN: 0.95,
};

export function toAED(amount, currency) {
  if (typeof amount !== 'number') return 0;
  return amount * (FX_RATES[currency] || 1);
}

export function formatAmount(value, currency = 'AED') {
  if (value === null || value === undefined || isNaN(value)) return '—';
  const aedValue = currency === 'AED' ? value : toAED(value, currency);
  const sym = currency === 'AED' ? 'AED' : currency;
  return `${sym} ${Math.round(aedValue).toLocaleString()}`;
}

export function formatFull(value, currency = 'AED') {
  if (value === null || value === undefined || isNaN(value)) return '—';
  const aedValue = currency === 'AED' ? value : toAED(value, currency);
  return `AED ${Math.round(aedValue).toLocaleString()}`;
}

export function formatShort(value) {
  if (value === null || value === undefined || isNaN(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1e6) return (value < 0 ? '-' : '') + (abs / 1e6).toFixed(2) + 'M';
  if (abs >= 1e3) return (value < 0 ? '-' : '') + (abs / 1e3).toFixed(1) + 'K';
  return (value < 0 ? '-' : '') + abs.toFixed(0);
}

export function calculateNetWorth(accounts) {
  let capital = 0, usable = 0, futureAssets = 0, liabilities = 0, debt = 0;

  accounts.forEach(acc => {
    const aedBalance = toAED(acc.currentBalance, acc.currency);

    if (acc.netWorthBucket === 'capital') capital += aedBalance;
    else if (acc.netWorthBucket === 'usable') usable += aedBalance;
    else if (acc.netWorthBucket === 'future') {
      if (acc.kind === 'asset') futureAssets += aedBalance;
      else if (acc.kind === 'liability') liabilities += Math.abs(aedBalance);
    } else if (acc.netWorthBucket === 'debt') {
      debt += Math.abs(aedBalance);
    }
  });

  return {
    capital,
    usable,
    futureNet: futureAssets - liabilities,
    debt,
    total: capital + usable + (futureAssets - liabilities) - debt,
  };
}

export function calculateMonthlySpending(transactions, month, year) {
  return transactions
    .filter(tx => {
      const date = new Date(tx.date);
      return date.getMonth() === month - 1 && date.getFullYear() === year && tx.type === 'expense';
    })
    .reduce((sum, tx) => sum + toAED(tx.amount, tx.currency), 0);
}

export function calculateSpendingByCategory(transactions, month, year) {
  const byCategory = {};

  transactions
    .filter(tx => {
      const date = new Date(tx.date);
      return date.getMonth() === month - 1 && date.getFullYear() === year && tx.type === 'expense';
    })
    .forEach(tx => {
      const aedAmount = toAED(tx.amount, tx.currency);
      byCategory[tx.category] = (byCategory[tx.category] || 0) + aedAmount;
    });

  return byCategory;
}

export function getDayProgress() {
  const now = new Date();
  const day = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return { day, daysInMonth, pct: (day / daysInMonth) * 100 };
}

export function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
}

export function formatMonth(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

const CATEGORY_COLORS = {
  'Investments': '#8b5cf6',
  'Housing': '#ec4899',
  'Subs, Sports & Health': '#10b981',
  'Food & Groceries': '#f59e0b',
  'Car': '#3b82f6',
  'Going Out': '#ef4444',
  'Purchases': '#06b6d4',
  'Travel': '#14b8a6',
  'Others': '#6b7280',
};

export function getCategoryColor(category) {
  return CATEGORY_COLORS[category] || '#6b7280';
}

const CATEGORY_EMOJI = {
  'Investments': '💰',
  'Housing': '🏠',
  'Subs, Sports & Health': '🏋️',
  'Food & Groceries': '🍔',
  'Car': '🚗',
  'Going Out': '🍻',
  'Purchases': '🛍️',
  'Travel': '✈️',
  'Others': '📦',
};

export function getCategoryEmoji(category) {
  return CATEGORY_EMOJI[category] || '📌';
}
