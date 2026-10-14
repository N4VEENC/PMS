package com.hexaware.portfolio.security.dto;

import java.util.Locale;

import com.hexaware.portfolio.security.entity.AssetType;
import com.hexaware.portfolio.security.entity.SecurityDetails;

/** Display classifications for the security master, including asset types without GICS data. */
public final class SecurityClassification {
    private SecurityClassification() {}

    public static String sector(SecurityDetails security) {
        if (hasGicsClassification(security) && hasText(security.getGicsIndustry().getSectorName())) {
            return security.getGicsIndustry().getSectorName().trim();
        }
        return switch (security.getAssetType()) {
            case EQUITY -> "Equities";
            case MUTUAL -> "Mutual Funds";
            case COMMODITY -> "Commodities";
            case BOND -> "Fixed Income";
            case CRYPTO -> "Digital Assets";
            case REIT -> "Real Estate";
            case ETF -> "Exchange Traded Funds";
            case CASH -> "Cash and Foreign Exchange";
        };
    }

    public static String industry(SecurityDetails security) {
        if (hasGicsClassification(security) && hasText(security.getGicsIndustry().getIndustryName())) {
            return security.getGicsIndustry().getIndustryName().trim();
        }
        AssetType type = security.getAssetType();
        if (type == AssetType.EQUITY && security.getEquityCategory() != null) {
            return title(security.getEquityCategory().name()) + " Equities";
        }
        String market = security.getMarket();
        if (hasText(market)) return market.trim();
        return switch (type) {
            case EQUITY -> "Other Equities";
            case MUTUAL -> "Other Mutual Funds";
            case COMMODITY -> "Other Commodities";
            case BOND -> "Other Fixed Income";
            case CRYPTO -> "Other Digital Assets";
            case REIT -> "Other Real Estate";
            case ETF -> "Other Exchange Traded Funds";
            case CASH -> "Other Cash and Foreign Exchange";
        };
    }

    private static boolean hasText(String value) { return value != null && !value.isBlank(); }

    private static boolean hasGicsClassification(SecurityDetails security) {
        return security.getGicsIndustry() != null
                && !"000000".equals(security.getGicsIndustry().getIndustryCode())
                && hasText(security.getGicsIndustry().getSectorName())
                && hasText(security.getGicsIndustry().getIndustryName())
                && !"unclassified".equalsIgnoreCase(security.getGicsIndustry().getIndustryName().trim());
    }

    private static String title(String value) {
        String[] words = value.toLowerCase(Locale.ROOT).split("_");
        for (int i = 0; i < words.length; i++) words[i] = Character.toUpperCase(words[i].charAt(0)) + words[i].substring(1);
        return String.join(" ", words);
    }
}
