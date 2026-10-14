package com.hexaware.portfolio.portfolio_backend.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import com.hexaware.portfolio.portfolio_backend.entity.enums.AssetClass;
import com.hexaware.portfolio.portfolio_backend.entity.enums.EquityCategory;

public record PortfolioValuationResponse(
        LocalDate purchaseDate,
        LocalDate requestedDate,
        LocalDate effectiveDate,
        BigDecimal totalValue,
        BigDecimal totalGain,
        List<HoldingValuation> holdings,
        List<AllocationDrift> allocations,
        List<LocalDate> availableDates
) {
    public record HoldingValuation(
            Long securityId,
            String isin,
            String symbol,
            String securityName,
            AssetClass assetClass,
            EquityCategory equityCategory,
            BigDecimal shares,
            BigDecimal purchasePrice,
            BigDecimal currentPrice,
            LocalDate priceDate,
            BigDecimal value,
            BigDecimal gain
    ) {
    }

    public record AllocationDrift(
            AssetClass assetClass,
            BigDecimal targetPercentage,
            BigDecimal currentPercentage,
            BigDecimal driftPercentagePoints,
            boolean alert
    ) {
    }
}
