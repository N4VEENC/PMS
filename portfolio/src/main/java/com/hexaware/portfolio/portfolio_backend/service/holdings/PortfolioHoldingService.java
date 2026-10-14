package com.hexaware.portfolio.portfolio_backend.service.holdings;

import java.math.*;
import java.time.*;
import java.util.*;

import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hexaware.portfolio.portfolio_backend.dto.*;
import com.hexaware.portfolio.portfolio_backend.entity.*;
import com.hexaware.portfolio.portfolio_backend.entity.enums.AssetClass;
import com.hexaware.portfolio.portfolio_backend.entity.enums.EquityCategory;
import com.hexaware.portfolio.portfolio_backend.entity.enums.PortfolioStatus;
import com.hexaware.portfolio.portfolio_backend.exceptions.*;
import com.hexaware.portfolio.portfolio_backend.repository.*;
import com.hexaware.portfolio.portfolio_backend.security.CurrentUserService;
import com.hexaware.portfolio.security.entity.*;
import com.hexaware.portfolio.security.repository.*;

@Service
public class PortfolioHoldingService {
    private static final BigDecimal ZERO = BigDecimal.ZERO;
    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);
    private static final int ELIGIBLE_CANDIDATE_LIMIT = 250;
    private final PortfolioRepository portfolios;
    private final PortfolioHoldingRepository holdings;
    private final PortfolioTradeRepository trades;
    private final SecurityDetailsRepository securities;
    private final DailyPriceRepository prices;
    private final ThemeRepository themes;
    private final CurrentUserService currentUser;
        private final HoldingSecurityService securityService;
        private final HoldingAllocationService allocationService;

    public PortfolioHoldingService(PortfolioRepository portfolios, PortfolioHoldingRepository holdings,
            PortfolioTradeRepository trades, SecurityDetailsRepository securities, DailyPriceRepository prices,
            ThemeRepository themes, CurrentUserService currentUser, HoldingSecurityService securityService,
            HoldingAllocationService allocationService) {
        this.portfolios = portfolios; this.holdings = holdings; this.trades = trades;
        this.securities = securities; this.prices = prices; this.themes = themes; this.currentUser = currentUser;
        this.securityService = securityService; this.allocationService = allocationService;
    }

    public List<PortfolioHolding> getAll(Long portfolioId) { 
        ownPortfolio(portfolioId); return holdings.findByPortfolioId(portfolioId); 
    }

    public PortfolioHolding getById(Long portfolioId, Long holdingId) {
        ownPortfolio(portfolioId);
        return holdings.findByIdAndPortfolioId(holdingId, portfolioId)
                        .orElseThrow(() -> new PortfolioValidationException("Holding not found"));
    }

    public PortfolioHoldingSummaryResponse getSummary(Long portfolioId) {
        List<PortfolioHolding> rows = getAll(portfolioId);
        return new PortfolioHoldingSummaryResponse(rows.size(), 
        rows.stream()
            .map(PortfolioHolding::getValue)
            .filter(Objects::nonNull)
            .reduce(ZERO, BigDecimal::add));
    }

    public List<EligibleSecurityResponse> getEligibleSecurities(Long portfolioId) {
        return getEligibleSecurities(portfolioId, null, 0, 100);
    }

    @Cacheable(cacheNames = "eligible-securities",
            key = "#portfolioId + ':' + (#asOfDate == null ? 'latest' : #asOfDate.toString()) + ':' + #page + ':' + #pageSize")
    public List<EligibleSecurityResponse> getEligibleSecurities(Long portfolioId, LocalDate asOfDate, int page, int pageSize) {
        Portfolio portfolio = ownPortfolio(portfolioId);
        Set<AssetClass> allowedAssetClasses = allocationService.allowedAssetClasses(portfolio);
        List<AssetType> allowedAssetTypes = allowedAssetClasses.isEmpty() ? List.of()
                : allowedAssetClasses.stream().map(this::toAssetType).filter(Objects::nonNull).distinct().toList();

        List<Long> candidateSecurityIds = topCandidateSecurityIds(portfolio, ELIGIBLE_CANDIDATE_LIMIT);
        if (candidateSecurityIds.isEmpty()) {
            return List.of();
        }

        Map<Long, DailyPrice> latestPricesBySecurity = loadLatestPricesBySecurityId(candidateSecurityIds, asOfDate);

        List<EligibleSecurityResponse> items = securities.findAllById(candidateSecurityIds).stream()
                .filter(security -> security != null && security.getSecurityId() != null)
                .filter(security -> !isExcludedExchange(security.getExchange()))
                .filter(security -> allowedAssetClasses.isEmpty()
                        || allowedAssetClasses.contains(securityService.assetClass(security.getAssetType())))
                .sorted(Comparator.comparing((SecurityDetails security) -> security.getSymbol() == null ? "" : security.getSymbol())
                        .thenComparing(SecurityDetails::getSecurityId))
                .map(security -> {
                    DailyPrice price = latestPricesBySecurity.get(security.getSecurityId());
                    if (price == null) {
                        return null;
                    }

                    return new EligibleSecurityResponse(
                            security.getSecurityId(),
                            security.getIsin(),
                            security.getSymbol(),
                            security.getName(),
                            securityService.assetClass(security.getAssetType()),
                            security.getEquityCategory(),
                            securityService.priceValue(price),
                            price.getTradeDate());
                })
                .filter(Objects::nonNull)
                .toList();

        int fromIndex = Math.min(page * pageSize, items.size());
        int toIndex = Math.min(fromIndex + pageSize, items.size());
        return items.subList(fromIndex, toIndex);
    }

    public List<EligibleSecurityResponse> getEligibleSecurities(Long portfolioId, LocalDate asOfDate) {
        return getEligibleSecurities(portfolioId, asOfDate, 0, 100);
    }

    @Transactional
    @CacheEvict(cacheNames = "eligible-securities", allEntries = true)
    public PortfolioHolding addSecurity(Long portfolioId, AddSecurityRequest request) {
        Portfolio p = ownPortfolio(portfolioId);
        ensurePortfolioOpen(p);
        if (request == null || (request.securityId() == null && request.isin() == null) || request.shares() == null || request.shares().signum() <= 0) throw new PortfolioValidationException("A security and positive share quantity are required");
        SecurityDetails s = request.securityId() != null
            ? securities.findById(request.securityId()).orElseThrow(() -> new SecurityNotFoundException(String.valueOf(request.securityId())))
            : securities.findByIsin(request.isin()).orElseThrow(() -> new SecurityNotFoundException(request.isin()));
        if (isExcludedExchange(s.getExchange())) {
            throw new PortfolioValidationException("Securities listed on LSE or NASDAQ cannot be added to holdings");
        }
        Set<AssetClass> allowedAssetClasses = allocationService.allowedAssetClasses(p);
        if (!allowedAssetClasses.isEmpty() && !allowedAssetClasses.contains(securityService.assetClass(s.getAssetType()))) {
            throw new PortfolioValidationException("This security is not part of the portfolio's investment theme");
        }
        PortfolioHolding existing = holdings.findByPortfolioId(portfolioId).stream()
            .filter(h -> securityService.sameSecurity(h, s))
            .findFirst()
            .orElse(null);
        LocalDate transactionDate = p.isHoldingsSaved() ? LocalDate.now() : (p.getPurchaseDate() == null ? LocalDate.now() : p.getPurchaseDate());
        DailyPrice price = securityService.priceOnOrBefore(s.getSecurityId(), transactionDate);
        BigDecimal unitPrice = securityService.priceValue(price);
        allocationService.ensureDoesNotExceedTarget(p, securityService.assetClass(s.getAssetType()), s.getEquityCategory(), unitPrice.multiply(request.shares()), null);
        if (existing != null) {
            existing.setSecurityId(s.getSecurityId());
            existing.setIsin(s.getIsin());
            existing.setSymbol(s.getSymbol());
            existing.setSecurityName(s.getName());
            existing.setAssetClass(securityService.assetClass(s.getAssetType()));
            existing.setEquityCategory(s.getEquityCategory());
            existing.setShares(existing.getShares().add(request.shares()));
            existing.setPrice(unitPrice);
            existing.setValue(unitPrice.multiply(existing.getShares()).setScale(2, RoundingMode.HALF_UP));
            existing.setPriceDate(price.getTradeDate());
            existing.setUpdatedAt(Instant.now());
            PortfolioHolding saved = holdings.save(existing);
            if (p.isHoldingsSaved()) recordTrade(portfolioId, s, saved.getAssetClass(), request.shares(), unitPrice, transactionDate);
            return saved;
        }
        PortfolioHolding holding = PortfolioHolding.builder().portfolioId(portfolioId).securityId(s.getSecurityId()).isin(s.getIsin()).symbol(s.getSymbol())
            .securityName(s.getName()).assetClass(securityService.assetClass(s.getAssetType())).equityCategory(s.getEquityCategory()).shares(request.shares())
                .price(unitPrice).value(unitPrice.multiply(request.shares()).setScale(2, RoundingMode.HALF_UP))
                .priceDate(price.getTradeDate()).createdAt(Instant.now()).updatedAt(Instant.now()).build();
        PortfolioHolding saved = holdings.save(holding);
        if (p.isHoldingsSaved()) recordTrade(portfolioId, s, saved.getAssetClass(), saved.getShares(), unitPrice, transactionDate);
        return saved;
    }

    @Transactional
    @CacheEvict(cacheNames = "eligible-securities", allEntries = true)
    public Portfolio saveHoldings(Long portfolioId) {
        Portfolio p = ownPortfolio(portfolioId);
        ensurePortfolioOpen(p);
        List<PortfolioHolding> rows = holdings.findByPortfolioId(portfolioId);
        if (rows.isEmpty()) throw new PortfolioValidationException("Add at least one holding before saving");
        if (!p.isHoldingsSaved()) {
            for (PortfolioHolding h : rows) {
                trades.save(PortfolioTrade.builder().portfolioId(portfolioId).securityId(h.getSecurityId()).isin(h.getIsin()).symbol(h.getSymbol())
                        .securityName(h.getSecurityName()).assetClass(h.getAssetClass()).equityCategory(h.getEquityCategory()).signedShares(h.getShares())
                        .unitPrice(h.getPrice()).tradeDate(p.getPurchaseDate()).createdAt(Instant.now()).build());
            }
            p.setHoldingsSaved(true); p.setStatus(PortfolioStatus.ACTIVE); p.setUpdatedAt(Instant.now());
            portfolios.save(p);
        }
        return p;
    }

    @Transactional
    @CacheEvict(cacheNames = "eligible-securities", allEntries = true)
    public PortfolioHolding update(Long portfolioId, Long holdingId, UpdateHoldingRequest request) {
        PortfolioHolding row = getById(portfolioId, holdingId);
        if (request == null || request.shares() == null || request.shares().signum() <= 0) throw new PortfolioValidationException("Shares must be greater than zero");
        BigDecimal delta = request.shares().subtract(row.getShares());
        Portfolio p = ownPortfolio(portfolioId);
        ensurePortfolioOpen(p);
        if (p.isHoldingsSaved() && delta.signum() != 0) {
            SecurityDetails security = securityService.resolveHolding(row);
            LocalDate date = LocalDate.now();
            BigDecimal price = securityService.priceValue(securityService.priceOnOrBefore(security.getSecurityId(), date));
            recordTrade(portfolioId, security, row.getAssetClass(), delta, price, date);
            row.setPrice(price); row.setPriceDate(securityService.priceOnOrBefore(security.getSecurityId(), date).getTradeDate());
        }
        allocationService.ensureDoesNotExceedTarget(p, row.getAssetClass(), row.getEquityCategory(), row.getPrice().multiply(request.shares()), row);
        row.setShares(request.shares()); row.setValue(row.getPrice().multiply(row.getShares()).setScale(2, RoundingMode.HALF_UP)); row.setUpdatedAt(Instant.now());
        return holdings.save(row);
    }
    @Transactional
    @CacheEvict(cacheNames = "eligible-securities", allEntries = true)
    public void delete(Long portfolioId, Long holdingId) {
        PortfolioHolding row = getById(portfolioId, holdingId);
        Portfolio portfolio = ownPortfolio(portfolioId);
        ensurePortfolioOpen(portfolio);
        if (portfolio.isHoldingsSaved()) {
            SecurityDetails security = securityService.resolveHolding(row);
            LocalDate date = LocalDate.now();
            BigDecimal price = securityService.priceValue(securityService.priceOnOrBefore(security.getSecurityId(), date));
            recordTrade(portfolioId, security, row.getAssetClass(), row.getShares().negate(), price, date);
        }
        holdings.delete(row);
    }

    @Transactional
    public PortfolioValuationResponse getValuation(Long portfolioId, LocalDate requestedDate) {
        return getValuations(portfolioId, List.of(requestedDate == null ? LocalDate.now() : requestedDate)).get(0);
    }

    @Transactional
    public List<PortfolioValuationResponse> getValuations(Long portfolioId, List<LocalDate> requestedDates) {
        if (requestedDates == null || requestedDates.isEmpty() || requestedDates.size() > 25
                || requestedDates.stream().anyMatch(Objects::isNull)) {
            throw new PortfolioValidationException("Provide between 1 and 25 valuation dates");
        }
        Portfolio p = ownPortfolio(portfolioId);
        if (!p.isHoldingsSaved()) throw new PortfolioValidationException("Save portfolio holdings before opening the historical dashboard");
        ensureTradeHistory(p);
        LocalDate purchase = p.getPurchaseDate();
        List<LocalDate> dates = requestedDates.stream().distinct().sorted().toList();
        dates.forEach(date -> {
            if (date.isBefore(purchase)) throw new PortfolioValidationException("Dashboard date cannot be before the purchase date");
        });
        List<PortfolioTrade> allTrades = trades.findAllByPortfolioId(portfolioId).stream()
                .sorted(Comparator.comparing(PortfolioTrade::getTradeDate).thenComparing(PortfolioTrade::getId))
                .toList();
        Map<Long, SecurityDetails> securitiesById = new HashMap<>();
        Map<Long, List<DailyPrice>> pricesBySecurity = new HashMap<>();
        for (PortfolioTrade trade : allTrades) {
            Long securityId = trade.getSecurityId() == null
                    ? securityService.tradeSecurityId(trade) : trade.getSecurityId();
            if (!securitiesById.containsKey(securityId)) {
                securitiesById.put(securityId, securityService.resolveTrade(trade));
                pricesBySecurity.put(securityId, prices.findBySecurityId(securityId));
            }
        }
        Set<LocalDate> availableDates = new TreeSet<>();
        availableDates.add(purchase);
        pricesBySecurity.values().stream().flatMap(List::stream)
                .map(DailyPrice::getTradeDate).filter(date -> !date.isBefore(purchase)).forEach(availableDates::add);
        List<ThemeAllocation> themeAllocations = p.getTheme() == null ? List.of()
                : themes.findByTheme(p.getTheme()).orElseThrow().getAllocations();
        List<LocalDate> portfolioDates = List.copyOf(availableDates);
        return dates.stream()
                .map(date -> calculateValuation(p, date, allTrades, securitiesById,
                        pricesBySecurity, themeAllocations, portfolioDates))
                .toList();
    }

    private PortfolioValuationResponse calculateValuation(Portfolio p, LocalDate requested,
            List<PortfolioTrade> allTrades, Map<Long, SecurityDetails> securitiesById,
            Map<Long, List<DailyPrice>> pricesBySecurity, List<ThemeAllocation> themeAllocations,
            List<LocalDate> portfolioDates) {
        LocalDate purchase = p.getPurchaseDate();
        List<PortfolioTrade> history = allTrades.stream().filter(trade -> !trade.getTradeDate().isAfter(requested)).toList();
        if (history.isEmpty()) throw new PortfolioValidationException("No portfolio trades exist on or before this date");
        Map<Long, BigDecimal> quantities = new LinkedHashMap<>();
        Map<Long, PortfolioTrade> metadata = new HashMap<>();
        Map<Long, BigDecimal> costs = new HashMap<>();
        Map<Long, BigDecimal> bought = new HashMap<>();
        for (PortfolioTrade t : history) {
            Long securityId = t.getSecurityId() == null
                    ? securityService.tradeSecurityId(t) : t.getSecurityId();
            quantities.merge(securityId, t.getSignedShares(), BigDecimal::add); 
            metadata.put(securityId, t);
            if (t.getSignedShares().signum() > 0) { 
                costs.merge(securityId, t.getSignedShares()
                                        .multiply(t.getUnitPrice()), BigDecimal::add); 
            bought.merge(securityId, t.getSignedShares(), BigDecimal::add); 
        }
        }
        List<PortfolioValuationResponse.HoldingValuation> output = new ArrayList<>();
        Map<AssetClass, BigDecimal> classValues = new EnumMap<>(AssetClass.class);
        BigDecimal total = ZERO, totalCost = ZERO;
        LocalDate effective = requested;
        for (var entry : quantities.entrySet()) {
            if (entry.getValue().signum() <= 0) continue;
            PortfolioTrade t = metadata.get(entry.getKey());
            SecurityDetails security = securitiesById.get(entry.getKey());
            if (security == null) throw new SecurityNotFoundException(String.valueOf(entry.getKey()));
            DailyPrice daily = pricesBySecurity.getOrDefault(entry.getKey(), List.of()).stream()
                    .filter(price -> !price.getTradeDate().isAfter(requested))
                    .max(Comparator.comparing(DailyPrice::getTradeDate))
                    .orElseThrow(() -> new PortfolioValidationException(
                            "No historical price is available on or before " + requested));
            BigDecimal currentPrice = securityService.priceValue(daily), value = currentPrice.multiply(entry.getValue()).setScale(2, RoundingMode.HALF_UP);
            BigDecimal averageCost = bought.getOrDefault(entry.getKey(), ZERO).signum() == 0 ? ZERO : costs.get(entry.getKey()).divide(bought.get(entry.getKey()), 6, RoundingMode.HALF_UP);
            BigDecimal gain = currentPrice.subtract(averageCost).multiply(entry.getValue()).setScale(2, RoundingMode.HALF_UP);
            output.add(new PortfolioValuationResponse.HoldingValuation(security.getSecurityId(), security.getIsin(), t.getSymbol(), t.getSecurityName(), t.getAssetClass(), t.getEquityCategory() == null ? security.getEquityCategory() : t.getEquityCategory(), entry.getValue(), averageCost, currentPrice, daily.getTradeDate(), value, gain));
            classValues.merge(t.getAssetClass(), value, BigDecimal::add); total = total.add(value); totalCost = totalCost.add(averageCost.multiply(entry.getValue()));
            if (daily.getTradeDate().isBefore(effective)) effective = daily.getTradeDate();
        }
        BigDecimal residualCash = p.getAmount().subtract(total).max(ZERO);
        if (residualCash.signum() > 0) {
            classValues.merge(AssetClass.CASH, residualCash, BigDecimal::add);
            total = total.add(residualCash);
            totalCost = totalCost.add(residualCash);
        }
        List<PortfolioValuationResponse.AllocationDrift> allocation = new ArrayList<>();
        for (ThemeAllocation target : themeAllocations) {
            BigDecimal current = total.signum() == 0 ? ZERO : classValues.getOrDefault(target.getAssetClass(), ZERO).multiply(HUNDRED).divide(total, 2, RoundingMode.HALF_UP);
            BigDecimal targetPct = target.getPercentage();
            BigDecimal drift = current.subtract(targetPct).setScale(2, RoundingMode.HALF_UP);
            allocation.add(new PortfolioValuationResponse.AllocationDrift(target.getAssetClass(), targetPct, current, drift, exceedsDriftLimit(drift)));
        }
        
        BigDecimal gains = total.subtract(totalCost).setScale(2, RoundingMode.HALF_UP);
        return new PortfolioValuationResponse(purchase, requested, effective, total.setScale(2, RoundingMode.HALF_UP), gains, output, allocation, portfolioDates);
    }

    static boolean exceedsDriftLimit(BigDecimal drift) {
        return drift.abs().compareTo(BigDecimal.valueOf(5)) > 0;
    }

    @Transactional
    @CacheEvict(cacheNames = "eligible-securities", allEntries = true)
    public void rebalance(Long portfolioId, RebalanceRequest request) {
        Portfolio p = ownPortfolio(portfolioId);
        ensurePortfolioOpen(p);
        ensureTradeHistory(p);
        if (request == null || request.tradeDate() == null || request.trades() == null || request.trades().isEmpty()) throw new PortfolioValidationException("Trade date and at least one trade are required");
        if (request.tradeDate().isBefore(p.getPurchaseDate()) || request.tradeDate().isAfter(LocalDate.now())) throw new PortfolioValidationException("Trade date must be between purchase date and today");
        Map<Long, BigDecimal> quantitiesAtTradeDate = new HashMap<>();
        Map<Long, PortfolioTrade> lastTradeAtTradeDate = new HashMap<>();
        Set<Long> securityIdsForPriceLookup = new HashSet<>();
        for (PortfolioTrade prior : trades.findByPortfolioIdAndTradeDateLessThanEqualOrderByTradeDateAscIdAsc(portfolioId, request.tradeDate())) {
            Long securityId = securityService.tradeSecurityId(prior);
            quantitiesAtTradeDate.merge(securityId, prior.getSignedShares(), BigDecimal::add);
            lastTradeAtTradeDate.put(securityId, prior);
            securityIdsForPriceLookup.add(securityId);
        }
        Map<Long, BigDecimal> requestedTrades = new LinkedHashMap<>();
        for (RebalanceRequest.TradeOrder order : request.trades()) {
            if (order == null || order.signedShares() == null) continue;
            if (order.signedShares().signum() == 0) continue;
            Long securityId = order.securityId();
            if (securityId == null && order.isin() != null) {
                securityId = securities.findByIsin(order.isin())
                        .orElseThrow(() -> new SecurityNotFoundException(order.isin())).getSecurityId();
            }
            if (securityId == null) throw new PortfolioValidationException("Every rebalance order needs a security");
            requestedTrades.merge(securityId, order.signedShares(), BigDecimal::add);
            securityIdsForPriceLookup.add(securityId);
        }

        if (requestedTrades.isEmpty()) throw new PortfolioValidationException("At least one nonzero buy or sell order is required");

        Map<Long, DailyPrice> priceBySecurityId = loadPricesOnOrBefore(securityIdsForPriceLookup, request.tradeDate());
        Map<AssetClass, BigDecimal> valueByClass = new EnumMap<>(AssetClass.class);
        Map<EquityCategory, BigDecimal> valueByEquityCategory = new EnumMap<>(EquityCategory.class);
        BigDecimal investedBefore = ZERO;
        for (var position : quantitiesAtTradeDate.entrySet()) {
            if (position.getValue().signum() <= 0) continue;
            PortfolioTrade lastTrade = lastTradeAtTradeDate.get(position.getKey());
            SecurityDetails security = securityService.resolveTrade(lastTrade);
            AssetClass assetClass = securityService.assetClass(security.getAssetType());
            DailyPrice tradeDatePrice = priceBySecurityId.get(position.getKey());
            if (tradeDatePrice == null) {
                tradeDatePrice = securityService.priceOnOrBefore(position.getKey(), request.tradeDate());
            }
            BigDecimal marketValue = securityService.priceValue(tradeDatePrice)
                    .multiply(position.getValue());
            investedBefore = investedBefore.add(marketValue);
            valueByClass.merge(assetClass, marketValue, BigDecimal::add);
            EquityCategory equityCategory = lastTrade.getEquityCategory() == null
                    ? security.getEquityCategory() : lastTrade.getEquityCategory();
            if (assetClass == AssetClass.STOCKS && equityCategory != null) {
                valueByEquityCategory.merge(equityCategory, marketValue, BigDecimal::add);
            }
        }

        Map<AssetClass, BigDecimal> themeTargets = new EnumMap<>(AssetClass.class);
        Map<EquityCategory, BigDecimal> equityTargets = new EnumMap<>(EquityCategory.class);
        if (p.getTheme() != null) {
            ThemeDefinition theme = themes.findByTheme(p.getTheme())
                    .orElseThrow(() -> new PortfolioValidationException("Investment theme is not configured"));
            theme.getAllocations().forEach(allocation -> themeTargets.put(allocation.getAssetClass(), allocation.getPercentage()));
            theme.getEquityAllocations().forEach(allocation -> equityTargets.put(allocation.getEquityCategory(), allocation.getPercentage()));
        }
        BigDecimal stocksTarget = themeTargets.getOrDefault(AssetClass.STOCKS, ZERO);

        List<RebalanceTrade> preparedTrades = new ArrayList<>();
        Map<AssetClass, BigDecimal> tradeValueByClass = new EnumMap<>(AssetClass.class);
        Map<EquityCategory, BigDecimal> tradeValueByEquityCategory = new EnumMap<>(EquityCategory.class);
        BigDecimal purchaseValue = ZERO;
        BigDecimal saleValue = ZERO;
        for (var order : requestedTrades.entrySet()) {
            BigDecimal signedShares = order.getValue();
            if (signedShares.signum() == 0) continue;
            SecurityDetails security = securities.findById(order.getKey()).orElseThrow(() -> new SecurityNotFoundException(String.valueOf(order.getKey())));
            if (signedShares.signum() > 0 && isExcludedExchange(security.getExchange())) {
                throw new PortfolioValidationException("Securities listed on LSE or NASDAQ cannot be added to holdings");
            }
            BigDecimal afterTrade = quantitiesAtTradeDate.getOrDefault(order.getKey(), ZERO).add(signedShares);
            if (afterTrade.signum() < 0) throw new PortfolioValidationException("Cannot sell more shares than the portfolio owns: " + security.getSymbol());
            AssetClass assetClass = securityService.assetClass(security.getAssetType());
            if (signedShares.signum() > 0 && p.getTheme() != null && !themeTargets.containsKey(assetClass)) {
                throw new PortfolioValidationException("This security is not part of the portfolio's investment theme");
            }
            EquityCategory equityCategory = security.getEquityCategory();
            if (signedShares.signum() > 0 && p.getTheme() != null && assetClass == AssetClass.STOCKS
                    && (equityCategory == null || !equityTargets.containsKey(equityCategory))) {
                throw new PortfolioValidationException("This security has no configured large, mid, or small cap category");
            }
            DailyPrice price = priceBySecurityId.get(security.getSecurityId());
            if (price == null) {
                price = securityService.priceOnOrBefore(security.getSecurityId(), request.tradeDate());
            }
            BigDecimal unitPrice = securityService.priceValue(price);
            BigDecimal tradeValue = unitPrice.multiply(signedShares);
            tradeValueByClass.merge(assetClass, tradeValue, BigDecimal::add);
            if (assetClass == AssetClass.STOCKS && equityCategory != null) {
                tradeValueByEquityCategory.merge(equityCategory, tradeValue, BigDecimal::add);
            }
            if (tradeValue.signum() > 0) purchaseValue = purchaseValue.add(tradeValue);
            if (tradeValue.signum() < 0) saleValue = saleValue.subtract(tradeValue);
            preparedTrades.add(new RebalanceTrade(security, assetClass, signedShares, unitPrice));
        }

        BigDecimal portfolioValue = p.getAmount().max(investedBefore);
        BigDecimal availableCash = portfolioValue.subtract(investedBefore).max(ZERO).add(saleValue);
        if (purchaseValue.compareTo(availableCash.add(new BigDecimal("0.01"))) > 0) {
            throw new PortfolioValidationException("Buy orders exceed available cash and sale proceeds");
        }

        for (var tradeValue : tradeValueByClass.entrySet()) {
            BigDecimal projectedValue = valueByClass.getOrDefault(tradeValue.getKey(), ZERO).add(tradeValue.getValue());
            BigDecimal targetPercentage = themeTargets.get(tradeValue.getKey());
            if (tradeValue.getValue().signum() > 0 && targetPercentage != null) {
                BigDecimal targetValue = portfolioValue.multiply(targetPercentage).divide(HUNDRED, 2, RoundingMode.HALF_UP);
                if (projectedValue.compareTo(targetValue.add(BigDecimal.ONE)) > 0) {
                    throw new PortfolioValidationException(tradeValue.getKey() + " purchases exceed the theme target of " + targetPercentage + "%");
                }
            }
            valueByClass.put(tradeValue.getKey(), projectedValue);
        }

        for (var tradeValue : tradeValueByEquityCategory.entrySet()) {
            BigDecimal targetPercentage = equityTargets.get(tradeValue.getKey());
            if (tradeValue.getValue().signum() > 0 && targetPercentage != null) {
                BigDecimal projectedValue = valueByEquityCategory.getOrDefault(tradeValue.getKey(), ZERO).add(tradeValue.getValue());
                BigDecimal targetValue = portfolioValue.multiply(stocksTarget).multiply(targetPercentage)
                        .divide(HUNDRED.multiply(HUNDRED), 2, RoundingMode.HALF_UP);
                if (projectedValue.compareTo(targetValue.add(BigDecimal.ONE)) > 0) {
                    throw new PortfolioValidationException(tradeValue.getKey() + " purchases exceed the theme target of " + targetPercentage + "%");
                }
            }
        }

        for (RebalanceTrade trade : preparedTrades) {
            recordTrade(portfolioId, trade.security(), trade.assetClass(), trade.signedShares(), trade.unitPrice(), request.tradeDate());
        }
        refreshHoldingSnapshots(portfolioId);
    }

    private void ensureTradeHistory(Portfolio portfolio) {
        if (trades.existsByPortfolioId(portfolio.getId())) return;
        List<PortfolioHolding> existing = holdings.findByPortfolioId(portfolio.getId());
        if (existing.isEmpty()) return;
        LocalDate purchase = portfolio.getPurchaseDate();
        if (purchase == null) {
            purchase = existing.stream().map(PortfolioHolding::getPriceDate).filter(Objects::nonNull).min(LocalDate::compareTo).orElse(LocalDate.now());
            portfolio.setPurchaseDate(purchase);
            portfolios.save(portfolio);
        }
        for (PortfolioHolding holding : existing) {
            SecurityDetails security = securityService.resolveHolding(holding);
            BigDecimal price = securityService.priceValue(securityService.priceOnOrBefore(security.getSecurityId(), purchase));
            recordTrade(portfolio.getId(), security, holding.getAssetClass(), holding.getShares(), price, purchase);
        }
    }
    private void refreshHoldingSnapshots(Long portfolioId) {
        List<PortfolioTrade> allTrades = trades.findAllByPortfolioId(portfolioId).stream()
                .sorted(Comparator.comparing(PortfolioTrade::getTradeDate).thenComparing(PortfolioTrade::getId)).toList();
        Map<Long, BigDecimal> quantities = new HashMap<>();
        Map<Long, PortfolioTrade> metadata = new HashMap<>();
        allTrades.forEach(t -> { Long securityId = securityService.tradeSecurityId(t); quantities.merge(securityId, t.getSignedShares(), BigDecimal::add); metadata.put(securityId, t); });
        Map<Long, PortfolioHolding> rows = new HashMap<>();
        holdings.findByPortfolioId(portfolioId).forEach(h -> rows.put(securityService.resolveHolding(h).getSecurityId(), h));
        for (Long securityId : quantities.keySet()) {
            BigDecimal shares = quantities.get(securityId);
            PortfolioHolding row = rows.get(securityId);
            if (shares.signum() <= 0) { if (row != null) holdings.delete(row); continue; }
            PortfolioTrade last = metadata.get(securityId);
            SecurityDetails security = securityService.resolveTrade(last);
            DailyPrice price = securityService.latestPrice(security.getSecurityId());
            if (price == null) throw new PortfolioValidationException("No market price is available for " + security.getSymbol());
            BigDecimal unitPrice = securityService.priceValue(price);
            if (row == null) row = PortfolioHolding.builder().portfolioId(portfolioId).securityId(securityId).isin(security.getIsin()).createdAt(Instant.now()).build();
            row.setSymbol(last.getSymbol()); row.setSecurityName(last.getSecurityName()); row.setAssetClass(last.getAssetClass());
            row.setEquityCategory(last.getEquityCategory() == null ? security.getEquityCategory() : last.getEquityCategory());
            row.setShares(shares); row.setPrice(unitPrice); row.setPriceDate(price.getTradeDate());
            row.setValue(unitPrice.multiply(shares).setScale(2, RoundingMode.HALF_UP)); row.setUpdatedAt(Instant.now());
            holdings.save(row);
        }
    }
    private void recordTrade(Long portfolioId, SecurityDetails security, AssetClass assetClass, BigDecimal quantity, BigDecimal price, LocalDate date) {
        securityService.evictLatestPrice(security.getSecurityId());
        trades.save(PortfolioTrade.builder().portfolioId(portfolioId).securityId(security.getSecurityId()).isin(security.getIsin()).symbol(security.getSymbol())
                .securityName(security.getName()).assetClass(assetClass).equityCategory(security.getEquityCategory()).signedShares(quantity).unitPrice(price)
                .tradeDate(date).createdAt(Instant.now()).build());
    }

    private record RebalanceTrade(SecurityDetails security, AssetClass assetClass, BigDecimal signedShares, BigDecimal unitPrice) {}

    private List<Long> topCandidateSecurityIds(Portfolio portfolio, int limit) {
        Set<AssetClass> allowedAssetClasses = allocationService.allowedAssetClasses(portfolio);
        List<AssetType> allowedAssetTypes = allowedAssetClasses.isEmpty() ? List.of()
                : allowedAssetClasses.stream().map(this::toAssetType).filter(Objects::nonNull).distinct().toList();

        List<SecurityDetails> candidates = allowedAssetTypes.isEmpty()
                ? securities.findAll()
                : securities.findAllByAssetTypeIn(allowedAssetTypes);

        List<SecurityDetails> filtered = candidates.stream()
                .filter(security -> security != null && security.getSecurityId() != null)
                .filter(security -> !isExcludedExchange(security.getExchange()))
                .filter(security -> allowedAssetClasses.isEmpty()
                        || allowedAssetClasses.contains(securityService.assetClass(security.getAssetType())))
                .sorted(Comparator.comparing((SecurityDetails security) -> security.getSymbol() == null ? "" : security.getSymbol())
                        .thenComparing(SecurityDetails::getSecurityId))
                .toList();

        if (filtered.isEmpty()) {
            return List.of();
        }

        if (allowedAssetClasses.isEmpty() || allowedAssetClasses.size() == 1) {
            return filtered.stream().limit(limit).map(SecurityDetails::getSecurityId).filter(Objects::nonNull).distinct().toList();
        }

        Map<AssetClass, List<Long>> byAssetClass = new EnumMap<>(AssetClass.class);
        for (SecurityDetails security : filtered) {
            AssetClass assetClass = securityService.assetClass(security.getAssetType());
            byAssetClass.computeIfAbsent(assetClass, key -> new ArrayList<>()).add(security.getSecurityId());
        }

        List<AssetClass> classOrder = allowedAssetClasses.stream()
                .sorted(Comparator.comparing(Enum::name))
                .toList();

        List<Long> prioritized = new ArrayList<>(limit);
        int perClassTarget = Math.max(1, limit / classOrder.size());
        for (AssetClass assetClass : classOrder) {
            List<Long> ids = byAssetClass.getOrDefault(assetClass, List.of());
            prioritized.addAll(ids.stream().distinct().limit(perClassTarget).toList());
            if (prioritized.size() >= limit) {
                break;
            }
        }

        if (prioritized.size() < limit) {
            Set<Long> alreadyAdded = new HashSet<>(prioritized);
            for (SecurityDetails security : filtered) {
                Long securityId = security.getSecurityId();
                if (securityId != null && !alreadyAdded.contains(securityId)) {
                    prioritized.add(securityId);
                    if (prioritized.size() >= limit) {
                        break;
                    }
                }
            }
        }

        return prioritized.stream().filter(Objects::nonNull).distinct().limit(limit).toList();
    }

    private Map<Long, DailyPrice> loadLatestPricesBySecurityId(Collection<Long> securityIds, LocalDate asOfDate) {
        return securityService.latestPricesForSecurityIds(securityIds, asOfDate);
    }

    private Map<Long, DailyPrice> loadPricesOnOrBefore(Collection<Long> securityIds, LocalDate asOfDate) {
        if (securityIds == null || securityIds.isEmpty() || asOfDate == null) {
            return Map.of();
        }
        return securityService.latestPricesForSecurityIds(securityIds, asOfDate);
    }

    private AssetType toAssetType(AssetClass assetClass) {
        if (assetClass == null) {
            return null;
        }
        return switch (assetClass) {
            case STOCKS -> AssetType.EQUITY;
            case MUTUAL_FUNDS -> AssetType.MUTUAL;
            case COMMODITIES -> AssetType.COMMODITY;
            case BONDS -> AssetType.BOND;
            case CRYPTO -> AssetType.CRYPTO;
            case REITS -> AssetType.REIT;
            case ETFS -> AssetType.ETF;
            case CASH -> AssetType.CASH;
        };
    }

    private boolean isExcludedExchange(String exchange) {
        return exchange != null && (exchange.equalsIgnoreCase("LSE") || exchange.equalsIgnoreCase("NASDAQ"));
    }

    private Portfolio ownPortfolio(Long id) {
        if (id == null) throw new PortfolioValidationException("Portfolio id is required");
        return portfolios.findByIdAndOwnerUsername(id, currentUser.getCurrentUser().getUsername()).orElseThrow(() -> new PortfolioNotFoundException(id));
    }

    private void ensurePortfolioOpen(Portfolio portfolio) {
        if (portfolio.getStatus() == PortfolioStatus.CLOSED) {
            throw new PortfolioValidationException("Closed portfolios cannot be changed");
        }
    }
}
