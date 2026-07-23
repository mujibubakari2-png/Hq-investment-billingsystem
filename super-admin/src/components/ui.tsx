import { useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';

// ── Status Badge ────────────────────────────────────────────────────────────────
const STATUS_MAP: Record<string, string> = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  TRIALLING: 'trialling',
  PENDING_APPROVAL: 'pending',
  INACTIVE: 'expired',
  PAID: 'paid',
  COMPLETED: 'paid',
  PENDING: 'pending',
  FAILED: 'suspended',
  EXPIRED: 'expired',
  CANCELLED: 'suspended',
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Active',
  SUSPENDED: 'Suspended',
  TRIALLING: 'Trialling',
  PENDING_APPROVAL: 'Pending',
  INACTIVE: 'Inactive',
  PAID: 'Paid',
  COMPLETED: 'Paid',
  PENDING: 'Pending',
  FAILED: 'Failed',
  EXPIRED: 'Expired',
  CANCELLED: 'Cancelled',
};

export function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_MAP[status] || 'info';
  const label = STATUS_LABEL[status] || status;
  return (
    <span className={`sa-badge ${cls}`}>
      <span className="sa-badge-dot" />
      {label}
    </span>
  );
}

// ── Expiry display ──────────────────────────────────────────────────────────────
export function ExpiryDate({ date }: { date: string | null }) {
  if (!date) return <span className="sa-text-muted">—</span>;
  const d = new Date(date);
  const now = new Date();
  const diffDays = Math.floor((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  let cls = 'sa-expiry-ok';
  let suffix = '';
  if (diffDays < 0) { cls = 'sa-expiry-critical'; suffix = ' (Expired)'; }
  else if (diffDays <= 7)  { cls = 'sa-expiry-critical'; suffix = ` (${diffDays}d)`; }
  else if (diffDays <= 30) { cls = 'sa-expiry-warning'; suffix = ` (${diffDays}d)`; }
  return (
    <span className={cls} style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>
      {d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
      {suffix}
    </span>
  );
}

// ── Format currency ─────────────────────────────────────────────────────────────
export function fmtCurrency(amount: number, currency = 'TZS') {
  return `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
}

export function fmtDate(dateStr: string | null) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export function fmtDateTime(dateStr: string | null) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Alert ────────────────────────────────────────────────────────────────────────
type AlertType = 'warning' | 'danger' | 'success' | 'info';
const ALERT_ICONS: Record<AlertType, React.ReactNode> = {
  warning: <AlertTriangle size={16} />,
  danger:  <XCircle size={16} />,
  success: <CheckCircle2 size={16} />,
  info:    <Info size={16} />,
};

export function Alert({ type, title, message }: { type: AlertType; title: string; message?: string }) {
  return (
    <div className={`sa-alert sa-alert-${type}`}>
      <span className="sa-alert-icon">{ALERT_ICONS[type]}</span>
      <div className="sa-alert-body">
        <div className="sa-alert-title">{title}</div>
        {message && <div className="sa-alert-message">{message}</div>}
      </div>
    </div>
  );
}

// ── Trend Indicator ──────────────────────────────────────────────────────────────
export function Trend({ value, suffix = '%' }: { value: number; suffix?: string }) {
  const dir = value > 0 ? 'up' : value < 0 ? 'down' : 'flat';
  const arrow = value > 0 ? '↑' : value < 0 ? '↓' : '→';
  return (
    <span className={`sa-stat-trend ${dir}`}>
      {arrow} {Math.abs(value).toFixed(1)}{suffix}
    </span>
  );
}

// ── Pagination ────────────────────────────────────────────────────────────────────
export function Pagination({
  page, pages, total, limit, onPage
}: {
  page: number; pages: number; total: number; limit: number; onPage: (p: number) => void;
}) {
  const from = Math.min((page - 1) * limit + 1, total);
  const to = Math.min(page * limit, total);
  return (
    <div className="sa-pagination">
      <span className="sa-pagination-info">
        Showing {from}–{to} of {total} records
      </span>
      <div className="sa-pagination-btns">
        <button className="sa-page-btn" onClick={() => onPage(page - 1)} disabled={page <= 1}>‹</button>
        {Array.from({ length: Math.min(pages, 7) }, (_, i) => {
          const p = pages <= 7 ? i + 1 : page <= 4
            ? i + 1
            : page >= pages - 3
              ? pages - 6 + i
              : page - 3 + i;
          if (p < 1 || p > pages) return null;
          return (
            <button
              key={p}
              className={`sa-page-btn ${p === page ? 'active' : ''}`}
              onClick={() => onPage(p)}
            >
              {p}
            </button>
          );
        })}
        <button className="sa-page-btn" onClick={() => onPage(page + 1)} disabled={page >= pages}>›</button>
      </div>
    </div>
  );
}

// ── Confirmation Modal ─────────────────────────────────────────────────────────
export function ConfirmModal({
  title, message, confirmText, confirmLabel, onConfirm, onCancel, loading, danger = false,
  requireTyping, typingLabel,
}: {
  title: string;
  message: string | React.ReactNode;
  confirmText?: string;
  confirmLabel?: string;
  onConfirm: (typed?: string) => void;
  onCancel: () => void;
  loading?: boolean;
  danger?: boolean;
  requireTyping?: boolean;
  typingLabel?: string;
}) {
  const [typed, setTyped] = useState('');
  const canConfirm = requireTyping ? typed === confirmText : true;

  return (
    <div className="sa-modal-overlay" onClick={onCancel}>
      <div className="sa-modal" onClick={e => e.stopPropagation()}>
        <div className="sa-modal-header">
          <div>
            <div className="sa-modal-title" style={{ color: danger ? 'var(--danger)' : undefined }}>
              {title}
            </div>
          </div>
          <button className="sa-modal-close" onClick={onCancel}><XCircle size={18} /></button>
        </div>
        <div className="sa-modal-body">
          <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: requireTyping ? 16 : 0 }}>
            {message}
          </div>
          {requireTyping && (
            <div className="sa-form-group" style={{ marginTop: 16, marginBottom: 0 }}>
              <label className="sa-label">{typingLabel || `Type "${confirmText}" to confirm`}</label>
              <input
                className="sa-input"
                value={typed}
                onChange={e => setTyped(e.target.value)}
                placeholder={confirmText}
                autoFocus
              />
            </div>
          )}
        </div>
        <div className="sa-modal-footer">
          <button className="sa-btn sa-btn-ghost" onClick={onCancel} disabled={loading}>Cancel</button>
          <button
            className={`sa-btn ${danger ? 'sa-btn-danger' : 'sa-btn-primary'}`}
            onClick={() => onConfirm(typed)}
            disabled={loading || !canConfirm}
          >
            {loading ? <span className="sa-spinner-sm sa-spinner" style={{ borderWidth: 2 }} /> : null}
            {confirmLabel || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}


