/**
 * DataTable — RD-001: Reusable Responsive Data Table Component
 *
 * Consolidates the repeated table pattern found across 20+ data pages
 * (Clients, Subscriptions, Transactions, Vouchers, etc.) into a single
 * generic component. Eliminates ~150 lines of duplicated markup per page.
 *
 * Features:
 *  - Responsive: collapses to card-based layout on mobile (≤640px)
 *  - Sortable columns: click header to toggle asc/desc, controlled or uncontrolled
 *  - Built-in loading skeleton with animated shimmer
 *  - Empty state with configurable message and optional action button
 *  - Integrated toolbar: search input, entries-per-page selector, slot for extra filters
 *  - Integrated pagination with smart page window (first/last/ellipsis)
 *  - CSV export utility function included
 *  - Full TypeScript generics — column definitions are typed to the row shape
 *  - Accessible: role="table", aria-sort, aria-label, keyboard pagination
 */

import { useState, useMemo, useId, type ReactNode, type CSSProperties } from 'react';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import './DataTable.css';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Column<T> {
    /** Key of T to read, or a unique string for computed columns */
    key: string;
    /** Header label shown in <th> */
    label: string;
    /** Custom cell renderer. Falls back to String(row[key]) */
    render?: (row: T, index: number) => ReactNode;
    /** If true, clicking the header sorts by this column */
    sortable?: boolean;
    /** Column-level CSS width e.g. '120px' or '10%' */
    width?: string;
    /** Hide this column below this breakpoint (applied via CSS class) */
    hideBelow?: 'sm' | 'md' | 'lg';
    /** Horizontal alignment */
    align?: 'left' | 'center' | 'right';
}

export interface DataTableProps<T extends { id: string | number }> {
    /** Column definitions */
    columns: Column<T>[];
    /** Rows to display on the CURRENT page (server-side paging) or all rows (client-side) */
    data: T[];
    /** Total record count for pagination info text */
    total?: number;
    /** Loading state — shows skeleton rows */
    loading?: boolean;
    /** Controlled search value */
    searchValue?: string;
    onSearchChange?: (value: string) => void;
    /** Controlled entries-per-page */
    pageSize?: number;
    onPageSizeChange?: (size: number) => void;
    /** Controlled current page (1-indexed) */
    page?: number;
    onPageChange?: (page: number) => void;
    /** Number of skeleton rows shown while loading */
    skeletonRows?: number;
    /** Empty-state message */
    emptyMessage?: string;
    /** Optional node rendered in the toolbar next to the search box */
    toolbarRight?: ReactNode;
    /** Optional node rendered in the toolbar left (filter selects etc.) */
    toolbarLeft?: ReactNode;
    /** aria-label for the table element */
    ariaLabel?: string;
    /** Called with row when a row is clicked */
    onRowClick?: (row: T) => void;
    /** Adds a hover highlight to rows when onRowClick is provided */
    rowClickable?: boolean;
    /** CSV export: pass a function to serialise each row into a CSV string array */
    csvExport?: {
        filename: string;
        headers: string[];
        rowMapper: (row: T) => (string | number)[];
    };
    /** Page size options */
    pageSizeOptions?: number[];
    /** Extra class names on the root wrapper */
    className?: string;
    /** Client-side sort (only used when paging is client-side) */
    clientSort?: boolean;
}

export type SortDirection = 'asc' | 'desc' | null;

export interface SortState {
    key: string;
    direction: SortDirection;
}

// ── CSV Export utility ────────────────────────────────────────────────────────

