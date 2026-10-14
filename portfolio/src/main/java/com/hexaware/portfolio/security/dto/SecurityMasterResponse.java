package com.hexaware.portfolio.security.dto;

import com.hexaware.portfolio.security.entity.SecurityDetails;
import com.hexaware.portfolio.portfolio_backend.entity.enums.AssetClass;
import com.hexaware.portfolio.portfolio_backend.entity.enums.EquityCategory;

public record SecurityMasterResponse(
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
        String status) {

    public static SecurityMasterResponse from(SecurityDetails security) {
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

        return new SecurityMasterResponse(
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
                status);
    }

    private static String normalize(String value, String fallback) {
        if (value == null) {
            return fallback;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? fallback : trimmed;
    }
}
