import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Notice } from '../components/Notice';
import { useHoldingsData } from '../hooks/useHoldingsData';
import { buildAllocationModel } from '../lib/allocation';
import { number } from '../lib/format';
import { AddSecuritiesGrid } from './holdings/AddSecuritiesGrid';
import { HoldingsHeader } from './holdings/HoldingsHeader';
import { HoldingsTiles } from './holdings/HoldingsTiles';
import { TargetGrids } from './holdings/TargetGrids';

export function HoldingsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const data = useHoldingsData(id);
  const [message, setMessage] = useState('');

  const model = useMemo(
    () => buildAllocationModel({ portfolio: data.portfolio, theme: data.theme, holdings: data.holdings }),
    [data.portfolio, data.theme, data.holdings]
  );
  const currency = data.portfolio?.currency || 'INR';

  const add = async (security, shares) => {
    setMessage('');
    const added = await data.addHolding(security.securityId, shares);
    if (added) setMessage(`Added ${number(shares, 4)} shares of ${security.symbol}.`);
    return added;
  };

  const fetchEligibleForSearch = useCallback(async (nextQuery) => {
    const trimmed = nextQuery?.trim() || '';

    console.log('[HoldingsPage] searching security master for matches', { trimmed });
    await data.searchEligibleSecurities(trimmed);
  }, [data.searchEligibleSecurities]);

  const changeShares = async (holdingId, shares) => {
    setMessage('');
    if (await data.updateShares(holdingId, shares)) setMessage('Holding updated.');
  };

  const reject = (text) => {
    setMessage('');
    data.setError(text);
  };

  const save = async () => {
    if (await data.saveHoldings()) navigate(`/portfolios/${id}`);
  };

  return (
    <>
      <HoldingsHeader portfolio={data.portfolio} theme={data.theme} busy={data.busy || data.loading} onSave={save} />

      <Notice tone="error">{data.error}</Notice>
      <Notice tone="success">{message}</Notice>

      {data.loading ? (
        <p className="text-sm text-muted-foreground">Loading holdings…</p>
      ) : data.portfolio && (
        <>
          <HoldingsTiles model={model} holdingCount={data.holdings.length} currency={currency} />
          <TargetGrids model={model} currency={currency} hasTheme={Boolean(data.theme)} />
          <div className="space-y-3">
            <AddSecuritiesGrid
              securities={data.eligible}
              holdings={[]}
              model={model}
              currency={currency}
              busy={data.busy}
              eligibleLoading={data.eligibleLoading}
              onAdd={add}
              onReject={reject}
              onSearch={fetchEligibleForSearch}
            />

            <AddSecuritiesGrid
              securities={[]}
              holdings={data.holdings}
              model={model}
              currency={currency}
              busy={data.busy}
              onChangeShares={changeShares}
              onRemove={data.removeHolding}
              onReject={reject}
              isPortfolioHoldings
            />
          </div>
        </>
      )}
    </>
  );
}
