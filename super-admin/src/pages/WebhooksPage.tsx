import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { webhooksApi, type WebhookLog } from '../api';
import { Alert, Pagination, fmtDate } from '../components/ui';
import { RefreshCw, Webhook, CheckCircle2, XCircle, X } from 'lucide-react';

export default function WebhooksPage() {
  const [page, setPage] = useState(1);
  const [provider, setProvider] = useState('');
  const [verified, setVerified] = useState('');
  const [detail, setDetail] = useState<WebhookLog | null>(null);

  const params: Record<string, string> = { page: String(page), limit: '50' };
  if (provider) params.provider = provider;
  if (verified) params.verified = verified;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['sa-webhooks', page, provider, verified],
    queryFn: () => webhooksApi.list(params),
  });

  const logs: WebhookLog[] = data?.data ?? [];
  const providers: string[] = data?.providers ?? [];

  return (
    <div>
      <div className="sa-page-header">
        <div className="sa-page-header-left">
          <h1>Webhook <span className="sa-gradient-text">Logs</span></h1>
          <p>Platform payment gateway callback history</p>
        </div>
        <button className="sa-btn sa-btn-ghost" onClick={() => refetch()}><RefreshCw size={14} /> Refresh</button>
      </div>

      {error && <Alert type="danger" title="Failed to load webhook logs" message={String(error)} />}

      {/* Filters */}
      <div className="sa-filters-row">
        <select className="sa-select" value={provider} onChange={e => { setProvider(e.target.value); setPage(1); }} style={{ width: 160 }}>
          <option value="">All Providers</option>
          {providers.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className="sa-select" value={verified} onChange={e => { setVerified(e.target.value); setPage(1); }} style={{ width: 150 }}>
          <option value="">All Verifications</option>
          <option value="true">✓ Verified</option>
          <option value="false">✗ Unverified</option>
        </select>
        {(provider || verified) && (
          <button className="sa-btn sa-btn-sm sa-btn-ghost" onClick={() => { setProvider(''); setVerified(''); setPage(1); }}>
            <X size={12} /> Clear
          </button>
        )}
        <span className="sa-text-muted" style={{ fontSize: 'var(--font-size-xs)', marginLeft: 'auto' }}>
          {data?.total ?? 0} records
        </span>
      </div>

      {/* Table */}
      <div className="sa-card" style={{ padding: 0 }}>
        <div className="sa-table-container">
          <table className="sa-table">
            <thead>
              <tr>
                <th>Provider</th>
                <th>Event</th>
                <th>Reference</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Verified</th>
                <th>Time</th>
                <th style={{ textAlign: 'right' }}>Detail</th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 8 }).map((_, j) => (
                    <td key={j}><div className="sa-skeleton" style={{ height: 14, width: j === 0 ? 80 : 60, borderRadius: 3 }} /></td>
                  ))}</tr>
                ))
                : logs.length === 0
                  ? (
                    <tr><td colSpan={8}>
                      <div className="sa-empty">
                        <div className="sa-empty-icon"><Webhook size={26} /></div>
                        <div className="sa-empty-title">No webhook logs</div>
                        <div className="sa-empty-sub">Webhook callbacks will appear here</div>
                      </div>
                    </td></tr>
                  )
                  : logs.map(log => (
                    <tr key={log.id}>
                      <td>
                        <span style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
                          {log.provider.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>{log.event}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {log.transactionRef ?? '—'}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)', color: 'var(--success)' }}>
                        {log.payloadSummary?.amount ? `TZS ${Number(log.payloadSummary.amount).toLocaleString()}` : '—'}
                      </td>
                      <td style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                        {String(log.payloadSummary?.status ?? log.payloadSummary?.order_status ?? '—')}
                      </td>
                      <td>
                        {log.verified
                          ? <CheckCircle2 size={15} color="var(--success)" />
                          : <XCircle size={15} color="var(--danger)" />}
                      </td>
                      <td style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {fmtDate(log.createdAt)}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="sa-btn sa-btn-sm sa-btn-ghost" onClick={() => setDetail(log)}>View</button>
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
        {!isLoading && (data?.pages ?? 0) > 1 && (
          <Pagination page={page} pages={data!.pages} total={data!.total} limit={50} onPage={setPage} />
        )}
      </div>

      {/* Detail Modal */}
      {detail && (
        <div className="sa-modal-overlay" onClick={() => setDetail(null)}>
          <div className="sa-modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <div className="sa-modal-header">
              <div>
                <div className="sa-modal-title">Webhook Detail</div>
                <div className="sa-modal-sub">{detail.provider} — {detail.event}</div>
              </div>
              <button className="sa-modal-close" onClick={() => setDetail(null)}><X size={18} /></button>
            </div>
            <div className="sa-modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                {[
                  ['ID', detail.id.slice(0, 16) + '…'],
                  ['Provider', detail.provider],
                  ['Event', detail.event],
                  ['Reference', detail.transactionRef ?? '—'],
                  ['Verified', detail.verified ? '✓ Yes' : '✗ No'],
                  ['Time', fmtDate(detail.createdAt)],
                ].map(([k, v]) => (
                  <div key={k} style={{ background: 'var(--bg-elevated)', padding: '8px 12px', borderRadius: 6 }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>{k}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>{v}</div>
                  </div>
                ))}
              </div>
              {detail.payloadSummary && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Payload Summary</div>
                  <pre style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: 14, fontSize: 12, color: 'var(--text-primary)', overflow: 'auto', maxHeight: 200, border: '1px solid var(--border)' }}>
                    {JSON.stringify(detail.payloadSummary, null, 2)}
                  </pre>
                </>
              )}
            </div>
            <div className="sa-modal-footer">
              <button className="sa-btn sa-btn-primary" onClick={() => setDetail(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
