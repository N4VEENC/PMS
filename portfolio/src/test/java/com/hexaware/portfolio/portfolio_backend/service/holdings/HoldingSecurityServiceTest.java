package com.hexaware.portfolio.portfolio_backend.service.holdings;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.lang.reflect.Method;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.hexaware.portfolio.portfolio_backend.entity.PortfolioHolding;
import com.hexaware.portfolio.portfolio_backend.entity.PortfolioTrade;
import com.hexaware.portfolio.portfolio_backend.entity.enums.AssetClass;
import com.hexaware.portfolio.portfolio_backend.exceptions.PortfolioValidationException;
import com.hexaware.portfolio.portfolio_backend.exceptions.SecurityNotFoundException;
import com.hexaware.portfolio.portfolio_backend.repository.PortfolioHoldingRepository;
import com.hexaware.portfolio.portfolio_backend.repository.PortfolioRepository;
import com.hexaware.portfolio.portfolio_backend.repository.PortfolioTradeRepository;
import com.hexaware.portfolio.portfolio_backend.repository.ThemeRepository;
import com.hexaware.portfolio.portfolio_backend.security.CurrentUserService;
import com.hexaware.portfolio.portfolio_backend.service.holdings.HoldingAllocationService;
import com.hexaware.portfolio.security.entity.AssetType;
import com.hexaware.portfolio.security.entity.DailyPrice;
import com.hexaware.portfolio.security.entity.SecurityDetails;
import com.hexaware.portfolio.security.repository.DailyPriceRepository;
import com.hexaware.portfolio.security.repository.SecurityDetailsRepository;

class HoldingSecurityServiceTest {
    private SecurityDetailsRepository securities;
    private DailyPriceRepository prices;
    private HoldingSecurityService service;

    @BeforeEach
    void setUp() {
        securities = mock(SecurityDetailsRepository.class);
        prices = mock(DailyPriceRepository.class);
        service = new HoldingSecurityService(securities, prices);
    }

    @Test
    void resolvesHoldingByIdOrFallsBackToIsin() {
        SecurityDetails byId = mock(SecurityDetails.class);
        SecurityDetails byIsin = mock(SecurityDetails.class);
        when(securities.findById(1L)).thenReturn(Optional.of(byId));
        when(securities.findByIsin("ISIN2")).thenReturn(Optional.of(byIsin));

        assertEquals(byId, service.resolveHolding(PortfolioHolding.builder().securityId(1L).isin("ignored").build()));
        assertEquals(byIsin, service.resolveHolding(PortfolioHolding.builder().isin("ISIN2").build()));
    }

    @Test
    void resolvesTradeByIdOrFallsBackToIsin() {
        SecurityDetails byId = mock(SecurityDetails.class);
        SecurityDetails byIsin = mock(SecurityDetails.class);
        when(securities.findById(3L)).thenReturn(Optional.of(byId));
        when(securities.findByIsin("ISIN4")).thenReturn(Optional.of(byIsin));

        assertEquals(byId, service.resolveTrade(PortfolioTrade.builder().securityId(3L).build()));
        assertEquals(byIsin, service.resolveTrade(PortfolioTrade.builder().isin("ISIN4").build()));
    }

    @Test
    void missingSecurityThrowsDomainException() {
        when(securities.findById(5L)).thenReturn(Optional.empty());
        when(securities.findByIsin("UNKNOWN")).thenReturn(Optional.empty());

        assertThrows(SecurityNotFoundException.class,
                () -> service.resolveHolding(PortfolioHolding.builder().securityId(5L).build()));
        assertThrows(SecurityNotFoundException.class,
                () -> service.resolveTrade(PortfolioTrade.builder().isin("UNKNOWN").build()));
    }

    @Test
    void comparesSecurityIdsAndLegacyIsinOrSymbol() {
        SecurityDetails security = mock(SecurityDetails.class);
        when(security.getSecurityId()).thenReturn(9L);
        when(security.getIsin()).thenReturn("ISIN9");
        when(security.getSymbol()).thenReturn("ABC");

        assertTrue(service.sameSecurity(PortfolioHolding.builder().securityId(9L).build(), security));
        assertTrue(service.sameSecurity(PortfolioHolding.builder().isin("ISIN9").build(), security));
        assertTrue(service.sameSecurity(PortfolioHolding.builder().symbol("ABC").build(), security));
        assertFalse(service.sameSecurity(PortfolioHolding.builder().isin("OTHER").symbol("OTHER").build(), security));
    }

    @Test
    void mapsAllSupportedAssetTypes() {
        assertEquals(AssetClass.STOCKS, service.assetClass(AssetType.EQUITY));
        assertEquals(AssetClass.MUTUAL_FUNDS, service.assetClass(AssetType.MUTUAL));
        assertEquals(AssetClass.COMMODITIES, service.assetClass(AssetType.COMMODITY));
        assertEquals(AssetClass.BONDS, service.assetClass(AssetType.BOND));
        assertEquals(AssetClass.CRYPTO, service.assetClass(AssetType.CRYPTO));
        assertEquals(AssetClass.REITS, service.assetClass(AssetType.REIT));
        assertEquals(AssetClass.ETFS, service.assetClass(AssetType.ETF));
        assertEquals(AssetClass.CASH, service.assetClass(AssetType.CASH));
    }

