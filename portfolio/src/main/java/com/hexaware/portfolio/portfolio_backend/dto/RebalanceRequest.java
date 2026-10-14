package com.hexaware.portfolio.portfolio_backend.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record RebalanceRequest(
        LocalDate tradeDate,
        List<TradeOrder> trades
) {
    public record TradeOrder(
            Long securityId,
            String isin,
            BigDecimal signedShares
    ) {
    }
}
