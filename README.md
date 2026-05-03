# 📈 Stock Data Intelligence Dashboard

> Built with FastAPI + yfinance + Chart.js

A full-stack mini financial data platform that collects real NSE stock data, exposes REST APIs, and visualises insights in a clean dark-themed dashboard.

---

## 🖥️ Live Preview
_(Add your Render/Heroku URL here after deployment)_

---

## 🚀 Features

| Feature | Status |
|---|---|
| Real-time NSE stock data (yfinance) | ✅ |
| Daily Return, 7-day MA, 30-day MA | ✅ |
| Custom Volatility Score metric | ✅ |
| REST API with FastAPI + Swagger docs | ✅ |
| 52-week High / Low / Avg summary | ✅ |
| Compare two stocks (correlation) | ✅ |
| Top Gainers & Losers | ✅ |
| Interactive Chart.js dashboard | ✅ |
| In-memory caching (10 min TTL) | ✅ |

---

## ⚙️ Tech Stack

- **Language:** Python 3.10+
- **Backend:** FastAPI + Uvicorn
- **Data:** yfinance (live NSE data), Pandas, NumPy
- **Frontend:** Pure HTML + Chart.js (no build step needed)
- **Docs:** Auto-generated Swagger at `/docs`

---

## 📦 Setup & Run

### 1. Clone the repo
```bash
git clone https://github.com/Abhay001-home/Stock-Data-Intelligence-Dashboard.git
cd stock-dashboard
```

### 2. Create a virtual environment
```bash
python -m venv venv
source venv/bin/activate        # Mac/Linux
venv\Scripts\activate           # Windows
```

### 3. Install dependencies
```bash
pip install -r requirements.txt
```

### 4. Run the server
```bash
uvicorn main:app --reload
```

### 5. Open in browser
- **Dashboard:** http://localhost:8000
- **API Docs (Swagger):** http://localhost:8000/docs

---

## 📡 API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/companies` | GET | List all tracked companies |
| `/data/{symbol}?days=30` | GET | OHLCV + metrics for last N days |
| `/summary/{symbol}` | GET | 52W high/low, avg, volatility score |
| `/compare?symbol1=TCS.NS&symbol2=INFY.NS` | GET | Compare two stocks |
| `/movers` | GET | Today's top gainers & losers |

### Example calls
```bash
# All companies
curl http://localhost:8000/companies

# TCS last 30 days
curl http://localhost:8000/data/TCS.NS?days=30

# Summary
curl http://localhost:8000/summary/INFY.NS

# Compare
curl "http://localhost:8000/compare?symbol1=TCS.NS&symbol2=INFY.NS&days=90"
```

---

## 📊 Calculated Metrics

| Metric | Formula |
|---|---|
| Daily Return | `(Close - Open) / Open × 100` |
| 7-day Moving Average | Rolling mean of Close |
| 30-day Moving Average | Rolling mean of Close |
| Volatility Score | `StdDev(Daily Return, 14) × 10`, capped at 100 |
| Cumulative Return | `(Close / Close[0] - 1) × 100` |

---

## 🗂️ Project Structure

```
stock-dashboard/
├── main.py            # FastAPI backend + all routes
├── requirements.txt
├── README.md
└── static/
    └── index.html     # Frontend dashboard (Chart.js)
```

---

## ☁️ Deployment (Vercel)

 Go to https://stock-data-intelligence-dashboard-lovat.vercel.app/
 Deployed 🎉

---

## 👤 Author
Abhay Kumar Verma
