package com.hexaware.portfolio.portfolio_backend.service;

import java.util.Map;
import java.util.HashMap;

import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.hexaware.portfolio.portfolio_backend.entity.enums.EquityCategory;
import com.hexaware.portfolio.portfolio_backend.entity.PortfolioHolding;
import com.hexaware.portfolio.portfolio_backend.entity.PortfolioTrade;
import com.hexaware.portfolio.portfolio_backend.repository.PortfolioHoldingRepository;
import com.hexaware.portfolio.portfolio_backend.repository.PortfolioTradeRepository;
import com.hexaware.portfolio.security.entity.SecurityDetails;
import com.hexaware.portfolio.security.entity.AssetType;
import com.hexaware.portfolio.security.repository.SecurityDetailsRepository;

import lombok.RequiredArgsConstructor;

@Component
@ConditionalOnProperty(name = "app.seed.enabled", havingValue = "true", matchIfMissing = true)
@RequiredArgsConstructor
public class EquityCategorySeeder implements CommandLineRunner {
    private static final Map<String, EquityCategory> KNOWN_CATEGORIES = Map.of(
            "TCS", EquityCategory.LARGE_CAP,
            "HDFCBANK", EquityCategory.LARGE_CAP,
            "INFY", EquityCategory.LARGE_CAP,
            "ICICIBANK", EquityCategory.LARGE_CAP);

    private final SecurityDetailsRepository securities;
    private final PortfolioHoldingRepository holdings;
    private final PortfolioTradeRepository trades;

    @Override
    @Transactional
    public void run(String... args) {
        Map<Long, EquityCategory> categoriesBySecurity = new HashMap<>();
        securities.findAll().stream()
                .filter(security -> security.getAssetType() == AssetType.EQUITY)
                .filter(security -> security.getEquityCategory() == null)
                .filter(security -> KNOWN_CATEGORIES.containsKey(security.getSymbol()))
                .forEach(security -> security.setEquityCategory(KNOWN_CATEGORIES.get(security.getSymbol())));

        for (SecurityDetails security : securities.findAll()) {
            if (security.getEquityCategory() != null) categoriesBySecurity.put(security.getSecurityId(), security.getEquityCategory());
        }
        for (PortfolioHolding holding : holdings.findAll()) {
            EquityCategory category = categoriesBySecurity.get(holding.getSecurityId());
            if (holding.getEquityCategory() == null && category != null) holding.setEquityCategory(category);
        }
        for (PortfolioTrade trade : trades.findAll()) {
            EquityCategory category = categoriesBySecurity.get(trade.getSecurityId());
            if (trade.getEquityCategory() == null && category != null) trade.setEquityCategory(category);
        }
    }
}
