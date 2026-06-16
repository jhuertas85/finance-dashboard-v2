// One-time migration via Firestore REST API (no SDK needed)
// Sets reconciled=true on all transactions EXCEPT tx_1781094858753_vg89kj
import https from 'https';

const PROJECT_ID = 'finance-center-b9cf9';
const API_KEY = 'AIzaSyBXF6pe23CnPdkC7zCr5Ev_Q_QVj69yj7s';
const PENDING_TX_ID = 'tx_1781094858753_vg89kj';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function listAllTransactions() {
  const docs = [];
  let pageToken = null;
  do {
    const url = new URL(`${BASE}/transactions`);
    url.searchParams.set('key', API_KEY);
    url.searchParams.set('pageSize', '300');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const parsed = new URL(url.toString());
    const result = await request({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'GET',
    });
    if (result.documents) docs.push(...result.documents);
    pageToken = result.nextPageToken || null;
  } while (pageToken);
  return docs;
}

async function setReconciled(docId, value) {
  const url = new URL(`${BASE}/transactions/${docId}`);
  url.searchParams.set('key', API_KEY);
  url.searchParams.set('updateMask.fieldPaths', 'reconciled');

  const parsed = new URL(url.toString());
  return request({
    hostname: parsed.hostname,
    path: parsed.pathname + parsed.search,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
  }, {
    fields: {
      reconciled: { booleanValue: value },
    },
  });
}

async function migrate() {
  console.log('Fetching all transactions...');
  const docs = await listAllTransactions();
  console.log(`Found ${docs.length} transactions\n`);

  let updated = 0;
  let kept = 0;

  for (const d of docs) {
    const id = d.name.split('/').pop();
    if (id === PENDING_TX_ID) {
      await setReconciled(id, false);
      kept++;
      console.log(`  KEPT false: ${id} (pending NBD Credit taxi charge)`);
    } else {
      await setReconciled(id, true);
      updated++;
    }
  }

  console.log(`\nDone. Set reconciled=true: ${updated}, Kept reconciled=false: ${kept}`);
}

migrate().catch(err => {
  console.error('Failed:', err.message);
  process.exit(1);
});
