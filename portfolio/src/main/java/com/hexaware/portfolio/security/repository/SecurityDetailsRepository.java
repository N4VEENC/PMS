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

    @EntityGraph(attributePaths = "gicsIndustry")
    @Query("""
            select s from SecurityDetails s
            left join s.gicsIndustry g
            where lower(coalesce(s.symbol, '')) like lower(concat('%', :query, '%'))
               or lower(coalesce(s.isin, '')) like lower(concat('%', :query, '%'))
               or lower(coalesce(s.series, '')) like lower(concat('%', :query, '%'))
               or lower(coalesce(s.name, '')) like lower(concat('%', :query, '%'))
               or lower(coalesce(s.description, '')) like lower(concat('%', :query, '%'))
               or lower(coalesce(s.exchange, '')) like lower(concat('%', :query, '%'))
               or lower(coalesce(s.currency, '')) like lower(concat('%', :query, '%'))
               or lower(coalesce(s.country, '')) like lower(concat('%', :query, '%'))
               or lower(coalesce(s.market, '')) like lower(concat('%', :query, '%'))
               or lower(coalesce(s.riskLevel, '')) like lower(concat('%', :query, '%'))
               or lower(coalesce(s.status, '')) like lower(concat('%', :query, '%'))
               or lower(coalesce(s.logoUrl, '')) like lower(concat('%', :query, '%'))
               or lower(coalesce(s.websiteUrl, '')) like lower(concat('%', :query, '%'))
               or lower(replace(str(s.assetType), '_', ' ')) like lower(concat('%', :query, '%'))
               or lower(replace(coalesce(str(s.equityCategory), ''), '_', ' ')) like lower(concat('%', :query, '%'))
               or lower(coalesce(g.industryCode, '')) like lower(concat('%', :query, '%'))
               or lower(coalesce(g.sectorCode, '')) like lower(concat('%', :query, '%'))
               or lower(coalesce(g.sectorName, '')) like lower(concat('%', :query, '%'))
               or lower(coalesce(g.industryName, '')) like lower(concat('%', :query, '%'))
            order by
               case
                   when lower(s.symbol) = lower(:query) then 0
                   when lower(s.symbol) like lower(concat(:query, '%')) then 1
                   else 2
               end,
               s.symbol asc
            """)
    List<SecurityDetails> searchMatching(@Param("query") String query);

    @EntityGraph(attributePaths = "gicsIndustry")
    List<SecurityDetails> findAllByAssetTypeIn(Collection<AssetType> assetTypes);
}
