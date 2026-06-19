// Fix NBD Credit → 0 and NBD Savings → 29049.90
// after a reconciliation/payment timing drift of AED 46.58
import https from 'https';

const PROJECT_ID = 'finance-center-b9cf9';
const API_KEY = 'AIzaSyBXF6pe23CnPdkC7zCr5Ev_Q_QVj69yj7s';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function listAccounts() {
  const url = new URL(`${BASE}/accounts`);
  url.searchParams.set('key', API_KEY);
  url.searchParams.set('pageSize', '100');
  const parsed = new URL(url.toString());
  const { body } = await request({ hostname: parsed.hostname, path: parsed.pathname + parsed.search, method: 'GET' });
  return body.documents || [];
}

async function setBalance(docId, balance) {
  const url = new URL(`${BASE}/accounts/${docId}`);
  url.searchParams.set('key', API_KEY);
  url.searchParams.set('updateMask.fieldPaths', 'currentBalance');
  const parsed = new URL(url.toString());
  return request({
    hostname: parsed.hostname,
    path: parsed.pathname + parsed.search,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
  }, { fields: { currentBalance: { doubleValue: balance } } });
}

async function fix() {
  console.log('Fetching accounts…');
  const docs = await listAccounts();
  console.log(`Found ${docs.length} accounts\n`);

  for (const d of docs) {
    const id = d.name.split('/').pop();
    const name = d.fields?.name?.stringValue || '';
    const bal = d.fields?.currentBalance?.doubleValue ?? d.fields?.currentBalance?.integerValue ?? '?';

    if (name.toLowerCase().includes('nbd') && name.toLowerCase().includes('credit')) {
      console.log(`Found: ${name} (${id}) — current balance: ${bal}`);
      const { status } = await setBalance(id, 0);
      console.log(`  → Set to 0  [HTTP ${status}]\n`);
    }

    if (name.toLowerCase().includes('nbd') && name.toLowerCase().includes('saving')) {
      console.log(`Found: ${name} (${id}) — current balance: ${bal}`);
      const { status } = await setBalance(id, 29049.90);
      console.log(`  → Set to 29049.90  [HTTP ${status}]\n`);
    }
  }

  console.log('Done.');
}

fix().catch(err => { console.error('Failed:', err.message); process.exit(1); });
