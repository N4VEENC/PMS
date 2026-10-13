package com.hexaware.portfolio.security.controller;

import java.util.Comparator;
import java.util.List;

import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

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
    @Cacheable(cacheNames = "security-master", key = "#page + ':' + #pageSize")
    public SecurityMasterPageResponse list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int pageSize) {
        if (page < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Page must be zero or greater");
        }
        if (pageSize < 1 || pageSize > 200) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Page size must be between 1 and 200");
        }

        Pageable pageable = PageRequest.of(page, pageSize,
                Sort.by("exchange").ascending()
                        .and(Sort.by("symbol").ascending())
                        .and(Sort.by("securityId").ascending()));

        Page<SecurityDetails> securityPage = securities.findPage(pageable);
        List<SecurityMasterResponse> content = securityPage.getContent().stream()
                .map(SecurityMasterResponse::from)
                .sorted(Comparator.comparing((SecurityMasterResponse s) -> normalizeExchange(s.exchange()), String.CASE_INSENSITIVE_ORDER)
                        .thenComparing((SecurityMasterResponse s) -> normalizeText(s.symbol()), String.CASE_INSENSITIVE_ORDER)
                        .thenComparing((SecurityMasterResponse s) -> normalizeText(s.name()), String.CASE_INSENSITIVE_ORDER)
                        .thenComparing(SecurityMasterResponse::securityId, Comparator.nullsLast(Long::compareTo)))
                .toList();

        return new SecurityMasterPageResponse(
                content,
                securityPage.getTotalElements(),
                securityPage.getTotalPages(),
                securityPage.getNumber(),
                securityPage.getSize());
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
            @RequestParam String query) {
        if (query == null || query.isBlank()) {
            return List.of();
        }
        return securities.searchMatching(query);
    }

    private ResponseStatusException notFound(String message) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, message);
    }
}