import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';
import { api } from '../api/client';
import { GridCard } from '../components/grid/GridCard';
import { SecurityCell, actionsCol, assetClassCol, driftCol, moneyCol, numCol, pctCol, sharesCol } from '../components/grid/columns';
import { Notice } from '../components/Notice';
import { PageHeader } from '../components/PageHeader';
import { StatTile } from '../components/StatTile';
import { Button, buttonVariants } from '../components/ui/button';
import { formatDate, money } from '../lib/format';
import { buildRebalanceOrders, projectRebalance } from '../lib/rebalance';
import { localDateString } from '../lib/utils';

const buildRebalanceOrdersAsync = (valuation, eligibleSecurities) => new Promise((resolve) => {
  setTimeout(() => {
    resolve(buildRebalanceOrders(valuation, eligibleSecurities));
  }, 0);
});

export function RebalancePage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const tradeDate = params.get('date') || localDateString();

  const [valuation, setValuation] = useState(null);
  const [portfolio, setPortfolio] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const [v, p, eligible] = await Promise.all([
          api.holdings.valuation(id, tradeDate),
          api.portfolios.get(id),
          api.holdings.eligibleSecurities(id, tradeDate, { page: 0, pageSize: 100 })
        ]);

        if (!active) return;

        setValuation(v);
        setPortfolio(p);

        const rebuiltOrders = await buildRebalanceOrdersAsync(v, eligible);
        if (!active) return;
        setOrders(rebuiltOrders);
      } catch (e) {
        if (!active) return;
        setError(e.message || 'Unable to load rebalance details');
      } finally {
        if (active) setLoading(false);
      }
    };

    load();

    return () => {
      active = false;
    };
  }, [id, tradeDate]);

  const currency = portfolio?.currency || 'INR';
  const projection = useMemo(
    () => (valuation ? projectRebalance(valuation, orders, Number(portfolio?.amount || 0)) : null),
    [valuation, orders, portfolio]
  );

  const investedValue = useMemo(() => {
    if (!valuation?.holdings?.length) return 0;
    return valuation.holdings.reduce((sum, holding) => sum + Number(holding.value || 0), 0);
  }, [valuation]);

  const cashBalance = useMemo(() => {
    if (!valuation) return 0;
    return Math.max(Number(valuation.totalValue || 0) - investedValue, 0);
  }, [valuation, investedValue]);

  const portfolioAmount = useMemo(() => Number(portfolio?.amount || 0), [portfolio]);
  const totalReturns = useMemo(() => Number(valuation?.totalGain || 0), [valuation]);
  const investedAmount = useMemo(() => Math.max(portfolioAmount - cashBalance, 0), [portfolioAmount, cashBalance]);
  const portfolioValue = useMemo(() => investedAmount + totalReturns, [investedAmount, totalReturns]);
  const saleProceeds = useMemo(() => cashBalance + Number(projection?.sellValue || 0), [cashBalance, projection]);

  const orderRows = useMemo(() => orders.map((o) => ({
    ...o,
    tradeShares: Math.abs(o.signedShares),
    proceeds: Math.abs(o.signedShares * o.unitPrice)
  })), [orders]);

  const allocationColumns = useMemo(() => [
    assetClassCol(),
    pctCol('targetPct', 'Target'),
    pctCol('currentPct', 'Current'),
    moneyCol('currentValue', 'Current value', currency, { minWidth: 160 }),
    moneyCol('addValue', 'Needed to hit target', currency, { minWidth: 180 }),
    pctCol('projectedPct', 'After rebalance'),
    driftCol('driftNow', 'Drift now'),
    driftCol('driftAfter', 'Drift after')
  ], [currency]);

  const orderColumns = useMemo(() => [
    {
      headerName: 'Security',
      field: 'symbol',
      minWidth: 220,
      cellRenderer: ({ data }) => {
        if (data?.action !== 'BUY') return <SecurityCell data={data} />;
        const options = data.candidates || [];
        return (
          <select
            aria-label={`Choose security for ${data.assetClass}`}
            value={data.securityId}
            className="field h-8 w-full text-xs"
            onChange={(event) => {
              const selected = options.find((option) => String(option.securityId) === event.target.value);
              if (!selected) return;
              const unitPrice = Number(selected.latestPrice);
              const existingPosition = valuation?.holdings.find((holding) => holding.securityId === selected.securityId);
              setOrders((list) => list.map((order) => {
                if (order.assetClass !== data.assetClass || order.action !== 'BUY') return order;
                const targetValue = Number(order.targetValue || Math.abs(order.signedShares * order.unitPrice));
                return {
                  ...order,
                  securityId: selected.securityId,
                  isin: selected.isin,
                  symbol: selected.symbol,
                  unitPrice,
                  heldShares: Number(existingPosition?.shares || 0),
                  signedShares: targetValue / unitPrice
                };
              }));
            }}
          >
            {options.map((option) => (
              <option key={option.securityId} value={option.securityId}>
                {option.symbol} — {option.name}
              </option>
            ))}
          </select>
        );
      }
    },
    assetClassCol(),
    { headerName: 'Action', field: 'action', minWidth: 100 },
    sharesCol('heldShares', 'Held'),
    moneyCol('unitPrice', 'Price', currency),
    sharesCol('tradeShares', 'Shares', {
      editable: true, singleClickEdit: true, cellEditor: 'agNumberCellEditor', cellEditorParams: { min: 0, precision: 4 }, cellClass: 'cell-input',
      valueSetter: ({ data, newValue }) => {
        const entered = Math.max(Number(newValue) || 0, 0);
        const shares = data.action === 'SELL' ? Math.min(entered, data.heldShares) : entered;
        setOrders((list) => list.map((o) => (o.securityId === data.securityId
          ? {
              ...o,
              signedShares: o.action === 'SELL' ? -shares : shares,
              targetValue: o.action === 'BUY' ? shares * o.unitPrice : o.targetValue
            }
          : o)));
        return false;
      }
    }),
    moneyCol('proceeds', 'Trade value', currency),
    actionsCol(({ data }) => (
      <Button size="icon" variant="ghost" className="text-neg hover:bg-neg/10 hover:text-neg" aria-label={`Remove ${data.symbol}`} onClick={() => setOrders((list) => list.filter((o) => o.securityId !== data.securityId))}><Trash2 /></Button>
    ), 80)
  ], [currency, valuation]);

  const submit = async () => {
    const trades = orders
      .filter((o) => o.signedShares !== 0)
      .map(({ securityId, isin, signedShares }) => ({ securityId, isin, signedShares }));
    if (!trades.length) { setError('Keep at least one buy or sell order to rebalance.'); return; }
    try {
      setSaving(true);
      setError('');
      await api.holdings.rebalance(id, { tradeDate, trades });
      window.location.assign(`/portfolios/${id}?date=${tradeDate}`);
    } catch (e) {
      setError(e.message || 'Unable to apply rebalance');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-muted-foreground">Loading rebalance proposal…</p>;

  return (
    <>
      <PageHeader
        title="Rebalance"
        description={`Proposed buys and sells to restore theme targets, priced on ${formatDate(tradeDate)}.`}
      />

      <Notice tone="error">{error}</Notice>
      {valuation && !valuation.allocations?.length && <Notice tone="warning">Attach a theme to calculate targets before rebalancing.</Notice>}

      {projection && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Portfolio value" value={money(portfolioValue, currency)} sub={`Invested ${money(investedAmount, currency)} + returns ${money(totalReturns, currency)}`} />
            <StatTile label="Invested" value={money(investedAmount, currency)} sub={`Total amount ${money(portfolioAmount, currency)} - cash ${money(cashBalance, currency)}`} />
            <StatTile label="Cash" value={money(cashBalance, currency)} tone={cashBalance < 0 ? 'neg' : undefined} sub="Unallocated cash balance" />
            <StatTile label="Sale proceeds" value={money(saleProceeds, currency)} sub={`${money(cashBalance, currency)} cash + ${money(projection.sellValue, currency)} sell proceeds`} />
          </div>

          <GridCard
            title="Allocation: now, target, after rebalance"
            exportName="rebalance-allocation"
            searchable={false}
            pagination
            pageSize={8}
            rowData={projection.allocations}
            columnDefs={allocationColumns}
            getRowId={({ data }) => data.assetClass}
            height={Math.min(projection.allocations.length * 46 + 70, 360)}
          />
          <GridCard
            title="Proposed buy and sell orders"
            subtitle="Buy underweight classes and sell overweight classes. Edit quantities or choose a different eligible security before applying."
            exportName="rebalance-orders"
            actions={<Button onClick={submit} disabled={saving || !orders.length}><Save />{saving ? 'Applying…' : 'Apply rebalance'}</Button>}
            pagination
            pageSize={10}
            rowData={orderRows}
            columnDefs={orderColumns}
            getRowId={({ data }) => String(data.securityId)}
            height={Math.min(Math.max(orderRows.length * 46 + 70, 200), 400)}
            emptyMessage="No buy or sell orders are needed for the current allocation."
          />
        </>
      )}
    </>
  );
}
