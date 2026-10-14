# Portfolio vs. Benchmark Chart

## What the chart compares

The chart compares the portfolio's historical value with the selected market
index. It does not compare a portfolio database column directly with the index
close:

- **Portfolio series:** the `totalValue` calculated for each requested date by
  the portfolio valuation service. The service reconstructs the shares held
  from trades up to that date, finds each security's latest available price on
  or before that date, and adds the remaining cash balance.
- **Benchmark series:** the selected index's daily `close_value` rows from
  `benchmark_daily_prices`.
- **Scale:** the frontend rebases both series to 100 at the first aligned
  observation. The plotted values therefore show relative movement, not rupees
  versus index points.

The portfolio can contain any asset classes represented in its trades; the
valuation is not restricted to equities. A market price is used for each
security position. Residual cash is calculated as the configured portfolio
amount minus current holdings value, floored at zero. Consequently, while
holdings remain below the configured amount, total value can remain at that
amount. This behavior can flatten the portfolio line and is distinct from
benchmark-price behavior.

## Data sources

| Chart data | Source | Notes |
| --- | --- | --- |
| Benchmark identity and label | `benchmark_indices` | Includes index code, display name, symbol, exchange, country, and currency. |
| Benchmark history | `benchmark_daily_prices.close_value` | One daily index close per available trading date. |
| Portfolio positions | `portfolio_trades` | Signed shares are summed by security through each valuation date. |
| Security prices | `daily_prices` | The last price on or before each valuation date is used. The service selects the first available field in this order: valuation price, close price, NAV, spot price, last price. |
| Residual cash | Portfolio amount and calculated holdings value | `max(portfolio amount - holdings value, 0)`. |

The repository contains generated demo histories, including
[`benchmark_2_years_sql.sql`](../../resources/benchmark_2_years_sql.sql) and
[`portfolio_all_assets_2_years_volatile.sql`](../../resources/portfolio_all_assets_2_years_volatile.sql).
These are synthetic data, not verified live market history.

The optional mock-price script has been removed. To remove its former baseline
table from an existing database, run
[`drop_portfolio_chart_mock_price_baseline.sql`](../../resources/db/drop_portfolio_chart_mock_price_baseline.sql).

## Chart loading flow

1. The dashboard's initial portfolio valuation provides the purchase date,
   effective date, and available portfolio price dates.
2. The frontend chooses the last available portfolio price date in each month,
   includes the purchase month, and keeps at most 25 monthly dates.
3. In parallel, it requests benchmark prices for the selected index and
   requests all portfolio valuations in one HTTP call:
   `POST /api/portfolios/{portfolioId}/holdings/valuation/history`
   with body:

   ```json
   {
     "dates": ["2026-01-30", "2026-02-27", "2026-03-31"]
   }
   ```

4. The backend validates that the request contains 1–25 non-null dates, loads
   the portfolio's trade history and each traded security's price history once
   for the request, then calculates a valuation for each date from those
   in-memory histories.
5. The frontend keeps the last benchmark close in each calendar month, matches
   the portfolio and benchmark observations by `YYYY-MM`, and rebases the
   aligned series to 100.

The bulk valuation endpoint replaces the previous pattern of making one
portfolio HTTP request per month. The work for each date is still calculated
separately in the backend, and histories are queried once per distinct traded
security; actual latency depends on the number of held securities, database
performance, and network conditions. The change reduces request round trips,
but does not guarantee a response time below two seconds.

## API and implementation locations

- Benchmark list and price endpoints: `BenchmarkService`
- Benchmark index and daily-price entities: `BenchmarkIndex`,
  `BenchmarkDailyPrice`
- Single and bulk portfolio valuation endpoints:
  `PortfolioHoldingController`
- Trade/price history loading and historical valuation calculations:
  `PortfolioHoldingService`
- Bulk request body: `PortfolioValuationHistoryRequest`
- Frontend API calls: `frontend/src/api/client.js`
- Date selection, parallel requests, and monthly chart series:
  `frontend/src/hooks/useBenchmarkPerformance.js`
- Monthly close selection, alignment, and rebasing:
  `frontend/src/lib/performance.js`

## Interpreting movements

Both lines can rise or fall when the selected month range contains changing
prices. A line that appears almost flat may have smaller relative movement
than the other line; both share one chart scale. Synthetic portfolio price
changes can also make its movements unusually large or small. Do not interpret
mock data as actual investment performance.
