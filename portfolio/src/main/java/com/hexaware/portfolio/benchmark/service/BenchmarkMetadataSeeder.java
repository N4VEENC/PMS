package com.hexaware.portfolio.benchmark.service;

import java.util.List;

import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import com.hexaware.portfolio.benchmark.entity.BenchmarkIndex;
import com.hexaware.portfolio.benchmark.repository.BenchmarkIndexRepository;

import lombok.RequiredArgsConstructor;

@Component
@ConditionalOnProperty(name = "app.seed.enabled", havingValue = "true", matchIfMissing = true)
@RequiredArgsConstructor
public class BenchmarkMetadataSeeder implements CommandLineRunner {
    private final BenchmarkIndexRepository benchmarkIndexes;

    @Override
    public void run(String... args) {
        for (BenchmarkIndex index : defaults()) {
            if (benchmarkIndexes.findByIndexCode(index.getIndexCode()).isEmpty()) {
                benchmarkIndexes.save(index);
            }
        }
    }

    private List<BenchmarkIndex> defaults() {
        return List.of(
                index("SP500", "S&P 500", "^GSPC", "NYSE / NASDAQ", "USA", "USD",
                        "Tracks 500 leading publicly traded companies in the United States."),
                index("NASDAQ100", "NASDAQ-100", "^NDX", "NASDAQ", "USA", "USD",
                        "Tracks 100 of the largest non-financial companies listed on Nasdaq."),
                index("NIFTY50", "NIFTY 50", "^NSEI", "NSE", "India", "INR",
                        "Tracks 50 large companies listed on the National Stock Exchange of India."),
                index("SENSEX", "BSE Sensex", "^BSESN", "BSE", "India", "INR",
                        "Tracks 30 large and actively traded companies listed on BSE."),
                index("FTSE100", "FTSE 100", "^FTSE", "LSE", "UK", "GBP",
                        "Tracks 100 large companies listed on the London Stock Exchange."),
                index("DAX", "DAX", "^GDAXI", "XETRA", "Germany", "EUR",
                        "Tracks major companies listed on the Frankfurt Stock Exchange."));
    }

    private BenchmarkIndex index(String code, String name, String symbol, String exchange, String country,
            String currency, String description) {
        BenchmarkIndex index = new BenchmarkIndex();
        index.setIndexCode(code);
        index.setIndexName(name);
        index.setSymbol(symbol);
        index.setExchange(exchange);
        index.setCountry(country);
        index.setCurrency(currency);
        index.setDescription(description);
        index.setStatus("ACTIVE");
        return index;
    }
}
