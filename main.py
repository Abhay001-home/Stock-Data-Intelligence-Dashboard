"""
Stock Data Intelligence Dashboard — Jarnox Internship Assignment
yfinance (live) with realistic seeded-random-walk fallback.
"""
from fastapi.staticfiles import StaticFiles
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import os

app = FastAPI(
    title="Stock Data Intelligence Dashboard",
    description="Mini financial data platform — Jarnox Internship Assignment",
    version="1.0.0",
)

app.mount("/static", StaticFiles(directory="static"), name="static")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

COMPANIES = [
    {"symbol": "RELIANCE.NS",  "name": "Reliance Industries",       "sector": "Energy",       "base_price": 2850},
    {"symbol": "TCS.NS",       "name": "Tata Consultancy Services",  "sector": "IT",           "base_price": 3900},
    {"symbol": "INFY.NS",      "name": "Infosys",                    "sector": "IT",           "base_price": 1780},
    {"symbol": "HDFCBANK.NS",  "name": "HDFC Bank",                  "sector": "Banking",      "base_price": 1650},
    {"symbol": "ICICIBANK.NS", "name": "ICICI Bank",                 "sector": "Banking",      "base_price": 1120},
    {"symbol": "WIPRO.NS",     "name": "Wipro",                      "sector": "IT",           "base_price": 480},
    {"symbol": "SBIN.NS",      "name": "State Bank of India",        "sector": "Banking",      "base_price": 780},
    {"symbol": "BAJFINANCE.NS","name": "Bajaj Finance",              "sector": "Finance",      "base_price": 6900},
    {"symbol": "ADANIENT.NS",  "name": "Adani Enterprises",          "sector": "Conglomerate", "base_price": 2400},
    {"symbol": "TATAMOTORS.NS","name": "Tata Motors",                "sector": "Auto",         "base_price": 960},
]

_COMPANY_MAP = {c["symbol"]: c for c in COMPANIES}
_cache: dict = {}
CACHE_TTL = 600


def _generate_mock(symbol: str, days: int = 365) -> pd.DataFrame:
    company = _COMPANY_MAP.get(symbol)
    if not company:
        raise HTTPException(status_code=404, detail=f"Unknown symbol: {symbol}")
    seed = sum(ord(c) for c in symbol)
    rng  = np.random.default_rng(seed)
    mu, sigma = 0.0004, 0.012
    closes = company["base_price"] * np.exp(np.cumsum(rng.normal(mu, sigma, days)))
    opens  = np.roll(closes, 1); opens[0] = company["base_price"]
    opens += rng.normal(0, company["base_price"] * 0.003, days)
    highs  = np.maximum(closes, opens) * (1 + rng.uniform(0, 0.012, days))
    lows   = np.minimum(closes, opens) * (1 - rng.uniform(0, 0.012, days))
    volume = rng.integers(500_000, 5_000_000, days).astype(float)

    end, dates = datetime.today().date(), []
    d = end - timedelta(days=days * 2)
    while len(dates) < days:
        if d.weekday() < 5:
            dates.append(d)
        d += timedelta(days=1)
    dates = dates[-days:]

    return pd.DataFrame(
        {"Open": opens.round(2), "High": highs.round(2), "Low": lows.round(2),
         "Close": closes.round(2), "Volume": volume},
        index=pd.DatetimeIndex(dates, name="Date"),
    )


def _fetch(symbol: str, period_days: int = 365) -> pd.DataFrame:
    key = f"{symbol}_{period_days}"
    now = datetime.utcnow().timestamp()
    if key in _cache and now - _cache[key]["ts"] < CACHE_TTL:
        return _cache[key]["df"]

    df = None
    try:
        import yfinance as yf
        raw = yf.Ticker(symbol).history(period="1y")
        if not raw.empty:
            df = raw[["Open","High","Low","Close","Volume"]].copy()
            df.index = pd.to_datetime(df.index).tz_localize(None)
            df.dropna(subset=["Close"], inplace=True)
    except Exception:
        pass

    if df is None or df.empty:
        df = _generate_mock(symbol, days=365)

    df["Daily_Return"] = (df["Close"] - df["Open"]) / df["Open"] * 100
    df["MA7"]          = df["Close"].rolling(7).mean()
    df["MA30"]         = df["Close"].rolling(30).mean()
    df["Volatility"]   = df["Daily_Return"].rolling(14).std()
    df["Cum_Return"]   = (df["Close"] / df["Close"].iloc[0] - 1) * 100
    _cache[key] = {"df": df, "ts": now}
    return df


