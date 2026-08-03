import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ecommerceApi, Promotion } from '../../api';
import { ConfirmModal, Alert, Pagination, StatusBadge } from '../../components/ui';
import { Search, Plus, Edit, Trash2, XCircle, Save, Megaphone, Calendar } from 'lucide-react';

const PROMO_TYPES: Promotion['type'][] = ['DISCOUNT', 'COUPON', 'FLASH_SALE'];
const PROMO_STATUSES: Promotion['status'][] = ['DRAFT', 'ACTIVE', 'EXPIRED'];

type PromotionForm = {
  id?: string;
  name?: string;
  description?: string;
  type?: Promotion['type'];
  status?: Promotion['status'];
  discountValue?: string;
  startDate?: string;
  endDate?: string;
  usageLimit?: string;
};

export default function PromotionsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<PromotionForm>({ name: '', description: '', type: 'DISCOUNT', status: 'DRAFT', discountValue: '', startDate: '', endDate: '', usageLimit: '' });
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['sa-promotions', page, search],
    queryFn: () => ecommerceApi.promotions.list({ page: String(page), limit: '25', search }),
  });

  const saveMutation = useMutation({
    mutationFn: (body: PromotionForm) => isEditing && formData.id ? ecommerceApi.promotions.update(formData.id, body as any) : ecommerceApi.promotions.create(body as any),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sa-promotions'] }); setShowModal(false); setErrorMsg(''); },
    onError: (err: any) => setErrorMsg(err.message || 'Failed to save promotion')
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ecommerceApi.promotions.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sa-promotions'] }); setConfirmDelete(null); }
  });

  const handleOpenNew = () => {
    setIsEditing(false);
    setFormData({ name: '', description: '', type: 'DISCOUNT', status: 'DRAFT', discountValue: '', startDate: '', endDate: '', usageLimit: '' });
    setShowModal(true);
    setErrorMsg('');
  };

  const handleOpenEdit = (p: Promotion) => {
    setIsEditing(true);
    setFormData({
      id: p.id,
      name: p.name,
      description: p.description,
      type: p.type,
      status: p.status,
      discountValue: p.discountValue?.toString() ?? '',
      usageLimit: p.usageLimit?.toString() ?? '',
      startDate: p.startDate ? new Date(p.startDate).toISOString().slice(0, 16) : '',
      endDate: p.endDate ? new Date(p.endDate).toISOString().slice(0, 16) : '',
    });
    setShowModal(true);
    setErrorMsg('');
  };

  const promotions = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const totalPages = data?.meta?.totalPages ?? 1;

  const statusColor: Record<string, string> = { ACTIVE: 'ACTIVE', DRAFT: 'INACTIVE', SCHEDULED: 'PENDING_APPROVAL', EXPIRED: 'EXPIRED' };

  return (
    <div>
      <div className="sa-page-header">
        <div className="sa-page-header-left">
          <h1>Promotions</h1>
          <p>Manage discount campaigns, bundles, BOGO, and free-shipping offers.</p>
        </div>
        <button className="sa-btn sa-btn-primary" onClick={handleOpenNew}>
          <Plus size={16} /> New Promotion
        </button>
      </div>

      <div className="sa-card">
        <div className="sa-card-header">
          <div className="sa-search-bar">
            <Search className="sa-search-icon" size={15} />
            <input className="sa-input" placeholder="Search promotions..." value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
        </div>
        <div className="sa-table-container">
          <table className="sa-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}></th>
                <th>Name</th>
                <th>Type</th>
                <th>Discount</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Used / Limit</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={9} className="sa-text-center">Loading...</td></tr>
              ) : promotions.length === 0 ? (
                <tr><td colSpan={7} className="sa-text-center sa-text-muted">No promotions found.</td></tr>
              ) : promotions.map((p: Promotion) => (
                <tr key={p.id}>
                  <td><Megaphone size={16} className="sa-text-muted" /></td>
                  <td style={{ fontWeight: 500 }}>{p.name}</td>
                  <td><span className="sa-badge">{p.type?.replace('_', ' ')}</span></td>
                  <td>{p.discountValue ? `TZS ${Number(p.discountValue).toLocaleString()}` : '—'}</td>
                  <td>{p.startDate ? <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Calendar size={13} />{new Date(p.startDate).toLocaleDateString()}</span> : '—'}</td>
                  <td>{p.endDate ? new Date(p.endDate).toLocaleDateString() : '—'}</td>
                  <td>{p.usedCount ?? 0} / {p.usageLimit ?? '∞'}</td>
                  <td><StatusBadge status={statusColor[p.status] || 'INACTIVE'} /></td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="sa-actions">
                      <button className="sa-btn sa-btn-icon" onClick={() => handleOpenEdit(p)} title="Edit"><Edit size={15} /></button>
                      <button className="sa-btn sa-btn-icon" style={{ color: 'var(--danger)' }} onClick={() => setConfirmDelete({ id: p.id, name: p.name })} title="Delete"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="sa-card-footer">
            <Pagination page={page} pages={totalPages} total={total} limit={25} onPage={setPage} />
          </div>
        )}
      </div>

      {showModal && (
        <div className="sa-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="sa-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="sa-modal-header">
              <div className="sa-modal-title">{isEditing ? 'Edit Promotion' : 'New Promotion'}</div>
              <button className="sa-modal-close" onClick={() => setShowModal(false)}><XCircle size={18} /></button>
            </div>
            <div className="sa-modal-body">
              {errorMsg && <div className="sa-mb-16"><Alert type="danger" title="Error" message={errorMsg} /></div>}

              <div className="sa-form-group">
                <label className="sa-label">Promotion Name *</label>
                <input className="sa-input" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Summer Sale 2026" required />
              </div>
              <div className="sa-form-group">
                <label className="sa-label">Description</label>
                <textarea className="sa-input" rows={2} value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="sa-form-group">
                  <label className="sa-label">Type *</label>
                  <select className="sa-input" value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value as Promotion['type'] })}>
                    {PROMO_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div className="sa-form-group">
                  <label className="sa-label">Status</label>
                  <select className="sa-input" value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value as Promotion['status'] })}>
                    {PROMO_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="sa-form-group">
                  <label className="sa-label">Discount Value (TZS)</label>
                  <input className="sa-input" type="number" min="0" value={formData.discountValue ?? ''} onChange={e => setFormData({ ...formData, discountValue: e.target.value })} placeholder="0" />
                </div>
                <div className="sa-form-group">
                  <label className="sa-label">Usage Limit</label>
                  <input className="sa-input" type="number" min="1" value={formData.usageLimit ?? ''} onChange={e => setFormData({ ...formData, usageLimit: e.target.value })} placeholder="Unlimited" />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="sa-form-group">
                  <label className="sa-label">Start Date</label>
                  <input className="sa-input" type="datetime-local" value={formData.startDate} onChange={e => setFormData({ ...formData, startDate: e.target.value })} />
                </div>
                <div className="sa-form-group">
                  <label className="sa-label">End Date</label>
                  <input className="sa-input" type="datetime-local" value={formData.endDate} onChange={e => setFormData({ ...formData, endDate: e.target.value })} />
                </div>
              </div>
            </div>
            <div className="sa-modal-footer">
              <button className="sa-btn sa-btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="sa-btn sa-btn-primary" onClick={() => saveMutation.mutate(formData)} disabled={saveMutation.isPending || !formData.name}>
                {saveMutation.isPending ? <span className="sa-spinner-sm sa-spinner" /> : <Save size={16} />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <ConfirmModal danger title="Delete Promotion"
          message={`Delete promotion "${confirmDelete.name}"? This cannot be undone.`}
          onConfirm={() => deleteMutation.mutate(confirmDelete.id)}
          onCancel={() => setConfirmDelete(null)}
          loading={deleteMutation.isPending}
        />
      )}
    </div>
  );
}
