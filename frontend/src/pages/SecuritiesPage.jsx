import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { api } from '../api/client';
import { GridCard } from '../components/grid/GridCard';
import { Pill, textCol } from '../components/grid/columns';
import { Notice } from '../components/Notice';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { formatAssetClass } from '../lib/assetClassUtils';

const isLse = (exchange) => exchange === 'LSE' || exchange === 'LSEG';

const REQUIRED = [
  ['Exchange', (s) => s.exchange], ['Symbol', (s) => s.symbol], ['Series', (s) => s.series],
  ['Description', (s) => s.description], ['Security ID', (s) => s.isin || s.cupid || s.securityId],
  ['Country', (s) => s.country], ['Currency', (s) => s.currency]
];
const missingFields = (s) => REQUIRED.filter(([, get]) => { const v = get(s); return v == null || String(v).trim() === ''; }).map(([name]) => name);

function ExchangeHeader({ displayName, exchanges, selectedExchange, onExchangeChange }) {
  return (
    <div className="flex h-full flex-col justify-center gap-1 px-1">
      <span className="font-semibold">{displayName}</span>
      <select
        aria-label="Filter securities by exchange"
        className="field h-7 min-w-0 px-1 text-xs"
        value={selectedExchange}
        onChange={(event) => {
          onExchangeChange(event.target.value);
          event.currentTarget.blur();
        }}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <option value="">All</option>
        {exchanges.map((exchange) => <option key={exchange} value={exchange}>{exchange}</option>)}
      </select>
    </div>
  );
}

