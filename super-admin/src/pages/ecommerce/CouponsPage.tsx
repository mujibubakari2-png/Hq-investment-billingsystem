import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ecommerceApi } from '../../api';
import { StatusBadge, ConfirmModal, Alert, Pagination } from '../../components/ui';
import { Search, Plus, Edit, Trash2, XCircle, Save, Tag } from 'lucide-react';

export default function CouponsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<any>({ code: '', discountType: 'percent', discountAmount: '', maxUses: '', expiryDate: '', isActive: true });
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; code: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['sa-coupons', page, search],
    queryFn: () => ecommerceApi.coupons.list({ page: String(page), limit: '25', search }),
  });

  const saveMutation = useMutation({
    mutationFn: (body: any) => isEditing && formData.id ? ecommerceApi.coupons.update(formData.id, body) : ecommerceApi.coupons.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sa-coupons'] });
      setShowModal(false);
      setErrorMsg('');
    },
    onError: (err: any) => setErrorMsg(err.message || 'Failed to save coupon')
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ecommerceApi.coupons.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sa-coupons'] });
      setConfirmDelete(null);
    },
  });

  const handleOpenNew = () => {
    setIsEditing(false);
    setFormData({ code: '', discountType: 'percent', discountAmount: '', maxUses: '', expiryDate: '', isActive: true });
    setShowModal(true);
    setErrorMsg('');
  };

  const handleOpenEdit = (c: any) => {
    setIsEditing(true);
    setFormData({
      ...c,
      discountAmount: c.discountAmount?.toString() || '',
      maxUses: c.maxUses?.toString() || '',
      expiryDate: c.expiryDate ? new Date(c.expiryDate).toISOString().slice(0, 16) : ''
    });
    setShowModal(true);
    setErrorMsg('');
  };

  const coupons = data?.data ?? [];
  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;

  return (
    <div>
      <div className="sa-page-header">
        <div className="sa-page-header-left">
          <h1>Coupons</h1>
          <p>Manage discount codes and promotional coupons.</p>
        </div>
        <button className="sa-btn sa-btn-primary" onClick={handleOpenNew}>
          <Plus size={16} /> Add Coupon
        </button>
      </div>

      <div className="sa-card">
        <div className="sa-card-header">
          <div className="sa-search-bar">
            <Search className="sa-search-icon" size={15} />
            <input
              className="sa-input"
              placeholder="Search coupons..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
        </div>
        <div className="sa-table-container">
          <table className="sa-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}></th>
                <th>Code</th>
                <th>Discount</th>
                <th>Uses Left</th>
                <th>Expires</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="sa-text-center">Loading...</td></tr>
              ) : coupons.length === 0 ? (
                <tr><td colSpan={7} className="sa-text-center sa-text-muted">No coupons found.</td></tr>
              ) : (
                coupons.map((c: any) => {
                  const isExpired = c.expiryDate && new Date(c.expiryDate) < new Date();
                  return (
                    <tr key={c.id}>
                      <td><Tag size={18} className="sa-text-muted" /></td>
                      <td style={{ fontWeight: 500 }}>{c.code}</td>
                      <td>
                        {c.discountType === 'percent' ? `${c.discountAmount}%` : `$${c.discountAmount}`}
                      </td>
                      <td>
                        {c.maxUses ? `${c.maxUses - (c.usedCount || 0)}/${c.maxUses}` : 'Unlimited'}
                      </td>
                      <td className={isExpired ? 'sa-text-danger' : ''}>
                        {c.expiryDate ? new Date(c.expiryDate).toLocaleDateString() : 'Never'}
                      </td>
                      <td>
                        {c.isActive && !isExpired ? <StatusBadge status="ACTIVE" /> : <StatusBadge status="INACTIVE" />}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="sa-actions">
                          <button className="sa-btn sa-btn-icon" onClick={() => handleOpenEdit(c)} title="Edit"><Edit size={15} /></button>
                          <button className="sa-btn sa-btn-icon" style={{ color: 'var(--danger)' }} onClick={() => setConfirmDelete({ id: c.id, code: c.code })} title="Delete"><Trash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className="sa-card-footer">
            <Pagination page={page} pages={pages} total={total} limit={25} onPage={setPage} />
          </div>
        )}
      </div>

      {showModal && (
        <div className="sa-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="sa-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="sa-modal-header">
              <div className="sa-modal-title">{isEditing ? 'Edit Coupon' : 'New Coupon'}</div>
              <button className="sa-modal-close" onClick={() => setShowModal(false)}><XCircle size={18} /></button>
            </div>
            <div className="sa-modal-body">
              {errorMsg && <div className="sa-mb-16"><Alert type="danger" title="Error" message={errorMsg} /></div>}
              
              <div className="sa-form-group">
                <label className="sa-label">Coupon Code *</label>
                <input className="sa-input" value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })} required placeholder="SUMMER24" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="sa-form-group">
                  <label className="sa-label">Discount Type *</label>
                  <select className="sa-input" value={formData.discountType} onChange={e => setFormData({ ...formData, discountType: e.target.value })}>
                    <option value="percent">Percentage (%)</option>
                    <option value="fixed">Fixed Amount ($)</option>
                  </select>
                </div>
                <div className="sa-form-group">
                  <label className="sa-label">Amount *</label>
                  <input className="sa-input" type="number" step="0.01" min="0" value={formData.discountAmount} onChange={e => setFormData({ ...formData, discountAmount: e.target.value })} required />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="sa-form-group">
                  <label className="sa-label">Max Uses (Optional)</label>
                  <input className="sa-input" type="number" min="1" value={formData.maxUses} onChange={e => setFormData({ ...formData, maxUses: e.target.value })} placeholder="Unlimited" />
                </div>
                <div className="sa-form-group">
                  <label className="sa-label">Expiry Date (Optional)</label>
                  <input className="sa-input" type="datetime-local" value={formData.expiryDate} onChange={e => setFormData({ ...formData, expiryDate: e.target.value })} />
                </div>
              </div>

              <div className="sa-form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--font-size-sm)' }}>
                  <input type="checkbox" checked={formData.isActive} onChange={e => setFormData({ ...formData, isActive: e.target.checked })} /> Active
                </label>
              </div>

            </div>
            <div className="sa-modal-footer">
              <button className="sa-btn sa-btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="sa-btn sa-btn-primary" onClick={() => saveMutation.mutate(formData)} disabled={saveMutation.isPending || !formData.code || formData.discountAmount === ''}>
                {saveMutation.isPending ? <span className="sa-spinner-sm sa-spinner" /> : <Save size={16} />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <ConfirmModal
          danger
          title="Delete Coupon"
          message={`Are you sure you want to delete the coupon "${confirmDelete.code}"? This action cannot be undone.`}
          onConfirm={() => deleteMutation.mutate(confirmDelete.id)}
          onCancel={() => setConfirmDelete(null)}
          loading={deleteMutation.isPending}
        />
      )}
    </div>
  );
}
