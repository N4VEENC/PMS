import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Plus, Search, Trash2 } from 'lucide-react';
import { GridCard } from '../../components/grid/GridCard';
import {
  SecurityCell, actionsCol, assetClassCol, categoryCol, moneyCol, numCol, sharesCol
} from '../../components/grid/columns';
import { Button } from '../../components/ui/button';
import { pctOfPortfolio, roomFor, sharesFromValue, valueFromPct } from '../../lib/allocation';
import { formatAssetClass } from '../../lib/assetClassUtils';
import { money, number, pct } from '../../lib/format';
import { cn } from '../../lib/utils';
import { RoomCell } from './RoomCell';

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : '';
};

/**
 * One searchable holdings table: current holdings stay visible, and eligible securities only appear
 * after a search query is entered. This prevents the whole security master from being listed by default.
 */
export function AddSecuritiesGrid({ securities, holdings, model, currency, busy, eligibleLoading = false, onAdd, onChangeShares, onRemove, onReject, onSearch, isPortfolioHoldings = false }) {
  const [drafts, setDrafts] = useState({});
  const [query, setQuery] = useState('');
  const lastSubmittedQueryRef = useRef('');

  useEffect(() => {
    if (isPortfolioHoldings) return;

    const trimmed = query.trim();
    if (trimmed === lastSubmittedQueryRef.current) {
      return;
    }

    const timeoutId = setTimeout(() => {
      const nextQuery = query.trim();
      lastSubmittedQueryRef.current = nextQuery;
      if (nextQuery) {
        onSearch?.(nextQuery);
      } else {
        onSearch?.('');
      }
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [isPortfolioHoldings, onSearch, query]);

  const heldBySecurity = useMemo(
    () => Object.fromEntries(holdings.map((holding) => [holding.securityId, holding])),
    [holdings]
  );

  const filteredSecurities = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return [];
    return securities.filter((security) => {
      const haystack = [
        security.symbol,
        security.isin,
        security.name,
        security.exchange,
        security.description,
        security.assetClass,
        security.equityCategory,
        security.series,
        security.country
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(trimmed) || String(security.securityId).includes(trimmed);
    });
  }, [securities, query]);

  const rows = useMemo(() => {
    if (isPortfolioHoldings) {
      return holdings.map((holding) => {
        const price = Number(holding.price || 0);
        const { room, limitedBy } = roomFor(model, holding);
        return {
          ...holding,
          isHolding: true,
          securityId: holding.securityId,
          symbol: holding.symbol,
          assetClass: holding.assetClass,
          price,
          value: Number(holding.value),
          shares: Number(holding.shares),
          room,
          limitedBy,
          canAdd: sharesFromValue(room, price),
          pctValue: pctOfPortfolio(holding.value, model.amount)
        };
      });
    }

    return filteredSecurities.map((security) => {
      const price = Number(security.latestPrice || 0);
      const { room, limitedBy } = roomFor(model, security);
      const shares = drafts[security.securityId] ?? '';
      const cost = (Number(shares) || 0) * price;
      return {
        ...security,
        isHolding: false,
        price,
        heldShares: Number(heldBySecurity[security.securityId]?.shares || 0),
        room,
        limitedBy,
        maxShares: sharesFromValue(room, price),
        sharesToAdd: shares,
        cost,
        pctValue: shares === '' ? '' : pctOfPortfolio(cost, model.amount),
        roomAfter: room - cost,
        over: cost > room + 1e-6
      };
    });
  }, [isPortfolioHoldings, holdings, model, filteredSecurities, drafts, heldBySecurity]);

  const setShares = (securityId, value) => setDrafts((current) => ({ ...current, [securityId]: value }));

  const add = async (row) => {
    if (await onAdd(row, Number(row.sharesToAdd))) {
      setDrafts(({ [row.securityId]: _added, ...rest }) => rest);
    }
  };

  const changeHolding = (row, newShares) => {
    if (!onChangeShares || !(newShares > 0) || newShares === row.shares) return;
    if (newShares > row.shares && row.price > 0) {
      const extra = (newShares - row.shares) * row.price;
      if (extra > row.room + 1e-6) {
        onReject?.(`You can add at most ${number(row.canAdd, 4)} more shares of ${row.symbol} right now. Room left is ${money(row.room, currency)}.`);
        return;
      }
    }
    onChangeShares(row.id, newShares);
  };

  const columns = useMemo(() => {
    if (isPortfolioHoldings) {
      return [
        { headerName: 'Security', field: 'symbol', filter: 'agTextColumnFilter', cellRenderer: SecurityCell, width: 220 },
        assetClassCol(),
        sharesCol('shares', 'Held shares', {
          editable: !busy,
          cellEditor: 'agNumberCellEditor',
          cellEditorParams: { min: 0, precision: 4 },
          cellClass: 'cell-input',
          valueSetter: ({ data, newValue }) => { changeHolding(data, Number(newValue)); return false; }
        }),
        moneyCol('price', 'Price', currency),
        moneyCol('value', 'Value', currency, { cellClass: 'font-semibold' }),
        numCol('pctValue', '% of portfolio', {
          valueFormatter: ({ value }) => pct(value),
          cellClass: 'font-medium'
        }),
        numCol('room', 'Room left', { minWidth: 180, cellRenderer: (props) => <RoomCell {...props} currency={currency} /> }),
        sharesCol('canAdd', 'Can add', { cellClass: 'font-semibold' }),
        actionsCol(({ data }) => (
          <Button
            size="icon"
            variant="ghost"
            className="text-neg hover:bg-neg/10 hover:text-neg"
            disabled={busy}
            onClick={() => onRemove(data.id)}
            aria-label={`Remove ${data.symbol}`}
            title="Remove holding"
          >
            <Trash2 />
          </Button>
        ), 80)
      ];
    }

    return [
      { headerName: 'Security', field: 'symbol', filter: 'agTextColumnFilter', cellRenderer: SecurityCell, width: 220 },
      assetClassCol(),
      categoryCol('equityCategory', 'Category'),
      moneyCol('price', 'Price', currency),
      moneyCol('cost', 'Cost', currency, { valueFormatter: ({ data }) => (data.sharesToAdd === '' ? '' : money(data.cost, currency)) }),
      sharesCol('sharesToAdd', 'Shares to add', {
        editable: !busy,
        singleClickEdit: true,
        cellEditor: 'agNumberCellEditor',
        cellEditorParams: { min: 0, precision: 4 },
        cellClass: ({ data }) => cn('cell-input', data.over && 'text-neg'),
        valueSetter: ({ data, newValue }) => { setShares(data.securityId, toNumber(newValue)); return false; }
      }),
      sharesCol('maxShares', 'Max shares', { cellClass: 'font-semibold' }),
      numCol('room', 'Room left', { minWidth: 180, cellRenderer: (props) => <RoomCell {...props} currency={currency} /> }),
      numCol('pctValue', '% of portfolio', {
        editable: !busy,
        singleClickEdit: true,
        cellEditor: 'agNumberCellEditor',
        cellEditorParams: { min: 0, precision: 2 },
        valueFormatter: ({ value }) => (value === '' || value == null ? '' : pct(value)),
        cellClass: 'cell-input',
        valueSetter: ({ data, newValue }) => {
          const percentage = toNumber(newValue);
          setShares(data.securityId, percentage === '' ? '' : sharesFromValue(valueFromPct(percentage, model.amount), data.price) || '');
          return false;
        }
      }),
      numCol('roomAfter', 'Room after', {
        valueFormatter: ({ data }) => money(data.roomAfter, currency),
        cellClass: ({ data }) => (data.over ? 'text-neg font-semibold' : 'text-muted-foreground')
      }),
      actionsCol(({ data }) => (
        <div className="flex gap-1.5">
          <Button
            size="sm"
            variant="outline"
            disabled={busy || data.maxShares <= 0}
            onClick={() => setShares(data.securityId, data.maxShares)}
            title={`Fill with the most you can add: ${number(data.maxShares, 4)} shares`}
          >
            Max
          </Button>
          <Button size="sm" disabled={busy || !data.sharesToAdd || data.over} onClick={() => add(data)}>
            <Plus /> Add
          </Button>
        </div>
      ), 170)
    ];
  }, [isPortfolioHoldings, busy, currency, model.amount, onRemove, onChangeShares]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <GridCard
      title={isPortfolioHoldings ? 'Portfolio holdings' : 'Add holdings'}
      subtitle={isPortfolioHoldings
        ? 'All holdings currently saved in this portfolio.'
        : query.trim() ? 'Matching securities are shown below.' : 'Search by symbol, ISIN, name, exchange, or asset class and then add.'}
      searchable={false}
      exportName={isPortfolioHoldings ? 'portfolio-holdings' : undefined}
      rowData={rows}
      columnDefs={columns}
      getRowId={({ data }) => String(data.id || data.securityId)}
      height={Math.min(Math.max(rows.length * 46 + 110, 200), (isPortfolioHoldings ? 620 : 220))}
      singleClickEdit
      emptyMessage={isPortfolioHoldings ? 'No holdings saved yet.' : (query.trim() ? 'No securities match the current search.' : 'No securities to show until a search is made.')}
      toolbar={!isPortfolioHoldings ? (
        <div className="ml-auto flex w-full justify-end">
          <label className="relative block w-full min-w-[320px] max-w-[620px]">
            <span className="sr-only">Search securities</span>
            {eligibleLoading ? (
              <Loader2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            ) : (
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            )}
            <input
              className="field h-9 w-full pl-9"
              value={query}
              disabled={busy}
              onChange={(event) => {
                setQuery(event.target.value);
              }}
              placeholder={eligibleLoading ? 'Loading eligible securities…' : 'Search by symbol, ISIN, name, exchange…'}
            />
          </label>
        </div>
      ) : undefined}
    />
  );
}
