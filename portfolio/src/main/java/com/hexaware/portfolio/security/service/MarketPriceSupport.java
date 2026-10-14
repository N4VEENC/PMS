package com.hexaware.portfolio.security.service;

import java.math.BigDecimal;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.Map;

import com.hexaware.portfolio.portfolio_backend.exceptions.PortfolioValidationException;
import com.hexaware.portfolio.security.entity.DailyPrice;

public final class MarketPriceSupport {

    private MarketPriceSupport() {
    }

    public static BigDecimal priceValue(DailyPrice price) {
        if (price == null) {
            throw new PortfolioValidationException("Historical price is missing or invalid");
        }

        BigDecimal[] candidates = {
                price.getValuationPrice(),
                price.getClosePrice(),
                price.getNav(),
                price.getSpotPrice(),
                price.getLastPrice()
        };

        for (BigDecimal candidate : candidates) {
            if (candidate != null && candidate.signum() > 0) {
                return candidate;
            }
        }

        throw new PortfolioValidationException("Historical price is missing or invalid");
    }

    public static Map<Long, DailyPrice> indexLatestPrices(Collection<DailyPrice> prices) {
        Map<Long, DailyPrice> latestBySecurityId = new LinkedHashMap<>();
        for (DailyPrice price : prices) {
            if (price == null || price.getSecurityId() == null) {
                continue;
            }
            latestBySecurityId.putIfAbsent(price.getSecurityId(), price);
        }
        return latestBySecurityId;
    }
}
