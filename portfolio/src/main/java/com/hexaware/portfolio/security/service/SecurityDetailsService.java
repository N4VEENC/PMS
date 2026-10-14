package com.hexaware.portfolio.security.service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import java.math.BigDecimal;
import java.time.LocalDate;

import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import com.hexaware.portfolio.security.dto.SecurityMasterResponse;
import com.hexaware.portfolio.security.dto.SecuritySearchResponse;
import com.hexaware.portfolio.security.entity.DailyPrice;
import com.hexaware.portfolio.security.entity.AssetType;
import com.hexaware.portfolio.security.entity.SecurityDetails;
import com.hexaware.portfolio.security.repository.DailyPriceRepository;
import com.hexaware.portfolio.security.repository.SecurityDetailsRepository;
import com.hexaware.portfolio.security.service.MarketPriceSupport;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class SecurityDetailsService {

    private final SecurityDetailsRepository repo;
    private final DailyPriceRepository dailyPrices;

    public Optional<SecurityDetails> getByIsin(String isin) {
        return repo.findByIsin(isin);
    }

    public Optional<SecurityDetails> getBySymbol(String symbol) {
        return repo.findBySymbol(symbol);
    }

    public Optional<SecurityDetails> findFirstBySymbol(String symbol) {
        return repo.findFirstBySymbolIgnoreCaseOrderBySecurityIdAsc(symbol);
    }

    public Optional<SecurityDetails> findByExchangeAndIsin(String exchange, String isin) {
        return repo.findByExchangeIgnoreCaseAndIsinIgnoreCase(exchange, isin);
    }

    public Optional<SecurityDetails> getBySymbolAndSeries(String symbol, String series) {
        return repo.findBySymbolAndSeries(symbol, series);
    }

    @Cacheable(cacheNames = "security-master", key = "'all'")
    public List<SecurityMasterResponse> getAllMasterResponses() {
        return repo.findAll().stream().map(SecurityMasterResponse::from).toList();
    }

    public List<SecurityDetails> findAll() {
        return repo.findAll();
    }

    public Page<SecurityDetails> findPage(Pageable pageable) {
        return repo.findAll(pageable);
    }

    public List<SecuritySearchResponse> searchMatching(String query, LocalDate asOfDate) {
        String clean = query == null ? "" : query.trim();
        if (clean.isEmpty()) {
            return List.of();
        }

        String searchTerm = clean.replace('_', ' ').trim();
        List<AssetType> assetTypes = switch (searchTerm.toLowerCase(java.util.Locale.ROOT)) {
            case "stock", "stocks", "equity", "equities" -> List.of(AssetType.EQUITY);
            case "commodity", "commodities" -> List.of(AssetType.COMMODITY);
            case "mutual fund", "mutual funds", "mutual", "funds" -> List.of(AssetType.MUTUAL);
            case "bond", "bonds", "fixed income" -> List.of(AssetType.BOND);
            case "etf", "etfs", "exchange traded fund", "exchange traded funds" -> List.of(AssetType.ETF);
            case "crypto", "cryptocurrency", "cryptocurrencies", "digital assets" -> List.of(AssetType.CRYPTO);
            case "reit", "reits", "real estate" -> List.of(AssetType.REIT);
            case "cash", "forex", "foreign exchange", "currency", "currencies" -> List.of(AssetType.CASH);
            default -> List.of();
        };
        List<SecurityDetails> matches = assetTypes.isEmpty()
                ? repo.searchMatching(searchTerm)
                : repo.findAllByAssetTypeIn(assetTypes);
        if (matches.isEmpty()) {
            return List.of();
        }

        List<Long> securityIds = matches.stream()
                .map(SecurityDetails::getSecurityId)
                .filter(java.util.Objects::nonNull)
                .toList();

        Map<Long, DailyPrice> latestBySecurityId = asOfDate == null
                ? MarketPriceSupport.indexLatestPrices(dailyPrices.findLatestBySecurityIdIn(securityIds))
                : MarketPriceSupport.indexLatestPrices(dailyPrices.findLatestBySecurityIdInOnOrBeforeOptimized(securityIds, asOfDate));

        return matches.stream()
                .map(security -> {
                    DailyPrice price = latestBySecurityId.get(security.getSecurityId());
                    BigDecimal currentPrice = price == null ? null : MarketPriceSupport.priceValue(price);
                    return SecuritySearchResponse.from(
                            security,
                            currentPrice,
                            price == null ? null : price.getTradeDate());
                })
                .toList();
    }

    @CacheEvict(cacheNames = "security-master", key = "'all'")
    public SecurityDetails save(SecurityDetails entity) {
        return repo.save(entity);
    }

    @CacheEvict(cacheNames = "security-master", key = "'all'")
    public List<SecurityDetails> saveAll(List<SecurityDetails> entities) {
        return repo.saveAll(entities);
    }
}
