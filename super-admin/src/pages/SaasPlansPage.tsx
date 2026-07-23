import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { plansApi, type SaasPlan } from '../api';
import { Alert, ConfirmModal, fmtDate } from '../components/ui';
import { Plus, Edit2, Trash2, RefreshCw, Users, Server, Wifi, X } from 'lucide-react';

interface PlanForm {
  name: string;
  price: string;
  pppoeLimit: string;
  hotspotLimit: string;
  maxRouters: string;
}

const defaultForm: PlanForm = { name: '', price: '', pppoeLimit: '100', hotspotLimit: '', maxRouters: '1' };

export default function SaasPlansPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<SaasPlan | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SaasPlan | null>(null);
  const [form, setForm] = useState<PlanForm>(defaultForm);
  const [msg, setMsg] = useState('');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['sa-plans'],
    queryFn: plansApi.list,
  });
  const plans: SaasPlan[] = data?.data ?? [];

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };

  const createMutation = useMutation({
    mutationFn: (f: PlanForm) => plansApi.create({
      name: f.name,
      price: parseFloat(f.price),
      pppoeLimit: parseInt(f.pppoeLimit) || 100,
      hotspotLimit: f.hotspotLimit ? parseInt(f.hotspotLimit) : null,
      maxRouters: parseInt(f.maxRouters) || 1,
    }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['sa-plans'] });
      flash(res.message);
      setShowCreate(false);
      setForm(defaultForm);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, f }: { id: string; f: PlanForm }) => plansApi.update(id, {
      name: f.name,
      price: parseFloat(f.price),
      pppoeLimit: parseInt(f.pppoeLimit) || 100,
      hotspotLimit: f.hotspotLimit ? parseInt(f.hotspotLimit) : null,
      maxRouters: parseInt(f.maxRouters) || 1,
    }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['sa-plans'] });
      flash(res.message);
      setEditing(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => plansApi.delete(id),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['sa-plans'] });
      flash(res.message);
      setDeleteTarget(null);
    },
  });

  const openEdit = (p: SaasPlan) => {
    setEditing(p);
    setForm({
      name: p.name,
      price: String(p.price),
      pppoeLimit: String(p.pppoeLimit),
      hotspotLimit: p.hotspotLimit != null ? String(p.hotspotLimit) : '',
      maxRouters: String(p.maxRouters),
    });
  };

  const FormContent = () => (
    <>
      <div className="sa-grid-2">
        <div className="sa-form-group">
          <label className="sa-label">Plan Name *</label>
          <input className="sa-input" placeholder="e.g. Pro" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </div>
        <div className="sa-form-group">
          <label className="sa-label">Monthly Price (TZS) *</label>
          <input className="sa-input" type="number" placeholder="50000" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
        </div>
        <div className="sa-form-group">
          <label className="sa-label">Max Routers</label>
          <input className="sa-input" type="number" placeholder="1" value={form.maxRouters} onChange={e => setForm(f => ({ ...f, maxRouters: e.target.value }))} />
        </div>
        <div className="sa-form-group">
          <label className="sa-label">PPPoE Client Limit</label>
          <input className="sa-input" type="number" placeholder="100" value={form.pppoeLimit} onChange={e => setForm(f => ({ ...f, pppoeLimit: e.target.value }))} />
        </div>
        <div className="sa-form-group">
          <label className="sa-label">Hotspot Client Limit</label>
          <input className="sa-input" type="number" placeholder="Unlimited if blank" value={form.hotspotLimit} onChange={e => setForm(f => ({ ...f, hotspotLimit: e.target.value }))} />
        </div>
      </div>
    </>
  );

  return (
    <div>
      <div className="sa-page-header">
        <div className="sa-page-header-left">
          <h1>SaaS <span className="sa-gradient-text">Plans</span></h1>
          <p>Create and manage billing plans for platform tenants</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="sa-btn sa-btn-ghost" onClick={() => refetch()}><RefreshCw size={14} /></button>
          <button className="sa-btn sa-btn-primary" onClick={() => { setShowCreate(true); setForm(defaultForm); }}>
            <Plus size={14} /> New Plan
          </button>
        </div>
      </div>

      {msg && <Alert type="success" title={msg} />}
      {error && <Alert type="danger" title="Failed to load plans" message={String(error)} />}

      {/* Plans Grid */}
      {isLoading ? (
        <div className="sa-grid-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="sa-card">
              <div className="sa-skeleton" style={{ height: 22, width: 80, marginBottom: 16 }} />
              <div className="sa-skeleton" style={{ height: 36, width: 140, marginBottom: 16 }} />
              <div className="sa-skeleton" style={{ height: 14, width: '100%', marginBottom: 8 }} />
              <div className="sa-skeleton" style={{ height: 14, width: '80%' }} />
            </div>
          ))}
        </div>
      ) : plans.length === 0 ? (
        <div className="sa-empty">
          <div className="sa-empty-icon"><Server size={26} /></div>
          <div className="sa-empty-title">No plans yet</div>
          <div className="sa-empty-sub">Create your first SaaS billing plan</div>
        </div>
      ) : (
        <div className="sa-grid-3">
          {plans.map((p, idx) => (
            <div key={p.id} className="sa-card" style={{ position: 'relative', overflow: 'hidden' }}>
              {/* Accent top bar */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                background: `linear-gradient(90deg, ${['#6366f1','#06b6d4','#10b981','#f59e0b'][idx % 4]}, transparent)`,
              }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <span style={{
                  background: `rgba(${['99,102,241','6,182,212','16,185,129','245,158,11'][idx % 4]},0.15)`,
                  color: ['var(--primary-light)','var(--accent)','var(--success)','var(--warning)'][idx % 4],
                  padding: '3px 10px', borderRadius: 'var(--r-full)', fontSize: 11, fontWeight: 700,
                }}>
                  {p.name}
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="sa-btn sa-btn-sm sa-btn-ghost" onClick={() => openEdit(p)}>
                    <Edit2 size={12} />
                  </button>
                  <button className="sa-btn sa-btn-sm sa-btn-danger" onClick={() => setDeleteTarget(p)}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
                  TZS {p.price.toLocaleString()}
                </div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: 2 }}>per month</div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                {[
                  { icon: <Server size={12} />, label: 'Max Routers', value: p.maxRouters },
                  { icon: <Users size={12} />, label: 'PPPoE Limit', value: `${p.pppoeLimit} clients` },
                  { icon: <Wifi size={12} />, label: 'Hotspot Limit', value: p.hotspotLimit != null ? `${p.hotspotLimit} clients` : 'Unlimited' },
                ].map(({ icon, label, value }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                    <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{icon}</span>
                    <span style={{ flex: 1 }}>{label}</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{value}</span>
                  </div>
                ))}
              </div>

              <div className="sa-divider" />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Users size={11} /> {p.tenantCount} tenant{p.tenantCount !== 1 ? 's' : ''}
                </span>
                <span>Updated {fmtDate(p.updatedAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="sa-modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="sa-modal" onClick={e => e.stopPropagation()}>
            <div className="sa-modal-header">
              <div className="sa-modal-title">Create SaaS Plan</div>
              <button className="sa-modal-close" onClick={() => setShowCreate(false)}><X size={18} /></button>
            </div>
            <div className="sa-modal-body">
              <FormContent />
              {createMutation.error && <Alert type="danger" title={String(createMutation.error)} />}
            </div>
            <div className="sa-modal-footer">
              <button className="sa-btn sa-btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
              <button
                className="sa-btn sa-btn-primary"
                disabled={createMutation.isPending || !form.name || !form.price}
                onClick={() => createMutation.mutate(form)}
              >
                {createMutation.isPending ? <span className="sa-spinner sa-spinner-sm" /> : <Plus size={14} />}
                Create Plan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editing && (
        <div className="sa-modal-overlay" onClick={() => setEditing(null)}>
          <div className="sa-modal" onClick={e => e.stopPropagation()}>
            <div className="sa-modal-header">
              <div className="sa-modal-title">Edit Plan: {editing.name}</div>
              <button className="sa-modal-close" onClick={() => setEditing(null)}><X size={18} /></button>
            </div>
            <div className="sa-modal-body">
              <FormContent />
              {updateMutation.error && <Alert type="danger" title={String(updateMutation.error)} />}
            </div>
            <div className="sa-modal-footer">
              <button className="sa-btn sa-btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button
                className="sa-btn sa-btn-primary"
                disabled={updateMutation.isPending || !form.name || !form.price}
                onClick={() => updateMutation.mutate({ id: editing.id, f: form })}
              >
                {updateMutation.isPending ? <span className="sa-spinner sa-spinner-sm" /> : <Edit2 size={14} />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <ConfirmModal
          title={`Delete "${deleteTarget.name}" plan?`}
          message={deleteTarget.tenantCount > 0
            ? `Cannot delete — ${deleteTarget.tenantCount} tenant(s) are using this plan.`
            : `This will permanently delete the "${deleteTarget.name}" plan. This cannot be undone.`}
          confirmLabel="Delete Plan"
          danger
          loading={deleteMutation.isPending}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
        />
      )}
    </div>
  );
}
