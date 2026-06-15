# Finance Command Center — React + Firestore Version

Exact replica of the Finance Dashboard, rebuilt as a modern React + Vite application with Firestore as the backend.

## Architecture

- **Frontend:** React 18 + Vite + Tailwind CSS (matching original design exactly)
- **Backend:** Firebase Firestore (real-time data)
- **Charting:** Recharts (same as original)
- **Deployment:** Vercel

## Setup Instructions

### 1. Clone and Install

```bash
git clone <your-github-url>
cd finance_dashboard_v2
npm install
```

### 2. Set Up Firebase

#### Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project (or use existing)
3. Enable Firestore Database
4. In **Project Settings → Service Accounts**, download your service account key
5. Save it as `serviceAccountKey.json` in the project root (keep this secret!)

#### Get Web App Credentials

1. In Firebase Console, go to **Project Settings**
2. Click on your web app (or create one)
3. Copy the Firebase config:
   ```
   API Key
   Auth Domain
   Project ID
   Storage Bucket
   Messaging Sender ID
   App ID
   ```

#### Create `.env.local`

```bash
cp .env.example .env.local
```

Then edit `.env.local` and paste your Firebase web app credentials:

```
VITE_FIREBASE_API_KEY=your_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### 3. Migrate Data to Firestore

Before first run, populate Firestore with data from `correct-data-v2.json`:

```bash
npm run setup-firebase
```

This will:
- Clear any existing data in Firestore
- Upload all accounts, transactions, budgets, and recurring bills
- Verify the upload succeeded

### 4. Run Locally

```bash
npm run dev
```

The app will open at `http://localhost:3000`

### 5. Deploy to Vercel

```bash
npm install -g vercel
vercel
```

When prompted, add your Firebase environment variables:
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

## Project Structure

```
├── index.html              # Entry point
├── package.json
├── vite.config.js         # Vite configuration
├── tailwind.config.js      # Tailwind configuration
├── vercel.json            # Vercel deployment config
├── .env.example           # Environment variables template
├── serviceAccountKey.json # Firebase Admin credentials (⚠️ Keep secret!)
├── data/
│   └── correct-data-v2.json  # Source data for Firestore migration
├── scripts/
│   └── setup-firebase.js  # Migration script
└── src/
    ├── main.jsx           # React entry point
    ├── App.jsx            # Main app component (layout & navigation)
    ├── Dashboard.jsx      # Dashboard tab (exact replica of original)
    ├── Transactions.jsx   # Transactions tab (exact replica of original)
    ├── firebase-config.js # Firebase initialization
    ├── utils.js           # Utilities (formatting, calculations, currency conversion)
    └── index.css          # Global styles + Tailwind
```

## Features

### Dashboard Tab
- **Net Worth Summary:** Capital + Usable Assets + Future Assets - Liabilities - Credit Card Debt
- **Monthly Spending:** Current month expenses with budget tracking
- **Annual Savings Tracker:** Jan-May real savings with projection
- **Capital Breakdown:** Bank accounts and savings
- **Assets - Usable:** Investments and trading accounts
- **Assets - Future:** Retirement and long-term holdings
- **Credit Cards:** Outstanding balances
- **Spending Detail:** By-category breakdown with budget comparison
- **Recent Transactions:** Last 15 expense transactions with dates, categories, and amounts

### Transactions Tab
- **Month Filter:** Select any month from your transaction history
- **Category Filter:** Filter by spending category
- **Summary Metrics:** Income, expenses, and net savings for the selected month
- **Detailed Table:** All transactions with date, type, description, category, and amount
- **Transaction Types:** Income, Expense (color-coded badges)

## Data Structure (Firestore Collections)

### Accounts Collection
```javascript
{
  id: "acc_mash_savings",
  name: "MASH Savings",
  type: "savings",
  currency: "AED",
  currentBalance: 469315.97,
  netWorthBucket: "capital",  // capital, usable, future, debt
  kind: "asset",              // asset, liability
  includeInNetWorth: true
}
```

### Transactions Collection
```javascript
{
  id: "txn_20260615_travel",
  date: "2026-06-15T00:00:00Z",
  description: "Travel expense",
  amount: 1717,
  type: "expense",  // expense, income, transfer
  category: "Travel",
  currency: "AED",
  fromAccount: "acc_mash_savings",
  toAccount: null,
  notes: ""
}
```

### Budgets Collection
```javascript
{
  id: "budget_travel",
  category: "Travel",
  monthlyLimit: 5000,
  year: 2026,
  month: 6
}
```

### Recurring Bills Collection
```javascript
{
  id: "bill_netflix",
  name: "Netflix",
  amount: 50,
  currency: "AED",
  frequency: "monthly",
  dueDay: 15,
  category: "Subscriptions",
  active: true
}
```

## Currency Handling

All values are stored in their native currency in Firestore. When displaying:

1. **Conversion rates** (from `correct-data-v2.json`):
   - AED: 1 (base)
   - USD: 3.67
   - EUR: 4.0
   - PEN: 0.95

2. **Calculations:**
   - Net Worth: Sum all accounts converted to AED
   - Monthly Spending: Sum expense transactions for the month in AED
   - By Category: Group transactions and convert to AED

3. **Display:**
   - Always show in AED with the symbol
   - Use short format (K, M) for large numbers
   - Full format for table displays

## Styling

The design matches the original exactly:
- Dark theme: `bg-black` with `text-gray-200`
- Accent color: `#10b981` (Tailwind emerald-500)
- Card borders: `border-neutral-800`
- Font family: `-apple-system, 'Segoe UI', Roboto, sans-serif`

## Performance

- Data loads from Firestore on app initialization
- No real-time listeners (load once on mount)
- Calculations are memoized with useMemo
- Responsive design works on mobile, tablet, and desktop

## Security

⚠️ **Important:**
- Never commit `serviceAccountKey.json` to git
- Never expose Firebase credentials in client code
- Use environment variables (`.env.local`) for development
- Firestore rules should restrict data access (configure in Firebase Console)

## Troubleshooting

### "Firestore initialization failed"
- Check `.env.local` has all required Firebase credentials
- Verify Firebase project is active
- Check browser console for specific error

### "Data not loading"
- Run `npm run setup-firebase` to populate Firestore
- Check Firestore collections exist in Firebase Console
- Verify read permissions in Firestore rules

### "Styles look wrong"
- Clear browser cache
- Run `npm install` to ensure Tailwind is installed
- Check `index.css` is imported in `main.jsx`

## Next Steps

1. **Set up Firestore security rules** in Firebase Console to restrict who can read/write
2. **Add authentication** (optional) if you want user accounts
3. **Set up continuous deployment** to redeploy on git push
4. **Monitor Firestore usage** to stay within free tier limits

## License

Your personal finance dashboard.

---

Built with React + Vite + Firestore  
Design inspired by original Google Apps Script dashboard
