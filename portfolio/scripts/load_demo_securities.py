import math
from datetime import date, timedelta

import mysql.connector

DB = {
    "host": "localhost",
    "port": 3306,
    "user": "root",
    "password": "password@123",
    "database": "portfolio_db",
}

ASSET_TYPES = [
    "EQUITY",
    "MUTUAL",
    "COMMODITY",
    "BOND",
    "CRYPTO",
    "REIT",
    "ETF",
]

ASSET_CONFIG = {
    "EQUITY": {
        "base": 140.0,
        "currency": "INR",
        "exchange": "NSE",
        "market": "NSE",
        "country": "India",
        "series": "EQ",
        "risk": "MEDIUM",
        "names": [
            "TCS", "INFY", "HDFCBANK", "ICICIBANK", "RELIANCE", "ITC", "SBIN", "LTIMINDIA", "BHARTIARTL", "KOTAKBANK",
            "AXISBANK", "SUNPHARMA", "HINDUNILVR", "ASIANPAINT", "MARUTI", "NTPC", "POWERGRID", "ULTRACEMCO", "TITAN",
            "JSWSTEEL", "BAJFINANCE", "WIPRO", "NESTLEIND", "TECHM", "INDUSINDBK", "HCLTECH", "M&M", "TATACONSUM",
            "CIPLA", "DRREDDY", "DIVISLAB", "APOLLOHOSP", "BRITANNIA", "EICHERMOT", "GRASIM", "HDFCLIFE", "ICICIPRULI",
            "SHRIRAMFIN", "TRENT", "ZOMATO", "PAYTM", "POLYCAB", "BANDHANBNK", "JUBLFOOD", "GODREJPROP", "TVSMOTOR",
            "PIIND", "SRF", "DABUR", "PAGEIND", "CHOLAFIN"
        ],
        "equity_categories": ["LARGE_CAP", "MID_CAP", "SMALL_CAP"],
    },
    "MUTUAL": {
        "base": 90.0,
        "currency": "INR",
        "exchange": "NSE",
        "market": "MUTUAL",
        "country": "India",
        "series": "MF",
        "risk": "MODERATE",
        "names": [
            "HDFC_TOP_100", "SBI_BLUECHIP", "AXIS_GROWTH", "ICICI_VALUE", "MIRAE_LARGE_CAP", "UTI_NIFTY", "NIPPON_INDEX",
            "PARAG_PARIKH", "KOTAK_BALANCED", "DSP_MIDCAP", "SUNDARAM_SMALLCAP", "FRANKLIN_TAX", "L_MIDCAP", "TATA_ELSS",
            "CANARA_ROB", "ADITYA_BIRLA", "ICICI_SIP", "HDFC_INFRA", "SBI_MIDCAP", "AXIS_SMLCAP", "NIPPON_SMALLCAP",
            "SUNDARAM_VALUE", "UTI_MIDCAP", "KOTAK_MULTI_CAP", "HDFC_HYBRID", "MIRAE_MULTI_CAP" , "ICICI_HYBRID",
            "SBI_EQUITY", "AXIS_INDEX", "DSP_INDEX", "NIPPON_MULTI_CAP", "FRANKLIN_MIDCAP", "L_GROWTH", "TATA_MIDCAP",
            "KOTAK_SMALLCAP", "HDFC_INDEX", "SBI_CONSUMER", "ICICI_GOLD", "UTI_GOLD", "MIRAE_GOLD", "AXIS_FLEXI_CAP",
            "CANARA_SMALLCAP", "ADITYA_HYBRID", "ICICI_FLEXI_CAP", "HDFC_FLEXI_CAP", "NIPPON_FLEXI_CAP", "SUNDARAM_MULTI_ASSET"
        ],
    },
    "COMMODITY": {
        "base": 3000.0,
        "currency": "INR",
        "exchange": "MCX",
        "market": "MCX",
        "country": "India",
        "series": "COM",
        "risk": "HIGH",
        "names": [
            "GOLD", "SILVER", "COPPER", "CRUDE_OIL", "NATURAL_GAS", "ALUMINIUM", "ZINC", "LEAD", "NICKEL", "TIN",
            "COTTON", "WHEAT", "SOYBEAN", "RAPESEED", "CORN", "SUGAR", "COFFEE", "CHICKPEA", "BARLEY", "JUTE",
            "IRON_ORE", "STEEL", "PLATINUM", "PALLADIUM", "CPO", "SOY_OIL", "MENTHA_OIL", "CASTOR_SEED", "RICE", "MAIZE",
            "MUSTARD", "PEPPER", "CARDAMOM", "GUR", "FISH", "COPRA", "POPPY_SEED", "GUAR_SEED", "BULLION", "BASE_METAL",
            "CRUDE_GAS", "HARD_CURRENCY", "ENERGY_INDEX", "INDIGO", "AGRI_INDEX", "SOFT_COMMODITY", "PRECIOUS_METAL", "REFINED_OIL"
        ],
    },
    "BOND": {
        "base": 900.0,
        "currency": "INR",
        "exchange": "NSE",
        "market": "BOND",
        "country": "India",
        "series": "BOND",
        "risk": "LOW",
        "names": [
            "GOVT_BOND_1", "GOVT_BOND_2", "GOVT_BOND_3", "GOVT_BOND_4", "GOVT_BOND_5", "GOVT_BOND_6", "GOVT_BOND_7",
            "GOVT_BOND_8", "GOVT_BOND_9", "GOVT_BOND_10", "SDL_BOND_1", "SDL_BOND_2", "SDL_BOND_3", "SDL_BOND_4",
            "CORP_BOND_1", "CORP_BOND_2", "CORP_BOND_3", "CORP_BOND_4", "CORP_BOND_5", "CORP_BOND_6", "CORP_BOND_7",
            "CORP_BOND_8", "CORP_BOND_9", "CORP_BOND_10", "PSU_BOND_1", "PSU_BOND_2", "PSU_BOND_3", "PSU_BOND_4",
            "PSU_BOND_5", "PSU_BOND_6", "PSU_BOND_7", "PSU_BOND_8", "PSU_BOND_9", "PSU_BOND_10", "MUNI_BOND_1",
            "MUNI_BOND_2", "MUNI_BOND_3", "MUNI_BOND_4", "MUNI_BOND_5", "INFRA_BOND_1", "INFRA_BOND_2", "INFRA_BOND_3",
            "INFRA_BOND_4", "INFRA_BOND_5", "GREEN_BOND_1", "GREEN_BOND_2", "GREEN_BOND_3", "GREEN_BOND_4", "GREEN_BOND_5",
            "SHORT_TERM_BOND_1", "SHORT_TERM_BOND_2", "SHORT_TERM_BOND_3", "SHORT_TERM_BOND_4", "SHORT_TERM_BOND_5"
        ],
    },
    "CRYPTO": {
        "base": 120000.0,
        "currency": "USD",
        "exchange": "CEX",
        "market": "CRYPTO",
        "country": "Global",
        "series": "CRY",
        "risk": "VERY_HIGH",
        "names": [
            "BTC", "ETH", "SOL", "ADA", "XRP", "DOGE", "DOT", "LINK", "AVAX", "MATIC", "LTC", "UNI", "ATOM", "NEAR",
            "FIL", "APT", "ARB", "OP", "INJ", "RNDR", "SUI", "BLUR", "MINA", "EOS", "CHZ", "ALGO", "SAND", "GRT",
            "FLOW", "ICP", "XTZ", "KSM", "THETA", "VET", "EGLD", "HBAR", "COMP", "AAVE", "YFI", "SNX", "IMX", "FET",
            "MASK", "DYDX", "WAVES", "CRO", "FTM", "KAVA", "MINA", "PEPE"
        ],
    },
    "REIT": {
        "base": 140.0,
        "currency": "INR",
        "exchange": "NSE",
        "market": "REIT",
        "country": "India",
        "series": "REIT",
        "risk": "MEDIUM",
        "names": [
            "INDIA_REIT_1", "INDIA_REIT_2", "INDIA_REIT_3", "INDIA_REIT_4", "INDIA_REIT_5", "INDIA_REIT_6", "INDIA_REIT_7",
            "INDIA_REIT_8", "INDIA_REIT_9", "INDIA_REIT_10", "COMM_REIT_1", "COMM_REIT_2", "COMM_REIT_3", "COMM_REIT_4",
            "COMM_REIT_5", "COMM_REIT_6", "COMM_REIT_7", "COMM_REIT_8", "COMM_REIT_9", "COMM_REIT_10", "RESI_REIT_1",
            "RESI_REIT_2", "RESI_REIT_3", "RESI_REIT_4", "RESI_REIT_5", "RESI_REIT_6", "RESI_REIT_7", "RESI_REIT_8",
            "RESI_REIT_9", "RESI_REIT_10", "OFFICE_REIT_1", "OFFICE_REIT_2", "OFFICE_REIT_3", "OFFICE_REIT_4", "OFFICE_REIT_5",
            "OFFICE_REIT_6", "OFFICE_REIT_7", "OFFICE_REIT_8", "OFFICE_REIT_9", "OFFICE_REIT_10", "IND_REIT_11", "IND_REIT_12",
            "IND_REIT_13", "IND_REIT_14", "IND_REIT_15", "IND_REIT_16", "IND_REIT_17", "IND_REIT_18", "IND_REIT_19",
            "IND_REIT_20", "IND_REIT_21", "IND_REIT_22"
        ],
    },
    "ETF": {
        "base": 180.0,
        "currency": "INR",
        "exchange": "NSE",
        "market": "ETF",
        "country": "India",
        "series": "ETF",
        "risk": "MEDIUM",
        "names": [
            "NIFTY_ETF_1", "NIFTY_ETF_2", "NIFTY_ETF_3", "NIFTY_ETF_4", "NIFTY_ETF_5", "NIFTY_ETF_6", "NIFTY_ETF_7",
            "NIFTY_ETF_8", "NIFTY_ETF_9", "NIFTY_ETF_10", "BANK_ETF_1", "BANK_ETF_2", "BANK_ETF_3", "BANK_ETF_4",
            "BANK_ETF_5", "BANK_ETF_6", "BANK_ETF_7", "BANK_ETF_8", "IT_ETF_1", "IT_ETF_2", "IT_ETF_3", "IT_ETF_4",
            "IT_ETF_5", "IT_ETF_6", "GOLD_ETF_1", "GOLD_ETF_2", "GOLD_ETF_3", "GOLD_ETF_4", "GOLD_ETF_5", "GOLD_ETF_6",
            "SMALLCAP_ETF_1", "SMALLCAP_ETF_2", "SMALLCAP_ETF_3", "SMALLCAP_ETF_4", "SMALLCAP_ETF_5", "MIDCAP_ETF_1",
            "MIDCAP_ETF_2", "MIDCAP_ETF_3", "MIDCAP_ETF_4", "MIDCAP_ETF_5", "ENERGY_ETF_1", "ENERGY_ETF_2", "ENERGY_ETF_3",
            "INDIA_ETF_1", "INDIA_ETF_2", "INDIA_ETF_3", "INDIA_ETF_4", "INDIA_ETF_5", "INDEX_ETF_1", "INDEX_ETF_2",
            "INDEX_ETF_3", "INDEX_ETF_4", "INDEX_ETF_5"
        ],
    },
}

