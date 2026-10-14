package com.hexaware.portfolio.benchmark.service;

import java.time.LocalDate;
import java.util.List;
import java.util.Locale;

import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.hexaware.portfolio.benchmark.dto.BenchmarkComparisonResponse;
import com.hexaware.portfolio.benchmark.dto.BenchmarkResponse;
import com.hexaware.portfolio.benchmark.entity.BenchmarkIndex;
import com.hexaware.portfolio.benchmark.repository.BenchmarkDailyPriceRepository;
import com.hexaware.portfolio.benchmark.repository.BenchmarkIndexRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class BenchmarkService {
    private final BenchmarkIndexRepository benchmarkIndexes;
    private final BenchmarkDailyPriceRepository dailyPrices;

    @Cacheable(cacheNames = "benchmark-list", key = "'all'")
    public List<BenchmarkResponse> getAllBenchmarks() {
        return benchmarkIndexes.findAllByOrderByBenchmarkIdAsc().stream()
                .map(BenchmarkResponse::from)
                .toList();
    }

    @Cacheable(cacheNames = "benchmark-detail", key = "#indexCode == null ? 'null' : #indexCode.trim().toUpperCase(T(java.util.Locale).ROOT)")
    public BenchmarkResponse getBenchmark(String indexCode) {
        return BenchmarkResponse.from(findBenchmark(indexCode));
    }

    @Cacheable(cacheNames = "benchmark-prices", key = "(#indexCode == null ? 'null' : #indexCode.trim().toUpperCase(T(java.util.Locale).ROOT)) + ':' + #from + ':' + #to")
    public BenchmarkComparisonResponse getPrices(String indexCode, LocalDate from, LocalDate to) {
        if (from == null || to == null || from.isAfter(to)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The from date must be on or before the to date");
        }
        var index = findBenchmark(indexCode);
        var prices = dailyPrices.findByBenchmarkIndex_BenchmarkIdAndTradeDateBetweenOrderByTradeDateAsc(
                index.getBenchmarkId(), from, to);
        return BenchmarkComparisonResponse.from(index, from, to, prices);
    }

    private BenchmarkIndex findBenchmark(String indexCode) {
        if (indexCode == null || indexCode.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Benchmark index code is required");
        }
        String normalizedCode = indexCode.trim().toUpperCase(Locale.ROOT);
        return benchmarkIndexes.findByIndexCode(normalizedCode)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Benchmark index not found: " + normalizedCode));
    }
}
