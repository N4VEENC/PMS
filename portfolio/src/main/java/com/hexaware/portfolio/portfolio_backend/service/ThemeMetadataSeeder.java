package com.hexaware.portfolio.portfolio_backend.service;

import java.math.BigDecimal;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.hexaware.portfolio.portfolio_backend.entity.ThemeAllocation;
import com.hexaware.portfolio.portfolio_backend.entity.ThemeDefinition;
import com.hexaware.portfolio.portfolio_backend.entity.enums.AssetClass;
import com.hexaware.portfolio.portfolio_backend.entity.enums.EquityCategory;
import com.hexaware.portfolio.portfolio_backend.entity.enums.InvestmentThemes;
import com.hexaware.portfolio.portfolio_backend.entity.ThemeEquityAllocation;
import com.hexaware.portfolio.portfolio_backend.repository.ThemeRepository;

import lombok.RequiredArgsConstructor;

@Component
@ConditionalOnProperty(name = "app.seed.enabled", havingValue = "true", matchIfMissing = true)
@RequiredArgsConstructor
public class ThemeMetadataSeeder implements CommandLineRunner {

    private final ThemeRepository themes;

    @Override
    @Transactional
    public void run(String... args) {
        for (ThemeData data : defaults()) {
            ThemeDefinition theme = themes.findByTheme(data.code()).orElse(null);
            boolean changed = false;
            if (theme == null) {
                theme = new ThemeDefinition();
                theme.setTheme(data.code());
                theme.setLabel(data.label());
                theme.setRisk(data.risk());
                theme.setInvestmentHorizon(data.horizon());
                theme.setDescription(data.description());
                synchronizeAllocations(theme, data.allocations());
                changed = true;
            } else if (theme.getAllocations().isEmpty()) {
                synchronizeAllocations(theme, data.allocations());
                changed = true;
            }
            if (theme.getEquityAllocations().isEmpty()) {
                seedEquityAllocations(theme);
                changed = true;
            }
            if (changed) themes.save(theme);
        }
    }

    private void seedEquityAllocations(ThemeDefinition theme) {
        List<EquityTargetData> targets = switch (theme.getTheme()) {
            case CONSERVATIVE -> List.of(
                    equityTarget(EquityCategory.LARGE_CAP, "66.67"),
                    equityTarget(EquityCategory.MID_CAP, "26.66"),
                    equityTarget(EquityCategory.SMALL_CAP, "6.67"));
            case MODERATELY_CONSERVATIVE -> List.of(
                    equityTarget(EquityCategory.LARGE_CAP, "60"),
                    equityTarget(EquityCategory.MID_CAP, "28"),
                    equityTarget(EquityCategory.SMALL_CAP, "12"));
            case AGGRESSIVE -> List.of(
                    equityTarget(EquityCategory.LARGE_CAP, "55.56"),
                    equityTarget(EquityCategory.MID_CAP, "28.89"),
                    equityTarget(EquityCategory.SMALL_CAP, "15.55"));
            case MODERATELY_AGGRESSIVE -> List.of(
                    equityTarget(EquityCategory.LARGE_CAP, "45.45"),
                    equityTarget(EquityCategory.MID_CAP, "32.73"),
                    equityTarget(EquityCategory.SMALL_CAP, "21.82"));
            case VERY_AGGRESSIVE -> List.of(
                    equityTarget(EquityCategory.LARGE_CAP, "35.29"),
                    equityTarget(EquityCategory.MID_CAP, "35.29"),
                    equityTarget(EquityCategory.SMALL_CAP, "29.42"));
        };
        targets.forEach(target -> addEquityAllocation(theme, target.category(), target.percentage()));
    }

    private EquityTargetData equityTarget(EquityCategory category, String percentage) {
        return new EquityTargetData(category, new BigDecimal(percentage));
    }

    private void addEquityAllocation(ThemeDefinition theme, EquityCategory category, BigDecimal percentage) {
        ThemeEquityAllocation allocation = new ThemeEquityAllocation();
        allocation.setEquityCategory(category);
        allocation.setPercentage(percentage.setScale(2));
        theme.addEquityAllocation(allocation);
    }

