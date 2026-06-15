# Finance Command Center Dashboard

A modern, real-time financial dashboard built with React, Firestore, and Vercel. Tracks net worth, spending, budgets, investments, and recurring bills across multiple currencies (AED, USD, EUR, PEN).

**🌐 Live Deployment:** https://finance-dashboard-v2.vercel.app  
**⚡ Load Time:** <1 second (real-time Firestore listeners)  
**📦 Stack:** React 18 + Vite + Tailwind CSS + Recharts + Firebase Firestore

---

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Features Implemented](#features-implemented)
3. [Architecture](#architecture)
4. [Data Model](#data-model)
5. [Setup Instructions](#setup-instructions)
6. [Development](#development)
7. [Deployment](#deployment)
8. [Project Structure](#project-structure)
9. [Future Features](#future-features)

---

## 🎯 Project Overview

This is a complete rewrite of the original Google Sheets-based finance dashboard into a modern React web application with real-time data synchronization. 

### Key Technical Achievement
**Performance Fix:** Switched from `getDocs` (one-time queries = 30+ sec load) to `onSnapshot` (real-time listeners = <1 sec load). This was the critical difference between the old slow version and the new fast version.

### Current Data in System
- **Net Worth:** AED 3.2M+ across 24 accounts
- **Monthly Spending:** AED 95K average
- **Annual Savings:** AED 230K+ projected
- **Transactions:** 370+ recorded (June 2024 - June 2026)
- **Budgets:** 15 monthly category budgets
- **Investments:** 31 holdings tracked
- **Recurring Bills:** 14 monthly/annual bills
- **Keywords Rules:** 118 auto-categorization rules

---

## ✨ Features Implemented

### Dashboard Tab (`src/Dashboard.jsx`)

#### 1️⃣ Top KPI Cards (3 columns)
```
NET WORTH                     SPENT THIS MONTH              ANNUAL SAVINGS TRACKER
💎 AED 3.2M                   💸 AED 95K                    📅 AED 177K
+7.9% vs last month           of AED 150K budget (63%)      Jan-May real • AED 230K projected
                              Day 15/30                      ↑ Ahead of pace 5/12 months
```
- Each card shows main metric + trend/context
- Progress bars for spending and savings tracking

#### 2️⃣ Account Breakdown (5 cards in 2x2.5 grid)
- **Capital**: Liquid accounts (checking, savings) - AED 1.2M
- **Assets—Usable**: Sellable within days (stocks) - AED 1.5M
- **Assets—Future**: Long-term locked (mortgages) - AED 800K
- **Outstanding Contributions**: Liabilities to be paid
- **Credit Cards**: All credit card balances

Each shows account name, balance in original currency, and bucket description.

#### 3️⃣ Monthly Flow Chart
- **Type**: Grouped bar chart
- **Data**: Last 12 months (rolling window)
- **Bars**: Real Spending (emerald) vs Projected (purple)
- **Purpose**: Identify spending patterns and forecast needs
- Shows month abbreviations on X-axis, amounts on Y-axis

#### 4️⃣ Wealth Trajectory Chart
- **Type**: Stacked area chart with line overlay
- **Data**: Last 12 months of net worth breakdown
- **Layers** (stacked):
  - Capital (purple 60%)
  - Assets Usable (emerald 60%)
  - Assets Future (amber 60%)
- **Line Overlay**: Total Net Worth (cyan, 2px)
- **Purpose**: See how wealth composition and total are evolving

#### 5️⃣ Spending Detail
- Category breakdown bars (all 9 categories)
- Shows: Spent / Budget = % used
- Color coding:
  - 🟢 Green: <50% used (safe)
  - 🟡 Amber: 50-85% used (caution)
  - 🔴 Red: >85% used (warning)
- Category emoji for quick visual scanning

#### 6️⃣ Budget Overview Table
- All 9 spending categories listed
- Columns: Category | Budget | Spent | Remaining | %
- Edit button to modify budgets
- Remaining balance color-coded (green=surplus, red=over-budget)
- Sortable by amount or percentage

#### 7️⃣ Recent Transactions
- Last 15 expense transactions
- Columns: Date | Description | Category | Amount
- Category emoji for quick identification
- Sorted by date (newest first)

#### 8️⃣ Alert Banner
- **Overdue Bills**: Red banner if any bills past due date
- **Due Soon**: Amber banner for bills due within 7 days
- Shows count and visual priority
- Only appears if there are alerts to show

### Transactions Tab (`src/Transactions.jsx`)

#### Filters & Controls
```
[Month ▼]  [Category ▼]  [Clear]         {filtered.length} transactions • Income: AED • Expenses: AED • Net: AED
```
- **Month Selector**: Dropdown of all months with transactions
- **Category Filter**: All categories or pick one
- **Clear Button**: Reset both filters
- **Stats Line**: Shows count + Income + Expenses + Net Savings

#### Summary Cards (3 columns)
- **Income**: Total income for selected month
- **Expenses**: Total expenses for selected month
- **Net Savings**: Income - Expenses (green if positive, red if negative)

#### Transaction Table
- **Columns**: Date | Type | Description | Category | Amount
- **Type Badges**: 
  - Emerald: Income ✓
  - Red: Expense ✗
  - Gray: Transfer ↔
- **Amount Color**: Green for income, red for expenses
- **Sorting**: By date (newest first)
- **Empty State**: "No transactions found" message

### Header & Navigation

**Left Side**
- 💰 Logo + "Finance Command Center" title

**Right Side**
```
[AED ▼] [➕ Add] [↔ Reconcile] [🔄 Refresh] [🌙]
```
- **Currency Selector**: AED, USD, EUR, PEN (with rates in code)
- **Add Button**: Create transaction (placeholder)
- **Reconcile Button**: Bank reconciliation (placeholder)
- **Refresh Button**: Manual data reload from Firestore
- **Dark Mode Toggle**: Dark/light theme (placeholder)

**Navigation Tabs** (below header)
- 📊 Dashboard (active: emerald border)
- 📋 Transactions

---

## 🏗️ Architecture

### Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 18.2.0 | UI component framework |
| **Build** | Vite 5.0.8 | Fast dev server & production bundler |
| **Styling** | Tailwind CSS 3.4.1 | Utility-first CSS framework |
| **Charts** | Recharts 2.10.3 | React-based composable charts |
| **Utils** | date-fns 2.30.0 | Date manipulation utilities |
| **Database** | Firebase Firestore | NoSQL, real-time document store |
| **Hosting** | Vercel | Serverless deployment platform |
| **VCS** | GitHub | Source control & version history |

### Data Flow

```
User Opens App
    ↓
App.jsx loads and initializes Firestore listeners
    ↓
onSnapshot(collection) fires for:
  - accounts collection → setAccounts()
  - transactions collection → setTransactions()
  - budgets collection → setBudgets()
  - recurringBills collection → setRecurringBills()
    ↓
State updated → Components re-render with live data
    ↓
Charts, tables, cards display updated values
    ↓
Any Firestore changes → onSnapshot fires again → UI updates instantly
```

### Critical Performance Detail

**Real-time Listeners (onSnapshot) vs One-time Queries (getDocs)**

```javascript
// ❌ SLOW: One-time queries (old version)
const accounts = await getDocs(collection(db, 'accounts')); // Wait 5-10 seconds
const transactions = await getDocs(collection(db, 'transactions')); // Wait 5-10 seconds
const budgets = await getDocs(collection(db, 'budgets')); // Wait 5-10 seconds
// Total: 15-30 seconds of waiting for each page load

// ✅ FAST: Real-time listeners (new version)
onSnapshot(collection(db, 'accounts'), (snapshot) => {
  setAccounts(snapshot.docs.map(doc => ({id: doc.id, ...doc.data()})));
}); // Instant load + auto-updates
onSnapshot(collection(db, 'transactions'), (snapshot) => {
  setTransactions(snapshot.docs.map(doc => ({id: doc.id, ...doc.data()})));
}); // Instant load + auto-updates
// Total: <1 second, and updates automatically when data changes
```

**Why it's faster:**
- onSnapshot caches data locally
- Firestore has data indexed and ready
- No waiting for full query execution
- Updates push to client instead of client polling

---

## 🗄️ Data Model

### Firestore Collections & Schemas

#### 1. **accounts** (24 documents)
All financial accounts: bank accounts, investment accounts, credit cards, mortgages.

```javascript
{
  id: "acc_ADIB_salary",
  name: "ADIB Salary",
  kind: "asset",                           // asset | liability
  type: "checking",
  currency: "AED",
  currentBalance: 450000,
  netWorthBucket: "capital",               // capital | usable | future | debt
  icon: "🏦",
  isActive: true,
  lastUpdated: "2026-06-15T14:30:00Z"
}
```

**Net Worth Buckets** (how they're classified):
- **capital**: Immediately accessible (checking, savings accounts)
- **usable**: Accessible within days (stocks, bonds, investment accounts)
- **future**: Long-term, locked funds (mortgages with years remaining, retirement accounts)
- **debt**: Money owed (credit cards, short-term loans)

Net Worth Calculation:
```
Net Worth = SUM(capital accounts) + SUM(usable accounts) + SUM(future assets - future liabilities) - SUM(debt)
```

#### 2. **transactions** (370+ documents)
Individual income and expense records.

```javascript
{
  id: "tx_2026_06_15_carrefour",
  date: "2026-06-15",
  type: "expense",                         // expense | income | transfer
  description: "Carrefour Groceries",
  category: "Food & Groceries",            // Must be one of 9 categories
  amount: 450,
  currency: "AED",
  accountId: "acc_ADIB_salary",
  notes: "Weekly groceries run",
  tags: ["food", "recurring"],
  isReconciled: false,
  keywordRuleApplied: "carrefour"
}
```

**Valid Categories** (9 total):
1. Investments
2. Housing
3. Subs, Sports & Health
4. Food & Groceries
5. Car
6. Going Out
7. Purchases
8. Travel
9. Others

**Transaction Types:**
- `expense`: Money out
- `income`: Money in
- `transfer`: Money between own accounts (doesn't count toward spending)

#### 3. **budgets** (15 documents)
Monthly category budgets.

```javascript
{
  id: "budget_2026_06_food",
  year: 2026,
  month: 6,
  category: "Food & Groceries",
  monthlyLimit: 2000,
  notes: "Groceries + dining out combined",
  isActive: true,
  lastModified: "2026-06-01T00:00:00Z"
}
```

**One budget per category per month.** If you change a budget, create a new document for that category/month.

#### 4. **recurringBills** (14 documents)
Scheduled bills and subscriptions.

```javascript
{
  id: "bill_rent_apartment",
  name: "Apartment Rent",
  description: "Monthly rent payment to landlord",
  amount: 3500,
  currency: "AED",
  dueDate: "2026-07-05",                   // Next due date
  frequency: "monthly",                    // monthly | quarterly | annual
  category: "Housing",
  isPaid: false,                           // Paid status for this cycle
  notes: "Fixed amount, automatically drafted",
  accountId: "acc_ADIB_salary"
}
```

**Used for:**
- Alert banner (overdue in red, due soon in amber)
- Bill tracking dashboard (future feature)
- Cash flow forecasting (future feature)

#### 5. **investments** (31 documents)
Investment holdings.

```javascript
{
  id: "inv_MSFT_2024",
  symbol: "MSFT",
  name: "Microsoft Corporation",
  quantity: 50,
  purchasePrice: 300,
  currentPrice: 420,
  purchaseDate: "2024-01-15",
  currency: "USD",
  type: "stock",                           // stock | bond | etf | crypto | real_estate
  exchange: "NASDAQ",
  accountId: "acc_interactive_brokers",
  notes: "Long-term tech holding",
  gainLoss: (420 - 300) * 50,              // Current gain/loss
  gainLossPercent: 40                      // Percentage gain/loss
}
```

**Investment Types:**
- `stock`: Individual stocks
- `bond`: Bonds
- `etf`: Exchange-traded funds
- `crypto`: Cryptocurrency holdings
- `real_estate`: Real estate holdings

**Data loaded but UI not yet implemented.**

#### 6. **keywordRules** (118 documents)
Auto-categorization rules based on description keywords.

```javascript
{
  id: "rule_carrefour",
  keyword: "carrefour",
  category: "Food & Groceries",
  priority: 1,                             // Higher = matched first
  isActive: true,
  appliedCount: 45,                        // How many txs matched this rule
  notes: "Carrefour supermarket chain",
  createdDate: "2024-06-01T00:00:00Z"
}
```

**Used for:**
- Auto-assigning categories to imported transactions
- Future transaction import feature

#### 7. **snapshots** (18 documents)
Monthly financial snapshots for historical tracking.

```javascript
{
  id: "snapshot_2026_06",
  month: "2026-06",
  timestamp: "2026-06-01T00:00:00Z",
  net_worth: 3200000,
  capital: 1200000,
  assets_usable: 1500000,
  assets_future: 800000,
  debt: 300000,
  total_income: 125000,
  total_expenses: 95000,
  total_savings: 30000
}
```

**Auto-generated** by setup script from accounts + transactions data for each month.

**Used for:**
- Historical tracking
- Wealth Trajectory chart
- Performance analysis (future feature)

---

## 📁 Project Structure

```
finance_dashboard_v2/
│
├── src/
│   ├── App.jsx                    # Main app, header, navigation, data loading
│   ├── Dashboard.jsx              # Dashboard tab (all cards, charts, tables)
│   ├── Transactions.jsx           # Transactions tab (filters, summary, table)
│   ├── firebase-config.js         # Firebase initialization & db instance
│   ├── utils.js                   # All utility functions (format, calculate, convert)
│   ├── index.css                  # Global styles + Tailwind @directives
│   ├── main.jsx                   # React entry point (mounts App to #root)
│   └── App.css                    # (if needed for component-specific styles)
│
├── public/
│   ├── index.html                 # HTML entry point
│   ├── favicon.ico
│   └── (static assets)
│
├── scripts/
│   ├── setup-firebase.js          # One-time script to populate Firestore
│   │   └── Reads data/correct-data-v2.json and uploads to 7 collections
│   ├── export-sheets.mjs          # (legacy) Export from Google Sheets API
│   └── export_from_sheets.py      # (legacy) Python version of above
│
├── data/
│   └── correct-data-v2.json       # Source data for setup-firebase.js
│       ├── accounts: [{...}, ...]
│       ├── transactions: [{...}, ...]
│       ├── budgets: [{...}, ...]
│       ├── recurringBills: [{...}, ...]
│       ├── investments: [{...}, ...]
│       └── keywordRules: [{...}, ...]
│
├── dist/                           # Production build output (generated by `npm run build`)
│   ├── index.html
│   ├── assets/
│   │   ├── index-HASH.js          # Bundled & minified JavaScript
│   │   └── index-HASH.css         # Bundled & minified CSS
│   └── (other static assets)
│
├── .env.example                    # Template for environment variables
├── .env.local                      # Local Firebase credentials (NOT in git)
├── .gitignore                      # Ignore node_modules, .env.local, dist, etc.
├── vite.config.js                 # Vite build configuration
├── tailwind.config.js             # Tailwind CSS configuration
├── postcss.config.js              # PostCSS configuration (for Tailwind)
├── vercel.json                    # Vercel deployment config (env vars defined here)
├── package.json                   # Dependencies and npm scripts
├── package-lock.json              # Locked dependency versions
├── README.md                       # This file
└── CLAUDE_NOTES.md                # (optional) Additional development notes
```

### Key Files Explained

**`src/App.jsx`** (350+ lines)
- Loads all 4 Firestore collections with onSnapshot listeners
- Manages activeTab state (dashboard/transactions)
- Renders header with currency selector, action buttons, and navigation tabs
- Renders Dashboard or Transactions component based on activeTab
- Shows loading spinner while data loads
- Shows error message if Firestore connection fails

**`src/Dashboard.jsx`** (350+ lines)
- All KPI calculations and UI rendering
- 8 main sections: KPI cards, alerts, account breakdowns, charts, spending detail, budget table, recent transactions
- Uses recharts for Monthly Flow and Wealth Trajectory charts
- Memoizes chart data to prevent unnecessary recalculations
- Responsive grid layouts (mobile: 1 col, tablet: 2 col, desktop: 3-4 col)

**`src/Transactions.jsx`** (150+ lines)
- Month and category filters with dropdown selects
- Calculates filtered transaction list and summary stats
- Renders income/expenses/savings summary cards
- Shows transaction table with type badges and color-coded amounts

**`src/utils.js`** (130+ lines)
- Currency conversion: `toAED()`, `formatAmount()`, `formatFull()`, `formatShort()`
- Calculations: `calculateNetWorth()`, `calculateMonthlySpending()`, `calculateSpendingByCategory()`
- Formatting: `formatDate()`, `getCategoryEmoji()`, `getCategoryColor()`
- Time: `getDayProgress()` for day counter in KPI cards

**`src/firebase-config.js`** (15 lines)
```javascript
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
```

**`scripts/setup-firebase.js`** (190 lines)
- Reads `data/correct-data-v2.json`
- Clears existing Firestore collections
- Uploads accounts, transactions, budgets, recurringBills, investments, keywordRules
- **Auto-generates monthly snapshots** from accounts + transactions data
- Must be run with serviceAccountKey.json in project root

**`vercel.json`** (Deployment config)
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "env": {
    "VITE_FIREBASE_API_KEY": "AIzaSy...",
    "VITE_FIREBASE_AUTH_DOMAIN": "finance-center-b9cf9.firebaseapp.com",
    ...
  }
}
```
**Critical:** All 6 Firebase env vars must be in vercel.json or Vercel dashboard for app to work.

---

## 🚀 Setup Instructions

### Prerequisites
- **Node.js** 18+ (check with `node --version`)
- **npm** 9+ (comes with Node)
- **Git** (clone repo)
- **Firebase project** (create at https://console.firebase.google.com)
- **GitHub account** (push code)
- **Vercel account** (deploy)

### Step 1: Clone Repository

```bash
git clone https://github.com/jhuertas85/finance-dashboard-v2.git
cd finance_dashboard_v2
```

### Step 2: Install Dependencies

```bash
npm install
# Creates node_modules/ directory with all packages
# Takes 2-3 minutes on first run
```

### Step 3: Configure Firebase Locally

**Get credentials from Firebase Console:**

1. Go to https://console.firebase.google.com
2. Select project: **finance-center-b9cf9**
3. Click ⚙️ (Settings) > Project Settings
4. Scroll to "Your apps" section
5. Click on the Web app (already created)
6. Copy these 6 values:

   ```
   apiKey: AIzaSy...
   authDomain: finance-center-b9cf9.firebaseapp.com
   projectId: finance-center-b9cf9
   storageBucket: finance-center-b9cf9.firebasestorage.app
   messagingSenderId: 155629624820
   appId: 1:155629624820:web:a05e...
   ```

**Create `.env.local` file:**

```bash
cp .env.example .env.local
```

Edit `.env.local` and paste your credentials:

```
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=finance-center-b9cf9.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=finance-center-b9cf9
VITE_FIREBASE_STORAGE_BUCKET=finance-center-b9cf9.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=155629624820
VITE_FIREBASE_APP_ID=1:155629624820:web:a05e...
```

⚠️ **NEVER commit `.env.local` to Git** (it's in `.gitignore`)

### Step 4: Populate Firestore (First Time Only)

If Firestore is empty, run the setup script:

```bash
# First, get serviceAccountKey.json from Firebase Console
# Project Settings > Service Accounts > Generate New Private Key
# Save to project root as serviceAccountKey.json

npm run setup-firebase
# Output should show:
# ✓ Uploaded 24 accounts
# ✓ Uploaded 370 transactions
# ✓ Uploaded 15 budgets
# ✓ Uploaded 14 recurring bills
# ✓ Uploaded 31 investments
# ✓ Uploaded 118 keyword rules
# ✓ Generated and uploaded 18 monthly snapshots
```

⚠️ **NEVER commit `serviceAccountKey.json` to Git** (it's in `.gitignore`)

### Step 5: Run Development Server

```bash
npm run dev
# Output:
# ➜ Local:   http://localhost:3002/
# Ready in 259ms
```

Open http://localhost:3002 in your browser.

**Features:**
- Hot module reload (edit a file, browser refreshes instantly)
- Dev server usually ready in <300ms
- Firestore connection shows data instantly

### Step 6: Build for Production

```bash
npm run build
# Output:
# ✓ 844 modules transformed
# dist/index.html 0.73 kB
# dist/assets/index-HASH.css 12.79 kB
# dist/assets/index-HASH.js 874.10 kB
# ✓ built in 4.72s
```

Creates optimized `dist/` folder ready for deployment.

---

## 🔧 Development

### Common Tasks

**Start Development Server**
```bash
npm run dev
# Vite starts on http://localhost:3002
# Press 'q' to quit
```

**Build for Production**
```bash
npm run build
# Outputs to dist/ folder
# ~875 kB minified JavaScript + CSS
```

**Update Data in Firestore**
```bash
# 1. Edit data/correct-data-v2.json
# 2. Run setup script (clears all data first!)
npm run setup-firebase
# 3. App automatically picks up changes (real-time listeners)
```

**Debug Mode**
```bash
# Open Browser DevTools: F12 or Right-click > Inspect
# Console tab shows:
# - "Accounts loaded: 24"
# - "Transactions loaded: 370"
# - Any Firestore errors
# Network tab shows GraphQL queries to Firestore
```

### Code Organization

**Adding a New Feature**

1. **Create component** (e.g., `src/NewFeature.jsx`)
   ```javascript
   export default function NewFeature({ accounts, transactions }) {
     return <div>Your component here</div>;
   }
   ```

2. **Import in App.jsx** and add navigation tab if needed
   ```javascript
   import NewFeature from './NewFeature.jsx';
   
   // In TABS array:
   { id: 'newfeature', label: 'New Feature', icon: '🎯' },
   
   // In render section:
   {activeTab === 'newfeature' && <NewFeature accounts={accounts} transactions={transactions} />}
   ```

3. **Use utilities for calculations**
   ```javascript
   import { toAED, calculateNetWorth, formatFull } from './utils.js';
   
   const netWorth = calculateNetWorth(accounts);
   const aedAmount = toAED(100, 'USD'); // = 367
   const formatted = formatFull(aedAmount); // = "AED 367"
   ```

4. **Test in browser**
   ```bash
   npm run dev
   # Edit code, browser refreshes instantly
   ```

5. **Push to GitHub**
   ```bash
   git add .
   git commit -m "feat: Add new feature description"
   git push origin master
   # Vercel auto-deploys from master branch
   ```

### Debugging Tips

| Issue | Solution |
|-------|----------|
| App shows "Loading..." forever | Check `.env.local` has correct Firebase credentials |
| Data shows as 0 or empty | Verify Firestore has data (Firebase Console > Firestore) |
| Buttons don't work | Check browser console (F12) for errors |
| Charts don't render | Verify transactions have valid dates and amounts |
| Deploy fails on Vercel | Check Vercel dashboard > deployments > build logs |
| Local changes don't appear | Refresh browser (F5) or check for syntax errors (npm run build) |

---

## 🌐 Deployment

### Vercel Configuration

**`vercel.json`** contains:
- Build command: `npm run build`
- Output directory: `dist/`
- Environment variables: All 6 Firebase credentials

**Current Status:**
- URL: https://finance-dashboard-v2.vercel.app
- Auto-deploys on every push to `master` branch
- Deployed in ~60-90 seconds

### First-Time Vercel Setup

1. **Push to GitHub** (code must be on GitHub)
   ```bash
   git push origin master
   ```

2. **Go to https://vercel.com/new**

3. **Import project**
   - Select "GitHub" 
   - Find `finance-dashboard-v2` repository
   - Click "Import"

4. **Configure environment**
   - Vercel auto-detects Vite config
   - Add environment variables (Project Settings > Environment Variables)
   - Paste all 6 Firebase values from `.env.local`

5. **Deploy**
   - Click "Deploy"
   - Vercel shows build progress
   - After ~2 minutes, deployed to https://finance-dashboard-v2.vercel.app

### Auto-Deployment Workflow

```
1. Make changes locally
2. Test with npm run dev
3. Commit: git commit -m "..."
4. Push: git push origin master
   ↓
5. GitHub receives push
   ↓
6. Vercel webhook triggered
   ↓
7. Vercel runs npm run build
   ↓
8. Vercel deploys dist/ to CDN
   ↓
9. Live at https://finance-dashboard-v2.vercel.app (updated)
```

Usually takes 1-3 minutes from push to live.

### Rollback Previous Version

In Vercel Dashboard:
1. Go to "Deployments" tab
2. Find previous successful deployment
3. Click "..." > "Promote to Production"
4. App rolls back to that version instantly

---

## 📊 Component Tree

```
App.jsx (Main Container)
├── Header
│   ├── Title (💰 Finance Command Center)
│   ├── Currency Selector [AED ▼]
│   ├── Action Buttons [Add] [Reconcile] [Refresh] [🌙]
│   └── Navigation Tabs
│       ├── Dashboard (📊)
│       └── Transactions (📋)
│
├── Dashboard.jsx (when activeTab === 'dashboard')
│   ├── Alert Banner (if bills overdue/due)
│   ├── KPI Cards Section (3 cards)
│   │   ├── Net Worth Card
│   │   ├── Spent This Month Card
│   │   └── Annual Savings Card
│   ├── Account Breakdown (5 cards grid)
│   │   ├── Capital
│   │   ├── Assets Usable
│   │   ├── Assets Future
│   │   ├── Outstanding Contributions
│   │   └── Credit Cards
│   ├── Monthly Flow Chart
│   ├── Wealth Trajectory Chart
│   ├── Spending Detail (category breakdown)
│   ├── Budget Overview Table
│   └── Recent Transactions Table
│
└── Transactions.jsx (when activeTab === 'transactions')
    ├── Filters Section
    │   ├── Month Selector
    │   ├── Category Filter
    │   ├── Clear Button
    │   └── Stats Line
    ├── Summary Cards (3 cards)
    │   ├── Income
    │   ├── Expenses
    │   └── Net Savings
    └── Transactions Table
        ├── Column: Date
        ├── Column: Type (badge)
        ├── Column: Description
        ├── Column: Category
        └── Column: Amount
```

---

## 🔐 Security & Environment

### Never Commit These Files
- `.env.local` - Contains Firebase API keys (in .gitignore)
- `serviceAccountKey.json` - Server credentials (in .gitignore)
- `node_modules/` - Dependencies (in .gitignore)

### Current Firestore Rules
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

⚠️ **TODO**: Anyone with auth can access all data. Should implement:
- User-based access (only your own data)
- Role-based access (admin, viewer, editor)
- Data encryption

### Environment Variables

**Required in `.env.local` for local development:**
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

**Required in Vercel Environment Variables for deployment:**
- Same 6 variables as above (must match `.env.local` values)

---

## 🎨 Design System

### Color Palette
```
Primary:        Emerald (#10b981) - buttons, positive values, accents
Background:     Black (#000000)   - main page background
Cards:          Neutral-950 (#0a0a0a) - card/component backgrounds
Borders:        Neutral-800 (#262626) - subtle dividers
Text Primary:   Gray-200 (#e5e7eb) - main body text
Text Secondary: Gray-500 (#6b7280) - labels, descriptions
Status Good:    Green (#10b981)    - success, positive values
Status Warning: Amber (#f59e0b)    - caution, 50-85% spent
Status Bad:     Red (#ef4444)      - error, >85% spent, overdue
```

### Typography
```
Headings:       Bold, UPPERCASE for section titles
Body:           Regular, 13px base size
Data/Numbers:   Monospace font for alignment and scanning
```

### Spacing
```
Cards:          Padding 24px (p-6)
Sections:       Gap 24px (gap-6)
Items:          Gap 8px (gap-1 to gap-3)
Mobile:         20px padding (px-4 sm:px-6)
```

### Responsive Breakpoints (Tailwind)
```
sm (640px):     Tablets in portrait
md (768px):     Tablets in landscape
lg (1024px):    Small laptops
xl (1280px):    Desktops
```

---

## 📈 Future Features

### High Priority (Next Sprint)
- [ ] **User Authentication** - Sign up/login with Firebase Auth
- [ ] **Add Transaction UI** - Modal form to create transactions
- [ ] **Edit Budgets** - In-app form to modify monthly budgets
- [ ] **Reconcile Button** - Mark transactions as reconciled
- [ ] **Account Management** - Add/edit/delete accounts
- [ ] **Investments Tab** - Table showing all investment holdings with gains/losses
- [ ] **Export Reports** - Download statements as CSV/PDF

### Medium Priority
- [ ] **Dark Mode Toggle** - Actually implement theme switching (button exists)
- [ ] **Currency Conversion** - Display amounts in selected currency (dropdown exists)
- [ ] **Advanced Filters** - Date range, amount range, multiple categories
- [ ] **Bill Management** - UI to add/edit/pay recurring bills
- [ ] **Category Rules** - Manage auto-categorization keyword rules
- [ ] **Custom Dashboard** - Drag-and-drop to rearrange cards

### Lower Priority
- [ ] **Mobile App** - React Native version for iOS/Android
- [ ] **Browser Notifications** - Alert for bills due/overdue
- [ ] **SMS/Email Alerts** - SMS for bill reminders
- [ ] **Automated Imports** - Auto-import from bank CSVs
- [ ] **Tax Reports** - Generate tax summaries
- [ ] **Goals Tracking** - Set and track financial goals
- [ ] **Collaborative** - Share budgets, split expenses with others
- [ ] **Analytics** - Advanced spending trends, forecasting

---

## 📞 Support & Troubleshooting

### Common Issues

**1. App stuck on "Loading..."**
```
Likely cause: Firestore connection failed or .env.local incorrect
Solution: 
  - Check .env.local has all 6 Firebase values
  - Open Firefox/Chrome DevTools (F12)
  - Check Console tab for error messages
  - Verify Firestore has data (Firebase Console > Firestore)
```

**2. Data shows as 0 or empty**
```
Likely cause: Firestore listeners loaded but have no data
Solution:
  - Check Firebase Console > Firestore > Collections
  - If empty, run: npm run setup-firebase
  - Verify serviceAccountKey.json is in project root
```

**3. npm install fails**
```
Solution:
  - Delete node_modules/ and package-lock.json
  - npm cache clean --force
  - npm install again
```

**4. Vite port 3000/3001/3002 already in use**
```
Solution:
  - npm run dev tries next port automatically
  - Or kill process: lsof -ti :3002 | xargs kill -9
```

**5. Build fails with "cannot find module"**
```
Solution:
  - Check import paths (case-sensitive on Linux/Mac)
  - Run npm install again
  - Delete node_modules and reinstall
```

**6. Vercel deployment shows blank page**
```
Likely cause: Environment variables not set in Vercel
Solution:
  - Vercel Dashboard > Project Settings > Environment Variables
  - Add all 6 Firebase credentials
  - Redeploy (click "Redeploy" button)
```

### Getting Help

1. **Check browser console** (F12) for error messages
2. **Read the error message carefully** - usually tells you the problem
3. **Search GitHub issues** - someone may have reported the same issue
4. **Check Firestore Console** - verify data is there
5. **Check Vercel deployment logs** - shows build/runtime errors

---

## 📚 Resources

- [React Documentation](https://react.dev) - Component patterns, hooks
- [Vite Guide](https://vitejs.dev) - Build tool documentation
- [Tailwind CSS](https://tailwindcss.com) - Utility classes reference
- [Recharts](https://recharts.org) - Chart components API
- [Firebase Firestore](https://firebase.google.com/docs/firestore) - Database docs
- [Vercel Deploy Docs](https://vercel.com/docs) - Hosting platform

---

## 📝 File Size Reference

| Item | Size | Notes |
|------|------|-------|
| source code | ~50 KB | src/ directory |
| dependencies | ~400 MB | node_modules/ (don't commit) |
| production build | ~875 KB | dist/ with all assets |
| gzipped bundle | ~235 KB | What browsers actually download |

---

## 🔄 Git Workflow

### Typical Developer Flow
```bash
# Start work
git pull origin master                    # Get latest
npm install                               # Install deps if package.json changed
npm run dev                               # Start dev server

# Make changes
# (edit files, test in browser)

# Commit work
git add .                                 # Stage all changes
git commit -m "feat: description"         # Create commit
git push origin master                    # Push to GitHub
# → Vercel auto-deploys in 1-3 minutes

# Done!
```

### Commit Message Format
- **feat**: New feature (`feat: Add dark mode toggle`)
- **fix**: Bug fix (`fix: Correct spending calculation`)
- **docs**: Documentation (`docs: Update README`)
- **refactor**: Code improvement (`refactor: Extract chart logic`)
- **style**: Formatting (`style: Add Tailwind classes`)

---

## 📞 Project Info

**Repository:**  https://github.com/jhuertas85/finance-dashboard-v2  
**Deployed URL:** https://finance-dashboard-v2.vercel.app  
**Firebase Project:** finance-center-b9cf9  
**Vercel Project:** finance-dashboard-v2  

**Owner:** Juanca Huertas (jc.huertas85@gmail.com)  
**Created:** June 2026  
**Last Updated:** June 15, 2026  
**Status:** ✅ Fully functional, open for feature development

---

## 📄 License

This project is private/proprietary. Do not distribute without permission.

---

**Ready to continue development?** Follow the [Setup Instructions](#setup-instructions) section to get started! 🚀
