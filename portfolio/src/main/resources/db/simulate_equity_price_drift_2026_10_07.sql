USE portfolio_db;

START TRANSACTION;

UPDATE daily_prices dp
JOIN security_details s ON s.security_id = dp.security_id
SET dp.open_price = ROUND(dp.open_price * 1.10, 6),
    dp.high_price = ROUND(dp.high_price * 1.10, 6),
    dp.low_price = ROUND(dp.low_price * 1.10, 6),
    dp.close_price = ROUND(dp.close_price * 1.10, 6),
    dp.last_price = ROUND(dp.last_price * 1.10, 6),
    dp.nav = ROUND(dp.nav * 1.10, 6),
    dp.spot_price = ROUND(dp.spot_price * 1.10, 6),
    dp.valuation_price = ROUND(dp.valuation_price * 1.10, 6)
WHERE dp.trade_date = '2026-10-07'
  AND s.asset_type = 'EQUITY'
  AND (
      EXISTS (
          SELECT 1
          FROM portfolio_holdings h
          WHERE h.security_id = dp.security_id
            AND h.shares > 0
      )
      OR EXISTS (
          SELECT 1
          FROM portfolio_trades t
          WHERE t.security_id = dp.security_id
            AND t.trade_date <= dp.trade_date
          GROUP BY t.portfolio_id
          HAVING SUM(t.signed_shares) > 0
      )
  );

SELECT ROW_COUNT() AS updated_equity_price_rows;

COMMIT;