export function exportToCsv<T>(
    rows: T[],
    headers: string[],
    rowMapper: (row: T) => (string | number)[],
    filename: string,
) {
    const escape = (v: string | number) =>
        `"${String(v).replace(/"/g, '""')}"`;
    const lines = [
        headers.map(escape).join(','),
        ...rows.map(r => rowMapper(r).map(escape).join(',')),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// ── Pagination helpers ─────────────────────────────────────────────────────────

function buildPageWindow(current: number, total: number, windowSize = 5): (number | '...')[] {
    if (total <= windowSize + 2) return Array.from({ length: total }, (_, i) => i + 1);
    const half = Math.floor(windowSize / 2);
    let start = Math.max(2, current - half);
    let end = Math.min(total - 1, current + half);
    if (current - half < 2) end = Math.min(total - 1, windowSize);
    if (current + half > total - 1) start = Math.max(2, total - windowSize);
    const pages: (number | '...')[] = [1];
    if (start > 2) pages.push('...');
    for (let p = start; p <= end; p++) pages.push(p);
    if (end < total - 1) pages.push('...');
    pages.push(total);
    return pages;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DataTable<T extends { id: string | number }>({
    columns,
    data,
    total,
    loading = false,
    searchValue = '',
    onSearchChange,
    pageSize = 25,
    onPageSizeChange,
    page = 1,
    onPageChange,
    skeletonRows = 6,
    emptyMessage = 'No records found.',
    toolbarRight,
    toolbarLeft,
    ariaLabel = 'Data table',
    onRowClick,
    rowClickable,
    csvExport,
    pageSizeOptions = [10, 25, 50, 100],
    className = '',
    clientSort = false,
}: DataTableProps<T>) {
    const uid = useId();
    const [sort, setSort] = useState<SortState>({ key: '', direction: null });

    // ── Client-side sort ──────────────────────────────────────────────────────
    const sortedData = useMemo(() => {
        if (!clientSort || !sort.key || !sort.direction) return data;
        return [...data].sort((a, b) => {
            const av = (a as any)[sort.key];
            const bv = (b as any)[sort.key];
            const cmp = typeof av === 'number' && typeof bv === 'number'
                ? av - bv
                : String(av ?? '').localeCompare(String(bv ?? ''));
            return sort.direction === 'asc' ? cmp : -cmp;
        });
    }, [data, sort, clientSort]);

    const rows = clientSort ? sortedData : data;

    // ── Pagination ────────────────────────────────────────────────────────────
    const effectiveTotal = total ?? data.length;
    const totalPages = Math.max(1, Math.ceil(effectiveTotal / pageSize));
    const pageWindow = buildPageWindow(page, totalPages);

    const firstEntry = Math.min((page - 1) * pageSize + 1, effectiveTotal);
    const lastEntry  = Math.min(page * pageSize, effectiveTotal);

    // ── Sort handler ──────────────────────────────────────────────────────────
    const handleSort = (col: Column<T>) => {
        if (!col.sortable) return;
        setSort(prev => {
            if (prev.key !== col.key) return { key: col.key, direction: 'asc' };
            if (prev.direction === 'asc')  return { key: col.key, direction: 'desc' };
            return { key: '', direction: null };
        });
    };

    const sortIcon = (col: Column<T>) => {
        if (!col.sortable) return null;
        if (sort.key !== col.key || !sort.direction)
            return <UnfoldMoreIcon className="dt-sort-icon dt-sort-neutral" />;
        return sort.direction === 'asc'
            ? <ArrowUpwardIcon className="dt-sort-icon dt-sort-active" />
            : <ArrowDownwardIcon className="dt-sort-icon dt-sort-active" />;
    };

    // ── Aria sort ─────────────────────────────────────────────────────────────
    const ariaSortAttr = (col: Column<T>): 'ascending' | 'descending' | 'none' | undefined => {
        if (!col.sortable) return undefined;
        if (sort.key !== col.key) return 'none';
        return sort.direction === 'asc' ? 'ascending' : sort.direction === 'desc' ? 'descending' : 'none';
    };

    // ── Skeleton ──────────────────────────────────────────────────────────────
    const renderSkeleton = () =>
        Array.from({ length: skeletonRows }).map((_, ri) => (
            <tr key={`sk-${ri}`} className="dt-skeleton-row" aria-hidden="true">
                {columns.map((col, ci) => (
                    <td key={`sk-${ri}-${ci}`} data-hide={col.hideBelow}>
                        <div className="dt-skeleton-cell" style={{ width: col.width ? '80%' : undefined }} />
                    </td>
                ))}
            </tr>
        ));

    // ── Empty state ───────────────────────────────────────────────────────────
    const renderEmpty = () => (
        <tr>
            <td colSpan={columns.length} className="dt-empty">
                <div className="dt-empty-inner">
                    <span className="dt-empty-icon" aria-hidden="true">📋</span>
                    <p>{emptyMessage}</p>
                </div>
            </td>
        </tr>
    );

    return (
        <div className={`dt-wrapper ${className}`}>
            {/* ── Toolbar ── */}
            <div className="dt-toolbar" role="toolbar" aria-label="Table controls">
                <div className="dt-toolbar-left">
                    {/* Entries per page */}
                    <label htmlFor={`${uid}-page-size`} className="dt-label">Show</label>
                    <select
                        id={`${uid}-page-size`}
                        className="dt-select"
                        value={pageSize}
                        onChange={e => { onPageSizeChange?.(Number(e.target.value)); onPageChange?.(1); }}
                    >
                        {pageSizeOptions.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <span className="dt-label">entries</span>
                    {toolbarLeft}
                </div>
                <div className="dt-toolbar-right">
                    {/* CSV Export */}
                    {csvExport && (
                        <button
                            className="btn btn-secondary btn-sm"
                            id={`${uid}-export-btn`}
                            onClick={() => exportToCsv(data, csvExport.headers, csvExport.rowMapper, csvExport.filename)}
                            title="Export to CSV"
                        >
                            <FileDownloadIcon fontSize="small" /> Export
                        </button>
                    )}
                    {toolbarRight}
                    {/* Search */}
                    {onSearchChange && (
                        <div className="dt-search">
                            <SearchIcon className="dt-search-icon" />
                            <input
                                id={`${uid}-search`}
                                type="search"
                                className="dt-search-input"
                                placeholder="Search…"
                                value={searchValue}
                                onChange={e => { onSearchChange(e.target.value); onPageChange?.(1); }}
                                aria-label="Search table"
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* ── Table ── */}
            <div className="dt-scroll-wrapper">
                <table
                    className="dt-table"
                    role="table"
                    aria-label={ariaLabel}
                    aria-busy={loading}
                    aria-rowcount={effectiveTotal}
                >
                    <thead>
                        <tr>
                            {columns.map(col => (
                                <th
                                    key={col.key}
                                    data-hide={col.hideBelow}
                                    style={{
                                        width: col.width,
                                        textAlign: col.align ?? 'left',
                                        cursor: col.sortable ? 'pointer' : undefined,
                                    } as CSSProperties}
                                    aria-sort={ariaSortAttr(col)}
                                    onClick={() => handleSort(col)}
                                    tabIndex={col.sortable ? 0 : undefined}
                                    onKeyDown={e => e.key === 'Enter' && handleSort(col)}
                                >
                                    <span className="dt-th-inner">
                                        {col.label}
                                        {sortIcon(col)}
                                    </span>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading
                            ? renderSkeleton()
                            : rows.length === 0
                                ? renderEmpty()
                                : rows.map((row, ri) => (
                                    <tr
                                        key={row.id}
                                        className={rowClickable || onRowClick ? 'dt-row-clickable' : ''}
                                        onClick={() => onRowClick?.(row)}
                                        aria-rowindex={firstEntry + ri}
                                    >
                                        {columns.map(col => (
                                            <td
                                                key={col.key}
                                                data-hide={col.hideBelow}
                                                data-label={col.label}
                                                style={{ textAlign: col.align ?? 'left' } as CSSProperties}
                                            >
                                                {col.render
                                                    ? col.render(row, ri)
                                                    : String((row as any)[col.key] ?? '')}
                                            </td>
                                        ))}
                                    </tr>
                                ))
                        }
                    </tbody>
                </table>
            </div>

            {/* ── Pagination ── */}
            {effectiveTotal > 0 && (
                <div className="dt-pagination" role="navigation" aria-label="Table pagination">
                    <div className="dt-pagination-info" aria-live="polite">
                        {loading
                            ? 'Loading…'
                            : `Showing ${firstEntry}–${lastEntry} of ${effectiveTotal.toLocaleString()} entries`}
                    </div>
                    <div className="dt-pagination-btns">
                        <button
                            className="dt-page-btn"
                            id={`${uid}-prev`}
                            disabled={page <= 1 || loading}
                            onClick={() => onPageChange?.(page - 1)}
                            aria-label="Previous page"
                        >
                            ‹ Prev
                        </button>
                        {pageWindow.map((p, i) =>
                            p === '...'
                                ? <span key={`ellipsis-${i}`} className="dt-page-ellipsis">…</span>
                                : (
                                    <button
                                        key={p}
                                        className={`dt-page-btn ${p === page ? 'active' : ''}`}
                                        onClick={() => onPageChange?.(p as number)}
                                        aria-label={`Page ${p}`}
                                        aria-current={p === page ? 'page' : undefined}
                                        disabled={loading}
                                    >
                                        {p}
                                    </button>
                                )
                        )}
                        <button
                            className="dt-page-btn"
                            id={`${uid}-next`}
                            disabled={page >= totalPages || loading}
                            onClick={() => onPageChange?.(page + 1)}
                            aria-label="Next page"
                        >
                            Next ›
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
