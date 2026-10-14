package com.hexaware.portfolio.security.controller;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.TreeSet;
import java.time.LocalDate;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.hexaware.portfolio.portfolio_backend.entity.enums.AssetClass;
import com.hexaware.portfolio.security.dto.SecurityMasterPageResponse;
import com.hexaware.portfolio.security.dto.SecurityMasterResponse;
import com.hexaware.portfolio.security.entity.SecurityDetails;
import com.hexaware.portfolio.security.service.SecurityDetailsService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/securities")
@RequiredArgsConstructor
public class SecurityMasterController {
    private final SecurityDetailsService securities;

    @GetMapping
    public SecurityMasterPageResponse list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int pageSize,
            @RequestParam(required = false) String exchange,
            @RequestParam(required = false) String isin,
            @RequestParam(required = false) String assetClass,
            @RequestParam(required = false) String sector,
            @RequestParam(required = false) String industry) {
        if (page < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Page must be zero or greater");
        }
        if (pageSize < 1 || pageSize > 200) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Page size must be between 1 and 200");
        }

        List<SecurityMasterResponse> filtered = securities.getAllMasterResponses()
                .stream()
                .filter(s -> containsIgnoreCase(s.exchange(), exchange))
                .filter(s -> containsIgnoreCase(s.isin(), isin))
                .filter(s -> assetClassMatches(s.assetClass(), assetClass))
                .filter(s -> equalsIgnoreCase(s.sector(), sector))
                .filter(s -> equalsIgnoreCase(s.industry(), industry))
                .sorted(Comparator.comparing((SecurityMasterResponse s) -> normalizeExchange(s.exchange()), String.CASE_INSENSITIVE_ORDER)
                        .thenComparing((SecurityMasterResponse s) -> normalizeText(s.symbol()), String.CASE_INSENSITIVE_ORDER)
                        .thenComparing((SecurityMasterResponse s) -> normalizeText(s.name()), String.CASE_INSENSITIVE_ORDER)
                        .thenComparing(SecurityMasterResponse::securityId, Comparator.nullsLast(Long::compareTo)))
                .toList();

        long total = filtered.size();
        int totalPages = (int) Math.ceil((double) total / pageSize);
        int from = Math.min(page * pageSize, filtered.size());
        int to = Math.min(from + pageSize, filtered.size());
        List<SecurityMasterResponse> content = filtered.subList(from, to);

        return new SecurityMasterPageResponse(
                content,
                total,
                totalPages,
                page,
                pageSize);
    }

    @GetMapping("/filter-options")
    public Map<String, List<String>> filterOptions() {
        List<SecurityMasterResponse> all = securities.findAll().stream().map(SecurityMasterResponse::from).toList();
        java.util.Set<String> assetClasses = new TreeSet<>();
        java.util.Arrays.stream(AssetClass.values()).map(Enum::name).forEach(assetClasses::add);
        all.stream().map(SecurityMasterResponse::assetClass).filter(v -> v != null).map(Enum::name).forEach(assetClasses::add);

        return Map.of(
                "exchanges", all.stream().map(SecurityMasterResponse::exchange).filter(v -> v != null && !v.isBlank()).collect(java.util.stream.Collectors.toCollection(TreeSet::new)).stream().toList(),
                "assetClasses", assetClasses.stream().toList(),
                "sectors", all.stream().map(SecurityMasterResponse::sector).filter(v -> v != null && !v.isBlank()).collect(java.util.stream.Collectors.toCollection(TreeSet::new)).stream().toList(),
                "industries", all.stream().map(SecurityMasterResponse::industry).filter(v -> v != null && !v.isBlank()).collect(java.util.stream.Collectors.toCollection(TreeSet::new)).stream().toList());
    }

    private String normalizeExchange(String exchange) {
        if (exchange == null || exchange.isBlank()) {
            return "ZZZ";
        }
        return exchange.trim();
    }

    private String normalizeText(String value) {
        if (value == null) {
            return "";
        }
        return value.trim();
    }

    private boolean containsIgnoreCase(String value, String filter) {
        return filter == null || filter.isBlank() || (value != null && value.toLowerCase().contains(filter.trim().toLowerCase()));
    }

    private boolean equalsIgnoreCase(String value, String filter) {
        return filter == null || filter.isBlank() || (value != null && value.equalsIgnoreCase(filter.trim()));
    }

    private boolean assetClassMatches(AssetClass value, String filter) {
        if (filter == null || filter.isBlank()) {
            return true;
        }
        if (value == null) {
            return false;
        }
        String normalizedFilter = normalizeAssetClassValue(filter);
        return normalizeAssetClassValue(value.name()).equals(normalizedFilter)
                || normalizeAssetClassValue(value.name().replace("_", " ")).equals(normalizedFilter);
    }

    private String normalizeAssetClassValue(String value) {
        if (value == null) {
            return "";
        }
        return value.trim().replace('-', '_').replace(' ', '_').toUpperCase();
    }

    @GetMapping("/search")
    public SecurityMasterResponse search(
            @RequestParam(required = false) String symbol,
            @RequestParam(required = false) String exchange,
            @RequestParam(required = false) String isin) {
        boolean hasSymbol = symbol != null && !symbol.isBlank();
        boolean hasExchange = exchange != null && !exchange.isBlank();
        boolean hasIsin = isin != null && !isin.isBlank();

        if (hasSymbol && !hasExchange && !hasIsin) {
            return securities.findFirstBySymbol(symbol.trim())
                    .map(SecurityMasterResponse::from)
                    .orElseThrow(() -> notFound("No security found for symbol " + symbol.trim()));
        }
        if (!hasSymbol && hasExchange && hasIsin) {
            return securities.findByExchangeAndIsin(exchange.trim(), isin.trim())
                    .map(SecurityMasterResponse::from)
                    .orElseThrow(() -> notFound("No security found for exchange and ISIN"));
        }

        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Search using either symbol, or both exchange and ISIN");
    }

    @GetMapping("/match")
    public List<com.hexaware.portfolio.security.dto.SecuritySearchResponse> match(
            @RequestParam String query,
            @RequestParam(required = false) LocalDate date) {
        if (query == null || query.isBlank()) {
            return List.of();
        }
        return securities.searchMatching(query, date);
    }

    private ResponseStatusException notFound(String message) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, message);
    }
}
