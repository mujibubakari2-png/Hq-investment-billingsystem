import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { tenantsApi, plansApi, type SaasPlan } from '../api';
import { StatusBadge, ExpiryDate, ConfirmModal, Alert, fmtDate, fmtDateTime, fmtCurrency } from '../components/ui';
import {
  ArrowLeft, Building2, Mail, Phone, Shield, CreditCard,
  RefreshCw, UserX, UserCheck, Key, Trash2, Calendar, Globe,
} from 'lucide-react';

export default function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState('');
  const [extendDate, setExtendDate] = useState('');
  const [newPlanId, setNewPlanId] = useState('');
  const [showExtend, setShowExtend] = useState(false);
  const [showChangePlan, setShowChangePlan] = useState(false);

  const { data: tenant, isLoading, error, refetch } = useQuery({
    queryKey: ['sa-tenant', id],
    queryFn: () => tenantsApi.get(id!),
    enabled: !!id,
  });

  const { data: plansData } = useQuery({
    queryKey: ['sa-plans'],
    queryFn: plansApi.list,
  });
  const plans: SaasPlan[] = plansData?.data ?? [];

  const actionMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => tenantsApi.update(id!, payload),
    onSuccess: (res) => {
      setActionMsg(res.message);
      qc.invalidateQueries({ queryKey: ['sa-tenant', id] });
      qc.invalidateQueries({ queryKey: ['sa-tenants'] });
      setTimeout(() => { setConfirmAction(null); setActionMsg(''); setShowExtend(false); setShowChangePlan(false); }, 2500);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (confirmName: string) => tenantsApi.delete(id!, confirmName),
    onSuccess: () => {
      navigate('/tenants', { replace: true });
    },
  });

  if (isLoading) {
    return (
      <div className="sa-loading-center">
        <div className="sa-spinner" />
        <span>Loading tenant details…</span>
      </div>
    );
  }

  if (error || !tenant) {
    return <Alert type="danger" title="Tenant not found" message={String(error || '')} />;
  }

  // Privacy reminder — displayed on page to reinforce boundary
  const PRIVACY_NOTE = "Platform Super Admin view: showing platform-level metadata only. Tenant operational data (clients, routers, transactions) is not accessible from this portal.";

  return (
    <div>
      {/* Back */}
      <button className="sa-btn sa-btn-ghost sa-btn-sm" style={{ marginBottom: 20 }} onClick={() => navigate('/tenants')}>
        <ArrowLeft size={14} /> Back to Tenants
      </button>

      {/* Header */}
      <div className="sa-page-header">
        <div className="sa-page-header-left" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, var(--primary), var(--accent))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, fontWeight: 800, color: 'white',
          }}>
            {(tenant as any).name?.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h1>{(tenant as any).name}</h1>
            <p style={{ marginTop: 2 }}>{(tenant as any).email} · Slug: <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>{(tenant as any).slug}</code></p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="sa-btn sa-btn-ghost sa-btn-sm" onClick={() => refetch()}>
            <RefreshCw size={13} />
          </button>
          {(tenant as any).status === 'PENDING_APPROVAL' && (
            <button className="sa-btn sa-btn-sm sa-btn-success" onClick={() => setConfirmAction('approve')}>
              <UserCheck size={13} /> Approve
            </button>
          )}
          {(['ACTIVE', 'TRIALLING'].includes((tenant as any).status)) && (
            <button className="sa-btn sa-btn-sm sa-btn-danger" onClick={() => setConfirmAction('suspend')}>
              <UserX size={13} /> Suspend
            </button>
          )}
          {(tenant as any).status === 'SUSPENDED' && (
            <button className="sa-btn sa-btn-sm sa-btn-success" onClick={() => setConfirmAction('reactivate')}>
              <UserCheck size={13} /> Reactivate
            </button>
          )}
          <button className="sa-btn sa-btn-sm sa-btn-ghost" onClick={() => setConfirmAction('reset_password')}>
            <Key size={13} /> Reset Password
          </button>
          <button className="sa-btn sa-btn-sm sa-btn-danger" onClick={() => setConfirmAction('delete')}>
            <Trash2 size={13} /> Delete
          </button>
        </div>
      </div>

      {/* Success message */}
      {actionMsg && <Alert type="success" title={actionMsg} />}

      {/* Privacy Banner */}
      <div className="sa-privacy-banner sa-mb-24">
        <Shield size={14} />
        {PRIVACY_NOTE}
      </div>

      {/* Info Grid */}
      <div className="sa-grid-2 sa-mb-24">
        {/* Tenant Details */}
        <div className="sa-card">
          <div className="sa-card-header">
            <span className="sa-card-title">Business Information</span>
            <StatusBadge status={(tenant as any).status} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { icon: <Building2 size={14} />, label: 'Name', value: (tenant as any).name },
              { icon: <Mail size={14} />, label: 'Email', value: (tenant as any).email },
              { icon: <Phone size={14} />, label: 'Phone', value: (tenant as any).phone || '—' },
              { icon: <Globe size={14} />, label: 'Slug', value: (tenant as any).slug },
              { icon: <Calendar size={14} />, label: 'Registered', value: fmtDate((tenant as any).createdAt) },
              { icon: <Calendar size={14} />, label: 'Trial Ends', value: fmtDate((tenant as any).trialEnd) },
            ].map(({ icon, label, value }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{icon}</span>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', width: 80, flexShrink: 0 }}>{label}</span>
                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)', fontWeight: 500 }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* License / Plan */}
        <div className="sa-card">
          <div className="sa-card-header">
            <span className="sa-card-title">License & Plan</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="sa-btn sa-btn-sm sa-btn-ghost" onClick={() => setShowChangePlan(true)}>
                Change Plan
              </button>
              <button className="sa-btn sa-btn-sm sa-btn-primary" onClick={() => setShowExtend(true)}>
                <CreditCard size={12} /> Extend
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { label: 'Current Plan', value: (tenant as any).plan?.name || '—' },
              { label: 'Plan Price', value: (tenant as any).plan ? fmtCurrency((tenant as any).plan.price) + '/mo' : '—' },
              { label: 'Max Routers', value: (tenant as any).plan?.maxRouters ?? '—' },
              { label: 'PPPoE Limit', value: (tenant as any).plan?.pppoeLimit ?? '—' },
              { label: 'Hotspot Limit', value: (tenant as any).plan?.hotspotLimit ?? 'Unlimited' },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', width: 110, flexShrink: 0 }}>{label}</span>
                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)', fontWeight: 600 }}>{String(value)}</span>
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', width: 110, flexShrink: 0 }}>License Expiry</span>
              <ExpiryDate date={(tenant as any).licenseExpiresAt} />
            </div>
          </div>
        </div>
      </div>

      {/* Admin Users */}
      {Array.isArray((tenant as any).adminUsers) && (tenant as any).adminUsers.length > 0 && (
        <div className="sa-card sa-mb-24">
          <div className="sa-card-header">
            <span className="sa-card-title">Admin Users (Contact Info Only)</span>
            <span className="sa-text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>
              Sub-users and client accounts are not visible — privacy protected
            </span>
          </div>
          <div className="sa-table-container">
            <table className="sa-table">
              <thead>
                <tr>
                  <th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Last Login</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(tenant as any).adminUsers.map((u: any) => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{u.fullName || '—'}</td>
                    <td>{u.email}</td>
                    <td>{u.phone || '—'}</td>
                    <td><span className="sa-badge info">{u.role}</span></td>
                    <td style={{ fontSize: 'var(--font-size-xs)' }}>{fmtDateTime(u.lastLogin)}</td>
                    <td><StatusBadge status={u.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* License History */}
      {Array.isArray((tenant as any).licenseHistory) && (tenant as any).licenseHistory.length > 0 && (
        <div className="sa-card sa-mb-24">
          <div className="sa-card-header">
            <span className="sa-card-title">License History</span>
          </div>
          <div className="sa-table-container">
            <table className="sa-table">
              <thead>
                <tr><th>Plan</th><th>Status</th><th>Starts</th><th>Expires</th><th>Created</th></tr>
              </thead>
              <tbody>
                {(tenant as any).licenseHistory.map((l: any) => (
                  <tr key={l.id}>
                    <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{l.plan?.name || '—'}</td>
                    <td><StatusBadge status={l.status} /></td>
                    <td style={{ fontSize: 'var(--font-size-xs)' }}>{fmtDate(l.startsAt)}</td>
                    <td><ExpiryDate date={l.expiresAt} /></td>
                    <td style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{fmtDate(l.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payment History */}
      {Array.isArray((tenant as any).paymentHistory) && (tenant as any).paymentHistory.length > 0 && (
        <div className="sa-card">
          <div className="sa-card-header">
            <span className="sa-card-title">License Payment History</span>
          </div>
          <div className="sa-table-container">
            <table className="sa-table">
              <thead>
                <tr><th>Invoice</th><th>Amount</th><th>Method</th><th>Status</th><th>Date</th></tr>
              </thead>
              <tbody>
                {(tenant as any).paymentHistory.map((p: any) => (
                  <tr key={p.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)' }}>
                      {p.invoice?.invoiceNumber || '—'}
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--success)' }}>{fmtCurrency(p.amount)}</td>
                    <td>{p.paymentMethod}</td>
                    <td><StatusBadge status={p.status} /></td>
                    <td style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{fmtDateTime(p.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────── */}
      {/* Extend license */}
      {showExtend && (
        <div className="sa-modal-overlay" onClick={() => setShowExtend(false)}>
          <div className="sa-modal" onClick={e => e.stopPropagation()}>
            <div className="sa-modal-header">
              <div className="sa-modal-title">Extend License</div>
              <button className="sa-modal-close" onClick={() => setShowExtend(false)}>✕</button>
            </div>
            <div className="sa-modal-body">
              <div className="sa-form-group">
                <label className="sa-label">New Expiry Date *</label>
                <input className="sa-input" type="date" value={extendDate} onChange={e => setExtendDate(e.target.value)} min={new Date().toISOString().split('T')[0]} />
              </div>
              {actionMutation.error && <Alert type="danger" title={String(actionMutation.error)} />}
              {actionMsg && <Alert type="success" title={actionMsg} />}
            </div>
            <div className="sa-modal-footer">
              <button className="sa-btn sa-btn-ghost" onClick={() => setShowExtend(false)}>Cancel</button>
              <button
                className="sa-btn sa-btn-primary"
                disabled={!extendDate || actionMutation.isPending}
                onClick={() => actionMutation.mutate({ action: 'extend_license', licenseExpiresAt: extendDate })}
              >
                {actionMutation.isPending ? <span className="sa-spinner sa-spinner-sm" /> : null}
                Extend License
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Plan */}
      {showChangePlan && (
        <div className="sa-modal-overlay" onClick={() => setShowChangePlan(false)}>
          <div className="sa-modal" onClick={e => e.stopPropagation()}>
            <div className="sa-modal-header">
              <div className="sa-modal-title">Change SaaS Plan</div>
              <button className="sa-modal-close" onClick={() => setShowChangePlan(false)}>✕</button>
            </div>
            <div className="sa-modal-body">
              <div className="sa-form-group">
                <label className="sa-label">New Plan *</label>
                <select className="sa-select" value={newPlanId} onChange={e => setNewPlanId(e.target.value)}>
                  <option value="">Select new plan…</option>
                  {plans.map(p => <option key={p.id} value={p.id}>{p.name} — TZS {p.price.toLocaleString()}/mo</option>)}
                </select>
              </div>
              {actionMsg && <Alert type="success" title={actionMsg} />}
            </div>
            <div className="sa-modal-footer">
              <button className="sa-btn sa-btn-ghost" onClick={() => setShowChangePlan(false)}>Cancel</button>
              <button
                className="sa-btn sa-btn-primary"
                disabled={!newPlanId || actionMutation.isPending}
                onClick={() => actionMutation.mutate({ action: 'change_plan', planId: newPlanId })}
              >
                {actionMutation.isPending ? <span className="sa-spinner sa-spinner-sm" /> : null}
                Change Plan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action confirmation modals */}
      {confirmAction === 'suspend' && (
        <ConfirmModal
          title="Suspend Tenant?"
          message={`Suspending "${(tenant as any).name}" will prevent all users from logging in. This can be reversed.`}
          confirmLabel="Suspend"
          danger
          loading={actionMutation.isPending}
          onCancel={() => setConfirmAction(null)}
          onConfirm={() => actionMutation.mutate({ action: 'suspend' })}
        />
      )}
      {confirmAction === 'approve' && (
        <ConfirmModal
          title="Approve Tenant?"
          message={`Approve "${(tenant as any).name}" and start their 10-day trial. They will receive a notification.`}
          confirmLabel="Approve & Start Trial"
          loading={actionMutation.isPending}
          onCancel={() => setConfirmAction(null)}
          onConfirm={() => actionMutation.mutate({ action: 'approve' })}
        />
      )}
      {confirmAction === 'reactivate' && (
        <ConfirmModal
          title="Reactivate Tenant?"
          message={`Reactivate "${(tenant as any).name}" and restore their access.`}
          confirmLabel="Reactivate"
          loading={actionMutation.isPending}
          onCancel={() => setConfirmAction(null)}
          onConfirm={() => actionMutation.mutate({ action: 'reactivate' })}
        />
      )}
      {confirmAction === 'reset_password' && (
        <ConfirmModal
          title="Reset Admin Password?"
          message={`A new temporary password will be generated and sent to the tenant admin's email/SMS. You will NOT see the new password — it goes directly to the tenant.`}
          confirmLabel="Reset Password"
          loading={actionMutation.isPending}
          onCancel={() => setConfirmAction(null)}
          onConfirm={() => actionMutation.mutate({ action: 'reset_password' })}
        />
      )}
      {confirmAction === 'delete' && (
        <ConfirmModal
          title="Delete Tenant?"
          message={<span>This action is <strong style={{ color: 'var(--danger)' }}>irreversible</strong>. All tenant data will be permanently removed. Type the tenant name to confirm.</span>}
          confirmLabel="Delete Tenant"
          confirmText={(tenant as any).name}
          requireTyping
          typingLabel={`Type "${(tenant as any).name}" to confirm deletion`}
          danger
          loading={deleteMutation.isPending}
          onCancel={() => setConfirmAction(null)}
          onConfirm={(typed) => deleteMutation.mutate(typed || '')}
        />
      )}
    </div>
  );
}
