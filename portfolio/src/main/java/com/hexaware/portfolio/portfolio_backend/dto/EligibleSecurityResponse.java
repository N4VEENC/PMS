package com.hexaware.portfolio.portfolio_backend.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

import com.hexaware.portfolio.portfolio_backend.entity.enums.AssetClass;

public record EligibleSecurityResponse(
        Long securityId,
        String isin,
        String symbol,
        String name,
        AssetClass assetClass,
        BigDecimal latestPrice,
        LocalDate priceDate
) {
}
