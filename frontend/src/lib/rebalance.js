// Rebalance proposal: sell overweight classes and categories first, then fill every underweight
// target using the cash freed up by sales plus any available cash. This keeps a single rebalance
// focused on achieving zero drift instead of only trimming the gap a little.
export function buildRebalanceOrders(valuation, eligibleSecurities = [], theme = null) {
  const orders = [];
  const valueByClass = new Map();
  const valueByCategory = new Map();

  valuation.holdings.forEach((holding) => {
    const value = Number(holding.value || 0);
    valueByClass.set(holding.assetClass, (valueByClass.get(holding.assetClass) || 0) + value);
    if (holding.assetClass === 'STOCKS' && holding.equityCategory) {
      valueByCategory.set(holding.equityCategory, (valueByCategory.get(holding.equityCategory) || 0) + value);
    }
  });

  const total = Number(valuation.totalValue || 0);
  const invested = valuation.holdings.reduce((sum, holding) => sum + Number(holding.value || 0), 0);
  const currentCash = Math.max(total - invested, 0);

  const themeAllocations = (theme?.allocations?.length ? theme.allocations : valuation.allocations || []);
  const stockTargetPct = Number((theme?.allocations || []).find((allocation) => allocation.assetClass === 'STOCKS')?.percentage
    || (valuation.allocations || []).find((allocation) => allocation.assetClass === 'STOCKS')?.targetPercentage
    || 0);
  const equityTargets = (theme?.equityAllocations || []).map((allocation) => ({
    equityCategory: allocation.equityCategory,
    percentage: Number(allocation.percentage || 0)
  }));

  const addSellOrders = ({ saleValue, saleRows, label }) => {
    if (saleRows.length === 0 || saleValue <= 0) return 0;
    const totalSellingValue = saleRows.reduce((sum, row) => sum + Number(row.value || 0), 0);
    if (!totalSellingValue) return 0;

    let soldValue = 0;
    saleRows.forEach((holding) => {
      const shareOfSale = (saleValue * Number(holding.value || 0)) / totalSellingValue;
      const signedShares = -(shareOfSale / Number(holding.currentPrice || 1));
      if (Math.abs(signedShares) > 0.000001) {
        orders.push({
          securityId: holding.securityId,
          isin: holding.isin,
          symbol: holding.symbol,
          assetClass: holding.assetClass,
          equityCategory: holding.equityCategory || label,
          unitPrice: Number(holding.currentPrice),
          heldShares: Number(holding.shares),
          signedShares,
          action: 'SELL'
        });
        soldValue += shareOfSale;
      }
    });
    return soldValue;
  };

  const addBuyOrders = ({ buyValue, candidates, label }) => {
    if (buyValue <= 0 || !candidates.length) return 0;
    const candidate = candidates[0];
    const candidatePrice = Number(candidate?.currentPrice ?? candidate?.latestPrice ?? 0);
    if (!candidate || candidatePrice <= 0) return 0;

    const plannedBuy = Math.min(buyValue, currentCash + sellProceeds);
    if (plannedBuy <= 0) return 0;

    orders.push({
      securityId: candidate.securityId,
      isin: candidate.isin,
      symbol: candidate.symbol,
      assetClass: candidate.assetClass,
      equityCategory: candidate.equityCategory ?? label,
      unitPrice: candidatePrice,
      heldShares: 0,
      signedShares: plannedBuy / candidatePrice,
      targetValue: plannedBuy,
      candidates,
      action: 'BUY'
    });

    return plannedBuy;
  };

  let sellProceeds = 0;
  const buyTargets = [];

  for (const allocation of themeAllocations) {
    const assetClass = allocation.assetClass;
    const targetValue = total * Number(allocation.targetPercentage ?? allocation.percentage ?? 0) / 100;
    const currentValue = valueByClass.get(assetClass) || 0;
    const gap = currentValue - targetValue;

    if (assetClass === 'STOCKS' && equityTargets.length) {
      continue;
    }

    if (gap > 0.01) {
      sellProceeds += addSellOrders({
        saleValue: gap,
        saleRows: valuation.holdings.filter((holding) => holding.assetClass === assetClass),
        label: assetClass
      });
    } else if (gap < -0.01) {
      buyTargets.push({
        assetClass,
        label: assetClass,
        targetValue: targetValue - currentValue,
        value: -gap,
        candidates: eligibleSecurities.filter((row) => row.assetClass === assetClass)
      });
    }
  }

  if (equityTargets.length) {
    equityTargets.forEach(({ equityCategory, percentage }) => {
      const targetValue = total * stockTargetPct * percentage / 100 / 100;
      const currentValue = valueByCategory.get(equityCategory) || 0;
      const gap = currentValue - targetValue;

      if (gap > 0.01) {
        sellProceeds += addSellOrders({
          saleValue: gap,
          saleRows: valuation.holdings.filter((holding) => holding.assetClass === 'STOCKS' && holding.equityCategory === equityCategory),
          label: equityCategory
        });
      } else if (gap < -0.01) {
        buyTargets.push({
          assetClass: 'STOCKS',
          label: equityCategory,
          targetValue: targetValue - currentValue,
          value: -gap,
          candidates: eligibleSecurities.filter((row) => row.assetClass === 'STOCKS' && row.equityCategory === equityCategory)
        });
      }
    });
  }

  const availableForBuys = currentCash + sellProceeds;
  let remainingCash = availableForBuys;
  buyTargets.sort((left, right) => right.value - left.value).forEach((buyTarget) => {
    if (remainingCash <= 0 || buyTarget.value <= 0) return;
    const amount = Math.min(buyTarget.value, remainingCash);
    if (amount <= 0) return;
    const candidate = buyTarget.candidates[0];
    const candidatePrice = Number(candidate?.currentPrice ?? candidate?.latestPrice ?? 0);
    if (!candidate || candidatePrice <= 0) return;

    const plannedBuy = Math.min(amount, remainingCash);
    orders.push({
      securityId: candidate.securityId,
      isin: candidate.isin,
      symbol: candidate.symbol,
      assetClass: candidate.assetClass,
      equityCategory: candidate.equityCategory ?? buyTarget.label,
      unitPrice: candidatePrice,
      heldShares: 0,
      signedShares: plannedBuy / candidatePrice,
      targetValue: plannedBuy,
      candidates: buyTarget.candidates,
      action: 'BUY'
    });
    remainingCash -= plannedBuy;
  });

  return orders;
}

