import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { licensesApi, tenantsApi, plansApi, type SaasPlan } from '../api';
import { StatusBadge, ExpiryDate, Pagination, Alert, fmtDate } from '../components/ui';
import { Plus, RefreshCw, Search, X } from 'lucide-react';

export default function LicensesPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ tenantId: '', planId: '', startsAt: '', expiresAt: '', action: 'approve' });
  const [msg, setMsg] = useState('');

  const params: Record<string, string> = { page: String(page), limit: '25' };
  if (statusFilter) params.status = statusFilter;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['sa-licenses', page, statusFilter],
    queryFn: () => licensesApi.list(params),
  });

  const { data: tenantsData } = useQuery({
    queryKey: ['sa-tenants-all'],
    queryFn: () => tenantsApi.list({ limit: '200' }),
    enabled: showCreate,
  });

  const { data: plansData } = useQuery({
    queryKey: ['sa-plans'],
    queryFn: plansApi.list,
    enabled: showCreate,
  });

  const createMutation = useMutation({
    mutationFn: (body: typeof form) => licensesApi.create(body),
    onSuccess: (res) => {
      setMsg(res.message);
      qc.invalidateQueries({ queryKey: ['sa-licenses'] });
      setTimeout(() => { setShowCreate(false); setMsg(''); setForm({ tenantId: '', planId: '', startsAt: '', expiresAt: '', action: 'approve' }); createMutation.reset(); }, 2500);
    },
  });

  const plans: SaasPlan[] = plansData?.data ?? [];
  const licenses = data?.data ?? [];
  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;

  return (
    <div>
      <div className="sa-page-header">
        <div className="sa-page-header-left">
          <h1>License <span className="sa-gradient-text">Management</span></h1>
          <p>Track, approve, and manage all tenant licenses</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="sa-btn sa-btn-ghost" onClick={() => refetch()}><RefreshCw size={14} /></button>
          <button className="sa-btn sa-btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={14} /> Manual Approval
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="sa-filters-row">
        <select className="sa-select" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} style={{ width: 160 }}>
          <option value="">All Statuses</option>
          <option value="PAID">Paid</option>
          <option value="PENDING">Pending</option>
          <option value="EXPIRED">Expired</option>
        </select>
        {statusFilter && (
          <button className="sa-btn sa-btn-sm sa-btn-ghost" onClick={() => { setStatusFilter(''); setPage(1); }}>
            <X size={12} /> Clear
          </button>
        )}
        <span className="sa-text-muted" style={{ fontSize: 'var(--font-size-xs)', marginLeft: 'auto' }}>
          {total} license{total !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="sa-card" style={{ padding: 0 }}>
        {error && <Alert type="danger" title="Failed to load licenses" message={String(error)} />}
        <div className="sa-table-container">
          <table className="sa-table">
            <thead>
              <tr>
                <th>Tenant</th>
                <th>Plan</th>
                <th>Price/mo</th>
                <th>Status</th>
                <th>Tenant Status</th>
                <th>Starts</th>
                <th>Expires</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j}><div className="sa-skeleton" style={{ height: 14, borderRadius: 3, width: j === 0 ? 120 : 70 }} /></td>
                    ))}
                  </tr>
                ))
                : licenses.length === 0
                  ? (
                    <tr><td colSpan={8}>
                      <div className="sa-empty">
                        <div className="sa-empty-title">No licenses found</div>
                      </div>
                    </td></tr>
                  )
                  : licenses.map(l => (
                    <tr key={l.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)' }}>{l.tenantName}</div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{l.tenantEmail}</div>
                      </td>
                      <td style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>{l.planName}</td>
                      <td style={{ color: 'var(--success)', fontWeight: 600, fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)' }}>
                        TZS {l.planPrice.toLocaleString()}
                      </td>
                      <td><StatusBadge status={l.status} /></td>
                      <td><StatusBadge status={l.tenantStatus} /></td>
                      <td style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{fmtDate(l.startsAt)}</td>
                      <td><ExpiryDate date={l.expiresAt} /></td>
                      <td style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{fmtDate(l.createdAt)}</td>
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

      {/* Create/Approve License Modal */}
      {showCreate && (
        <div className="sa-modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="sa-modal" onClick={e => e.stopPropagation()}>
            <div className="sa-modal-header">
              <div className="sa-modal-title">Manual License Approval</div>
              <button className="sa-modal-close" onClick={() => setShowCreate(false)}>✕</button>
            </div>
            <div className="sa-modal-body">
              {msg && <Alert type="success" title={msg} />}
              <div className="sa-form-group">
                <label className="sa-label">Tenant *</label>
                <select className="sa-select" value={form.tenantId} onChange={e => setForm(f => ({ ...f, tenantId: e.target.value }))}>
                  <option value="">Select tenant…</option>
                  {tenantsData?.data.map(t => (
                    <option key={t.id} value={t.id}>{t.name} — {t.status}</option>
                  ))}
                </select>
              </div>
              <div className="sa-form-group">
                <label className="sa-label">SaaS Plan *</label>
                <select className="sa-select" value={form.planId} onChange={e => setForm(f => ({ ...f, planId: e.target.value }))}>
                  <option value="">Select plan…</option>
                  {plans.map(p => <option key={p.id} value={p.id}>{p.name} — TZS {p.price.toLocaleString()}/mo</option>)}
                </select>
              </div>
              <div className="sa-grid-2">
                <div className="sa-form-group">
                  <label className="sa-label">Starts At</label>
                  <input className="sa-input" type="date" value={form.startsAt} onChange={e => setForm(f => ({ ...f, startsAt: e.target.value }))} />
                </div>
                <div className="sa-form-group">
                  <label className="sa-label">Expires At</label>
                  <input className="sa-input" type="date" value={form.expiresAt} onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))} />
                </div>
              </div>
              <div className="sa-form-group">
                <label className="sa-label">Action</label>
                <select className="sa-select" value={form.action} onChange={e => setForm(f => ({ ...f, action: e.target.value }))}>
                  <option value="approve">Approve immediately (activates tenant)</option>
                  <option value="create">Create pending (manual follow-up)</option>
                </select>
              </div>
              {createMutation.error && <Alert type="danger" title={String(createMutation.error)} />}
            </div>
            <div className="sa-modal-footer">
              <button className="sa-btn sa-btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
              <button
                className="sa-btn sa-btn-primary"
                disabled={createMutation.isPending || !form.tenantId || !form.planId}
                onClick={() => createMutation.mutate(form)}
              >
                {createMutation.isPending ? <span className="sa-spinner sa-spinner-sm" /> : <Plus size={14} />}
                {form.action === 'approve' ? 'Approve License' : 'Create License'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