START = date(2024, 9, 30)
END = date(2026, 9, 25)


def daterange(start, end):
    cur = start
    while cur <= end:
        yield cur
        cur += timedelta(days=1)


def make_isin(symbol, idx):
    short = (symbol[:4].upper() if len(symbol) >= 4 else symbol.upper())
    return f"INE{idx:05d}{short:<4}"


def ensure_gics(conn):
    cur = conn.cursor()
    cur.executemany(
        "INSERT IGNORE INTO gics_industries (industry_code, sector_code, sector_name, industry_name) VALUES (%s,%s,%s,%s)",
        [
            ("451020", "IT", "Information Technology", "Software & Services"),
            ("151010", "FS", "Financial Services", "Banking & Finance"),
            ("201010", "EN", "Energy", "Oil & Gas"),
        ],
    )
    conn.commit()


def build_security_rows():
    rows = []
    idx = 1
    for asset_type in ASSET_TYPES:
        config = ASSET_CONFIG[asset_type]
        for name in config["names"]:
            symbol = name
            equity_category = None
            if asset_type == "EQUITY":
                equity_category = config["equity_categories"][idx % len(config["equity_categories"])]
            rows.append({
                "asset_type": asset_type,
                "equity_category": equity_category,
                "isin": make_isin(symbol, idx),
                "symbol": symbol,
                "series": config["series"],
                "name": name.replace("_", " "),
                "description": f"Synthetic {asset_type.lower()} demo security {name}",
                "exchange": config["exchange"],
                "currency": config["currency"],
                "country": config["country"],
                "market": config["market"],
                "risk_level": config["risk"],
                "status": "ACTIVE",
                "gics_industry_code": "451020" if asset_type == "EQUITY" else None,
                "base": config["base"],
            })
            idx += 1
    return rows


