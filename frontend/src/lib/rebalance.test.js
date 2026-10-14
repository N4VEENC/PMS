import test from 'node:test';
import assert from 'node:assert/strict';

import { buildRebalanceOrders } from './rebalance.js';

test('uses the attached theme equity targets instead of treating all stocks as one bucket', () => {
  const valuation = {
    totalValue: 100000,
    holdings: [
      { securityId: 1, assetClass: 'STOCKS', equityCategory: 'LARGE_CAP', value: 50000, currentPrice: 100, shares: 500 },
      { securityId: 2, assetClass: 'STOCKS', equityCategory: 'MID_CAP', value: 10000, currentPrice: 100, shares: 100 }
    ],
    allocations: [{
      assetClass: 'STOCKS',
      targetPercentage: 60,
      currentPercentage: 60,
      driftPercentagePoints: 0
    }]
  };

  const theme = {
    allocations: [{ assetClass: 'STOCKS', percentage: 60 }],
    equityAllocations: [
      { equityCategory: 'LARGE_CAP', percentage: 60 },
      { equityCategory: 'MID_CAP', percentage: 30 },
      { equityCategory: 'SMALL_CAP', percentage: 10 }
    ]
  };

  const eligibleSecurities = [
    { securityId: 10, assetClass: 'STOCKS', equityCategory: 'LARGE_CAP', symbol: 'AAA', name: 'Alpha', currentPrice: 100 },
    { securityId: 11, assetClass: 'STOCKS', equityCategory: 'MID_CAP', symbol: 'BBB', name: 'Bravo', currentPrice: 90 },
    { securityId: 12, assetClass: 'STOCKS', equityCategory: 'SMALL_CAP', symbol: 'CCC', name: 'Charlie', currentPrice: 80 }
  ];

  const orders = buildRebalanceOrders(valuation, eligibleSecurities, theme);
  const buyOrders = orders.filter((order) => order.action === 'BUY');
  assert.equal(buyOrders.length, 2, 'rebalance should create buy orders for every underweight equity category');
  assert.deepEqual(buyOrders.map((order) => order.equityCategory).sort(), ['MID_CAP', 'SMALL_CAP']);
  assert.deepEqual(buyOrders[0].candidates.map((candidate) => candidate.equityCategory), ['MID_CAP']);
  assert.deepEqual(buyOrders[1].candidates.map((candidate) => candidate.equityCategory), ['SMALL_CAP']);
});