export const buildSellOrders = buildRebalanceOrders;

export function projectRebalance(valuation, orders, portfolioAmount) {
  const total = Number(valuation.totalValue);
  const valueByClass = new Map();
  let invested = 0;
  valuation.holdings.forEach((holding) => {
    const value = Number(holding.value);
    invested += value;
    valueByClass.set(holding.assetClass, (valueByClass.get(holding.assetClass) || 0) + value);
  });

  const cash = Math.max(total - invested, 0);
  valueByClass.set('CASH', cash);
  const currentByClass = new Map(valueByClass);

  let orderTotal = 0;
  let sellValue = 0;
  let purchaseValue = 0;
  orders.forEach((order) => {
    const tradeValue = order.signedShares * order.unitPrice;
    orderTotal += tradeValue;
    valueByClass.set(order.assetClass, (valueByClass.get(order.assetClass) || 0) + tradeValue);
    if (tradeValue < 0) sellValue -= tradeValue;
    if (tradeValue > 0) purchaseValue += tradeValue;
  });

  // Sells add proceeds to cash; purchases consume cash.
  const projectedInvested = invested - sellValue + purchaseValue;
  const projectedCash = cash + sellValue - purchaseValue;
  valueByClass.set('CASH', projectedCash);
  const projectedTotal = projectedInvested + projectedCash;

  return {
    cashBefore: cash,
    sellValue,
    purchaseValue,
    projectedInvested,
    projectedCash,
    projectedTotal,
    allocations: valuation.allocations.map((allocation) => {
      const targetPct = Number(allocation.targetPercentage);
      const currentValue = currentByClass.get(allocation.assetClass) || 0;
      const projectedValue = valueByClass.get(allocation.assetClass) || 0;
      const projectedPct = projectedTotal > 0 ? (projectedValue / projectedTotal) * 100 : 0;
      return {
        assetClass: allocation.assetClass,
        targetPct,
        currentPct: Number(allocation.currentPercentage),
        currentValue,
        initialTarget: (portfolioAmount * targetPct) / 100,
        addValue: Math.max((total * targetPct) / 100 - currentValue, 0),
        projectedValue,
        projectedPct,
        driftNow: Number(allocation.currentPercentage) - targetPct,
        driftAfter: projectedPct - targetPct
      };
    })
  };
}
