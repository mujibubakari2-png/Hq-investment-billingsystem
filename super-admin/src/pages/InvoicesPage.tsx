import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoicesApi, tenantsApi, plansApi, type TenantInvoiceItem, type SaasPlan } from '../api';
import { StatusBadge, Pagination, Alert, fmtDate, fmtCurrency, ConfirmModal } from '../components/ui';
import { Plus, RefreshCw, CheckCircle2, X, Receipt, AlertTriangle } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'PAID', label: 'Paid' },
  { value: 'OVERDUE', label: 'Overdue' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export default function InvoicesPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [confirmPay, setConfirmPay] = useState<TenantInvoiceItem | null>(null);
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState({
    tenantId: '', planId: '', amount: '', dueDate: '', packageMonths: '1',
  });

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 4000); };

  const params: Record<string, string> = { page: String(page), limit: '25' };
  if (statusFilter) params.status = statusFilter;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['sa-invoices', page, statusFilter],
    queryFn: () => invoicesApi.list(params),
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

  const plans: SaasPlan[] = plansData?.data ?? [];

  // Auto-fill amount when plan is selected
  const handlePlanSelect = (planId: string) => {
    const plan = plans.find(p => p.id === planId);
    setForm(f => ({
      ...f,
      planId,
      amount: plan ? String(plan.price) : f.amount,
    }));
  };

  const createMutation = useMutation({
    mutationFn: () => invoicesApi.create({
      action: 'create',
      tenantId: form.tenantId,
      planId: form.planId,
      amount: parseFloat(form.amount),
      dueDate: form.dueDate || undefined,
      packageMonths: parseInt(form.packageMonths) || 1,
    }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['sa-invoices'] });
      flash(res.message);
      setShowCreate(false);
      setForm({ tenantId: '', planId: '', amount: '', dueDate: '', packageMonths: '1' });
    },
  });

  const confirmMutation = useMutation({
    mutationFn: (invoiceId: string) => invoicesApi.confirmPayment(invoiceId),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['sa-invoices'] });
      qc.invalidateQueries({ queryKey: ['sa-tenants'] });
      flash(res.message);
      setConfirmPay(null);
    },
  });

  const invoices: TenantInvoiceItem[] = data?.data ?? [];
  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;

  // Summary stats
  const overdue = invoices.filter(i => i.status === 'OVERDUE').length;
  const pending = invoices.filter(i => i.status === 'PENDING').length;

  return (
    <div>
      <div className="sa-page-header">
        <div className="sa-page-header-left">
          <h1>SaaS <span className="sa-gradient-text">Invoices</span></h1>
          <p>Platform billing to tenants for license subscriptions</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="sa-btn sa-btn-ghost" onClick={() => refetch()}><RefreshCw size={14} /> Refresh</button>
          <button className="sa-btn sa-btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={14} /> Create Invoice
          </button>
        </div>
      </div>

      {msg && <Alert type="success" title={msg} />}

      {/* Quick alerts */}
      {overdue > 0 && !statusFilter && (
        <Alert
          type="danger"
          title={`${overdue} overdue invoice${overdue > 1 ? 's' : ''} require attention`}
          message="These tenants have unpaid invoices past their due date."
        />
      )}
      {pending > 0 && !statusFilter && (
        <Alert
          type="warning"
          title={`${pending} invoice${pending > 1 ? 's' : ''} awaiting payment`}
        />
      )}

      {/* Filters */}
      <div className="sa-filters-row">
        <select
          className="sa-select"
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          style={{ width: 160 }}
        >
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {statusFilter && (
          <button className="sa-btn sa-btn-sm sa-btn-ghost" onClick={() => { setStatusFilter(''); setPage(1); }}>
            <X size={12} /> Clear
          </button>
        )}
        <span className="sa-text-muted" style={{ fontSize: 'var(--font-size-xs)', marginLeft: 'auto' }}>
          {total} invoice{total !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="sa-card" style={{ padding: 0 }}>
        {error && <Alert type="danger" title="Failed to load invoices" message={String(error)} />}
        <div className="sa-table-container">
          <table className="sa-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Tenant</th>
                <th>Plan</th>
                <th>Amount</th>
                <th>Months</th>
                <th>Status</th>
                <th>Due Date</th>
                <th>Created</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j}><div className="sa-skeleton" style={{ height: 14, borderRadius: 3, width: j === 0 ? 100 : 70 }} /></td>
                    ))}
                  </tr>
                ))
                : invoices.length === 0
                  ? (
                    <tr><td colSpan={9}>
                      <div className="sa-empty">
                        <div className="sa-empty-icon"><Receipt size={26} /></div>
                        <div className="sa-empty-title">No invoices found</div>
                        <div className="sa-empty-sub">Create your first platform invoice</div>
                      </div>
                    </td></tr>
                  )
                  : invoices.map(inv => (
                    <tr key={inv.id}>
                      <td>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)', color: 'var(--accent)' }}>
                          {inv.invoiceNumber}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)' }}>
                          {inv.tenantName}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{inv.tenantEmail}</div>
                      </td>
                      <td style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>{inv.planName}</td>
                      <td style={{ fontWeight: 700, color: 'var(--success)', fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-sm)' }}>
                        {fmtCurrency(inv.amount)}
                      </td>
                      <td style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                        {inv.packageMonths}mo
                      </td>
                      <td>
                        <StatusBadge status={inv.status} />
                      </td>
                      <td style={{ fontSize: 'var(--font-size-xs)' }}>
                        {inv.dueDate ? (
                          <span style={{ color: inv.status === 'OVERDUE' ? 'var(--danger)' : 'var(--text-secondary)' }}>
                            {inv.status === 'OVERDUE' && <AlertTriangle size={11} style={{ display: 'inline', marginRight: 3 }} />}
                            {fmtDate(inv.dueDate)}
                          </span>
                        ) : '—'}
                      </td>
                      <td style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                        {fmtDate(inv.createdAt)}
                      </td>
                      <td>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                          {(inv.status === 'PENDING' || inv.status === 'OVERDUE') && (
                            <button
                              className="sa-btn sa-btn-sm sa-btn-success"
                              onClick={() => setConfirmPay(inv)}
                              title="Confirm manual payment"
                            >
                              <CheckCircle2 size={12} /> Confirm Paid
                            </button>
                          )}
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

      {/* Create Invoice Modal */}
      {showCreate && (
        <div className="sa-modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="sa-modal" onClick={e => e.stopPropagation()}>
            <div className="sa-modal-header">
              <div>
                <div className="sa-modal-title">Create SaaS Invoice</div>
                <div className="sa-modal-sub">Generate a license payment invoice for a tenant</div>
              </div>
              <button className="sa-modal-close" onClick={() => setShowCreate(false)}><X size={18} /></button>
            </div>
            <div className="sa-modal-body">
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
                <select className="sa-select" value={form.planId} onChange={e => handlePlanSelect(e.target.value)}>
                  <option value="">Select plan…</option>
                  {plans.map(p => (
                    <option key={p.id} value={p.id}>{p.name} — {fmtCurrency(p.price)}/mo</option>
                  ))}
                </select>
              </div>
              <div className="sa-grid-2">
                <div className="sa-form-group">
                  <label className="sa-label">Amount (TZS) *</label>
                  <input
                    className="sa-input"
                    type="number"
                    placeholder="Auto-filled from plan"
                    value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  />
                </div>
                <div className="sa-form-group">
                  <label className="sa-label">Package Months</label>
                  <select className="sa-select" value={form.packageMonths} onChange={e => setForm(f => ({ ...f, packageMonths: e.target.value }))}>
                    {[1,2,3,6,12].map(m => <option key={m} value={m}>{m} month{m > 1 ? 's' : ''}</option>)}
                  </select>
                </div>
                <div className="sa-form-group">
                  <label className="sa-label">Due Date</label>
                  <input
                    className="sa-input"
                    type="date"
                    value={form.dueDate}
                    onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
              </div>
              {createMutation.error && <Alert type="danger" title={String(createMutation.error)} />}
            </div>
            <div className="sa-modal-footer">
              <button className="sa-btn sa-btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
              <button
                className="sa-btn sa-btn-primary"
                disabled={createMutation.isPending || !form.tenantId || !form.planId || !form.amount}
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending ? <span className="sa-spinner sa-spinner-sm" /> : <Plus size={14} />}
                Create Invoice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Payment Modal */}
      {confirmPay && (
        <ConfirmModal
          title="Confirm Manual Payment?"
          message={
            <span>
              Mark invoice <strong style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{confirmPay.invoiceNumber}</strong> as PAID for <strong>{confirmPay.tenantName}</strong>?<br /><br />
              Amount: <strong style={{ color: 'var(--success)' }}>{fmtCurrency(confirmPay.amount)}</strong><br />
              This will activate the tenant and extend their license by <strong>{confirmPay.packageMonths} month(s)</strong>.
            </span>
          }
          confirmLabel="Confirm Payment"
          loading={confirmMutation.isPending}
          onCancel={() => setConfirmPay(null)}
          onConfirm={() => confirmMutation.mutate(confirmPay.id)}
        />
      )}
    </div>
  );
}