    @Test
    void readsLatestAndHistoricalPrices() {
        LocalDate date = LocalDate.of(2025, 4, 1);
        DailyPrice latest = mock(DailyPrice.class);
        DailyPrice historical = mock(DailyPrice.class);
        when(prices.findTopBySecurityIdOrderByTradeDateDesc(2L)).thenReturn(Optional.of(latest));
        when(prices.findTopBySecurityIdAndTradeDateLessThanEqualOrderByTradeDateDesc(2L, date))
                .thenReturn(Optional.of(historical));

        assertEquals(latest, service.latestPrice(2L));
        assertEquals(historical, service.priceOnOrBefore(2L, date));
        verify(prices).findTopBySecurityIdOrderByTradeDateDesc(2L);
    }

    @Test
    void batchPriceLookupKeepsNewestPriceOnOrBeforeCutoff() throws Exception {
        LocalDate cutoff = LocalDate.of(2026, 2, 15);
        DailyPrice p1New = new DailyPrice();
        p1New.setSecurityId(1L);
        p1New.setTradeDate(LocalDate.of(2026, 2, 14));
        DailyPrice p1Old = new DailyPrice();
        p1Old.setSecurityId(1L);
        p1Old.setTradeDate(LocalDate.of(2026, 1, 5));
        DailyPrice p2New = new DailyPrice();
        p2New.setSecurityId(2L);
        p2New.setTradeDate(LocalDate.of(2026, 2, 13));
        DailyPrice p2Old = new DailyPrice();
        p2Old.setSecurityId(2L);
        p2Old.setTradeDate(LocalDate.of(2026, 1, 10));

        when(prices.findLatestBySecurityIdInOnOrBefore(Set.of(1L, 2L), cutoff))
                .thenReturn(List.of(p1New, p2New));

        PortfolioRepository portfolios = mock(PortfolioRepository.class);
        PortfolioHoldingRepository holdings = mock(PortfolioHoldingRepository.class);
        PortfolioTradeRepository trades = mock(PortfolioTradeRepository.class);
        ThemeRepository themes = mock(ThemeRepository.class);
        CurrentUserService currentUser = mock(CurrentUserService.class);
        HoldingAllocationService allocationService = mock(HoldingAllocationService.class);

        PortfolioHoldingService portfolioService = new PortfolioHoldingService(
                portfolios, holdings, trades, securities, prices, themes, currentUser,
                service, allocationService);

        Method method = PortfolioHoldingService.class.getDeclaredMethod("loadPricesOnOrBefore", java.util.Collection.class, LocalDate.class);
        method.setAccessible(true);

        @SuppressWarnings("unchecked")
        Map<Long, DailyPrice> pricesOnOrBefore = (Map<Long, DailyPrice>) method.invoke(
                portfolioService, Set.of(1L, 2L), cutoff);

        verify(prices).findLatestBySecurityIdInOnOrBefore(Set.of(1L, 2L), cutoff);
        assertEquals(LocalDate.of(2026, 2, 14), pricesOnOrBefore.get(1L).getTradeDate());
        assertEquals(LocalDate.of(2026, 2, 13), pricesOnOrBefore.get(2L).getTradeDate());
        assertEquals(2, pricesOnOrBefore.size());
    }

    @Test
    void sharedBulkPriceLookupReusesTheSameLatestPriceCacheKeying() {
        LocalDate cutoff = LocalDate.of(2026, 2, 15);
        DailyPrice p1 = new DailyPrice();
        p1.setSecurityId(1L);
        p1.setTradeDate(LocalDate.of(2026, 2, 14));
        DailyPrice p2 = new DailyPrice();
        p2.setSecurityId(2L);
        p2.setTradeDate(LocalDate.of(2026, 2, 13));

        when(prices.findLatestBySecurityIdInOnOrBefore(Set.of(1L, 2L), cutoff)).thenReturn(List.of(p1, p2));

        Map<Long, DailyPrice> bySecurity = service.latestPricesForSecurityIds(Set.of(1L, 2L), cutoff);

        assertEquals(LocalDate.of(2026, 2, 14), bySecurity.get(1L).getTradeDate());
        assertEquals(LocalDate.of(2026, 2, 13), bySecurity.get(2L).getTradeDate());
        assertEquals(2, bySecurity.size());
    }

    @Test
    void priceValueUsesFirstPositiveCandidateAndRejectsMissingPrices() {
        DailyPrice fallback = mock(DailyPrice.class);
        when(fallback.getValuationPrice()).thenReturn(BigDecimal.ZERO);
        when(fallback.getClosePrice()).thenReturn(null);
        when(fallback.getNav()).thenReturn(new BigDecimal("12.75"));
        assertEquals(new BigDecimal("12.75"), service.priceValue(fallback));

        DailyPrice invalid = mock(DailyPrice.class);
        assertThrows(PortfolioValidationException.class, () -> service.priceValue(invalid));
        assertThrows(PortfolioValidationException.class, () -> service.priceValue(null));
    }
}