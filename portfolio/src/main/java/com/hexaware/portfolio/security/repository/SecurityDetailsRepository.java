package com.hexaware.portfolio.security.repository;

import java.util.Optional;
import java.util.Collection;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.hexaware.portfolio.security.entity.AssetType;
import com.hexaware.portfolio.security.entity.SecurityDetails;


public interface SecurityDetailsRepository extends JpaRepository<SecurityDetails, Long> {

    @EntityGraph(attributePaths = "gicsIndustry")
    @Override
    List<SecurityDetails> findAll();

    @EntityGraph(attributePaths = "gicsIndustry")
    @Override
    Page<SecurityDetails> findAll(Pageable pageable);

    Optional<SecurityDetails> findByIsin(String isin);

    Optional<SecurityDetails> findBySymbol(String symbol);

    @EntityGraph(attributePaths = "gicsIndustry")
    Optional<SecurityDetails> findFirstBySymbolIgnoreCaseOrderBySecurityIdAsc(String symbol);

    @EntityGraph(attributePaths = "gicsIndustry")
    Optional<SecurityDetails> findByExchangeIgnoreCaseAndIsinIgnoreCase(String exchange, String isin);

    Optional<SecurityDetails> findBySymbolAndSeries(String symbol, String series);

    @Query("""
            select s from SecurityDetails s
            where lower(s.symbol) like lower(concat('%', :query, '%'))
               or lower(s.isin) like lower(concat('%', :query, '%'))
               or lower(s.name) like lower(concat('%', :query, '%'))
               or lower(s.description) like lower(concat('%', :query, '%'))
               or lower(s.exchange) like lower(concat('%', :query, '%'))
            order by
               case
                   when lower(s.symbol) = lower(:query) then 0
                   when lower(s.symbol) like lower(concat(:query, '%')) then 1
                   else 2
               end,
               s.symbol asc
            """)
    List<SecurityDetails> searchMatching(@Param("query") String query, Pageable pageable);

    List<SecurityDetails> findAllByAssetTypeIn(Collection<AssetType> assetTypes);
}