def insert_securities(conn):
    rows = build_security_rows()
    cur = conn.cursor()
    for row in rows:
        cur.execute(
            """
            INSERT INTO security_details
            (asset_type, equity_category, isin, symbol, series, name, description, exchange, currency,
             gics_industry_code, country, market, risk_level, status, created_at, updated_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW(),NOW())
            ON DUPLICATE KEY UPDATE name=VALUES(name), updated_at=NOW()
            """,
            (
                row["asset_type"],
                row["equity_category"],
                row["isin"],
                row["symbol"],
                row["series"],
                row["name"],
                row["description"],
                row["exchange"],
                row["currency"],
                row["gics_industry_code"],
                row["country"],
                row["market"],
                row["risk_level"],
                row["status"],
            ),
        )
    conn.commit()
    return rows


def fetch_security_ids(conn, rows):
    symbols = [r["symbol"] for r in rows]
    cur = conn.cursor(dictionary=True)
    placeholders = ",".join(["%s"] * len(symbols))
    cur.execute(f"SELECT security_id, symbol FROM security_details WHERE symbol IN ({placeholders})", symbols)
    return {row["symbol"]: row["security_id"] for row in cur.fetchall()}


def insert_daily_prices(conn, rows):
    sec_map = fetch_security_ids(conn, rows)
    batch = []
    cur = conn.cursor()
    for row in rows:
        sid = sec_map[row["symbol"]]
        base = float(row["base"])
        drift_seed = sum(ord(ch) for ch in row["symbol"]) % 31
        prev_close = None
        for day in daterange(START, END):
            if day.weekday() >= 5:
                continue
            wave = math.sin((day.timetuple().tm_yday + drift_seed) / 7.2)
            trend = (drift_seed % 9) / 200.0 - 0.015
            delta = (0.012 + abs((drift_seed + day.day) % 11) / 500.0) * wave + trend
            open_price = round(base * (1 + delta / 10.0), 4)
            close_price = round(open_price * (1 + delta / 30.0), 4)
            high_price = round(max(open_price, close_price) * (1 + 0.01 + ((drift_seed * 7 + day.day) % 9) / 250.0), 4)
            low_price = round(min(open_price, close_price) * (1 - 0.01 - ((drift_seed * 3 + day.day) % 7) / 300.0), 4)
            if prev_close is None:
                prev_close = round(open_price * 0.995, 4)
            last_price = close_price
            volume = 20000 + ((drift_seed * 173 + day.day * 37 + len(row["symbol"])) % 700000)
            batch.append((sid, day.isoformat(), open_price, high_price, low_price, close_price, prev_close, last_price, volume, None, None, close_price))
            prev_close = close_price
            if len(batch) >= 500:
                cur.executemany(
                    """
                    INSERT INTO daily_prices
                    (security_id, trade_date, open_price, high_price, low_price, close_price, prev_close, last_price, volume, nav, spot_price, valuation_price)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    ON DUPLICATE KEY UPDATE
                    open_price=VALUES(open_price), high_price=VALUES(high_price), low_price=VALUES(low_price),
                    close_price=VALUES(close_price), prev_close=VALUES(prev_close), last_price=VALUES(last_price),
                    volume=VALUES(volume), valuation_price=VALUES(valuation_price)
                    """,
                    batch,
                )
                batch.clear()
    if batch:
        cur.executemany(
            """
            INSERT INTO daily_prices
            (security_id, trade_date, open_price, high_price, low_price, close_price, prev_close, last_price, volume, nav, spot_price, valuation_price)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            ON DUPLICATE KEY UPDATE
            open_price=VALUES(open_price), high_price=VALUES(high_price), low_price=VALUES(low_price),
            close_price=VALUES(close_price), prev_close=VALUES(prev_close), last_price=VALUES(last_price),
            volume=VALUES(volume), valuation_price=VALUES(valuation_price)
            """,
            batch,
        )
    conn.commit()


def main():
    conn = mysql.connector.connect(**DB)
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE pt FROM portfolio_trades pt JOIN security_details s ON s.security_id = pt.security_id WHERE s.asset_type = 'CASH';")
            cur.execute("DELETE ph FROM portfolio_holdings ph JOIN security_details s ON s.security_id = ph.security_id WHERE s.asset_type = 'CASH';")
            cur.execute("DELETE dp FROM daily_prices dp JOIN security_details s ON s.security_id = dp.security_id WHERE s.asset_type = 'CASH';")
            cur.execute("DELETE FROM security_details WHERE asset_type = 'CASH';")
        conn.commit()
        ensure_gics(conn)
        rows = insert_securities(conn)
        insert_daily_prices(conn, rows)
        print(f"Loaded {len(rows)} securities across all non-cash asset types with 2-year daily price history.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
