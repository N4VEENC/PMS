import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRightLeft } from 'lucide-react';
import { api } from '../api/client';
import { GridCard } from '../components/grid/GridCard';
import { actionsCol, assetClassCol, driftCol, pctCol, textCol } from '../components/grid/columns';
import { Notice } from '../components/Notice';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/ui/button';
import { formatDate } from '../lib/format';

export function AlertsPage() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [skipped, setSkipped] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const saved = (await api.portfolios.list()).filter((p) => p.holdingsSaved);
        const results = await Promise.allSettled(saved.map(async (portfolio) => ({ portfolio, valuation: await api.holdings.valuation(portfolio.id) })));
        if (!active) return;
        const ok = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
        const nextAlerts = ok.flatMap(({ portfolio, valuation }) => (valuation.allocations || []).filter((a) => a.alert).map((a) => ({
          portfolioId: portfolio.id,
          portfolio: portfolio.name,
          date: valuation.requestedDate,
          assetClass: a.assetClass,
          targetPct: Number(a.targetPercentage),
          currentPct: Number(a.currentPercentage),
          driftPp: Number(a.driftPercentagePoints)
        })));

        setAlerts(nextAlerts);
        setSkipped(results.length - ok.length);

        const nextCount = nextAlerts.length;
        try {
          localStorage.setItem('portfolio_alert_count', String(nextCount));
        } catch {
          // ignore localStorage quota issues
        }
        window.dispatchEvent(new CustomEvent('portfolio-alert-count', { detail: { count: nextCount } }));
      } catch (e) {
        if (active) setError(e.message || 'Unable to load alerts');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const columns = useMemo(() => [
    textCol('portfolio', 'Portfolio', { cellClass: 'font-semibold', minWidth: 200 }),
    assetClassCol(),
    pctCol('targetPct', 'Target'),
    pctCol('currentPct', 'Current'),
    driftCol('driftPp', 'Drift', { sort: 'desc', comparator: (a, b) => Math.abs(a) - Math.abs(b) }),
    textCol('date', 'As of', { valueFormatter: ({ value }) => formatDate(value) }),
    actionsCol(({ data }) => (
      <Button size="sm" variant="outline" onClick={() => navigate(`/portfolios/${data.portfolioId}/rebalance?date=${data.date}`)}><ArrowRightLeft /> Rebalance</Button>
    ), 140)
  ], [navigate]);

  return (
    <>
      <PageHeader title="Alerts" description="Asset classes that have drifted more than 5 percentage points from their theme target." />
      <Notice tone="error">{error}</Notice>
      {skipped > 0 && <Notice tone="warning">Could not check {skipped} saved {skipped === 1 ? 'portfolio' : 'portfolios'}.</Notice>}
      <GridCard
        title="Allocation drift alerts"
        subtitle={loading ? 'Checking portfolios…' : `${alerts.length} ${alerts.length === 1 ? 'alert' : 'alerts'} across your saved portfolios.`}
        exportName="drift-alerts"
        rowData={alerts}
        columnDefs={columns}
        loading={loading}
        getRowId={({ data }) => `${data.portfolioId}-${data.assetClass}`}
        height={420}
        emptyMessage="No drift alerts. Every checked asset class is within 5 pp of its target."
      />
    </>
  );
}
