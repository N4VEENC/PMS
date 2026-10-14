import { useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { useColorMode } from '../../context/ColorMode';
import { gridThemes } from './gridTheme';

ModuleRegistry.registerModules([AllCommunityModule]);

const MIN_COLUMN_WIDTH = 135;

const defaultColDef = {
  sortable: true,
  resizable: true,
  filter: true,
  flex: 1,
  suppressMovable: true,
  // We format values ourselves. Inferring a type from the first row rejects typed input when that row is empty.
  cellDataType: false,
  wrapHeaderText: true,
  autoHeaderHeight: true
};

function NoRows({ message }) {
  return <p className="px-6 text-center text-sm text-muted-foreground">{message}</p>;
}

/**
 * The one grid every table in the app uses.
 *
 *  - The grid has a fixed height and scrolls inside its own box (down and sideways); the page never moves.
 *  - Header stays visible while scrolling down. The first column stays visible while scrolling sideways.
 *  - Clicking a header sorts (numbers go largest to smallest first). The funnel icon opens that column's filter.
 *  - Pagination is off. Turn it on for any grid with `pagination` (and optionally `pageSize`).
 */
export function DataGrid({
  rowData,
  columnDefs,
  height = 420,
  pinFirstColumn = true,
  pinnedBottomRowData,
  pagination = false,
  pageSize = 25,
  emptyMessage = 'Nothing to show yet.',
  loading = false,
  rowHeight,
  ...gridProps
}) {
  const { mode } = useColorMode();
  const columns = useMemo(() => columnDefs.map((column, index) => {
    // keep every column wide enough for its header text plus the sort and filter icons
    const withFloor = column.colId === 'actions' ? column : { ...column, minWidth: Math.max(column.minWidth || 0, MIN_COLUMN_WIDTH) };
    return index === 0 && pinFirstColumn
      ? { pinned: 'left', lockPinned: true, flex: 0, width: 190, ...withFloor }
      : withFloor;
  }), [columnDefs, pinFirstColumn]);

  return (
    <div className="w-full min-w-0" style={{ height }}>
      <AgGridReact
        theme={gridThemes[mode]}
        rowData={rowData}
        columnDefs={columns}
        defaultColDef={defaultColDef}
        pinnedBottomRowData={pinnedBottomRowData}
        pagination={pagination}
        paginationPageSize={pageSize}
        paginationPageSizeSelector={false}
        rowHeight={rowHeight}
        loading={loading}
        stopEditingWhenCellsLoseFocus
        noRowsOverlayComponent={NoRows}
        noRowsOverlayComponentParams={{ message: emptyMessage }}
        {...gridProps}
      />
    </div>
  );
}
