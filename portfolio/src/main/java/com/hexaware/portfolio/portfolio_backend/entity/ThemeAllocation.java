package com.hexaware.portfolio.portfolio_backend.entity;

import java.math.BigDecimal;

import com.hexaware.portfolio.portfolio_backend.entity.enums.AssetClass;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Column;
import jakarta.persistence.UniqueConstraint;
import org.hibernate.annotations.Check;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;


@Entity
@Table(name = "theme_allocations", uniqueConstraints = @UniqueConstraint(
    name = "uk_theme_allocations_theme_asset", columnNames = { "theme_id", "asset_class" }))
@Check(name = "ck_theme_allocations_percentage_range", constraints = "percentage >= 0 AND percentage <= 100")
@Data 
@Builder 
@NoArgsConstructor
@AllArgsConstructor
public class ThemeAllocation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "theme_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_theme_allocations_theme"))
    private ThemeDefinition theme;

    @Enumerated(EnumType.STRING)
    @Column(name = "asset_class", nullable = false, length = 40)
    private AssetClass assetClass;

    @Column(nullable = false, precision = 5, scale = 2)
    private BigDecimal percentage;
}