package com.hexaware.portfolio.security.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.hexaware.portfolio.security.entity.SecurityDetails;
import com.hexaware.portfolio.security.repository.DailyPriceRepository;
import com.hexaware.portfolio.security.repository.SecurityDetailsRepository;

class SecurityDetailsServiceTest {
    private SecurityDetailsRepository repository;
    private DailyPriceRepository dailyPriceRepository;
    private SecurityDetailsService service;

    @BeforeEach
    void setUp() {
        repository = mock(SecurityDetailsRepository.class);
        dailyPriceRepository = mock(DailyPriceRepository.class);
        service = new SecurityDetailsService(repository, dailyPriceRepository);
    }

    @Test
    void delegatesSecurityLookups() {
        SecurityDetails security = mock(SecurityDetails.class);
        when(repository.findByIsin("ISIN1")).thenReturn(Optional.of(security));
        when(repository.findBySymbol("ABC")).thenReturn(Optional.of(security));
        when(repository.findFirstBySymbolIgnoreCaseOrderBySecurityIdAsc("abc")).thenReturn(Optional.of(security));
        when(repository.findByExchangeIgnoreCaseAndIsinIgnoreCase("nse", "isin1"))
                .thenReturn(Optional.of(security));
        when(repository.findBySymbolAndSeries("ABC", "EQ")).thenReturn(Optional.of(security));

        assertEquals(Optional.of(security), service.getByIsin("ISIN1"));
        assertEquals(Optional.of(security), service.getBySymbol("ABC"));
        assertEquals(Optional.of(security), service.findFirstBySymbol("abc"));
        assertEquals(Optional.of(security), service.findByExchangeAndIsin("nse", "isin1"));
        assertEquals(Optional.of(security), service.getBySymbolAndSeries("ABC", "EQ"));
    }

    @Test
    void delegatesListAndSaveOperations() {
        SecurityDetails security = mock(SecurityDetails.class);
        List<SecurityDetails> rows = List.of(security);
        when(repository.findAll()).thenReturn(rows);
        when(repository.save(security)).thenReturn(security);
        when(repository.saveAll(rows)).thenReturn(rows);

        assertEquals(rows, service.findAll());
        assertEquals(security, service.save(security));
        assertEquals(rows, service.saveAll(rows));
        verify(repository).findAll();
    }
}