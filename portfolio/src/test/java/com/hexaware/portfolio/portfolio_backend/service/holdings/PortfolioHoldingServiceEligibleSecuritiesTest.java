package com.hexaware.portfolio.portfolio_backend.service.holdings;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import org.junit.jupiter.api.Test;

import com.hexaware.portfolio.portfolio_backend.dto.EligibleSecurityResponse;
import com.hexaware.portfolio.portfolio_backend.entity.Portfolio;
import com.hexaware.portfolio.portfolio_backend.entity.enums.AssetClass;
import com.hexaware.portfolio.portfolio_backend.entity.enums.EquityCategory;
import com.hexaware.portfolio.portfolio_backend.entity.enums.InvestmentThemes;
import com.hexaware.portfolio.portfolio_backend.repository.PortfolioHoldingRepository;
import com.hexaware.portfolio.portfolio_backend.repository.PortfolioRepository;
import com.hexaware.portfolio.portfolio_backend.repository.PortfolioTradeRepository;
import com.hexaware.portfolio.portfolio_backend.repository.ThemeRepository;
import com.hexaware.portfolio.portfolio_backend.security.AppUser;
import com.hexaware.portfolio.portfolio_backend.security.CurrentUserService;
import com.hexaware.portfolio.security.entity.AssetType;
import com.hexaware.portfolio.security.entity.DailyPrice;
import com.hexaware.portfolio.security.entity.SecurityDetails;
import com.hexaware.portfolio.security.repository.DailyPriceRepository;
import com.hexaware.portfolio.security.repository.SecurityDetailsRepository;

class PortfolioHoldingServiceEligibleSecuritiesTest {

    @Test
    void getEligibleSecuritiesUsesBatchPriceLookup() {
        PortfolioRepository portfolios = mock(PortfolioRepository.class);
        PortfolioHoldingRepository holdings = mock(PortfolioHoldingRepository.class);
        PortfolioTradeRepository trades = mock(PortfolioTradeRepository.class);
        SecurityDetailsRepository securities = mock(SecurityDetailsRepository.class);
        DailyPriceRepository prices = mock(DailyPriceRepository.class);
        ThemeRepository themes = mock(ThemeRepository.class);
        CurrentUserService currentUser = mock(CurrentUserService.class);
        HoldingSecurityService securityService = mock(HoldingSecurityService.class);
        HoldingAllocationService allocationService = mock(HoldingAllocationService.class);

        Portfolio portfolio = Portfolio.builder()
                .id(12L)
                .owner(AppUser.builder().id(2L).username("investor").build())
                .amount(new BigDecimal("1000"))
                .theme(InvestmentThemes.CONSERVATIVE)
                .build();

        when(currentUser.getCurrentUser()).thenReturn(portfolio.getOwner());
        when(portfolios.findByIdAndOwnerUsername(12L, "investor")).thenReturn(Optional.of(portfolio));
        when(allocationService.allowedAssetClasses(portfolio)).thenReturn(Set.of(AssetClass.STOCKS));

        SecurityDetails security = mock(SecurityDetails.class);
        when(security.getSecurityId()).thenReturn(101L);
        when(security.getExchange()).thenReturn("NSE");
        when(security.getAssetType()).thenReturn(AssetType.EQUITY);
        when(security.getIsin()).thenReturn("ISIN-101");
        when(security.getSymbol()).thenReturn("AAA");
        when(security.getDescription()).thenReturn("AAA Ltd");
        when(security.getEquityCategory()).thenReturn(EquityCategory.LARGE_CAP);

        DailyPrice price = DailyPrice.builder()
                .securityId(101L)
                .tradeDate(LocalDate.of(2026, 1, 1))
                .closePrice(new BigDecimal("120.00"))
                .build();

        when(securities.findAllByAssetTypeIn(List.of(AssetType.EQUITY))).thenReturn(List.of(security));
        when(prices.findBySecurityIdInOrderBySecurityIdAscTradeDateDesc(List.of(101L))).thenReturn(List.of(price));
        when(securityService.assetClass(AssetType.EQUITY)).thenReturn(AssetClass.STOCKS);
        when(securityService.priceValue(price)).thenReturn(new BigDecimal("120.00"));

        PortfolioHoldingService service = new PortfolioHoldingService(
                portfolios, holdings, trades, securities, prices, themes, currentUser, securityService, allocationService);

        List<EligibleSecurityResponse> result = service.getEligibleSecurities(12L, LocalDate.of(2026, 1, 1));

        assertEquals(1, result.size());
        verify(prices).findBySecurityIdInOrderBySecurityIdAscTradeDateDesc(List.of(101L));
        verify(prices, never()).findTopBySecurityIdAndTradeDateLessThanEqualOrderByTradeDateDesc(anyLong(), any(LocalDate.class));
    }
}