export function SecuritiesPage() {
  const [mode, setMode] = useState('symbol');
  const [symbol, setSymbol] = useState('');
  const [exchange, setExchange] = useState('');
  const [masterExchange, setMasterExchange] = useState('');
  const [masterIsin, setMasterIsin] = useState('');
  const [masterSector, setMasterSector] = useState('');
  const [masterIndustry, setMasterIndustry] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [result, setResult] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [master, setMaster] = useState([]);
  const [filterOptions, setFilterOptions] = useState({ exchanges: [], sectors: [], industries: [] });
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.securities.filterOptions().then(setFilterOptions).catch((e) => setError(e.message || 'Unable to load security filters'));
  }, []);

  useEffect(() => {
    setLoading(true);
    api.securities.list({ page, pageSize, exchange: masterExchange, isin: masterIsin, sector: masterSector, industry: masterIndustry })
      .then((pageResponse) => {
        setMaster(pageResponse.content || []);
        setTotalElements(pageResponse.totalElements || 0);
        setTotalPages(pageResponse.totalPages || 0);
      })
      .catch((e) => setError(e.message || 'Unable to load securities'))
      .finally(() => setLoading(false));
  }, [page, pageSize, masterExchange, masterIsin, masterSector, masterIndustry]);

  const exchanges = filterOptions.exchanges;
  const sectors = filterOptions.sectors;
  const industries = filterOptions.industries;
  const filteredMaster = master;
  const idLabel = isLse(exchange) ? 'CUPID' : 'ISIN';
  const firstRow = totalElements === 0 ? 0 : page * pageSize + 1;
  const lastRow = Math.min((page + 1) * pageSize, totalElements);
  const pageButtons = useMemo(() => {
    const totalPageCount = Math.max(totalPages, 1);
    if (totalPageCount <= 7) {
      return Array.from({ length: totalPageCount }, (_, index) => index + 1);
    }

    const pages = new Set([1, page + 1, totalPageCount]);
    for (let candidate = page - 2; candidate <= page + 2; candidate += 1) {
      if (candidate > 1 && candidate < totalPageCount) {
        pages.add(candidate);
      }
    }

    const ordered = [...pages].sort((a, b) => a - b);
    const result = [];
    let previous = 0;
    ordered.forEach((pageNumber) => {
      if (previous !== 0 && pageNumber > previous + 1) {
        result.push('ellipsis');
      }
      result.push(pageNumber);
      previous = pageNumber;
    });
    return result;
  }, [page, totalPages]);

  const search = async (event) => {
    event.preventDefault();
    setSearching(true); setSearchError(''); setResult(null);
    try {
      const query = mode === 'symbol' ? { symbol: symbol.trim() } : { exchange: exchange.trim(), [isLse(exchange) ? 'cupid' : 'isin']: identifier.trim() };
      setResult(await api.securities.search(query));
    } catch (e) {
      setSearchError(e.message || 'No matching security found.');
    } finally {
      setSearching(false);
    }
  };

  const columns = useMemo(() => [
    textCol('symbol', 'Symbol', { cellClass: 'font-semibold' }),
    {
      field: 'exchange',
      headerName: 'Exchange',
      minWidth: 150,
      sortable: false,
      filter: false,
      headerComponent: ExchangeHeader,
      headerComponentParams: {
        exchanges,
        selectedExchange: masterExchange,
        onExchangeChange: (value) => { setMasterExchange(value); setPage(0); }
      }
    },
    textCol('series', 'Series', { minWidth: 100 }),
    textCol('description', 'Description', { minWidth: 260, flex: 2 }),
    { headerName: 'Security ID', colId: 'id', minWidth: 170, filter: 'agTextColumnFilter', valueGetter: ({ data }) => data.isin || data.cupid || data.securityId },
    textCol('assetClass', 'Asset class', { minWidth: 130, valueFormatter: ({ value }) => formatAssetClass(value) }),
    textCol('sector', 'Sector', { minWidth: 180 }),
    textCol('industry', 'Industry', { minWidth: 200 }),
    textCol('country', 'Country', { minWidth: 110 }),
    textCol('currency', 'Currency', { minWidth: 110 }),
    {
      headerName: 'Data quality', colId: 'quality', minWidth: 160, filter: 'agTextColumnFilter',
      valueGetter: ({ data }) => { const m = missingFields(data); return m.length ? `Missing ${m.length}` : 'Complete'; },
      tooltipValueGetter: ({ data }) => missingFields(data).join(', ') || 'All required fields present',
      cellRenderer: ({ value }) => <Pill tone={value === 'Complete' ? 'good' : 'warn'}>{value}</Pill>
    }
  ], [masterExchange]);

  const missing = result ? missingFields(result) : [];

  return (
    <>
      <PageHeader title="Securities" description="Look up one security, or scroll the full securities master below." />

      <Card className="p-5">
        <div className="inline-flex rounded-md border border-input p-0.5" role="group" aria-label="Search type">
          {[['symbol', 'By symbol'], ['id', 'By exchange and ID']].map(([key, text]) => (
            <button key={key} type="button" aria-pressed={mode === key} onClick={() => { setMode(key); setResult(null); setSearchError(''); }}
              className={`rounded px-3 py-1.5 text-sm font-medium ${mode === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>{text}</button>
          ))}
        </div>
        <form onSubmit={search} className="mt-4 flex flex-wrap items-end gap-3">
          {mode === 'symbol' ? (
            <label className="w-64"><span className="field-label">Symbol</span>
              <input required className="field" value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="AAPL or RELIANCE" /></label>
          ) : (
            <>
              <label className="w-48"><span className="field-label">Exchange</span>
                <select required className="field" value={exchange} onChange={(e) => { setExchange(e.target.value); setIdentifier(''); }}>
                  <option value="">Choose…</option>{exchanges.map((x) => <option key={x}>{x}</option>)}
                </select></label>
              <label className="w-64"><span className="field-label">{idLabel}</span>
                <input required className="field" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder={`Enter ${idLabel}`} /></label>
            </>
          )}
          <Button type="submit" disabled={searching}><Search />{searching ? 'Searching…' : 'Search'}</Button>
        </form>
        <Notice tone="error" className="mt-4">{searchError}</Notice>
        {result && (
          <div className="mt-5 border-t border-border pt-4">
            <p className="font-semibold">{result.symbol}{result.series ? ` · ${result.series}` : ''} <span className="font-normal text-muted-foreground">{result.name}</span></p>
            {missing.length > 0 && <Notice tone="warning" className="mt-3">Missing required values: {missing.join(', ')}.</Notice>}
            <dl className="mt-3 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
              {[...REQUIRED.map(([name, get]) => [name, get(result)]), ['Sector', result.sector], ['Industry', result.industry], ['Asset class', formatAssetClass(result.assetClass)]].map(([name, value]) => (
                <div key={name} className="flex justify-between gap-4 border-t border-border py-2.5 text-sm">
                  <dt className="text-muted-foreground">{name}</dt>
                  <dd className={`break-all text-right font-medium ${value ? '' : 'text-neg'}`}>{value || 'Missing'}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </Card>

      <Notice tone="error">{error}</Notice>
      <GridCard
        title="Securities master"
        subtitle={loading ? 'Loading…' : totalElements > 0 ? `Showing ${firstRow}-${lastRow} of ${totalElements} securities. Scroll sideways for sector, industry and data quality.` : 'No securities in the master yet.'}
        toolbar={(
          <>
            <label className="w-44">
              <span className="sr-only">Filter by ISIN</span>
              <input
                className="field h-9"
                value={masterIsin}
                onChange={(event) => { setMasterIsin(event.target.value); setPage(0); }}
                placeholder="Filter ISIN"
              />
            </label>
            <label className="w-44">
              <span className="sr-only">Filter by sector</span>
              <select className="field h-9" value={masterSector} onChange={(event) => { setMasterSector(event.target.value); setMasterIndustry(''); setPage(0); }}>
                <option value="">All sectors</option>
                {sectors.map((sector) => <option key={sector} value={sector}>{sector}</option>)}
              </select>
            </label>
            <label className="w-48">
              <span className="sr-only">Filter by industry</span>
              <select className="field h-9" value={masterIndustry} onChange={(event) => { setMasterIndustry(event.target.value); setPage(0); }}>
                <option value="">All industries</option>
                {industries.map((industry) => <option key={industry} value={industry}>{industry}</option>)}
              </select>
            </label>
            {(masterExchange || masterIsin || masterSector || masterIndustry) && (
              <Button type="button" variant="ghost" size="sm" onClick={() => { setMasterExchange(''); setMasterIsin(''); setMasterSector(''); setMasterIndustry(''); }}>
                Clear filters
              </Button>
            )}
          </>
        )}
        exportName="securities-master"
        rowData={filteredMaster}
        columnDefs={columns}
        loading={loading}
        getRowId={({ data }) => String(data.securityId)}
        height={520}
        headerHeight={64}
        tooltipShowDelay={300}
        emptyMessage={master.length > 0 ? 'No securities match the selected filters.' : 'No securities in the master yet.'}
      />

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            disabled={page === 0 || loading}
            onClick={() => setPage((current) => Math.max(current - 1, 0))}
          >
            {'< Back'}
          </button>
          {pageButtons.map((buttonNumber, index) => {
            if (buttonNumber === 'ellipsis') {
              return <span key={`ellipsis-${index}`} className="px-2 text-sm text-muted-foreground">...</span>;
            }

            const isCurrent = buttonNumber === page + 1;
            return (
              <button
                key={buttonNumber}
                type="button"
                onClick={() => setPage(buttonNumber - 1)}
                className={`h-10 min-w-10 rounded-md border px-3 text-sm transition ${isCurrent ? 'border-foreground bg-foreground text-background' : 'border-input bg-background text-foreground hover:bg-accent'}`}
                disabled={loading}
              >
                {buttonNumber}
              </button>
            );
          })}
          <button
            type="button"
            className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            disabled={page >= Math.max(totalPages - 1, 0) || loading}
            onClick={() => setPage((current) => Math.min(current + 1, Math.max(totalPages - 1, 0)))}
          >
            {'Next >'}
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{totalElements === 0 ? '0-0 of 0' : `${firstRow}-${lastRow} of ${totalElements}`}</span>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Result per page</span>
            <select
              className="field h-9 w-20"
              value={pageSize}
              onChange={(event) => { setPageSize(Number(event.target.value)); setPage(0); }}
            >
              {[25, 50, 100, 200].map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
        </div>
      </div>
    </>
  );
}
