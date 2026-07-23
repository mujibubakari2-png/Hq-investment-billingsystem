import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { auditApi, type AuditLog } from '../api';
import { Pagination, Alert, fmtDateTime } from '../components/ui';
import { Shield, RefreshCw, X } from 'lucide-react';

const ACTION_COLORS: Record<string, string> = {
  PLATFORM_CREATE_TENANT: 'var(--success)',
  PLATFORM_APPROVE_TENANT: 'var(--success)',
  PLATFORM_REACTIVATE_TENANT: 'var(--success)',
  PLATFORM_SUSPEND_TENANT: 'var(--danger)',
  PLATFORM_DELETE_TENANT: 'var(--danger)',
  PLATFORM_CHANGE_TENANT_PLAN: 'var(--accent)',
  PLATFORM_EXTEND_TENANT_LICENSE: 'var(--primary-light)',
  PLATFORM_RESET_TENANT_ADMIN_PASSWORD: 'var(--warning)',
  PLATFORM_CREATE_SAAS_PLAN: 'var(--success)',
  PLATFORM_UPDATE_SAAS_PLAN: 'var(--accent)',
  PLATFORM_DELETE_SAAS_PLAN: 'var(--danger)',
  PLATFORM_MANUAL_LICENSE_APPROVAL: 'var(--success)',
  PLATFORM_UPDATE_SETTINGS: 'var(--info)',
};

function ActionTag({ action }: { action: string }) {
  const color = ACTION_COLORS[action] || 'var(--text-muted)';
  const label = action.replace('PLATFORM_', '').replace(/_/g, ' ');
  return (
    <span style={{
      background: `${color}18`,
      color,
      border: `1px solid ${color}30`,
      borderRadius: 'var(--r-full)',
      padding: '2px 9px',
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.04em',
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [selected, setSelected] = useState<AuditLog | null>(null);

  const params: Record<string, string> = { page: String(page), limit: '25' };
  if (actionFilter) params.action = actionFilter;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['sa-audit', page, actionFilter],
    queryFn: () => auditApi.list(params),
    refetchInterval: 30_000,
  });

  const logs: AuditLog[] = data?.data ?? [];
  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;

  return (
    <div>
      <div className="sa-page-header">
        <div className="sa-page-header-left">
          <h1>Audit <span className="sa-gradient-text">Logs</span></h1>
          <p>Complete record of all Platform Super Admin actions</p>
        </div>
        <button className="sa-btn sa-btn-ghost" onClick={() => refetch()}><RefreshCw size={14} /> Refresh</button>
      </div>

      {/* Privacy notice */}
      <div className="sa-privacy-banner sa-mb-24">
        <Shield size={14} />
        Showing platform-level actions only (PLATFORM_* events). Tenant-internal audit logs are not visible here — privacy protected.
      </div>

      {/* Filters */}
      <div className="sa-filters-row">
        <select
          className="sa-select"
          value={actionFilter}
          onChange={e => { setActionFilter(e.target.value); setPage(1); }}
          style={{ width: 220 }}
        >
          <option value="">All Actions</option>
          {Object.keys(ACTION_COLORS).map(a => (
            <option key={a} value={a}>{a.replace('PLATFORM_', '').replace(/_/g, ' ')}</option>
          ))}
        </select>
        {actionFilter && (
          <button className="sa-btn sa-btn-sm sa-btn-ghost" onClick={() => { setActionFilter(''); setPage(1); }}>
            <X size={12} /> Clear
          </button>
        )}
        <span className="sa-text-muted" style={{ fontSize: 'var(--font-size-xs)', marginLeft: 'auto' }}>
          {total} log{total !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="sa-card" style={{ padding: 0 }}>
        {error && <Alert type="danger" title="Failed to load audit logs" message={String(error)} />}
        <div className="sa-table-container">
          <table className="sa-table">
            <thead>
              <tr>
                <th>Action</th>
                <th>Resource</th>
                <th>Performed By</th>
                <th>IP Address</th>
                <th>Timestamp</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j}><div className="sa-skeleton" style={{ height: 14, borderRadius: 3, width: j === 0 ? 140 : 80 }} /></td>
                    ))}
                  </tr>
                ))
                : logs.length === 0
                  ? (
                    <tr><td colSpan={6}>
                      <div className="sa-empty">
                        <div className="sa-empty-icon"><Shield size={24} /></div>
                        <div className="sa-empty-title">No audit logs yet</div>
                        <div className="sa-empty-sub">Platform actions will appear here</div>
                      </div>
                    </td></tr>
                  )
                  : logs.map(log => (
                    <tr key={log.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(log)}>
                      <td><ActionTag action={log.action} /></td>
                      <td>
                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', fontWeight: 500 }}>
                          {log.resource}
                        </span>
                        {log.resourceId && (
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                            {log.resourceId.slice(0, 12)}…
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {log.performedBy.username}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                          {log.performedBy.email}
                        </div>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                        {log.ipAddress || '—'}
                      </td>
                      <td style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {fmtDateTime(log.createdAt)}
                      </td>
                      <td>
                        <button className="sa-btn sa-btn-sm sa-btn-ghost" onClick={e => { e.stopPropagation(); setSelected(log); }}>
                          View
                        </button>
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
        {!isLoading && pages > 1 && (
          <Pagination page={page} pages={pages} total={total} limit={25} onPage={setPage} />
        )}
      </div>

      {/* Details Modal */}
      {selected && (
        <div className="sa-modal-overlay" onClick={() => setSelected(null)}>
          <div className="sa-modal sa-modal-lg" onClick={e => e.stopPropagation()}>
            <div className="sa-modal-header">
              <div>
                <div className="sa-modal-title">Audit Log Details</div>
                <div className="sa-modal-sub">{fmtDateTime(selected.createdAt)}</div>
              </div>
              <button className="sa-modal-close" onClick={() => setSelected(null)}><X size={18} /></button>
            </div>
            <div className="sa-modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="sa-flex-between">
                  <span className="sa-label">Action</span>
                  <ActionTag action={selected.action} />
                </div>
                {[
                  { label: 'Resource', value: selected.resource },
                  { label: 'Resource ID', value: selected.resourceId || '—', mono: true },
                  { label: 'Performed By', value: `${selected.performedBy.fullName || selected.performedBy.username} (${selected.performedBy.email})` },
                  { label: 'IP Address', value: selected.ipAddress || '—', mono: true },
                ].map(({ label, value, mono }) => (
                  <div key={label} className="sa-flex-between" style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                    <span className="sa-label" style={{ fontSize: 11 }}>{label}</span>
                    <span style={{ fontFamily: mono ? 'var(--font-mono)' : undefined, fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)', textAlign: 'right', maxWidth: '60%' }}>
                      {value}
                    </span>
                  </div>
                ))}
                <div>
                  <span className="sa-label" style={{ display: 'block', marginBottom: 8 }}>Details</span>
                  <pre style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--r-md)',
                    padding: 14,
                    fontSize: 12,
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-secondary)',
                    overflow: 'auto',
                    maxHeight: 280,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                  }}>
                    {JSON.stringify(selected.details, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
            <div className="sa-modal-footer">
              <button className="sa-btn sa-btn-ghost" onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
