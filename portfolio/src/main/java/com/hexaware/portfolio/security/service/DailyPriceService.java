package com.hexaware.portfolio.security.service;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;

import com.hexaware.portfolio.security.entity.DailyPrice;
import com.hexaware.portfolio.security.repository.DailyPriceRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class DailyPriceService {

    private final DailyPriceRepository repo;

    public List<DailyPrice> getBySecurityId(Long securityId) {
        return repo.findBySecurityId(securityId);
    }

    public List<DailyPrice> getBySecurityIdRange(Long securityId, LocalDate from, LocalDate to) {
        return repo.findBySecurityIdAndTradeDateBetween(securityId, from, to);
    }

    public Optional<DailyPrice> getBySecurityIdAndTradeDate(Long securityId, LocalDate date) {
        return repo.findBySecurityIdAndTradeDate(securityId, date);
    }

    public Optional<LocalDate> lastLoadedDate(Long securityId) {
        return repo.findTopBySecurityIdOrderByTradeDateDesc(securityId)
                .map(DailyPrice::getTradeDate);
    }

    public boolean hasAny(Long securityId) {
        return repo.existsBySecurityId(securityId);
    }

    @CacheEvict(cacheNames = "latest-price", key = "#entity.securityId")
    public DailyPrice save(DailyPrice entity) {
        return repo.save(entity);
    }

    @CacheEvict(cacheNames = "latest-price", allEntries = true)
    public List<DailyPrice> saveAll(List<DailyPrice> rows) {
        return repo.saveAll(rows);
    }
}