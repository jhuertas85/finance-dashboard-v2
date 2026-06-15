import { initializeApp, cert } from 'firebase-admin/app.js';
import { getFirestore } from 'firebase-admin/firestore.js';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = new URL('.', import.meta.url).pathname;

// Get Firebase credentials from environment or from a service account file
const serviceAccountPath = resolve(__dirname, '../serviceAccountKey.json');
let serviceAccount;

try {
  const serviceAccountJson = readFileSync(serviceAccountPath, 'utf8');
  serviceAccount = JSON.parse(serviceAccountJson);
} catch (err) {
  console.error('Error: serviceAccountKey.json not found in project root');
  console.error('Please download your Firebase service account key and save it as serviceAccountKey.json');
  process.exit(1);
}

// Initialize Firebase Admin
initializeApp({
  credential: cert(serviceAccount),
  projectId: serviceAccount.project_id,
});

const db = getFirestore();

// Load data from correct-data-v2.json
const dataPath = resolve(__dirname, '../data/correct-data-v2.json');
const rawData = readFileSync(dataPath, 'utf8');
const data = JSON.parse(rawData);

async function setupFirebase() {
  try {
    console.log('🔥 Clearing existing data...');

    // Delete all documents in collections
    const collections = ['accounts', 'transactions', 'budgets', 'recurringBills'];
    for (const collectionName of collections) {
      const snapshot = await db.collection(collectionName).get();
      const batch = db.batch();
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      if (snapshot.docs.length > 0) {
        await batch.commit();
        console.log(`  ✓ Cleared ${collectionName}`);
      }
    }

    console.log('\n📥 Uploading data to Firestore...');

    // Upload accounts
    let count = 0;
    for (const account of data.accounts) {
      await db.collection('accounts').doc(account.id).set(account);
      count++;
    }
    console.log(`  ✓ Uploaded ${count} accounts`);

    // Upload transactions
    count = 0;
    for (const tx of data.transactions) {
      await db.collection('transactions').doc(tx.id).set(tx);
      count++;
    }
    console.log(`  ✓ Uploaded ${count} transactions`);

    // Upload budgets
    count = 0;
    for (const budget of data.budgets) {
      await db.collection('budgets').doc(budget.id).set(budget);
      count++;
    }
    console.log(`  ✓ Uploaded ${count} budgets`);

    // Upload recurring bills
    count = 0;
    for (const bill of data.recurringBills) {
      await db.collection('recurringBills').doc(bill.id).set(bill);
      count++;
    }
    console.log(`  ✓ Uploaded ${count} recurring bills`);

    console.log('\n✅ Firestore setup complete!');
    console.log('\nNext steps:');
    console.log('1. Create a .env.local file with your Firebase config');
    console.log('2. Copy from .env.example');
    console.log('3. Run: npm install');
    console.log('4. Run: npm run dev');
    console.log('\nYour Firestore is now populated with data from correct-data-v2.json');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error setting up Firestore:', error);
    process.exit(1);
  }
}

setupFirebase();
