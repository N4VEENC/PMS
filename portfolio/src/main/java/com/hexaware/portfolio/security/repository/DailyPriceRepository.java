package com.hexaware.portfolio.security.repository;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.hexaware.portfolio.security.entity.DailyPrice;


public interface DailyPriceRepository extends JpaRepository<DailyPrice, Long> {

    List<DailyPrice> findBySecurityId(Long securityId);

    List<DailyPrice> findBySecurityIdIn(Collection<Long> securityIds);

    List<DailyPrice> findBySecurityIdInOrderBySecurityIdAscTradeDateDesc(Collection<Long> securityIds);

    List<DailyPrice> findBySecurityIdAndTradeDateBetween(Long securityId, LocalDate from, LocalDate to);

    Optional<DailyPrice> findBySecurityIdAndTradeDate(Long securityId, LocalDate date);

    Optional<DailyPrice> findTopBySecurityIdOrderByTradeDateDesc(Long securityId);

    Optional<DailyPrice> findTopBySecurityIdAndTradeDateLessThanEqualOrderByTradeDateDesc(Long securityId, LocalDate date);

    Optional<DailyPrice> findTopBySecurityIdAndTradeDateGreaterThanEqualOrderByTradeDateAsc(Long securityId, LocalDate date);

    boolean existsBySecurityId(Long securityId);
}
