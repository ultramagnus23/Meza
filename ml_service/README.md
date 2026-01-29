# Restaurant Intelligence ML Service

FastAPI-based ML service for restaurant analytics.

## Features

- **Demand Forecasting**: ARIMA-style forecasting for inventory prediction
- **Theft Detection**: Anomaly detection using statistical analysis
- **Price Elasticity**: Calculate price sensitivity for menu items

## Installation

```bash
cd ml_service
pip install -r requirements.txt
```

## Running the Service

```bash
python main.py
```

Or with uvicorn:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

## API Endpoints

### Health Check
```
GET /
```

### Demand Forecast
```
POST /forecast/demand
{
  "item_id": "item-123",
  "historical_data": [
    {"date": "2024-01-01", "quantity": 10},
    {"date": "2024-01-02", "quantity": 12}
  ],
  "days": 7
}
```

### Theft Detection
```
POST /detect/theft
{
  "orders": [
    {"server_id": "server-1", "is_void": false, "total": 500},
    {"server_id": "server-1", "is_void": true, "total": 200, "void_amount": 200}
  ]
}
```

### Price Elasticity
```
POST /calculate/elasticity
{
  "price_history": [
    {"date": "2024-01-01", "price": 100, "quantity": 50},
    {"date": "2024-01-15", "price": 110, "quantity": 45}
  ]
}
```

## Integration with Next.js

The ML service can be called from Next.js API routes:

```typescript
const response = await fetch('http://localhost:8000/forecast/demand', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    item_id: 'item-123',
    historical_data: data,
    days: 7
  })
});
```