@app.get("/companies", tags=["Data"])
def get_companies():
    return {"count": len(COMPANIES), "companies": COMPANIES}


@app.get("/data/{symbol}", tags=["Data"])
def get_stock_data(symbol: str, days: int = Query(30, ge=7, le=365)):
    df = _fetch(symbol.upper()).tail(days).copy()
    df.reset_index(inplace=True)
    df["Date"] = df["Date"].dt.strftime("%Y-%m-%d")
    return {"symbol": symbol.upper(), "days": days, "data": df.round(2).fillna("").to_dict(orient="records")}


@app.get("/summary/{symbol}", tags=["Data"])
def get_summary(symbol: str):
    df = _fetch(symbol.upper())
    close = df["Close"]
    c = _COMPANY_MAP.get(symbol.upper(), {})
    return {
        "symbol": symbol.upper(), "name": c.get("name", symbol), "sector": c.get("sector", "N/A"),
        "52_week_high":    round(float(close.max()), 2),
        "52_week_low":     round(float(close.min()), 2),
        "avg_close":       round(float(close.mean()), 2),
        "current_price":   round(float(close.iloc[-1]), 2),
        "ytd_return":      round(float((close.iloc[-1]/close.iloc[0]-1)*100), 2),
        "volatility_score":round(min(float(df["Daily_Return"].std())*10, 100), 1),
        "avg_daily_return":round(float(df["Daily_Return"].mean()), 4),
        "data_points":     len(df),
    }


@app.get("/compare", tags=["Bonus"])
def compare_stocks(symbol1: str = Query(...), symbol2: str = Query(...), days: int = Query(90, ge=7, le=365)):
    df1 = _fetch(symbol1.upper()).tail(days)["Close"].rename(symbol1.upper())
    df2 = _fetch(symbol2.upper()).tail(days)["Close"].rename(symbol2.upper())
    merged = pd.concat([df1, df2], axis=1).dropna()
    corr   = round(float(merged.corr().iloc[0,1]), 4)
    def stats(s):
        return {"start_price": round(float(s.iloc[0]),2), "end_price": round(float(s.iloc[-1]),2),
                "return_pct": round(float((s.iloc[-1]/s.iloc[0]-1)*100),2),
                "volatility": round(float(s.pct_change().std()*100),4)}
    return {
        "symbol1": symbol1.upper(), "symbol2": symbol2.upper(), "days": days, "correlation": corr,
        "symbol1_stats": stats(merged[symbol1.upper()]), "symbol2_stats": stats(merged[symbol2.upper()]),
        "prices": {"dates": [d.strftime("%Y-%m-%d") for d in merged.index],
                   symbol1.upper(): [round(v,2) for v in merged[symbol1.upper()].tolist()],
                   symbol2.upper(): [round(v,2) for v in merged[symbol2.upper()].tolist()]},
    }


@app.get("/movers", tags=["Bonus"])
def top_movers():
    results = []
    for c in COMPANIES:
        try:
            last = _fetch(c["symbol"])["Close"].dropna().tail(2)
            if len(last) < 2: continue
            pct = round(float((last.iloc[-1]/last.iloc[-2]-1)*100), 2)
            results.append({"symbol":c["symbol"],"name":c["name"],"price":round(float(last.iloc[-1]),2),"change_pct":pct})
        except Exception:
            continue
    results.sort(key=lambda x: x["change_pct"], reverse=True)
    return {"top_gainers": results[:3], "top_losers": results[-3:][::-1]}


@app.get("/", response_class=HTMLResponse, include_in_schema=False)
def serve_dashboard():
    with open(os.path.join(os.path.dirname(__file__), "static", "index.html")) as f:
        return f.read()
