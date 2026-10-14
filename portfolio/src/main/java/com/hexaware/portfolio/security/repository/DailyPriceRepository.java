package com.hexaware.portfolio.security.repository;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.hexaware.portfolio.security.entity.DailyPrice;


public interface DailyPriceRepository extends JpaRepository<DailyPrice, Long> {

    List<DailyPrice> findBySecurityId(Long securityId);

    List<DailyPrice> findBySecurityIdIn(Collection<Long> securityIds);

    List<DailyPrice> findBySecurityIdInOrderBySecurityIdAscTradeDateDesc(Collection<Long> securityIds);

    @Query("""
            select p from DailyPrice p
            where p.securityId in :securityIds
              and p.tradeDate = (
                  select max(latest.tradeDate) from DailyPrice latest
                  where latest.securityId = p.securityId
              )
            """)
    List<DailyPrice> findLatestBySecurityIdIn(@Param("securityIds") Collection<Long> securityIds);

    @Query("""
            select p from DailyPrice p
            where p.securityId in :securityIds
              and p.tradeDate = (
                  select max(previous.tradeDate) from DailyPrice previous
                  where previous.securityId = p.securityId
                    and previous.tradeDate <= :asOfDate
              )
            """)
    List<DailyPrice> findLatestBySecurityIdInOnOrBefore(
            @Param("securityIds") Collection<Long> securityIds,
            @Param("asOfDate") LocalDate asOfDate);

    @Query(value = """
            select d.*
            from daily_prices d
            inner join (
                select security_id, max(trade_date) as max_trade_date
                from daily_prices
                where security_id in (:securityIds)
                  and trade_date <= :asOfDate
                group by security_id
            ) latest
              on d.security_id = latest.security_id
             and d.trade_date = latest.max_trade_date
            """, nativeQuery = true)
    List<DailyPrice> findLatestBySecurityIdInOnOrBeforeOptimized(
            @Param("securityIds") Collection<Long> securityIds,
            @Param("asOfDate") LocalDate asOfDate);

    List<DailyPrice> findBySecurityIdAndTradeDateBetween(Long securityId, LocalDate from, LocalDate to);

    Optional<DailyPrice> findBySecurityIdAndTradeDate(Long securityId, LocalDate date);

    Optional<DailyPrice> findTopBySecurityIdOrderByTradeDateDesc(Long securityId);

    Optional<DailyPrice> findTopBySecurityIdAndTradeDateLessThanEqualOrderByTradeDateDesc(Long securityId, LocalDate date);

    Optional<DailyPrice> findTopBySecurityIdAndTradeDateGreaterThanEqualOrderByTradeDateAsc(Long securityId, LocalDate date);

    boolean existsBySecurityId(Long securityId);
}
