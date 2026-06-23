const ACCOUNT_ORDER_KEYWORDS = [
  ['nbd', 'credit'],
  ['nbd', 'sav'],
  ['mashreq', 'sav'],
  ['wio', 'sav'],
  ['wio', 'usd'],
  ['wio', 'eur'],
  ['talabat'],
  ['nbd', 'current'],
  ['mashreq', 'current'],
  ['bcp', 'sol'],
  ['bcp', 'usd'],
  ['cash'],
];

export function sortAndFilterAccounts(accounts) {
  const result = [];
  for (const keywords of ACCOUNT_ORDER_KEYWORDS) {
    const found = accounts.find(a => {
      const n = (a.name || '').toLowerCase();
      return keywords.every(k => n.includes(k));
    });
    if (found && !result.find(r => r.id === found.id)) result.push(found);
  }
  return result;
}

const BRAND_MAP = [
  { match: ['nbd'],      color: '#C8102E', initials: 'NBD', emoji: '🔴' },
  { match: ['mashreq'],  color: '#F04E23', initials: 'MQ',  emoji: '🟠' },
  { match: ['wio'],      color: '#0D9488', initials: 'WIO', emoji: '🔵' },
  { match: ['talabat'],  color: '#FF6600', initials: 'TAL', emoji: '🟡' },
  { match: ['bcp'],      color: '#1D4ED8', initials: 'BCP', emoji: '🟣' },
  { match: ['cash'],     color: '#16A34A', initials: '$',   emoji: '🟢' },
];

export function getAccountBrand(name) {
  const n = (name || '').toLowerCase();
  for (const b of BRAND_MAP) {
    if (b.match.every(k => n.includes(k))) return b;
  }
  return { color: '#6b7280', initials: '?', emoji: '⚪' };
}
