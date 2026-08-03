import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ecommerceApi } from '../../api';
import { StatusBadge, ConfirmModal, Alert, Pagination } from '../../components/ui';
import { Search, Plus, Edit, Trash2, XCircle, Save, Zap } from 'lucide-react';

export default function FlashSalesPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<any>({ title: '', discountPercentage: '', startDate: '', endDate: '', isActive: true });
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; title: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['sa-flash-sales', page, search],
    queryFn: () => ecommerceApi.flashSales.list({ page: String(page), limit: '25', search }),
  });

  const saveMutation = useMutation({
    mutationFn: (body: any) => isEditing && formData.id ? ecommerceApi.flashSales.update(formData.id, body) : ecommerceApi.flashSales.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sa-flash-sales'] });
      setShowModal(false);
      setErrorMsg('');
    },
    onError: (err: any) => setErrorMsg(err.message || 'Failed to save flash sale')
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ecommerceApi.flashSales.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sa-flash-sales'] });
      setConfirmDelete(null);
    },
  });

  const handleOpenNew = () => {
    setIsEditing(false);
    setFormData({ title: '', discountPercentage: '', startDate: '', endDate: '', isActive: true });
    setShowModal(true);
    setErrorMsg('');
  };

  const handleOpenEdit = (fs: any) => {
    setIsEditing(true);
    setFormData({
      ...fs,
      discountPercentage: fs.discountPercentage?.toString() || '',
      startDate: fs.startDate ? new Date(fs.startDate).toISOString().slice(0, 16) : '',
      endDate: fs.endDate ? new Date(fs.endDate).toISOString().slice(0, 16) : '',
    });
    setShowModal(true);
    setErrorMsg('');
  };

  const flashSales = data?.data ?? [];
  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;

  return (
    <div>
      <div className="sa-page-header">
        <div className="sa-page-header-left">
          <h1>Flash Sales</h1>
          <p>Create and manage time-limited discounts across the store.</p>
        </div>
        <button className="sa-btn sa-btn-primary" onClick={handleOpenNew}>
          <Plus size={16} /> Add Flash Sale
        </button>
      </div>

      <div className="sa-card">
        <div className="sa-card-header">
          <div className="sa-search-bar">
            <Search className="sa-search-icon" size={15} />
            <input
              className="sa-input"
              placeholder="Search flash sales..."
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
                <th>Title</th>
                <th>Discount</th>
                <th>Starts At</th>
                <th>Ends At</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="sa-text-center">Loading...</td></tr>
              ) : flashSales.length === 0 ? (
                <tr><td colSpan={7} className="sa-text-center sa-text-muted">No flash sales found.</td></tr>
              ) : (
                flashSales.map((fs: any) => {
                  const now = new Date();
                  const start = new Date(fs.startDate);
                  const end = new Date(fs.endDate);
                  const isUpcoming = start > now;
                  const isEnded = end < now;
                  const isLive = !isUpcoming && !isEnded && fs.isActive;
                  
                  return (
                    <tr key={fs.id}>
                      <td><Zap size={18} className={isLive ? 'sa-text-warning' : 'sa-text-muted'} /></td>
                      <td style={{ fontWeight: 500 }}>{fs.title}</td>
                      <td>{Number(fs.discountPercentage).toFixed(0)}%</td>
                      <td>{start.toLocaleString()}</td>
                      <td>{end.toLocaleString()}</td>
                      <td>
                        {isLive ? <StatusBadge status="ACTIVE" /> : isUpcoming ? <StatusBadge status="PENDING_APPROVAL" /> : isEnded ? <StatusBadge status="EXPIRED" /> : <StatusBadge status="INACTIVE" />}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="sa-actions">
                          <button className="sa-btn sa-btn-icon" onClick={() => handleOpenEdit(fs)} title="Edit"><Edit size={15} /></button>
                          <button className="sa-btn sa-btn-icon" style={{ color: 'var(--danger)' }} onClick={() => setConfirmDelete({ id: fs.id, title: fs.title })} title="Delete"><Trash2 size={15} /></button>
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
              <div className="sa-modal-title">{isEditing ? 'Edit Flash Sale' : 'New Flash Sale'}</div>
              <button className="sa-modal-close" onClick={() => setShowModal(false)}><XCircle size={18} /></button>
            </div>
            <div className="sa-modal-body">
              {errorMsg && <div className="sa-mb-16"><Alert type="danger" title="Error" message={errorMsg} /></div>}
              
              <div className="sa-form-group">
                <label className="sa-label">Campaign Title *</label>
                <input className="sa-input" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} required />
              </div>

              <div className="sa-form-group">
                <label className="sa-label">Discount Percentage (%) *</label>
                <input className="sa-input" type="number" step="1" min="1" max="100" value={formData.discountPercentage} onChange={e => setFormData({ ...formData, discountPercentage: e.target.value })} required />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="sa-form-group">
                  <label className="sa-label">Start Date *</label>
                  <input className="sa-input" type="datetime-local" value={formData.startDate} onChange={e => setFormData({ ...formData, startDate: e.target.value })} required />
                </div>
                <div className="sa-form-group">
                  <label className="sa-label">End Date *</label>
                  <input className="sa-input" type="datetime-local" value={formData.endDate} onChange={e => setFormData({ ...formData, endDate: e.target.value })} required />
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
              <button className="sa-btn sa-btn-primary" onClick={() => saveMutation.mutate(formData)} disabled={saveMutation.isPending || !formData.title || formData.discountPercentage === '' || !formData.startDate || !formData.endDate}>
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
          title="Delete Flash Sale"
          message={`Are you sure you want to delete the flash sale "${confirmDelete.title}"? This action cannot be undone.`}
          onConfirm={() => deleteMutation.mutate(confirmDelete.id)}
          onCancel={() => setConfirmDelete(null)}
          loading={deleteMutation.isPending}
        />
      )}
    </div>
  );
}
