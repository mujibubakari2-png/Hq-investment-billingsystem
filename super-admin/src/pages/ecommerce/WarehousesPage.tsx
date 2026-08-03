import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ecommerceApi } from '../../api';
import { StatusBadge, ConfirmModal, Alert, Pagination } from '../../components/ui';
import { Search, Plus, Edit, Trash2, XCircle, Save, MapPin } from 'lucide-react';

export default function WarehousesPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<any>({ name: '', location: '', isActive: true });
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['sa-warehouses', page, search],
    queryFn: () => ecommerceApi.warehouses.list({ page: String(page), limit: '25', search }),
  });

  const saveMutation = useMutation({
    mutationFn: (body: any) => isEditing && formData.id ? ecommerceApi.warehouses.update(formData.id, body) : ecommerceApi.warehouses.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sa-warehouses'] });
      setShowModal(false);
      setErrorMsg('');
    },
    onError: (err: any) => setErrorMsg(err.message || 'Failed to save warehouse')
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ecommerceApi.warehouses.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sa-warehouses'] });
      setConfirmDelete(null);
    },
  });

  const handleOpenNew = () => {
    setIsEditing(false);
    setFormData({ name: '', location: '', isActive: true });
    setShowModal(true);
    setErrorMsg('');
  };

  const handleOpenEdit = (w: any) => {
    setIsEditing(true);
    setFormData(w);
    setShowModal(true);
    setErrorMsg('');
  };

  const warehouses = data?.data ?? [];
  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;

  return (
    <div>
      <div className="sa-page-header">
        <div className="sa-page-header-left">
          <h1>Warehouses</h1>
          <p>Manage physical or virtual locations where inventory is stored.</p>
        </div>
        <button className="sa-btn sa-btn-primary" onClick={handleOpenNew}>
          <Plus size={16} /> Add Warehouse
        </button>
      </div>

      <div className="sa-card">
        <div className="sa-card-header">
          <div className="sa-search-bar">
            <Search className="sa-search-icon" size={15} />
            <input
              className="sa-input"
              placeholder="Search warehouses..."
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
                <th>Name</th>
                <th>Location</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="sa-text-center">Loading...</td></tr>
              ) : warehouses.length === 0 ? (
                <tr><td colSpan={5} className="sa-text-center sa-text-muted">No warehouses found.</td></tr>
              ) : (
                warehouses.map((w: any) => (
                  <tr key={w.id}>
                    <td><MapPin size={18} className="sa-text-muted" /></td>
                    <td style={{ fontWeight: 500 }}>{w.name}</td>
                    <td className="sa-text-muted">{w.location || '—'}</td>
                    <td>
                      {w.isActive ? <StatusBadge status="ACTIVE" /> : <StatusBadge status="INACTIVE" />}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="sa-actions">
                        <button className="sa-btn sa-btn-icon" onClick={() => handleOpenEdit(w)} title="Edit"><Edit size={15} /></button>
                        <button className="sa-btn sa-btn-icon" style={{ color: 'var(--danger)' }} onClick={() => setConfirmDelete({ id: w.id, name: w.name })} title="Delete"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))
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
              <div className="sa-modal-title">{isEditing ? 'Edit Warehouse' : 'New Warehouse'}</div>
              <button className="sa-modal-close" onClick={() => setShowModal(false)}><XCircle size={18} /></button>
            </div>
            <div className="sa-modal-body">
              {errorMsg && <div className="sa-mb-16"><Alert type="danger" title="Error" message={errorMsg} /></div>}
              
              <div className="sa-form-group">
                <label className="sa-label">Warehouse Name *</label>
                <input className="sa-input" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
              </div>

              <div className="sa-form-group">
                <label className="sa-label">Location (Address/City)</label>
                <input className="sa-input" value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} />
              </div>

              <div className="sa-form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--font-size-sm)' }}>
                  <input type="checkbox" checked={formData.isActive} onChange={e => setFormData({ ...formData, isActive: e.target.checked })} /> Active
                </label>
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
        <ConfirmModal
          danger
          title="Delete Warehouse"
          message={`Are you sure you want to delete the warehouse "${confirmDelete.name}"? This action cannot be undone.`}
          onConfirm={() => deleteMutation.mutate(confirmDelete.id)}
          onCancel={() => setConfirmDelete(null)}
          loading={deleteMutation.isPending}
        />
      )}
    </div>
  );
}
