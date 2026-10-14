package com.hexaware.portfolio.portfolio_backend.service.holdings;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import com.hexaware.portfolio.portfolio_backend.entity.PortfolioHolding;
import com.hexaware.portfolio.portfolio_backend.entity.PortfolioTrade;
import com.hexaware.portfolio.portfolio_backend.entity.enums.AssetClass;
import com.hexaware.portfolio.portfolio_backend.exceptions.PortfolioValidationException;
import com.hexaware.portfolio.portfolio_backend.exceptions.SecurityNotFoundException;
import com.hexaware.portfolio.security.entity.AssetType;
import com.hexaware.portfolio.security.entity.DailyPrice;
import com.hexaware.portfolio.security.entity.SecurityDetails;
import com.hexaware.portfolio.security.repository.DailyPriceRepository;
import com.hexaware.portfolio.security.repository.SecurityDetailsRepository;
import com.hexaware.portfolio.security.service.MarketPriceSupport;

@Service
public class HoldingSecurityService {
    private final SecurityDetailsRepository securities;
    private final DailyPriceRepository prices;

    public HoldingSecurityService(SecurityDetailsRepository securities, DailyPriceRepository prices) {
        this.securities = securities;
        this.prices = prices;
    }

    public SecurityDetails resolveHolding(PortfolioHolding holding) {
        if (holding.getSecurityId() != null) {
            return securities.findById(holding.getSecurityId())
                    .orElseThrow(() -> new SecurityNotFoundException(String.valueOf(holding.getSecurityId())));
        }
        return securities.findByIsin(holding.getIsin())
                .orElseThrow(() -> new SecurityNotFoundException(holding.getIsin()));
    }

    public SecurityDetails resolveTrade(PortfolioTrade trade) {
        if (trade.getSecurityId() != null) {
            return securities.findById(trade.getSecurityId())
                    .orElseThrow(() -> new SecurityNotFoundException(String.valueOf(trade.getSecurityId())));
        }
        return securities.findByIsin(trade.getIsin())
                .orElseThrow(() -> new SecurityNotFoundException(trade.getIsin()));
    }

    public boolean sameSecurity(PortfolioHolding holding, SecurityDetails security) {
        if (holding.getSecurityId() != null) return holding.getSecurityId().equals(security.getSecurityId());
        return Objects.equals(holding.getIsin(), security.getIsin())
                || Objects.equals(holding.getSymbol(), security.getSymbol());
    }

    public AssetClass assetClass(AssetType type) {
        return AssetClass.from(type);
    }

    @Cacheable(cacheNames = "latest-price", key = "#securityId", unless = "#result == null")
    public DailyPrice latestPrice(Long securityId) {
        return prices.findTopBySecurityIdOrderByTradeDateDesc(securityId).orElse(null);
    }

    @Cacheable(cacheNames = "latest-price", key = "#securityId + ':' + #date", unless = "#result == null")
    public DailyPrice priceOnOrBefore(Long securityId, LocalDate date) {
        if (securityId == null || date == null) {
            throw new PortfolioValidationException("Security id and date are required");
        }
        return prices.findTopBySecurityIdAndTradeDateLessThanEqualOrderByTradeDateDesc(securityId, date)
                .orElseThrow(() -> new PortfolioValidationException("No historical price is available on or before " + date));
    }

    public Map<Long, DailyPrice> latestPricesForSecurityIds(Collection<Long> securityIds, LocalDate asOfDate) {
        if (securityIds == null || securityIds.isEmpty()) {
            return Map.of();
        }
        Set<Long> requestedIds = new LinkedHashSet<>();
        for (Long securityId : securityIds) {
            if (securityId != null) {
                requestedIds.add(securityId);
            }
        }
        if (requestedIds.isEmpty()) {
            return Map.of();
        }
        List<DailyPrice> latestPrices = (asOfDate == null)
                ? prices.findLatestBySecurityIdIn(requestedIds)
                : prices.findLatestBySecurityIdInOnOrBeforeOptimized(requestedIds, asOfDate);
        return MarketPriceSupport.indexLatestPrices(latestPrices);
    }

    @CacheEvict(cacheNames = "latest-price", key = "#securityId")
    public void evictLatestPrice(Long securityId) {
        // no-op: cache eviction is handled by Spring AOP
    }

    public BigDecimal priceValue(DailyPrice price) {
        return MarketPriceSupport.priceValue(price);
    }

    public Long tradeSecurityId(PortfolioTrade trade) {
        return resolveTrade(trade).getSecurityId();
    }
}
