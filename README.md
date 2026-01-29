# Restaurant Intelligence Platform

A comprehensive restaurant analytics and decision-support system that transforms POS transaction data into profit-aware operational decisions.

## Features

- **Decision Engine**: Prioritized recommendations with impact analysis
- **Menu Engineering**: Stars/Plowhorses/Puzzles/Dogs classification with margin analysis
- **Capacity Optimization**: RevPASH analysis and bottleneck identification
- **Channel Performance**: Multi-channel profitability and LTV:CAC analysis
- **Server Performance**: Normalized effectiveness scores with fatigue tracking
- **Scenario Simulator**: What-if modeling for operational changes
- **Multi-Currency Support**: Base currency in INR, convertible to USD, EUR, GBP, AUD, CAD, SGD, AED
- **Theft Detection**: Void patterns and inventory variance analysis
- **Demand Elasticity**: Price sensitivity calculation for menu items
- **Supply Forecasting**: ARIMA-style inventory predictions
- **Aggregator Reconciliation**: Swiggy/Zomato settlement matching

---

## 🚀 Quick Start

### Prerequisites

Make sure you have these installed on your machine:

- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **Python** (v3.9 or higher) - [Download](https://python.org/)
- **pnpm** (recommended) or npm - Install pnpm: `npm install -g pnpm`

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/ultramagnus23/RestaurantApp.git
cd RestaurantApp

# 2. Install Node.js dependencies
pnpm install
# OR using npm:
npm install

# 3. Generate Prisma client and set up database
pnpm prisma:generate
pnpm prisma:migrate
# OR using npm:
npm run prisma:generate
npm run prisma:migrate

# 4. (Optional) Install Python ML service dependencies
cd ml_service
pip install -r requirements.txt
cd ..
```

### Running the Application

You need to run **two services** (and optionally a third for ML features):

#### 1. Run the Next.js Frontend (Main Web App)

```bash
# In the root directory
npx next dev
```

This starts the web app at **http://localhost:3000**

#### 2. Run the Express Backend Server

```bash
# In the root directory
pnpm dev
# OR using npm:
npm run dev
```

This starts the API server at **http://localhost:3001**

#### 3. (Optional) Run the Python ML Service

```bash
# In the ml_service directory
cd ml_service
python main.py
# OR using uvicorn:
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

This starts the ML service at **http://localhost:8000**

### All-in-One Commands (Run in separate terminals)

```bash
# Terminal 1: Frontend
npx next dev

# Terminal 2: Backend API
npm run dev

# Terminal 3: ML Service (optional)
cd ml_service && python main.py
```

---

## 📦 Project Structure

```
RestaurantApp/
├── app/                    # Next.js pages and API routes
│   ├── api/               # API endpoints
│   │   ├── analytics/     # Analytics APIs (boston-matrix, theft-detection, etc.)
│   │   ├── predictions/   # Supply forecast, scenario simulator
│   │   ├── aggregators/   # Swiggy/Zomato reconciliation
│   │   ├── alerts/        # Alert management
│   │   └── reports/       # Daily summary, GST export
│   └── page.tsx           # Main dashboard
├── components/            # React components
├── lib/                   # Utilities and API client
├── prisma/                # Database schema and migrations
├── server/                # Express backend server
│   └── src/
│       ├── index.ts       # Server entry point
│       └── engines/       # Analytics engines
├── ml_service/            # Python ML service
│   ├── main.py            # FastAPI application
│   └── requirements.txt   # Python dependencies
└── package.json           # Node.js dependencies
```

---

## 🛠️ Available Scripts

| Command | Description |
|---------|-------------|
| `npx next dev` | Start Next.js frontend (port 3000) |
| `npm run dev` | Start Express backend server (port 3001) |
| `npm run build` | Build for production |
| `npm run prisma:generate` | Generate Prisma client |
| `npm run prisma:migrate` | Run database migrations |
| `npm run prisma:studio` | Open Prisma Studio (database GUI) |

---

## 🗄️ Database Setup

The application uses SQLite by default (file: `prisma/dev.db`).

To reset the database:

```bash
# Delete existing database
rm prisma/dev.db

# Re-run migrations
npm run prisma:migrate

# (Optional) View database in Prisma Studio
npm run prisma:studio
```

---

## 📊 Uploading Data

1. Open **http://localhost:3000** in your browser
2. Use the CSV upload feature to import your POS data
3. Required CSV columns: `posOrderId`, `order_time`, `channel`, `menu_item`, `category`, `quantity`, `price`

---

## 🔧 Configuration

## API Integration

### Connecting Your POS System

Edit `app/api/orders/route.ts` and replace the mock data with your actual POS API:

```typescript
// Example: Square POS Integration
import { SquareClient } from '@square/api-client'

const client = new SquareClient({
  accessToken: process.env.SQUARE_API_KEY
})

const orders = await client.orders.list({
  locationIds: [process.env.LOCATION_ID],
  // ... other params
})
```

### Supported POS Systems

This platform can integrate with any POS system that provides:
- Order transaction data (timestamp, items, amounts, channel)
- Menu item information (name, price, cost, prep time)
- Server/staff performance data
- Customer information (optional, for repeat behavior tracking)

Popular integrations: Square, Toast, Lightspeed, Clover, TouchBistro, Revel, Upserve

## Data Models

All data types are defined in `lib/types.ts`:
- `Order`: Transaction records from POS
- `MenuItem`: Menu items with costs and pricing
- `Server`: Staff performance metrics
- `ChannelMetrics`: Sales channel profitability
- `Decision`: AI-generated recommendations
- `Scenario`: What-if simulation results

## Architecture

- **Frontend**: Next.js 16 with React 19, Tailwind CSS, shadcn/ui
- **State Management**: Zustand for global state (currency, decisions)
- **Data Fetching**: API routes with client-side caching
- **Currency**: Base INR with real-time conversion
- **Charts**: Recharts for data visualization

## Customization

### Adding New Currencies

Edit `lib/currency.ts`:

```typescript
export const CURRENCY_RATES: Record<Currency, CurrencyRate> = {
  // Add your currency
  JPY: { code: "JPY", symbol: "¥", rate: 1.8, name: "Japanese Yen" },
}
```

### Adding New Metrics

1. Define types in `lib/types.ts`
2. Create API route in `app/api/analytics/[metric]/route.ts`
3. Add to `lib/api-client.ts`
4. Create component in `components/[metric].tsx`
5. Add tab to `app/page.tsx`

## Environment Variables

Create these in your Vercel project settings:

```
# POS API
POS_API_KEY=your_pos_api_key
POS_LOCATION_ID=your_location_id

# Database (optional)
DATABASE_URL=your_database_url

# Other integrations
SQUARE_API_KEY=...
TOAST_API_KEY=...
```

## Logic & Calculations

### Menu Engineering
- **Stars**: Popularity > 50 AND Margin > ₹680
- **Plowhorses**: Popularity > 50 AND Margin < ₹680
- **Puzzles**: Popularity < 50 AND Margin > ₹680
- **Dogs**: Popularity < 50 AND Margin < ₹680

### RevPASH (Revenue Per Available Seat Hour)
- Formula: `Total Revenue / (Total Seats × Hours Open)`

### Server Effectiveness
- Normalized for shift difficulty and fatigue
- Formula: `(Raw Performance / Shift Difficulty) × Fatigue Adjustment`

### Channel Profitability
- Net Margin = Gross Margin - Platform Fees - CAC
- LTV:CAC Ratio = Customer Lifetime Value / Customer Acquisition Cost

## Support

For issues or questions, refer to the inline code comments marked with `// TODO:` for integration points.
