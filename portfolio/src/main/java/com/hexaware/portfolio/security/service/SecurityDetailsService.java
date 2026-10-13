package com.hexaware.portfolio.security.service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import java.math.BigDecimal;

import org.springframework.cache.annotation.CacheEvict;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import com.hexaware.portfolio.security.dto.SecuritySearchResponse;
import com.hexaware.portfolio.security.entity.DailyPrice;
import com.hexaware.portfolio.security.entity.SecurityDetails;
import com.hexaware.portfolio.security.repository.DailyPriceRepository;
import com.hexaware.portfolio.security.repository.SecurityDetailsRepository;

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

    public List<SecurityDetails> findAll() {
        return repo.findAll();
    }

    public Page<SecurityDetails> findPage(Pageable pageable) {
        return repo.findAll(pageable);
    }

    public List<SecuritySearchResponse> searchMatching(String query) {
        String clean = query == null ? "" : query.trim();
        if (clean.isEmpty()) {
            return List.of();
        }

        List<SecurityDetails> matches = repo.searchMatching(clean, PageRequest.of(0, 25));
        if (matches.isEmpty()) {
            return List.of();
        }

        List<Long> securityIds = matches.stream()
                .map(SecurityDetails::getSecurityId)
                .filter(java.util.Objects::nonNull)
                .toList();

        Map<Long, DailyPrice> latestBySecurityId = new HashMap<>();
        for (DailyPrice price : dailyPrices.findBySecurityIdInOrderBySecurityIdAscTradeDateDesc(securityIds)) {
            if (price == null || price.getSecurityId() == null) {
                continue;
            }
            latestBySecurityId.putIfAbsent(price.getSecurityId(), price);
        }

        return matches.stream()
                .map(security -> {
                    DailyPrice price = latestBySecurityId.get(security.getSecurityId());
                    BigDecimal currentPrice = price == null ? null
                            : price.getValuationPrice() != null ? price.getValuationPrice()
                            : price.getClosePrice() != null ? price.getClosePrice()
                            : price.getNav() != null ? price.getNav()
                            : price.getSpotPrice() != null ? price.getSpotPrice()
                            : price.getLastPrice();
                    return SecuritySearchResponse.from(
                            security,
                            currentPrice,
                            price == null ? null : price.getTradeDate());
                })
                .toList();
    }

    @CacheEvict(cacheNames = "security-master", allEntries = true)
    public SecurityDetails save(SecurityDetails entity) {
        return repo.save(entity);
    }

    @CacheEvict(cacheNames = "security-master", allEntries = true)
    public List<SecurityDetails> saveAll(List<SecurityDetails> entities) {
        return repo.saveAll(entities);
    }
}