package com.hexaware.portfolio.security.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

import com.hexaware.portfolio.portfolio_backend.entity.enums.AssetClass;
import com.hexaware.portfolio.portfolio_backend.entity.enums.EquityCategory;
import com.hexaware.portfolio.security.entity.SecurityDetails;

public record SecuritySearchResponse(
        Long securityId,
        String isin,
        String symbol,
        String series,
        String description,
        String exchange,
        String country,
        String currency,
        String name,
        AssetClass assetClass,
        EquityCategory equityCategory,
        String sector,
        String industry,
        String status,
        BigDecimal latestPrice,
        LocalDate priceDate) {

    public static SecuritySearchResponse from(SecurityDetails security, BigDecimal latestPrice, LocalDate priceDate) {
        String symbol = normalize(security.getSymbol(), "UNKNOWN");
        String name = normalize(security.getName(), "Unnamed security");
        String description = normalize(security.getDescription(), "No description available");
        String exchange = normalize(security.getExchange(), "UNKNOWN");
        String country = normalize(security.getCountry(), "UNKNOWN");
        String currency = normalize(security.getCurrency(), "USD");
        String status = normalize(security.getStatus(), "ACTIVE");
        String series = normalize(security.getSeries(), "-");
        String isin = normalize(security.getIsin(), "N/A");
        String sector = SecurityClassification.sector(security);
        String industry = SecurityClassification.industry(security);

        return new SecuritySearchResponse(
                security.getSecurityId(),
                isin,
                symbol,
                series,
                description,
                exchange,
                country,
                currency,
                name,
                AssetClass.from(security.getAssetType()),
                security.getEquityCategory(),
                sector,
                industry,
                status,
                latestPrice,
                priceDate);
    }

    private static String normalize(String value, String fallback) {
        if (value == null) {
            return fallback;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? fallback : trimmed;
    }
}
