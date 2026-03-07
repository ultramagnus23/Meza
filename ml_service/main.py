"""
Restaurant Intelligence ML Service
FastAPI service for demand forecasting, theft detection, and elasticity calculation
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import numpy as np
from datetime import datetime, timedelta

app = FastAPI(
    title="Restaurant Intelligence ML Service",
    description="ML endpoints for demand forecasting, theft detection, and elasticity calculation",
    version="1.0.0"
)
import os

# Enable CORS - Use environment variable for allowed origins in production
# Default to localhost for development
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:3001").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============= Models =============

class HistoricalData(BaseModel):
    date: str
    quantity: int


class DemandForecastRequest(BaseModel):
    item_id: str
    historical_data: List[HistoricalData]
    days: int = 7


class DemandForecastResponse(BaseModel):
    predictions: List[dict]
    confidence: float
    trend: str
    seasonality_detected: bool


class OrderData(BaseModel):
    server_id: str
    is_void: bool
    total: float
    void_amount: Optional[float] = 0


class TheftDetectionRequest(BaseModel):
    orders: List[OrderData]


class TheftDetectionResponse(BaseModel):
    flagged: List[dict]
    summary: dict


class PriceHistoryData(BaseModel):
    date: str
    price: float
    quantity: int


class ElasticityRequest(BaseModel):
    price_history: List[PriceHistoryData]


class ElasticityResponse(BaseModel):
    elasticity: float
    elasticity_type: str
    recommendation: str
    confidence: float


# ============= Endpoints =============

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "Restaurant Intelligence ML Service",
        "version": "1.0.0",
        "endpoints": [
            "/forecast/demand",
            "/detect/theft",
            "/calculate/elasticity"
        ]
    }


@app.post("/forecast/demand", response_model=DemandForecastResponse)
async def forecast_demand(request: DemandForecastRequest):
    """
    ARIMA-style demand forecast for inventory prediction.
    Uses simple moving average and trend analysis when statsmodels is not available.
    """
    try:
        if len(request.historical_data) < 3:
            raise HTTPException(status_code=400, detail="Need at least 3 data points for forecasting")

        # Extract quantities
        quantities = [d.quantity for d in request.historical_data]
        dates = [datetime.strptime(d.date, "%Y-%m-%d") for d in request.historical_data]

        # Simple forecasting using moving average and trend
        # Calculate moving average (last 7 days or available data)
        window = min(7, len(quantities))
        recent_avg = np.mean(quantities[-window:])

        # Calculate trend (slope of last N days)
        if len(quantities) >= 7:
            x = np.arange(len(quantities[-7:]))
            y = np.array(quantities[-7:])
            slope = np.polyfit(x, y, 1)[0]
        else:
            slope = 0

        # Detect seasonality (simple: check if weekday pattern exists)
        seasonality_detected = False
        if len(quantities) >= 14:
            # Compare week 1 to week 2
            week1 = quantities[-14:-7]
            week2 = quantities[-7:]
            correlation = np.corrcoef(week1, week2)[0, 1] if len(week1) == len(week2) else 0
            seasonality_detected = correlation > 0.7

        # Generate predictions
        predictions = []
        last_date = dates[-1] if dates else datetime.now()

        for day in range(1, request.days + 1):
            forecast_date = last_date + timedelta(days=day)

            # Base prediction with trend
            base_prediction = recent_avg + (slope * day)

            # Add day-of-week seasonality if detected
            if seasonality_detected and len(quantities) >= 7:
                dow = forecast_date.weekday()
                idx = -(7 - dow)
                # Bounds check for safety
                if abs(idx) <= len(quantities) and recent_avg > 0:
                    dow_factor = quantities[idx] / recent_avg
                    base_prediction *= dow_factor

            # Ensure non-negative
            prediction = max(0, round(base_prediction, 1))

            predictions.append({
                "day": day,
                "date": forecast_date.strftime("%Y-%m-%d"),
                "qty": prediction,
                "confidence": max(0.5, 0.95 - (day * 0.05))  # Confidence decreases with forecast horizon
            })

        # Determine trend
        if slope > 0.5:
            trend = "INCREASING"
        elif slope < -0.5:
            trend = "DECREASING"
        else:
            trend = "STABLE"

        # Overall confidence based on data quality
        confidence = min(0.95, 0.5 + (len(quantities) * 0.02))

        return DemandForecastResponse(
            predictions=predictions,
            confidence=round(confidence, 2),
            trend=trend,
            seasonality_detected=seasonality_detected
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/detect/theft", response_model=TheftDetectionResponse)
async def detect_theft(request: TheftDetectionRequest):
    """
    Anomaly detection for theft using statistical analysis.
    Uses Z-score method when sklearn is not available.
    """
    try:
        if len(request.orders) == 0:
            return TheftDetectionResponse(
                flagged=[],
                summary={"total_orders": 0, "flagged_count": 0}
            )

        # Aggregate by server
        server_metrics = {}
        for order in request.orders:
            sid = order.server_id
            if sid not in server_metrics:
                server_metrics[sid] = {
                    "server_id": sid,
                    "total_orders": 0,
                    "void_count": 0,
                    "total_amount": 0,
                    "void_amount": 0
                }

            server_metrics[sid]["total_orders"] += 1
            server_metrics[sid]["total_amount"] += order.total
            if order.is_void:
                server_metrics[sid]["void_count"] += 1
                server_metrics[sid]["void_amount"] += order.void_amount or order.total

        # Calculate rates
        for sid, metrics in server_metrics.items():
            if metrics["total_orders"] > 0:
                metrics["void_rate"] = metrics["void_count"] / metrics["total_orders"]
                metrics["avg_order_value"] = metrics["total_amount"] / metrics["total_orders"]
            else:
                metrics["void_rate"] = 0
                metrics["avg_order_value"] = 0

        # Calculate population statistics
        void_rates = [m["void_rate"] for m in server_metrics.values()]
        void_amounts = [m["void_amount"] for m in server_metrics.values()]

        mean_void_rate = np.mean(void_rates) if void_rates else 0
        std_void_rate = np.std(void_rates) if len(void_rates) > 1 else 0
        mean_void_amount = np.mean(void_amounts) if void_amounts else 0
        std_void_amount = np.std(void_amounts) if len(void_amounts) > 1 else 0

        # Flag anomalies using Z-score > 2
        flagged = []
        for sid, metrics in server_metrics.items():
            is_anomaly = False
            suspicion_score = 0

            # Check void rate anomaly
            if std_void_rate > 0:
                z_void_rate = (metrics["void_rate"] - mean_void_rate) / std_void_rate
                if z_void_rate > 2:
                    is_anomaly = True
                    suspicion_score += min(50, z_void_rate * 20)

            # Check void amount anomaly
            if std_void_amount > 0:
                z_void_amount = (metrics["void_amount"] - mean_void_amount) / std_void_amount
                if z_void_amount > 2:
                    is_anomaly = True
                    suspicion_score += min(50, z_void_amount * 20)

            # Check if void rate > 2x mean
            if mean_void_rate > 0 and metrics["void_rate"] > mean_void_rate * 2:
                is_anomaly = True
                suspicion_score += 30

            if is_anomaly and metrics["void_count"] >= 2:  # Minimum voids to flag
                flagged.append({
                    "server_id": sid,
                    "score": min(100, round(suspicion_score)),
                    "void_rate": round(metrics["void_rate"] * 100, 1),
                    "void_count": metrics["void_count"],
                    "void_amount": round(metrics["void_amount"], 2),
                    "total_orders": metrics["total_orders"],
                    "flags": generate_flags(metrics, mean_void_rate),
                    "recommendation": generate_recommendation(suspicion_score)
                })

        # Sort by suspicion score
        flagged.sort(key=lambda x: x["score"], reverse=True)

        summary = {
            "total_orders": len(request.orders),
            "total_servers": len(server_metrics),
            "flagged_count": len(flagged),
            "mean_void_rate": round(mean_void_rate * 100, 2),
            "total_void_amount": round(sum(void_amounts), 2)
        }

        return TheftDetectionResponse(
            flagged=flagged,
            summary=summary
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/calculate/elasticity", response_model=ElasticityResponse)
async def calculate_elasticity(request: ElasticityRequest):
    """
    Price elasticity calculation using historical price and quantity data.
    Elasticity = (% change in quantity) / (% change in price)
    """
    try:
        if len(request.price_history) < 2:
            raise HTTPException(status_code=400, detail="Need at least 2 data points")

        # Sort by date
        sorted_data = sorted(request.price_history, key=lambda x: x.date)

        # Calculate elasticity for each price change
        elasticities = []
        for i in range(1, len(sorted_data)):
            prev = sorted_data[i - 1]
            curr = sorted_data[i]

            price_change = (curr.price - prev.price) / prev.price if prev.price > 0 else 0
            qty_change = (curr.quantity - prev.quantity) / prev.quantity if prev.quantity > 0 else 0

            # Only calculate if there's a meaningful price change
            if abs(price_change) > 0.01:  # > 1% price change
                elasticity = qty_change / price_change
                # Filter out extreme values (likely noise)
                if abs(elasticity) < 10:
                    elasticities.append(elasticity)

        # Calculate average elasticity
        if len(elasticities) == 0:
            # No significant price changes, estimate from trend
            avg_elasticity = -1.0  # Default assumption
            confidence = 0.3
        else:
            avg_elasticity = np.mean(elasticities)
            # Confidence based on consistency
            std_elasticity = np.std(elasticities) if len(elasticities) > 1 else 0
            confidence = max(0.3, min(0.95, 1 - (std_elasticity / (abs(avg_elasticity) + 1))))

        # Classify elasticity
        abs_elasticity = abs(avg_elasticity)
        if abs_elasticity < 0.5:
            elasticity_type = "HIGHLY_INELASTIC"
            recommendation = "Customers are not price sensitive. Can safely increase price by 15-20% without significant volume loss."
        elif abs_elasticity < 1:
            elasticity_type = "INELASTIC"
            recommendation = "Can increase price by 10-15% with minimal demand impact. Consider premium positioning."
        elif abs_elasticity < 2:
            elasticity_type = "ELASTIC"
            recommendation = "Price sensitive item. Use promotions and bundles instead of price increases. Consider value meals."
        else:
            elasticity_type = "HIGHLY_ELASTIC"
            recommendation = "Very price sensitive. Focus on volume, avoid price increases. Consider competitive pricing strategy."

        return ElasticityResponse(
            elasticity=round(avg_elasticity, 3),
            elasticity_type=elasticity_type,
            recommendation=recommendation,
            confidence=round(confidence, 2)
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============= Helper Functions =============

def generate_flags(metrics: dict, mean_void_rate: float) -> List[str]:
    """Generate warning flags based on metrics"""
    flags = []

    if mean_void_rate > 0 and metrics["void_rate"] > mean_void_rate * 3:
        flags.append("VERY_HIGH_VOID_RATE")
    elif mean_void_rate > 0 and metrics["void_rate"] > mean_void_rate * 2:
        flags.append("HIGH_VOID_RATE")

    if metrics["void_amount"] > 5000:
        flags.append("HIGH_VOID_AMOUNT")

    if metrics["void_count"] >= 5:
        flags.append("FREQUENT_VOIDS")

    return flags


def generate_recommendation(suspicion_score: float) -> str:
    """Generate recommendation based on suspicion score"""
    if suspicion_score >= 75:
        return "Immediate review required. Check CCTV footage and receipts."
    elif suspicion_score >= 50:
        return "Schedule audit. Monitor closely for next 7 days."
    else:
        return "Continue monitoring. May be legitimate pattern."


# ============= Run Server =============

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