    private void synchronizeAllocations(ThemeDefinition theme, List<AllocationData> definitions) {
        Map<AssetClass, ThemeAllocation> existing = new EnumMap<>(AssetClass.class);
        for (ThemeAllocation allocation : theme.getAllocations()) {
            existing.put(allocation.getAssetClass(), allocation);
        }

        Map<AssetClass, BigDecimal> configured = new EnumMap<>(AssetClass.class);
        definitions.forEach(item -> configured.put(item.assetClass(), item.percentage()));
        theme.getAllocations().removeIf(allocation -> !configured.containsKey(allocation.getAssetClass()));

        for (AllocationData definition : definitions) {
            ThemeAllocation allocation = existing.get(definition.assetClass());
            if (allocation == null) {
                allocation = new ThemeAllocation();
                allocation.setAssetClass(definition.assetClass());
                theme.addAllocation(allocation);
            }
            allocation.setPercentage(definition.percentage());
        }
    }

    private List<ThemeData> defaults() {
        return List.of(
                theme(InvestmentThemes.CONSERVATIVE, "Conservative", "Moderate", "Medium Term",
                        "A balanced allocation focused on stability and diversified income.",
                        allocation(AssetClass.STOCKS, "15"), allocation(AssetClass.MUTUAL_FUNDS, "25"),
                        allocation(AssetClass.COMMODITIES, "10"), allocation(AssetClass.BONDS, "35"),
                        allocation(AssetClass.REITS, "5"), allocation(AssetClass.ETFS, "10")),
                theme(InvestmentThemes.MODERATELY_CONSERVATIVE, "Moderately Conservative", "Low", "Short Term",
                        "A lower-risk allocation with a measured equity component.",
                        allocation(AssetClass.STOCKS, "25"), allocation(AssetClass.MUTUAL_FUNDS, "25"),
                        allocation(AssetClass.COMMODITIES, "10"), allocation(AssetClass.BONDS, "25"),
                        allocation(AssetClass.REITS, "5"), allocation(AssetClass.ETFS, "10")),
                theme(InvestmentThemes.AGGRESSIVE, "Aggressive", "High", "Long Term",
                        "A growth-focused allocation with limited defensive assets.",
                        allocation(AssetClass.STOCKS, "45"), allocation(AssetClass.MUTUAL_FUNDS, "15"),
                        allocation(AssetClass.COMMODITIES, "5"), allocation(AssetClass.BONDS, "10"),
                        allocation(AssetClass.CRYPTO, "10"), allocation(AssetClass.REITS, "5"),
                        allocation(AssetClass.ETFS, "10")),
                theme(InvestmentThemes.MODERATELY_AGGRESSIVE, "Moderately Aggressive", "High", "Long Term",
                        "A high-growth allocation balanced with small defensive positions.",
                        allocation(AssetClass.STOCKS, "55"), allocation(AssetClass.MUTUAL_FUNDS, "10"),
                        allocation(AssetClass.COMMODITIES, "5"), allocation(AssetClass.BONDS, "5"),
                        allocation(AssetClass.CRYPTO, "10"), allocation(AssetClass.REITS, "5"),
                        allocation(AssetClass.ETFS, "10")),
                theme(InvestmentThemes.VERY_AGGRESSIVE, "Very Aggressive", "Very High", "Long Term",
                        "A high-volatility growth allocation for long-term investors.",
                        allocation(AssetClass.STOCKS, "85"), allocation(AssetClass.BONDS, "15")));
    }

    private ThemeData theme(InvestmentThemes code, String label, String risk, String horizon,
            String description, AllocationData... allocations) {
        return new ThemeData(code, label, risk, horizon, description, List.of(allocations));
    }

    private AllocationData allocation(AssetClass assetClass, String percentage) {
        return new AllocationData(assetClass, new BigDecimal(percentage));
    }

    private record ThemeData(
            InvestmentThemes code,
            String label,
            String risk,
            String horizon,
            String description,
            List<AllocationData> allocations) {
    }

    private record AllocationData(AssetClass assetClass, BigDecimal percentage) {
    }

    private record EquityTargetData(EquityCategory category, BigDecimal percentage) {
    }
}
