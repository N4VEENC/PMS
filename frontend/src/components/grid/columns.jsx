import { money, number, pct, signedMoney, signedPct, signedPp, titleCase, toneClass } from '../../lib/format';
import { formatAssetClass } from '../../lib/assetClassUtils';
import { colorFor } from '../../lib/dashboard';
import { cn } from '../../lib/utils';

const isBlank = (value) => value == null || value === '';

export const textCol = (field, headerName, extra = {}) => ({
  field,
  headerName,
  filter: 'agTextColumnFilter',
  sortingOrder: ['asc', 'desc', null],
  ...extra
});

/** Number columns right-align and sort largest to smallest on the first click. */
export const numCol = (field, headerName, extra = {}) => ({
  field,
  headerName,
  type: 'rightAligned',
  filter: 'agNumberColumnFilter',
  sortingOrder: ['desc', 'asc', null],
  ...extra
});

export const moneyCol = (field, headerName, currency, extra = {}) => numCol(field, headerName, {
  minWidth: 140,
  valueFormatter: ({ value }) => (isBlank(value) ? '—' : money(value, currency)),
  ...extra
});

export const pctCol = (field, headerName, extra = {}) => numCol(field, headerName, {
  valueFormatter: ({ value }) => (isBlank(value) ? '—' : pct(value)),
  ...extra
});

/** Coloured +/− money (green up, red down) */
export const gainCol = (field, headerName, currency, extra = {}) => numCol(field, headerName, {
  valueFormatter: ({ value }) => (value == null ? '—' : signedMoney(value, currency)),
  cellClass: ({ value }) => cn('font-semibold', toneClass(value)),
  ...extra
});

export const gainPctCol = (field, headerName, extra = {}) => numCol(field, headerName, {
  valueFormatter: ({ value }) => (value == null ? '—' : signedPct(value)),
  cellClass: ({ value }) => cn('font-semibold', toneClass(value)),
  ...extra
});

/** Drift in percentage points: red when beyond the 5 pp limit */
export const driftCol = (field, headerName, extra = {}) => numCol(field, headerName, {
  valueFormatter: ({ value }) => (value == null ? '—' : signedPp(value)),
  cellClass: ({ value }) => cn('font-semibold', Math.abs(value) > 5 ? 'text-neg' : Math.abs(value) > 2.5 ? 'text-warn' : 'text-pos'),
  ...extra
});

export const assetClassCol = (field = 'assetClass', headerName = 'Asset class', extra = {}) => textCol(field, headerName, {
  valueFormatter: ({ value }) => formatAssetClass(value),
  cellRenderer: AssetClassCell,
  minWidth: 150,
  ...extra
});

export const categoryCol = (field = 'equityCategory', headerName = 'Category', extra = {}) => textCol(field, headerName, {
  valueFormatter: ({ value }) => (value ? titleCase(value) : '—'),
  minWidth: 120,
  ...extra
});

export const sharesCol = (field, headerName, extra = {}) => numCol(field, headerName, {
  valueFormatter: ({ value }) => (isBlank(value) ? '—' : number(value, 4)),
  ...extra
});

/** Fixed-width column pinned to the right for row buttons */
export const actionsCol = (cellRenderer, width = 120, extra = {}) => ({
  headerName: '',
  colId: 'actions',
  pinned: 'right',
  lockPinned: true,
  sortable: false,
  filter: false,
  resizable: false,
  flex: 0,
  width,
  minWidth: width,
  cellRenderer,
  cellClass: 'flex items-center justify-end',
  ...extra
});

export function AssetClassCell({ value }) {
  if (!value) return '—';
  return (
    <span className="inline-flex items-center gap-2">
      <i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colorFor(value) }} />
      {formatAssetClass(value)}
    </span>
  );
}

/** Symbol on top, company name underneath */
export function SecurityCell({ data }) {
  if (!data) return null;
  const symbol = data.symbol || data.securityName || data.name;
  const name = data.securityName || data.name;
  return (
    <div className="flex h-full flex-col justify-center leading-tight">
      <span className="font-semibold">{symbol}</span>
      {name && name !== symbol ? <span className="truncate text-xs text-muted-foreground">{name}</span> : null}
    </div>
  );
}

const PILL_TONES = {
  good: 'bg-pos/15 text-pos',
  warn: 'bg-warn/15 text-warn',
  bad: 'bg-neg/15 text-neg',
  info: 'bg-primary/15 text-primary',
  neutral: 'bg-muted text-muted-foreground'
};

export function Pill({ tone = 'neutral', children }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
        PILL_TONES[tone]
      )}
    >
      {children}
    </span>
  );
}

/** Shows the proportion of a target used; value and max must use the same units. */
export function ProgressCell({ value, max, color = '#7c5cff' }) {
  const ratio = max > 0 ? Math.min(value / max, 1.2) : 0;
  const over = ratio > 1.0005;
  return (
    <div className="flex h-full w-full items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.min(ratio, 1) * 100}%`, background: over ? 'hsl(var(--neg))' : color }}
        />
      </div>
      <span className="w-10 text-right text-xs text-muted-foreground">{Math.round(ratio * 100)}%</span>
    </div>
  );
}
