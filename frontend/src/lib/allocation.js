// Match backend allocation guardrails so the UI shows the room the server will accept.

const TOLERANCE = 1;

export function buildAllocationModel({ portfolio, theme, holdings = [] }) {
  const amount = Number(portfolio?.amount || 0);
  const invested = holdings.reduce((total, holding) => total + Number(holding.value || 0), 0);
  const availableCash = Math.max(amount - invested, 0);

  const valueByClass = {};
  const valueByCategory = {};
  holdings.forEach((holding) => {
    const value = Number(holding.value || 0);
    valueByClass[holding.assetClass] = (valueByClass[holding.assetClass] || 0) + value;
    if (holding.assetClass === 'STOCKS' && holding.equityCategory) {
      valueByCategory[holding.equityCategory] = (valueByCategory[holding.equityCategory] || 0) + value;
    }
  });

  const toRow = (key, targetPct, currentValue, isCash = false) => {
    const targetValue = amount * targetPct / 100;
    const currentPct = amount > 0 ? currentValue / amount * 100 : 0;
    return {
      key,
      targetPct,
      targetValue,
      currentValue,
      currentPct,
      gapPct: currentPct - targetPct,
      leftValue: Math.max(targetValue - currentValue, 0),
      roomValue: isCash ? 0 : Math.max(targetValue + TOLERANCE - currentValue, 0)
    };
  };

  const classRows = (theme?.allocations || []).map((allocation) => {
    const isCash = allocation.assetClass === 'CASH';
    const current = isCash ? availableCash + (valueByClass.CASH || 0) : valueByClass[allocation.assetClass] || 0;
    return {
      ...toRow(allocation.assetClass, Number(allocation.percentage), current, isCash),
      assetClass: allocation.assetClass
    };
  });

  const stocksTargetPct = Number(theme?.allocations?.find((allocation) => allocation.assetClass === 'STOCKS')?.percentage || 0);
  const categoryRows = (theme?.equityAllocations || []).map((allocation) => ({
    ...toRow(
      allocation.equityCategory,
      stocksTargetPct * Number(allocation.percentage) / 100,
      valueByCategory[allocation.equityCategory] || 0
    ),
    equityCategory: allocation.equityCategory,
    equityWeightPct: Number(allocation.percentage)
  }));

  return { amount, invested, availableCash, classRows, categoryRows };
}

/** Return the tightest cash, asset-class, or equity-category limit for a security. */
export function roomFor(model, { assetClass, equityCategory }) {
  const limits = [{ by: 'cash', value: model.availableCash }];

  const classRow = model.classRows.find((row) => row.assetClass === assetClass);
  if (classRow) limits.push({ by: 'class', value: classRow.roomValue });

  if (assetClass === 'STOCKS' && equityCategory) {
    const categoryRow = model.categoryRows.find((row) => row.equityCategory === equityCategory);
    if (categoryRow) limits.push({ by: 'category', value: categoryRow.roomValue });
  }

  const tightest = limits.reduce((best, limit) => (limit.value < best.value ? limit : best));
  return { room: Math.max(tightest.value, 0), limitedBy: tightest.by };
}

/** Largest share quantity that fits in `value`. Whole shares when possible, otherwise 4 decimals. */
export function sharesFromValue(value, price) {
  if (!(price > 0) || !(value > 0)) return 0;
  const whole = Math.floor(value / price + 1e-9);
  return whole >= 1 ? whole : Math.floor(value / price * 10000 + 1e-9) / 10000;
}

export const pctOfPortfolio = (value, amount) => (amount > 0 ? Number(value || 0) / amount * 100 : 0);
export const valueFromPct = (percentage, amount) => amount * Number(percentage || 0) / 100;

export const limitLabel = (limitedBy, { assetClassLabel, categoryLabel }) => ({
  cash: 'Available cash',
  class: `${assetClassLabel} target`,
  category: `${categoryLabel} target`
}[limitedBy]);
