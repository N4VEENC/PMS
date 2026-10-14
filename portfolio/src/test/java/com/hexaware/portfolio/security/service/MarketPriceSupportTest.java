package com.hexaware.portfolio.security.service;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.math.BigDecimal;

import org.junit.jupiter.api.Test;

import com.hexaware.portfolio.security.entity.DailyPrice;

class MarketPriceSupportTest {

    @Test
    void priceValuePrefersValuationPriceAndFallsBackToAssetSpecificFields() {
        DailyPrice priced = DailyPrice.builder()
                .valuationPrice(new BigDecimal("101.25"))
                .closePrice(new BigDecimal("99.00"))
                .nav(new BigDecimal("98.50"))
                .spotPrice(new BigDecimal("97.75"))
                .lastPrice(new BigDecimal("96.50"))
                .build();

        assertEquals(new BigDecimal("101.25"), MarketPriceSupport.priceValue(priced));

        DailyPrice fallback = DailyPrice.builder()
                .closePrice(new BigDecimal("84.20"))
                .build();

        assertEquals(new BigDecimal("84.20"), MarketPriceSupport.priceValue(fallback));
    }
}
