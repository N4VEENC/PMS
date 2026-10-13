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

START = date(2024, 9, 30)
END = date(2026, 9, 25)

ASSET_ORDER = ["EQUITY", "MUTUAL", "COMMODITY", "BOND", "CRYPTO", "REIT", "ETF"]
STOCK_CAP_COUNTS = {"LARGE_CAP": 334, "MID_CAP": 333, "SMALL_CAP": 333}
USED_SECURITY_KEYS = set()

REAL_SECURITY_CATALOG = {
    "EQUITY": [
        {"symbol": "AAPL", "name": "Apple Inc.", "category": "LARGE_CAP", "exchange": "NASDAQ", "currency": "USD", "country": "United States", "market": "NASDAQ", "gics_industry_code": "451020"},
        {"symbol": "MSFT", "name": "Microsoft Corporation", "category": "LARGE_CAP", "exchange": "NASDAQ", "currency": "USD", "country": "United States", "market": "NASDAQ", "gics_industry_code": "451020"},
        {"symbol": "AMZN", "name": "Amazon.com, Inc.", "category": "LARGE_CAP", "exchange": "NASDAQ", "currency": "USD", "country": "United States", "market": "NASDAQ", "gics_industry_code": "452010"},
        {"symbol": "GOOGL", "name": "Alphabet Inc.", "category": "LARGE_CAP", "exchange": "NASDAQ", "currency": "USD", "country": "United States", "market": "NASDAQ", "gics_industry_code": "301010"},
        {"symbol": "NVDA", "name": "NVIDIA Corporation", "category": "LARGE_CAP", "exchange": "NASDAQ", "currency": "USD", "country": "United States", "market": "NASDAQ", "gics_industry_code": "451040"},
        {"symbol": "META", "name": "Meta Platforms, Inc.", "category": "LARGE_CAP", "exchange": "NASDAQ", "currency": "USD", "country": "United States", "market": "NASDAQ", "gics_industry_code": "301010"},
        {"symbol": "JPM", "name": "JPMorgan Chase & Co.", "category": "LARGE_CAP", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE", "gics_industry_code": "151010"},
        {"symbol": "XOM", "name": "Exxon Mobil Corporation", "category": "LARGE_CAP", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE", "gics_industry_code": "201010"},
        {"symbol": "WMT", "name": "Walmart Inc.", "category": "LARGE_CAP", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE", "gics_industry_code": "502010"},
        {"symbol": "V", "name": "Visa Inc.", "category": "LARGE_CAP", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE", "gics_industry_code": "151020"},
        {"symbol": "TCS", "name": "Tata Consultancy Services Ltd.", "category": "LARGE_CAP", "exchange": "NSE", "currency": "INR", "country": "India", "market": "NSE", "gics_industry_code": "451020"},
        {"symbol": "HDFCBANK", "name": "HDFC Bank Ltd.", "category": "LARGE_CAP", "exchange": "NSE", "currency": "INR", "country": "India", "market": "NSE", "gics_industry_code": "151010"},
        {"symbol": "INFY", "name": "Infosys Ltd.", "category": "LARGE_CAP", "exchange": "NSE", "currency": "INR", "country": "India", "market": "NSE", "gics_industry_code": "451020"},
        {"symbol": "ICICIBANK", "name": "ICICI Bank Ltd.", "category": "LARGE_CAP", "exchange": "NSE", "currency": "INR", "country": "India", "market": "NSE", "gics_industry_code": "151010"},
        {"symbol": "RELIANCE", "name": "Reliance Industries Ltd.", "category": "LARGE_CAP", "exchange": "NSE", "currency": "INR", "country": "India", "market": "NSE", "gics_industry_code": "201010"},
        {"symbol": "ITC", "name": "ITC Ltd.", "category": "LARGE_CAP", "exchange": "NSE", "currency": "INR", "country": "India", "market": "NSE", "gics_industry_code": "502020"},
        {"symbol": "SBIN", "name": "State Bank of India", "category": "LARGE_CAP", "exchange": "NSE", "currency": "INR", "country": "India", "market": "NSE", "gics_industry_code": "151010"},
        {"symbol": "LTIM", "name": "LTIMindtree Ltd.", "category": "MID_CAP", "exchange": "NSE", "currency": "INR", "country": "India", "market": "NSE", "gics_industry_code": "451020"},
        {"symbol": "SUNPHARMA", "name": "Sun Pharmaceutical Industries Ltd.", "category": "MID_CAP", "exchange": "NSE", "currency": "INR", "country": "India", "market": "NSE", "gics_industry_code": "351020"},
        {"symbol": "TITAN", "name": "Titan Company Ltd.", "category": "MID_CAP", "exchange": "NSE", "currency": "INR", "country": "India", "market": "NSE", "gics_industry_code": "252010"},
        {"symbol": "AMD", "name": "Advanced Micro Devices, Inc.", "category": "MID_CAP", "exchange": "NASDAQ", "currency": "USD", "country": "United States", "market": "NASDAQ", "gics_industry_code": "451040"},
        {"symbol": "NFLX", "name": "Netflix, Inc.", "category": "MID_CAP", "exchange": "NASDAQ", "currency": "USD", "country": "United States", "market": "NASDAQ", "gics_industry_code": "301010"},
        {"symbol": "QCOM", "name": "QUALCOMM Incorporated", "category": "MID_CAP", "exchange": "NASDAQ", "currency": "USD", "country": "United States", "market": "NASDAQ", "gics_industry_code": "451040"},
        {"symbol": "CAT", "name": "Caterpillar Inc.", "category": "MID_CAP", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE", "gics_industry_code": "101010"},
        {"symbol": "HD", "name": "The Home Depot, Inc.", "category": "MID_CAP", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE", "gics_industry_code": "252010"},
        {"symbol": "DIS", "name": "The Walt Disney Company", "category": "MID_CAP", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE", "gics_industry_code": "301010"},
        {"symbol": "BA", "name": "The Boeing Company", "category": "SMALL_CAP", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE", "gics_industry_code": "101010"},
        {"symbol": "HON", "name": "Honeywell International Inc.", "category": "SMALL_CAP", "exchange": "NASDAQ", "currency": "USD", "country": "United States", "market": "NASDAQ", "gics_industry_code": "101010"},
        {"symbol": "UPS", "name": "United Parcel Service, Inc.", "category": "SMALL_CAP", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE", "gics_industry_code": "101010"},
        {"symbol": "IBM", "name": "International Business Machines Corporation", "category": "SMALL_CAP", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE", "gics_industry_code": "451020"},
        {"symbol": "TMO", "name": "Thermo Fisher Scientific Inc.", "category": "SMALL_CAP", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE", "gics_industry_code": "351020"},
        {"symbol": "PFE", "name": "Pfizer Inc.", "category": "MID_CAP", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE", "gics_industry_code": "351020"},
        {"symbol": "MRK", "name": "Merck & Co., Inc.", "category": "MID_CAP", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE", "gics_industry_code": "351020"},
        {"symbol": "LLY", "name": "Eli Lilly and Company", "category": "MID_CAP", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE", "gics_industry_code": "351020"},
        {"symbol": "ABBV", "name": "AbbVie Inc.", "category": "MID_CAP", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE", "gics_industry_code": "351020"},
        {"symbol": "ORCL", "name": "Oracle Corporation", "category": "LARGE_CAP", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE", "gics_industry_code": "451020"},
        {"symbol": "ADBE", "name": "Adobe Inc.", "category": "LARGE_CAP", "exchange": "NASDAQ", "currency": "USD", "country": "United States", "market": "NASDAQ", "gics_industry_code": "451020"},
        {"symbol": "CRM", "name": "Salesforce, Inc.", "category": "LARGE_CAP", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE", "gics_industry_code": "451020"},
        {"symbol": "MCD", "name": "McDonald's Corporation", "category": "LARGE_CAP", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE", "gics_industry_code": "502020"},
        {"symbol": "PG", "name": "Procter & Gamble Company", "category": "LARGE_CAP", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE", "gics_industry_code": "502020"},
        {"symbol": "NKE", "name": "Nike, Inc.", "category": "LARGE_CAP", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE", "gics_industry_code": "252010"},
        {"symbol": "COST", "name": "Costco Wholesale Corporation", "category": "LARGE_CAP", "exchange": "NASDAQ", "currency": "USD", "country": "United States", "market": "NASDAQ", "gics_industry_code": "502010"},
        {"symbol": "PEP", "name": "PepsiCo, Inc.", "category": "LARGE_CAP", "exchange": "NASDAQ", "currency": "USD", "country": "United States", "market": "NASDAQ", "gics_industry_code": "502020"},
        {"symbol": "CSCO", "name": "Cisco Systems, Inc.", "category": "LARGE_CAP", "exchange": "NASDAQ", "currency": "USD", "country": "United States", "market": "NASDAQ", "gics_industry_code": "451020"},
        {"symbol": "INTC", "name": "Intel Corporation", "category": "LARGE_CAP", "exchange": "NASDAQ", "currency": "USD", "country": "United States", "market": "NASDAQ", "gics_industry_code": "451020"},
        {"symbol": "TXN", "name": "Texas Instruments Incorporated", "category": "LARGE_CAP", "exchange": "NASDAQ", "currency": "USD", "country": "United States", "market": "NASDAQ", "gics_industry_code": "451040"},
        {"symbol": "AVGO", "name": "Broadcom Inc.", "category": "LARGE_CAP", "exchange": "NASDAQ", "currency": "USD", "country": "United States", "market": "NASDAQ", "gics_industry_code": "451040"},
        {"symbol": "WFC", "name": "Wells Fargo & Company", "category": "LARGE_CAP", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE", "gics_industry_code": "151010"},
        {"symbol": "UNH", "name": "UnitedHealth Group Incorporated", "category": "LARGE_CAP", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE", "gics_industry_code": "351020"},
        {"symbol": "CVX", "name": "Chevron Corporation", "category": "LARGE_CAP", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE", "gics_industry_code": "201010"},
        {"symbol": "NEM", "name": "Newmont Corporation", "category": "MID_CAP", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE", "gics_industry_code": "401010"},
        {"symbol": "SCHW", "name": "The Charles Schwab Corporation", "category": "MID_CAP", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE", "gics_industry_code": "151020"},
        {"symbol": "C", "name": "Citigroup Inc.", "category": "MID_CAP", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE", "gics_industry_code": "151010"},
        {"symbol": "SHOP", "name": "Shopify Inc.", "category": "MID_CAP", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE", "gics_industry_code": "452010"},
        {"symbol": "SNOW", "name": "Snowflake Inc.", "category": "MID_CAP", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE", "gics_industry_code": "451020"},
        {"symbol": "TWTR", "name": "Twitter, Inc.", "category": "SMALL_CAP", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE", "gics_industry_code": "301010"},
        {"symbol": "EA", "name": "Electronic Arts Inc.", "category": "SMALL_CAP", "exchange": "NASDAQ", "currency": "USD", "country": "United States", "market": "NASDAQ", "gics_industry_code": "451020"},
        {"symbol": "ROKU", "name": "Roku, Inc.", "category": "SMALL_CAP", "exchange": "NASDAQ", "currency": "USD", "country": "United States", "market": "NASDAQ", "gics_industry_code": "301010"},
        {"symbol": "ZM", "name": "Zoom Video Communications, Inc.", "category": "SMALL_CAP", "exchange": "NASDAQ", "currency": "USD", "country": "United States", "market": "NASDAQ", "gics_industry_code": "451020"},
        {"symbol": "UBER", "name": "Uber Technologies, Inc.", "category": "MID_CAP", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE", "gics_industry_code": "452010"},
        {"symbol": "LYFT", "name": "Lyft, Inc.", "category": "SMALL_CAP", "exchange": "NASDAQ", "currency": "USD", "country": "United States", "market": "NASDAQ", "gics_industry_code": "452010"},
        {"symbol": "DOCU", "name": "DocuSign, Inc.", "category": "SMALL_CAP", "exchange": "NASDAQ", "currency": "USD", "country": "United States", "market": "NASDAQ", "gics_industry_code": "451020"},
        {"symbol": "ASML", "name": "ASML Holding N.V.", "category": "LARGE_CAP", "exchange": "NASDAQ", "currency": "USD", "country": "Netherlands", "market": "NASDAQ", "gics_industry_code": "451040"},
        {"symbol": "TMUS", "name": "T-Mobile US, Inc.", "category": "LARGE_CAP", "exchange": "NASDAQ", "currency": "USD", "country": "United States", "market": "NASDAQ", "gics_industry_code": "302010"},
        {"symbol": "COST", "name": "Costco Wholesale Corporation", "category": "LARGE_CAP", "exchange": "NASDAQ", "currency": "USD", "country": "United States", "market": "NASDAQ", "gics_industry_code": "502010"},
        {"symbol": "NESTLE", "name": "Nestle India Ltd.", "category": "LARGE_CAP", "exchange": "NSE", "currency": "INR", "country": "India", "market": "NSE", "gics_industry_code": "502020"},
        {"symbol": "AXISBANK", "name": "Axis Bank Ltd.", "category": "LARGE_CAP", "exchange": "NSE", "currency": "INR", "country": "India", "market": "NSE", "gics_industry_code": "151010"},
        {"symbol": "KOTAKBANK", "name": "Kotak Mahindra Bank Ltd.", "category": "LARGE_CAP", "exchange": "NSE", "currency": "INR", "country": "India", "market": "NSE", "gics_industry_code": "151010"},
        {"symbol": "MARUTI", "name": "Maruti Suzuki India Ltd.", "category": "MID_CAP", "exchange": "NSE", "currency": "INR", "country": "India", "market": "NSE", "gics_industry_code": "252020"},
        {"symbol": "MUTHOOTFIN", "name": "Muthoot Finance Ltd.", "category": "MID_CAP", "exchange": "NSE", "currency": "INR", "country": "India", "market": "NSE", "gics_industry_code": "151020"},
        {"symbol": "WIPRO", "name": "Wipro Ltd.", "category": "LARGE_CAP", "exchange": "NSE", "currency": "INR", "country": "India", "market": "NSE", "gics_industry_code": "451020"},
        {"symbol": "HEXAWAR", "name": "Hexaware Technologies Ltd.", "category": "MID_CAP", "exchange": "NSE", "currency": "INR", "country": "India", "market": "NSE", "gics_industry_code": "451030"},
        {"symbol": "BANDHAN", "name": "Bandhan Bank Ltd.", "category": "MID_CAP", "exchange": "NSE", "currency": "INR", "country": "India", "market": "NSE", "gics_industry_code": "151010"},
        {"symbol": "GODREJCP", "name": "Godrej Consumer Products Ltd.", "category": "MID_CAP", "exchange": "NSE", "currency": "INR", "country": "India", "market": "NSE", "gics_industry_code": "502020"},
        {"symbol": "ULTRACEMCO", "name": "UltraTech Cement Ltd.", "category": "LARGE_CAP", "exchange": "NSE", "currency": "INR", "country": "India", "market": "NSE", "gics_industry_code": "101010"},
        {"symbol": "TATASTEEL", "name": "Tata Steel Ltd.", "category": "LARGE_CAP", "exchange": "NSE", "currency": "INR", "country": "India", "market": "NSE", "gics_industry_code": "401010"},
        {"symbol": "POWERGRID", "name": "Power Grid Corporation of India Ltd.", "category": "LARGE_CAP", "exchange": "NSE", "currency": "INR", "country": "India", "market": "NSE", "gics_industry_code": "201020"},
        {"symbol": "NTPC", "name": "NTPC Ltd.", "category": "LARGE_CAP", "exchange": "NSE", "currency": "INR", "country": "India", "market": "NSE", "gics_industry_code": "201010"},
        {"symbol": "CIPLA", "name": "Cipla Ltd.", "category": "MID_CAP", "exchange": "NSE", "currency": "INR", "country": "India", "market": "NSE", "gics_industry_code": "351020"},
        {"symbol": "DRREDDY", "name": "Dr. Reddy's Laboratories Ltd.", "category": "MID_CAP", "exchange": "NSE", "currency": "INR", "country": "India", "market": "NSE", "gics_industry_code": "351020"},
        {"symbol": "GRASIM", "name": "Grasim Industries Ltd.", "category": "LARGE_CAP", "exchange": "NSE", "currency": "INR", "country": "India", "market": "NSE", "gics_industry_code": "401010"},
        {"symbol": "HINDUNILVR", "name": "Hindustan Unilever Ltd.", "category": "LARGE_CAP", "exchange": "NSE", "currency": "INR", "country": "India", "market": "NSE", "gics_industry_code": "502020"},
        {"symbol": "KOTAKBANK", "name": "Kotak Mahindra Bank Ltd.", "category": "LARGE_CAP", "exchange": "NSE", "currency": "INR", "country": "India", "market": "NSE", "gics_industry_code": "151010"},
        {"symbol": "ZEEL", "name": "Zee Entertainment Enterprises Ltd.", "category": "SMALL_CAP", "exchange": "NSE", "currency": "INR", "country": "India", "market": "NSE", "gics_industry_code": "301010"},
        {"symbol": "CHOLAFIN", "name": "Cholamandalam Investment and Finance Company Ltd.", "category": "MID_CAP", "exchange": "NSE", "currency": "INR", "country": "India", "market": "NSE", "gics_industry_code": "151020"},
        {"symbol": "PFIZER", "name": "Pfizer Ltd.", "category": "MID_CAP", "exchange": "NSE", "currency": "INR", "country": "India", "market": "NSE", "gics_industry_code": "351020"},
        {"symbol": "HCLTECH", "name": "HCL Technologies Ltd.", "category": "LARGE_CAP", "exchange": "NSE", "currency": "INR", "country": "India", "market": "NSE", "gics_industry_code": "451020"},
    ],
    "MUTUAL": [
        {"symbol": "HDFCLARGECAP", "name": "HDFC Large Cap Fund", "exchange": "NSE", "currency": "INR", "country": "India", "market": "MUTUAL"},
        {"symbol": "HDFCMIDCAP", "name": "HDFC Mid-Cap Fund", "exchange": "NSE", "currency": "INR", "country": "India", "market": "MUTUAL"},
        {"symbol": "HDFCFLEXI", "name": "HDFC Flexi Cap Fund", "exchange": "NSE", "currency": "INR", "country": "India", "market": "MUTUAL"},
        {"symbol": "AXISBLUECHIP", "name": "Axis Bluechip Fund", "exchange": "NSE", "currency": "INR", "country": "India", "market": "MUTUAL"},
        {"symbol": "SBIMIDCAP", "name": "SBI Midcap Fund", "exchange": "NSE", "currency": "INR", "country": "India", "market": "MUTUAL"},
        {"symbol": "ICICIPRU", "name": "ICICI Prudential Bluechip Fund", "exchange": "NSE", "currency": "INR", "country": "India", "market": "MUTUAL"},
        {"symbol": "NIPINDEX", "name": "Nippon India Index Fund", "exchange": "NSE", "currency": "INR", "country": "India", "market": "MUTUAL"},
        {"symbol": "MIRAEIND", "name": "Mirae Asset India Equity Fund", "exchange": "NSE", "currency": "INR", "country": "India", "market": "MUTUAL"},
        {"symbol": "UTIMID", "name": "UTI Mid Cap Fund", "exchange": "NSE", "currency": "INR", "country": "India", "market": "MUTUAL"},
        {"symbol": "SUNDARMID", "name": "Sundaram Mid Cap Fund", "exchange": "NSE", "currency": "INR", "country": "India", "market": "MUTUAL"},
        {"symbol": "CANARABALANCE", "name": "Canara Robeco Balanced Advantage Fund", "exchange": "NSE", "currency": "INR", "country": "India", "market": "MUTUAL"},
        {"symbol": "FRANKLINGROWTH", "name": "Franklin India Growth Fund", "exchange": "NSE", "currency": "INR", "country": "India", "market": "MUTUAL"},
        {"symbol": "DSPVALUE", "name": "DSP Value Fund", "exchange": "NSE", "currency": "INR", "country": "India", "market": "MUTUAL"},
        {"symbol": "TATAMF", "name": "Tata Digital India Fund", "exchange": "NSE", "currency": "INR", "country": "India", "market": "MUTUAL"},
        {"symbol": "PARAGMF", "name": "Parag Parikh Flexi Cap Fund", "exchange": "NSE", "currency": "INR", "country": "India", "market": "MUTUAL"},
        {"symbol": "SBIINFRA", "name": "SBI Infrastructure Fund", "exchange": "NSE", "currency": "INR", "country": "India", "market": "MUTUAL"},
        {"symbol": "KOTAKGROWTH", "name": "Kotak Growth Fund", "exchange": "NSE", "currency": "INR", "country": "India", "market": "MUTUAL"},
        {"symbol": "NIPPONFLEXI", "name": "Nippon India Flexi Cap Fund", "exchange": "NSE", "currency": "INR", "country": "India", "market": "MUTUAL"},
        {"symbol": "AXISGROWTH", "name": "Axis Growth Fund", "exchange": "NSE", "currency": "INR", "country": "India", "market": "MUTUAL"},
        {"symbol": "ADITYABIRLA", "name": "Aditya Birla Sun Life Frontline Equity Fund", "exchange": "NSE", "currency": "INR", "country": "India", "market": "MUTUAL"},
    ],
    "COMMODITY": [
        {"symbol": "XAUUSD", "name": "Gold Spot", "exchange": "COMEX", "currency": "USD", "country": "Global", "market": "COMEX"},
        {"symbol": "XAGUSD", "name": "Silver Spot", "exchange": "COMEX", "currency": "USD", "country": "Global", "market": "COMEX"},
        {"symbol": "CL=F", "name": "Crude Oil WTI", "exchange": "NYMEX", "currency": "USD", "country": "United States", "market": "NYMEX"},
        {"symbol": "NG=F", "name": "Natural Gas", "exchange": "NYMEX", "currency": "USD", "country": "United States", "market": "NYMEX"},
        {"symbol": "HG=F", "name": "Copper", "exchange": "COMEX", "currency": "USD", "country": "United States", "market": "COMEX"},
        {"symbol": "GC=F", "name": "Gold Futures", "exchange": "COMEX", "currency": "USD", "country": "United States", "market": "COMEX"},
        {"symbol": "SI=F", "name": "Silver Futures", "exchange": "COMEX", "currency": "USD", "country": "United States", "market": "COMEX"},
        {"symbol": "BZ=F", "name": "Brent Crude Oil", "exchange": "ICE", "currency": "USD", "country": "United Kingdom", "market": "ICE"},
        {"symbol": "PL=F", "name": "Platinum Futures", "exchange": "NYMEX", "currency": "USD", "country": "United States", "market": "NYMEX"},
        {"symbol": "PA=F", "name": "Palladium Futures", "exchange": "NYMEX", "currency": "USD", "country": "United States", "market": "NYMEX"},
        {"symbol": "ZS=F", "name": "Soybean Futures", "exchange": "CBOT", "currency": "USD", "country": "United States", "market": "CBOT"},
        {"symbol": "ZW=F", "name": "Wheat Futures", "exchange": "CBOT", "currency": "USD", "country": "United States", "market": "CBOT"},
        {"symbol": "KC=F", "name": "Coffee Futures", "exchange": "ICE", "currency": "USD", "country": "United States", "market": "ICE"},
        {"symbol": "CT=F", "name": "Cotton Futures", "exchange": "ICE", "currency": "USD", "country": "United States", "market": "ICE"},
        {"symbol": "LH=F", "name": "Lean Hogs Futures", "exchange": "CME", "currency": "USD", "country": "United States", "market": "CME"},
        {"symbol": "LC=F", "name": "Live Cattle Futures", "exchange": "CME", "currency": "USD", "country": "United States", "market": "CME"},
        {"symbol": "AL=F", "name": "Aluminium Futures", "exchange": "LME", "currency": "USD", "country": "United Kingdom", "market": "LME"},
        {"symbol": "NI=F", "name": "Nickel Futures", "exchange": "LME", "currency": "USD", "country": "United Kingdom", "market": "LME"},
        {"symbol": "ZN=F", "name": "Zinc Futures", "exchange": "LME", "currency": "USD", "country": "United Kingdom", "market": "LME"},
        {"symbol": "TIN=F", "name": "Tin Futures", "exchange": "LME", "currency": "USD", "country": "United Kingdom", "market": "LME"},
    ],
    "BOND": [
        {"symbol": "BND", "name": "Vanguard Total Bond Market ETF", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE"},
        {"symbol": "AGG", "name": "iShares Core U.S. Aggregate Bond ETF", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE"},
        {"symbol": "VGLT", "name": "Vanguard Long-Term Treasury ETF", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE"},
        {"symbol": "SCHR", "name": "Schwab U.S. TIPS ETF", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE"},
        {"symbol": "LQD", "name": "iShares iBoxx Investment Grade Corporate Bond ETF", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE"},
        {"symbol": "GOVT", "name": "iShares U.S. Treasury Bond ETF", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE"},
        {"symbol": "IEI", "name": "iShares 3-7 Year Treasury Bond ETF", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE"},
        {"symbol": "IUSB", "name": "iShares Broad USD Investment Grade Corporate Bond ETF", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE"},
        {"symbol": "SHY", "name": "iShares 1-3 Year Treasury Bond ETF", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE"},
        {"symbol": "TLT", "name": "iShares 20+ Year Treasury Bond ETF", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE"},
        {"symbol": "GILT", "name": "iShares 5-10 Year Treasury Bond ETF", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE"},
        {"symbol": "HYG", "name": "iShares iBoxx High Yield Corporate Bond ETF", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE"},
        {"symbol": "JNK", "name": "SPDR Bloomberg High Yield Bond ETF", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE"},
        {"symbol": "TIP", "name": "iShares TIPS Bond ETF", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE"},
        {"symbol": "MUB", "name": "iShares National Muni Bond ETF", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE"},
    ],
    "CRYPTO": [
        {"symbol": "BTC", "name": "Bitcoin", "exchange": "CEX", "currency": "USD", "country": "Global", "market": "CRYPTO"},
        {"symbol": "ETH", "name": "Ethereum", "exchange": "CEX", "currency": "USD", "country": "Global", "market": "CRYPTO"},
        {"symbol": "SOL", "name": "Solana", "exchange": "CEX", "currency": "USD", "country": "Global", "market": "CRYPTO"},
        {"symbol": "XRP", "name": "XRP", "exchange": "CEX", "currency": "USD", "country": "Global", "market": "CRYPTO"},
        {"symbol": "ADA", "name": "Cardano", "exchange": "CEX", "currency": "USD", "country": "Global", "market": "CRYPTO"},
        {"symbol": "DOGE", "name": "Dogecoin", "exchange": "CEX", "currency": "USD", "country": "Global", "market": "CRYPTO"},
        {"symbol": "DOT", "name": "Polkadot", "exchange": "CEX", "currency": "USD", "country": "Global", "market": "CRYPTO"},
        {"symbol": "LINK", "name": "Chainlink", "exchange": "CEX", "currency": "USD", "country": "Global", "market": "CRYPTO"},
        {"symbol": "AVAX", "name": "Avalanche", "exchange": "CEX", "currency": "USD", "country": "Global", "market": "CRYPTO"},
        {"symbol": "ATOM", "name": "Cosmos", "exchange": "CEX", "currency": "USD", "country": "Global", "market": "CRYPTO"},
        {"symbol": "MATIC", "name": "Polygon", "exchange": "CEX", "currency": "USD", "country": "Global", "market": "CRYPTO"},
        {"symbol": "UNI", "name": "Uniswap", "exchange": "CEX", "currency": "USD", "country": "Global", "market": "CRYPTO"},
        {"symbol": "LTC", "name": "Litecoin", "exchange": "CEX", "currency": "USD", "country": "Global", "market": "CRYPTO"},
        {"symbol": "BCH", "name": "Bitcoin Cash", "exchange": "CEX", "currency": "USD", "country": "Global", "market": "CRYPTO"},
        {"symbol": "TRX", "name": "TRON", "exchange": "CEX", "currency": "USD", "country": "Global", "market": "CRYPTO"},
        {"symbol": "NEAR", "name": "NEAR Protocol", "exchange": "CEX", "currency": "USD", "country": "Global", "market": "CRYPTO"},
        {"symbol": "ICP", "name": "Internet Computer", "exchange": "CEX", "currency": "USD", "country": "Global", "market": "CRYPTO"},
        {"symbol": "ALGO", "name": "Algorand", "exchange": "CEX", "currency": "USD", "country": "Global", "market": "CRYPTO"},
        {"symbol": "ARB", "name": "Arbitrum", "exchange": "CEX", "currency": "USD", "country": "Global", "market": "CRYPTO"},
        {"symbol": "OP", "name": "Optimism", "exchange": "CEX", "currency": "USD", "country": "Global", "market": "CRYPTO"},
    ],
    "REIT": [
        {"symbol": "O", "name": "Realty Income Corporation", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE"},
        {"symbol": "PLD", "name": "Prologis, Inc.", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE"},
        {"symbol": "AMT", "name": "American Tower Corporation", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE"},
        {"symbol": "SPG", "name": "Simon Property Group, Inc.", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE"},
        {"symbol": "VICI", "name": "VICI Properties Inc.", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE"},
        {"symbol": "EQR", "name": "Equity Residential", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE"},
        {"symbol": "PSA", "name": "Public Storage", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE"},
        {"symbol": "DLR", "name": "Digital Realty Trust, Inc.", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE"},
        {"symbol": "CPT", "name": "Camden Property Trust", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE"},
        {"symbol": "MAA", "name": "Mid-America Apartment Communities, Inc.", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE"},
        {"symbol": "UDR", "name": "UDR, Inc.", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE"},
        {"symbol": "WELL", "name": "Welltower Inc.", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE"},
        {"symbol": "KRC", "name": "Kilroy Realty Corporation", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE"},
        {"symbol": "ESS", "name": "Essex Property Trust, Inc.", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE"},
        {"symbol": "AIRC", "name": "Apartment Income REIT Corp.", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE"},
    ],
    "ETF": [
        {"symbol": "SPY", "name": "SPDR S&P 500 ETF Trust", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE"},
        {"symbol": "QQQ", "name": "Invesco NASDAQ 100 ETF", "exchange": "NASDAQ", "currency": "USD", "country": "United States", "market": "NASDAQ"},
        {"symbol": "VTI", "name": "Vanguard Total Stock Market ETF", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE"},
        {"symbol": "IVV", "name": "iShares Core S&P 500 ETF", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE"},
        {"symbol": "VOO", "name": "Vanguard S&P 500 ETF", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE"},
        {"symbol": "IWM", "name": "iShares Russell 2000 ETF", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE"},
        {"symbol": "VGT", "name": "Vanguard Information Technology ETF", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE"},
        {"symbol": "VTV", "name": "Vanguard Value ETF", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE"},
        {"symbol": "VUG", "name": "Vanguard Growth ETF", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE"},
        {"symbol": "ITOT", "name": "iShares Core S&P Total U.S. Stock Market ETF", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE"},
        {"symbol": "XLF", "name": "Financial Select Sector SPDR Fund", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE"},
        {"symbol": "XLK", "name": "Technology Select Sector SPDR Fund", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE"},
        {"symbol": "XLE", "name": "Energy Select Sector SPDR Fund", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE"},
        {"symbol": "XLY", "name": "Consumer Discretionary Select Sector SPDR Fund", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE"},
        {"symbol": "XLI", "name": "Industrial Select Sector SPDR Fund", "exchange": "NYSE", "currency": "USD", "country": "United States", "market": "NYSE"},
    ],
}

GICS_CATALOG = [
    ("451020", "IT", "Information Technology", "Software & Services"),
    ("451030", "IT", "Information Technology", "IT Services"),
    ("451040", "IT", "Information Technology", "Semiconductors"),
    ("452010", "IT", "Information Technology", "Internet & Direct Marketing"),
    ("151010", "FS", "Financial Services", "Banks"),
    ("151020", "FS", "Financial Services", "Diversified Financials"),
    ("151030", "FS", "Financial Services", "Insurance"),
    ("201010", "EN", "Energy", "Oil & Gas"),
    ("201020", "EN", "Energy", "Utilities"),
    ("101010", "IN", "Industrials", "Capital Goods"),
    ("351020", "HC", "Health Care", "Pharmaceuticals"),
    ("502010", "CS", "Consumer Staples", "Food & Staples Retailing"),
    ("502020", "CS", "Consumer Staples", "Food Products"),
    ("252010", "CD", "Consumer Discretionary", "Consumer Retail"),
    ("252020", "CD", "Consumer Discretionary", "Automotive"),
    ("401010", "MA", "Materials", "Metals & Mining"),
    ("551010", "RE", "Real Estate", "REITs"),
    ("301010", "CS", "Communication Services", "Media"),
    ("302010", "CS", "Communication Services", "Telecommunication Services"),
]

BENCHMARK_CONFIG = [
    {
        "index_code": "NIFTY_50",
        "index_name": "Nifty 50",
        "symbol": "NIFTY",
        "exchange": "NSE",
        "country": "India",
        "currency": "INR",
        "base_value": 24000.0,
        "status": "ACTIVE",
        "volatility": 0.0105,
    },
    {
        "index_code": "SENSEX",
        "index_name": "BSE Sensex",
        "symbol": "SENSEX",
        "exchange": "BSE",
        "country": "India",
        "currency": "INR",
        "base_value": 82000.0,
        "status": "ACTIVE",
        "volatility": 0.0112,
    },
    {
        "index_code": "NIFTY_MIDCAP_150",
        "index_name": "Nifty Midcap 150",
        "symbol": "MIDCPNIFTY",
        "exchange": "NSE",
        "country": "India",
        "currency": "INR",
        "base_value": 28000.0,
        "status": "ACTIVE",
        "volatility": 0.014,
    },
    {
        "index_code": "NIFTY_SMALLCAP_250",
        "index_name": "Nifty Smallcap 250",
        "symbol": "SMCPNIFTY",
        "exchange": "NSE",
        "country": "India",
        "currency": "INR",
        "base_value": 16500.0,
        "status": "ACTIVE",
        "volatility": 0.018,
    },
    {
        "index_code": "NASDAQ_100",
        "index_name": "NASDAQ 100",
        "symbol": "NDX",
        "exchange": "NASDAQ",
        "country": "United States",
        "currency": "USD",
        "base_value": 22000.0,
        "status": "ACTIVE",
        "volatility": 0.013,
    },
    {
        "index_code": "GOLD_SPOT",
        "index_name": "Gold Spot",
        "symbol": "XAUUSD",
        "exchange": "COMEX",
        "country": "Global",
        "currency": "USD",
        "base_value": 2200.0,
        "status": "ACTIVE",
        "volatility": 0.009,
    },
]


def business_days(start, end):
    cur = start
    while cur <= end:
        if cur.weekday() < 5:
            yield cur
        cur += timedelta(days=1)


def compose_name(asset_type, index, category=None):
    base_names = ASSET_CONFIG[asset_type]["names"]
    sector_names = ASSET_CONFIG[asset_type].get("sectors", [])
    if asset_type == "EQUITY":
        sector_name = sector_names[(index - 1) % len(sector_names)]
        label = base_names[(index - 1) % len(base_names)]
        cap = ("Large" if category == "LARGE_CAP" else "Mid" if category == "MID_CAP" else "Small")
        return f"{label} {sector_name} {cap} Holdings"
    label = base_names[(index - 1) % len(base_names)]
    if category:
        return f"{label} {category}"
    return f"{label} {asset_type.title()}"


def generate_symbol(asset_type, index, category=None):
    prefix_map = {
        "EQUITY": "EQ",
        "MUTUAL": "MF",
        "COMMODITY": "CMD",
        "BOND": "BND",
        "CRYPTO": "CRY",
        "REIT": "REIT",
        "ETF": "ETF",
    }
    if asset_type == "EQUITY":
        cap_prefix = {"LARGE_CAP": "LC", "MID_CAP": "MC", "SMALL_CAP": "SC"}[category]
        return f"{prefix_map[asset_type]}{cap_prefix}{index:04d}"
    return f"{prefix_map[asset_type]}{index:04d}"


def generate_isin(index, symbol):
    token = (symbol[:4].upper() if len(symbol) >= 4 else symbol.upper())
    return f"INE{index % 100000:05d}{token[:4]:<4}".replace(" ", "")


def clean_tables(conn):
    with conn.cursor() as cur:
        cur.execute("SET FOREIGN_KEY_CHECKS = 0")
        for table in [
            "portfolio_trades",
            "portfolio_holdings",
            "bond_details",
            "daily_prices",
            "benchmark_daily_prices",
            "security_details",
            "benchmark_indices",
            "gics_industries",
        ]:
            try:
                cur.execute(f"TRUNCATE TABLE `{table}`")
            except Exception:
                pass
        cur.execute("SET FOREIGN_KEY_CHECKS = 1")
    conn.commit()


def ensure_gics(conn):
    entries = []
    for code, sector_code, sector_name, industry_name in GICS_CATALOG:
        entries.append((code, sector_code, sector_name, industry_name))
    with conn.cursor() as cur:
        cur.executemany(
            "INSERT IGNORE INTO gics_industries (industry_code, sector_code, sector_name, industry_name) VALUES (%s,%s,%s,%s)",
            entries,
        )
    conn.commit()


def build_unique_catalog(asset_type, target_count, category=None):
    pool = list(REAL_SECURITY_CATALOG.get(asset_type, []))
    if asset_type == "EQUITY" and category:
        pool = [entry for entry in pool if entry.get("category") == category]
    if not pool:
        return []

    unique = []
    used_symbols = set()
    used_names = set()
    suffixes = ["CAPITAL", "GROWTH", "VALUE", "GLOBAL", "HOLDINGS", "INDIA", "INTERNATIONAL", "STRATEGY", "EQUITY"]

    for source in pool:
        symbol = str(source.get("symbol", "")).upper()
        name = str(source.get("name", "")).strip()
        key = (symbol, name.lower())
        if key in USED_SECURITY_KEYS:
            continue
        if symbol and symbol not in used_symbols and name.lower() not in used_names:
            entry = dict(source)
            if category:
                entry["category"] = category
            unique.append(entry)
            used_symbols.add(symbol)
            used_names.add(name.lower())
            USED_SECURITY_KEYS.add(key)

    while len(unique) < target_count:
        source = pool[(len(unique)) % len(pool)]
        base_symbol = str(source.get("symbol", "")).upper()
        suffix = suffixes[(len(unique)) % len(suffixes)]
        variant = (len(unique) // len(suffixes)) + 1
        candidate = dict(source)
        candidate["symbol"] = f"{base_symbol}-{suffix}-{variant:03d}"
        candidate["name"] = f"{source.get('name', 'Professional Security')} {suffix.title()} {variant}"
        if category:
            candidate["category"] = category
        key = (candidate["symbol"].upper(), candidate["name"].lower())
        if key in USED_SECURITY_KEYS:
            offset = 1
            while True:
                alt_suffix = suffixes[(len(unique) + offset) % len(suffixes)]
                alt_variant = (len(unique) // len(suffixes)) + offset + 1
                candidate["symbol"] = f"{base_symbol}-{alt_suffix}-{alt_variant:03d}"
                candidate["name"] = f"{source.get('name', 'Professional Security')} {alt_suffix.title()} {alt_variant}"
                key = (candidate["symbol"].upper(), candidate["name"].lower())
                if key not in USED_SECURITY_KEYS:
                    break
                offset += 1
        unique.append(candidate)
        used_symbols.add(candidate["symbol"])
        used_names.add(candidate["name"].lower())
        USED_SECURITY_KEYS.add(key)

    return unique[:target_count]


def build_security_rows():
    USED_SECURITY_KEYS.clear()
    rows = []
    n = 1

    for asset_type in ASSET_ORDER:
        if asset_type == "EQUITY":
            for category, count in STOCK_CAP_COUNTS.items():
                selected = build_unique_catalog("EQUITY", count, category=category)

                for entry in selected:
                    rows.append(
                        {
                            "asset_type": asset_type,
                            "equity_category": category,
                            "isin": generate_isin(n, entry["symbol"]),
                            "symbol": entry["symbol"],
                            "series": "EQ",
                            "name": entry["name"],
                            "description": f"Professional {category.lower()} equity security in the {entry['market']} market.",
                            "exchange": entry["exchange"],
                            "currency": entry["currency"],
                            "country": entry["country"],
                            "market": entry["market"],
                            "risk_level": "MEDIUM" if category != "SMALL_CAP" else "HIGH",
                            "status": "ACTIVE",
                            "gics_industry_code": entry.get("gics_industry_code", GICS_CATALOG[(n - 1) % len(GICS_CATALOG)][0]),
                            "base_price": 120.0 + (n % 230),
                        }
                    )
                    n += 1
            continue

        catalog = build_unique_catalog(asset_type, 1000)
        for entry in catalog:
            rows.append(
                {
                    "asset_type": asset_type,
                    "equity_category": None,
                    "isin": generate_isin(n, entry["symbol"]),
                    "symbol": entry["symbol"],
                    "series": {"MUTUAL": "MF", "COMMODITY": "COM", "BOND": "BOND", "CRYPTO": "CRY", "REIT": "REIT", "ETF": "ETF"}[asset_type],
                    "name": entry["name"],
                    "description": f"Professional {asset_type.lower()} instrument with real-world market identifiers and benchmark-aware pricing.",
                    "exchange": entry["exchange"],
                    "currency": entry["currency"],
                    "country": entry["country"],
                    "market": entry["market"],
                    "risk_level": {"MUTUAL": "MODERATE", "COMMODITY": "HIGH", "BOND": "LOW", "CRYPTO": "VERY_HIGH", "REIT": "MEDIUM", "ETF": "MEDIUM"}[asset_type],
                    "status": "ACTIVE",
                    "gics_industry_code": GICS_CATALOG[(n - 1) % len(GICS_CATALOG)][0],
                    "base_price": 120.0 + (n % 250),
                }
            )
            n += 1

    return rows


def insert_security_rows(conn, rows):
    with conn.cursor() as cur:
        for row in rows:
            cur.execute(
                """
                INSERT INTO security_details
                (asset_type, equity_category, isin, symbol, series, name, description, exchange, currency,
                 gics_industry_code, country, market, risk_level, status, created_at, updated_at)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW(),NOW())
                ON DUPLICATE KEY UPDATE
                  name = VALUES(name),
                  description = VALUES(description),
                  updated_at = NOW()
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


def fetch_security_map(conn):
    with conn.cursor(dictionary=True) as cur:
        cur.execute("SELECT security_id, symbol FROM security_details")
        return {row["symbol"]: row["security_id"] for row in cur.fetchall()}


def build_daily_price_rows(security_id, symbol, asset_type, base_price, trade_date_list):
    rows = []
    prev_close = base_price * (0.96 + ((sum(ord(ch) for ch in symbol) % 11) / 100.0))
    drift_seed = sum(ord(ch) for ch in symbol) % 31

    for index, day in enumerate(trade_date_list):
        if day.weekday() >= 5:
            continue
        seasonal = math.sin((index + drift_seed) / 5.4)
        cyclical = math.cos((index + drift_seed) / 13.7)
        swing = math.sin((index * 1.4 + drift_seed) / 2.8)

        if asset_type == "BOND":
            trend = 0.0002 + (drift_seed % 7) * 0.00006
            volatility = 0.0035
        elif asset_type == "COMMODITY":
            trend = 0.00055 + (drift_seed % 9) * 0.00010
            volatility = 0.008
        elif asset_type == "CRYPTO":
            trend = 0.00135 + (drift_seed % 10) * 0.00018
            volatility = 0.019
        elif asset_type == "EQUITY":
            trend = 0.0007 + (drift_seed % 9) * 0.00012
            volatility = 0.0105
        elif asset_type in ["ETF", "MUTUAL", "REIT"]:
            trend = 0.00045 + (drift_seed % 7) * 0.00009
            volatility = 0.0085
        else:
            trend = 0.0004
            volatility = 0.006

        daily_drift = trend + seasonal * volatility * 0.7 + cyclical * volatility * 0.5 + swing * volatility * 0.6
        if (index + drift_seed) % 42 == 0:
            daily_drift += 0.02
        if (index + drift_seed) % 53 == 0:
            daily_drift -= 0.018

        open_price = prev_close * (1 + daily_drift * 0.45)
        close_price = prev_close * (1 + daily_drift)
        high_price = max(open_price, close_price) * (1 + 0.012 + ((drift_seed + index) % 7) * 0.002)
        low_price = min(open_price, close_price) * (1 - 0.011 - ((drift_seed + index) % 5) * 0.002)
        last_price = close_price
        volume = int(18000 + (drift_seed * 117 + index * 39 + (len(symbol) * 73)) % 950000)

        if asset_type in ["MUTUAL", "ETF"]:
            nav = close_price
        else:
            nav = None

        if asset_type in ["COMMODITY", "CRYPTO"]:
            spot_price = close_price
        else:
            spot_price = None

        if asset_type in ["BOND", "REIT", "ETF", "EQUITY", "MUTUAL"]:
            valuation_price = close_price
        else:
            valuation_price = close_price

        rows.append(
            (
                security_id,
                day.isoformat(),
                round(open_price, 4),
                round(high_price, 4),
                round(low_price, 4),
                round(close_price, 4),
                round(prev_close, 4),
                round(last_price, 4),
                volume,
                round(nav, 4) if nav is not None else None,
                round(spot_price, 4) if spot_price is not None else None,
                round(valuation_price, 4),
            )
        )
        prev_close = close_price

    return rows


def insert_daily_prices(conn, rows):
    trade_dates = list(business_days(START, END))
    security_map = fetch_security_map(conn)
    batch = []
    with conn.cursor() as cur:
        for row in rows:
            security_id = security_map.get(row["symbol"])
            if security_id is None:
                continue
            batch.extend(build_daily_price_rows(security_id, row["symbol"], row["asset_type"], row["base_price"], trade_dates))
            if len(batch) >= 2000:
                cur.executemany(
                    """
                    INSERT INTO daily_prices
                    (security_id, trade_date, open_price, high_price, low_price, close_price, prev_close, last_price, volume, nav, spot_price, valuation_price)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    ON DUPLICATE KEY UPDATE
                      open_price = VALUES(open_price),
                      high_price = VALUES(high_price),
                      low_price = VALUES(low_price),
                      close_price = VALUES(close_price),
                      prev_close = VALUES(prev_close),
                      last_price = VALUES(last_price),
                      volume = VALUES(volume),
                      nav = VALUES(nav),
                      spot_price = VALUES(spot_price),
                      valuation_price = VALUES(valuation_price)
                    """,
                    batch,
                )
                batch = []

        if batch:
            cur.executemany(
                """
                INSERT INTO daily_prices
                (security_id, trade_date, open_price, high_price, low_price, close_price, prev_close, last_price, volume, nav, spot_price, valuation_price)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                ON DUPLICATE KEY UPDATE
                  open_price = VALUES(open_price),
                  high_price = VALUES(high_price),
                  low_price = VALUES(low_price),
                  close_price = VALUES(close_price),
                  prev_close = VALUES(prev_close),
                  last_price = VALUES(last_price),
                  volume = VALUES(volume),
                  nav = VALUES(nav),
                  spot_price = VALUES(spot_price),
                  valuation_price = VALUES(valuation_price)
                """,
                batch,
            )
    conn.commit()


def insert_benchmark_indices(conn):
    with conn.cursor() as cur:
        for config in BENCHMARK_CONFIG:
            cur.execute(
                """
                INSERT INTO benchmark_indices
                (index_code, index_name, symbol, exchange, country, currency, description, base_value, status, created_at, updated_at)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW(),NOW())
                ON DUPLICATE KEY UPDATE
                  index_name = VALUES(index_name),
                  symbol = VALUES(symbol),
                  updated_at = NOW()
                """,
                (
                    config["index_code"],
                    config["index_name"],
                    config["symbol"],
                    config["exchange"],
                    config["country"],
                    config["currency"],
                    f"Synthetic benchmark for {config['index_name']} drift analysis.",
                    config["base_value"],
                    config["status"],
                ),
            )
    conn.commit()


def fetch_benchmark_map(conn):
    with conn.cursor(dictionary=True) as cur:
        cur.execute("SELECT benchmark_id, index_code FROM benchmark_indices")
        return {row["index_code"]: row["benchmark_id"] for row in cur.fetchall()}


def build_benchmark_rows():
    rows = []
    for config in BENCHMARK_CONFIG:
        prev_close = float(config["base_value"])
        for day in business_days(START, END):
            seasonal = math.sin((day.timetuple().tm_yday + len(config["index_code"])) / 8.2)
            cyclical = math.cos((day.timetuple().tm_yday + len(config["index_code"])) / 17.4)
            drift = 0.0008 + seasonal * config["volatility"] * 0.75 + cyclical * config["volatility"] * 0.45
            if day.timetuple().tm_yday % 29 == 0:
                drift += 0.011
            if day.timetuple().tm_yday % 43 == 0:
                drift -= 0.009
            open_value = prev_close * (1 + drift * 0.35)
            close_value = prev_close * (1 + drift)
            high_value = max(open_value, close_value) * (1 + 0.008 + config["volatility"] * 0.7)
            low_value = min(open_value, close_value) * (1 - 0.008 - config["volatility"] * 0.6)
            change_value = close_value - prev_close
            change_percent = (change_value / prev_close) * 100
            volume = int(950000 + ((day.timetuple().tm_yday * 17) % 6500000))
            rows.append(
                (
                    config["index_code"],
                    day.isoformat(),
                    round(open_value, 4),
                    round(high_value, 4),
                    round(low_value, 4),
                    round(close_value, 4),
                    round(prev_close, 4),
                    round(change_value, 4),
                    round(change_percent, 6),
                    volume,
                )
            )
            prev_close = close_value
    return rows


def insert_benchmark_prices(conn):
    benchmark_map = fetch_benchmark_map(conn)
    benchmark_rows = build_benchmark_rows()
    batch = []
    with conn.cursor() as cur:
        for index_code, trade_date, open_value, high_value, low_value, close_value, prev_close, change_value, change_percent, volume in benchmark_rows:
            benchmark_id = benchmark_map.get(index_code)
            if benchmark_id is None:
                continue
            batch.append((benchmark_id, trade_date, open_value, high_value, low_value, close_value, prev_close, change_value, change_percent, volume))
            if len(batch) >= 2000:
                cur.executemany(
                    """
                    INSERT INTO benchmark_daily_prices
                    (benchmark_id, trade_date, open_value, high_value, low_value, close_value, prev_close, change_value, change_percent, volume, created_at)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW())
                    ON DUPLICATE KEY UPDATE
                      open_value = VALUES(open_value),
                      high_value = VALUES(high_value),
                      low_value = VALUES(low_value),
                      close_value = VALUES(close_value),
                      prev_close = VALUES(prev_close),
                      change_value = VALUES(change_value),
                      change_percent = VALUES(change_percent),
                      volume = VALUES(volume)
                    """,
                    batch,
                )
                batch = []

        if batch:
            cur.executemany(
                """
                INSERT INTO benchmark_daily_prices
                (benchmark_id, trade_date, open_value, high_value, low_value, close_value, prev_close, change_value, change_percent, volume, created_at)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW())
                ON DUPLICATE KEY UPDATE
                  open_value = VALUES(open_value),
                  high_value = VALUES(high_value),
                  low_value = VALUES(low_value),
                  close_value = VALUES(close_value),
                  prev_close = VALUES(prev_close),
                  change_value = VALUES(change_value),
                  change_percent = VALUES(change_percent),
                  volume = VALUES(volume)
                """,
                batch,
            )
    conn.commit()


def main():
    conn = mysql.connector.connect(**DB)
    try:
        clean_tables(conn)
        ensure_gics(conn)
        security_rows = build_security_rows()
        insert_security_rows(conn, security_rows)
        insert_daily_prices(conn, security_rows)
        insert_benchmark_indices(conn)
        insert_benchmark_prices(conn)

        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM security_details")
            total_securities = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM daily_prices")
            total_daily = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM benchmark_daily_prices")
            total_benchmark = cur.fetchone()[0]
            print(f"Total securities inserted: {total_securities}")
            print(f"Total daily price rows inserted: {total_daily}")
            print(f"Total benchmark daily rows inserted: {total_benchmark}")
            cur.execute("SELECT asset_type, COUNT(*) FROM security_details GROUP BY asset_type ORDER BY asset_type")
            print("Per-asset counts:")
            for asset_type, count in cur.fetchall():
                print(f"  {asset_type}: {count}")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
