import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { tenantsApi, plansApi, type Tenant, type SaasPlan } from '../api';
import { StatusBadge, ExpiryDate, Pagination, ConfirmModal, Alert, fmtDate } from '../components/ui';
import {
  Search, Plus, UserX, UserCheck, Eye, RefreshCw,
  Filter, Building2, X,
} from 'lucide-react';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'TRIALLING', label: 'Trialling' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'PENDING_APPROVAL', label: 'Pending Approval' },
  { value: 'INACTIVE', label: 'Inactive' },
];

interface CreateForm {
  name: string; email: string; phone: string; planId: string;
  adminEmail: string; adminName: string; adminPhone: string;
}

export default function TenantsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [planFilter, setPlanFilter] = useState('');

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>({ name: '', email: '', phone: '', planId: '', adminEmail: '', adminName: '', adminPhone: '' });
  const [createResult, setCreateResult] = useState<{ adminEmail: string; tempPassword: string; note: string } | null>(null);

  const [confirmAction, setConfirmAction] = useState<{ tenantId: string; tenantName: string; action: string } | null>(null);
  const [actionMsg, setActionMsg] = useState('');

  // Queries
  const params: Record<string, string> = { page: String(page), limit: '25' };
  if (search) params.search = search;
  if (status) params.status = status;
  if (planFilter) params.planId = planFilter;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['sa-tenants', page, search, status, planFilter],
    queryFn: () => tenantsApi.list(params),
  });

  const { data: plansData } = useQuery({
    queryKey: ['sa-plans'],
    queryFn: plansApi.list,
  });
  const plans: SaasPlan[] = plansData?.data ?? [];

  // Create tenant mutation
  const createMutation = useMutation({
    mutationFn: (body: CreateForm) => tenantsApi.create(body),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['sa-tenants'] });
      setCreateResult(res.credentials);
    },
  });

  // Action mutation (suspend/reactivate/approve)
  const actionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) =>
      tenantsApi.update(id, { action }),
    onSuccess: (res) => {
      setActionMsg(res.message);
      qc.invalidateQueries({ queryKey: ['sa-tenants'] });
      setTimeout(() => { setConfirmAction(null); setActionMsg(''); }, 2000);
    },
  });

  const handleSearch = (val: string) => {
    setSearch(val);
    setPage(1);
    const p = new URLSearchParams(searchParams);
    if (val) p.set('search', val); else p.delete('search');
    setSearchParams(p, { replace: true });
  };

  const handleStatus = (val: string) => {
    setStatus(val);
    setPage(1);
    const p = new URLSearchParams(searchParams);
    if (val) p.set('status', val); else p.delete('status');
    setSearchParams(p, { replace: true });
  };

  const tenants: Tenant[] = data?.data ?? [];
  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;

  return (
    <div>
      {/* Header */}
      <div className="sa-page-header">
        <div className="sa-page-header-left">
          <h1>Tenant <span className="sa-gradient-text">Management</span></h1>
          <p>Register, manage, and monitor all platform tenants</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="sa-btn sa-btn-ghost" onClick={() => refetch()}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button className="sa-btn sa-btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={14} /> New Tenant
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="sa-filters-row">
        <div className="sa-search-bar">
          <Search className="sa-search-icon" size={15} />
          <input
            className="sa-input"
            placeholder="Search by name, email, phone…"
            value={search}
            onChange={e => handleSearch(e.target.value)}
          />
        </div>
        <select className="sa-select" value={status} onChange={e => handleStatus(e.target.value)} style={{ width: 160 }}>
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select className="sa-select" value={planFilter} onChange={e => { setPlanFilter(e.target.value); setPage(1); }} style={{ width: 140 }}>
          <option value="">All Plans</option>
          {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {(search || status || planFilter) && (
          <button className="sa-btn sa-btn-sm sa-btn-ghost" onClick={() => { setSearch(''); setStatus(''); setPlanFilter(''); setPage(1); setSearchParams({}); }}>
            <X size={12} /> Clear
          </button>
        )}
        <span className="sa-text-muted sa-mt-auto" style={{ fontSize: 'var(--font-size-xs)', marginLeft: 'auto' }}>
          {total} tenant{total !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="sa-card" style={{ padding: 0 }}>
        {error && <Alert type="danger" title="Failed to load tenants" message={String(error)} />}

        <div className="sa-table-container">
          <table className="sa-table">
            <thead>
              <tr>
                <th>Tenant</th>
                <th>Status</th>
                <th>Plan</th>
                <th>Primary Admin</th>
                <th>License Expires</th>
                <th>Registered</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j}><div className="sa-skeleton" style={{ height: 16, borderRadius: 4, width: j === 0 ? 120 : 80 }} /></td>
                      ))}
                    </tr>
                  ))
                : tenants.length === 0
                  ? (
                    <tr><td colSpan={7}>
                      <div className="sa-empty">
                        <div className="sa-empty-icon"><Building2 size={24} /></div>
                        <div className="sa-empty-title">No tenants found</div>
                        <div className="sa-empty-sub">{search || status ? 'Try adjusting filters' : 'Register your first tenant'}</div>
                      </div>
                    </td></tr>
                  )
                  : tenants.map(t => (
                    <tr key={t.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                            background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 11, fontWeight: 700, color: 'white',
                          }}>
                            {t.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)' }}>
                              {t.name}
                            </div>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                              {t.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td><StatusBadge status={t.status} /></td>
                      <td>
                        <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--text-secondary)' }}>
                          {t.planName ?? '—'}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                          {t.primaryAdmin?.fullName || t.primaryAdmin?.email || '—'}
                        </span>
                      </td>
                      <td><ExpiryDate date={t.licenseExpiresAt} /></td>
                      <td style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                        {fmtDate(t.createdAt)}
                      </td>
                      <td>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                          <button
                            className="sa-btn sa-btn-sm sa-btn-ghost"
                            title="View Details"
                            onClick={() => navigate(`/tenants/${t.id}`)}
                          >
                            <Eye size={13} />
                          </button>
                          {t.status === 'PENDING_APPROVAL' && (
                            <button
                              className="sa-btn sa-btn-sm sa-btn-success"
                              title="Approve"
                              onClick={() => setConfirmAction({ tenantId: t.id, tenantName: t.name, action: 'approve' })}
                            >
                              <UserCheck size={13} /> Approve
                            </button>
                          )}
                          {t.status === 'ACTIVE' || t.status === 'TRIALLING' ? (
                            <button
                              className="sa-btn sa-btn-sm sa-btn-danger"
                              title="Suspend"
                              onClick={() => setConfirmAction({ tenantId: t.id, tenantName: t.name, action: 'suspend' })}
                            >
                              <UserX size={13} />
                            </button>
                          ) : t.status === 'SUSPENDED' ? (
                            <button
                              className="sa-btn sa-btn-sm sa-btn-success"
                              title="Reactivate"
                              onClick={() => setConfirmAction({ tenantId: t.id, tenantName: t.name, action: 'reactivate' })}
                            >
                              <UserCheck size={13} />
                            </button>
                          ) : null}
                        </div>
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

      {/* ── Create Tenant Modal ────────────────────────── */}
      {showCreate && !createResult && (
        <div className="sa-modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="sa-modal sa-modal-lg" onClick={e => e.stopPropagation()}>
            <div className="sa-modal-header">
              <div>
                <div className="sa-modal-title">Register New Tenant</div>
                <div className="sa-modal-sub">Create a new tenant account with auto-generated admin credentials</div>
              </div>
              <button className="sa-modal-close" onClick={() => setShowCreate(false)}><X size={18} /></button>
            </div>
            <div className="sa-modal-body">
              <div className="sa-privacy-banner">
                <Building2 size={14} />
                Tenant will receive admin credentials via email. Super admin does not retain permanent access to tenant data.
              </div>
              <div className="sa-grid-2">
                <div className="sa-form-group">
                  <label className="sa-label">Business Name *</label>
                  <input className="sa-input" placeholder="Acme ISP Ltd" value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="sa-form-group">
                  <label className="sa-label">Business Email *</label>
                  <input className="sa-input" type="email" placeholder="info@acme.co.tz" value={createForm.email} onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="sa-form-group">
                  <label className="sa-label">Business Phone</label>
                  <input className="sa-input" placeholder="+255 712 345 678" value={createForm.phone} onChange={e => setCreateForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <div className="sa-form-group">
                  <label className="sa-label">SaaS Plan *</label>
                  <select className="sa-select" value={createForm.planId} onChange={e => setCreateForm(f => ({ ...f, planId: e.target.value }))}>
                    <option value="">Select plan…</option>
                    {plans.map(p => <option key={p.id} value={p.id}>{p.name} — TZS {p.price.toLocaleString()}/mo</option>)}
                  </select>
                </div>
              </div>
              <div className="sa-divider" />
              <p style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Admin User Details (optional overrides)</p>
              <div className="sa-grid-2">
                <div className="sa-form-group">
                  <label className="sa-label">Admin Full Name</label>
                  <input className="sa-input" placeholder="Auto-generated if blank" value={createForm.adminName} onChange={e => setCreateForm(f => ({ ...f, adminName: e.target.value }))} />
                </div>
                <div className="sa-form-group">
                  <label className="sa-label">Admin Email</label>
                  <input className="sa-input" type="email" placeholder="Uses business email if blank" value={createForm.adminEmail} onChange={e => setCreateForm(f => ({ ...f, adminEmail: e.target.value }))} />
                </div>
              </div>
              {createMutation.error && (
                <Alert type="danger" title="Creation failed" message={String(createMutation.error)} />
              )}
            </div>
            <div className="sa-modal-footer">
              <button className="sa-btn sa-btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
              <button
                className="sa-btn sa-btn-primary"
                disabled={createMutation.isPending || !createForm.name || !createForm.email || !createForm.planId}
                onClick={() => createMutation.mutate(createForm)}
              >
                {createMutation.isPending ? <span className="sa-spinner sa-spinner-sm" /> : <Plus size={14} />}
                Create Tenant
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Credentials result modal */}
      {showCreate && createResult && (
        <div className="sa-modal-overlay">
          <div className="sa-modal" onClick={e => e.stopPropagation()}>
            <div className="sa-modal-header">
              <div className="sa-modal-title" style={{ color: 'var(--success)' }}>✓ Tenant Created</div>
            </div>
            <div className="sa-modal-body">
              <Alert type="success" title="Tenant registered successfully!" message="Share these credentials securely with the tenant." />
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: 16, fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-sm)' }}>
                <div style={{ marginBottom: 8 }}><span style={{ color: 'var(--text-muted)' }}>Email: </span><span style={{ color: 'var(--text-primary)' }}>{createResult.adminEmail}</span></div>
                <div><span style={{ color: 'var(--text-muted)' }}>Temp Password: </span><span style={{ color: 'var(--success)', fontWeight: 700 }}>{createResult.tempPassword}</span></div>
              </div>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: 12 }}>{createResult.note}</p>
            </div>
            <div className="sa-modal-footer">
              <button className="sa-btn sa-btn-primary" onClick={() => { setShowCreate(false); setCreateResult(null); setCreateForm({ name: '', email: '', phone: '', planId: '', adminEmail: '', adminName: '', adminPhone: '' }); createMutation.reset(); }}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action confirmation */}
      {confirmAction && (
        <ConfirmModal
          title={confirmAction.action === 'suspend' ? 'Suspend Tenant?' : confirmAction.action === 'approve' ? 'Approve Tenant?' : 'Reactivate Tenant?'}
          message={
            confirmAction.action === 'suspend'
              ? `Suspending "${confirmAction.tenantName}" will prevent all their users from logging in. You can reactivate at any time.`
              : confirmAction.action === 'approve'
              ? `Approving "${confirmAction.tenantName}" will start their 10-day trial period and send them a notification.`
              : `Reactivating "${confirmAction.tenantName}" will restore their access.`
          }
          confirmLabel={confirmAction.action === 'suspend' ? 'Suspend' : confirmAction.action === 'approve' ? 'Approve & Start Trial' : 'Reactivate'}
          danger={confirmAction.action === 'suspend'}
          loading={actionMutation.isPending}
          onCancel={() => { setConfirmAction(null); setActionMsg(''); }}
          onConfirm={() => actionMutation.mutate({ id: confirmAction.tenantId, action: confirmAction.action })}
        />
      )}
    </div>
  );
}
