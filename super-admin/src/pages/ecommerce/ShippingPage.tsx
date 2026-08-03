import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ecommerceApi } from '../../api';
import { StatusBadge, ConfirmModal, Alert, Pagination } from '../../components/ui';
import { Search, Plus, Edit, Trash2, XCircle, Save, Truck } from 'lucide-react';

export default function ShippingPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<any>({ name: '', countries: '', rate: '', isActive: true });
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['sa-shipping', page, search],
    queryFn: () => ecommerceApi.shipping.list({ page: String(page), limit: '25', search }),
  });

  const saveMutation = useMutation({
    mutationFn: (body: any) => isEditing && formData.id ? ecommerceApi.shipping.update(formData.id, body) : ecommerceApi.shipping.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sa-shipping'] });
      setShowModal(false);
      setErrorMsg('');
    },
    onError: (err: any) => setErrorMsg(err.message || 'Failed to save shipping zone')
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ecommerceApi.shipping.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sa-shipping'] });
      setConfirmDelete(null);
    },
  });

  const handleOpenNew = () => {
    setIsEditing(false);
    setFormData({ name: '', countries: '', rate: '', isActive: true });
    setShowModal(true);
    setErrorMsg('');
  };

  const handleOpenEdit = (sz: any) => {
    setIsEditing(true);
    setFormData({
      ...sz,
      countries: Array.isArray(sz.countries) ? sz.countries.join(', ') : sz.countries,
      rate: sz.rate?.toString() || ''
    });
    setShowModal(true);
    setErrorMsg('');
  };

  const handleSave = () => {
    saveMutation.mutate({
      ...formData,
      countries: typeof formData.countries === 'string' ? formData.countries.split(',').map((c: string) => c.trim()).filter(Boolean) : formData.countries
    });
  };

  const zones = data?.data ?? [];
  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;

  return (
    <div>
      <div className="sa-page-header">
        <div className="sa-page-header-left">
          <h1>Shipping Zones</h1>
          <p>Define shipping regions and their associated flat rates.</p>
        </div>
        <button className="sa-btn sa-btn-primary" onClick={handleOpenNew}>
          <Plus size={16} /> Add Zone
        </button>
      </div>

      <div className="sa-card">
        <div className="sa-card-header">
          <div className="sa-search-bar">
            <Search className="sa-search-icon" size={15} />
            <input
              className="sa-input"
              placeholder="Search shipping zones..."
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
                <th>Countries</th>
                <th>Base Rate</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="sa-text-center">Loading...</td></tr>
              ) : zones.length === 0 ? (
                <tr><td colSpan={6} className="sa-text-center sa-text-muted">No shipping zones found.</td></tr>
              ) : (
                zones.map((z: any) => (
                  <tr key={z.id}>
                    <td><Truck size={18} className="sa-text-muted" /></td>
                    <td style={{ fontWeight: 500 }}>{z.name}</td>
                    <td className="sa-text-muted">
                      {Array.isArray(z.countries) ? z.countries.join(', ') : '—'}
                    </td>
                    <td>{z.rate != null ? `$${Number(z.rate).toFixed(2)}` : '—'}</td>
                    <td>
                      {z.isActive ? <StatusBadge status="ACTIVE" /> : <StatusBadge status="INACTIVE" />}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="sa-actions">
                        <button className="sa-btn sa-btn-icon" onClick={() => handleOpenEdit(z)} title="Edit"><Edit size={15} /></button>
                        <button className="sa-btn sa-btn-icon" style={{ color: 'var(--danger)' }} onClick={() => setConfirmDelete({ id: z.id, name: z.name })} title="Delete"><Trash2 size={15} /></button>
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
              <div className="sa-modal-title">{isEditing ? 'Edit Shipping Zone' : 'New Shipping Zone'}</div>
              <button className="sa-modal-close" onClick={() => setShowModal(false)}><XCircle size={18} /></button>
            </div>
            <div className="sa-modal-body">
              {errorMsg && <div className="sa-mb-16"><Alert type="danger" title="Error" message={errorMsg} /></div>}
              
              <div className="sa-form-group">
                <label className="sa-label">Zone Name *</label>
                <input className="sa-input" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
              </div>

              <div className="sa-form-group">
                <label className="sa-label">Countries (comma separated)</label>
                <input className="sa-input" value={formData.countries} onChange={e => setFormData({ ...formData, countries: e.target.value })} placeholder="US, CA, UK" />
              </div>

              <div className="sa-form-group">
                <label className="sa-label">Base Rate ($) *</label>
                <input className="sa-input" type="number" step="0.01" min="0" value={formData.rate} onChange={e => setFormData({ ...formData, rate: e.target.value })} required />
              </div>

              <div className="sa-form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--font-size-sm)' }}>
                  <input type="checkbox" checked={formData.isActive} onChange={e => setFormData({ ...formData, isActive: e.target.checked })} /> Active
                </label>
              </div>

            </div>
            <div className="sa-modal-footer">
              <button className="sa-btn sa-btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="sa-btn sa-btn-primary" onClick={handleSave} disabled={saveMutation.isPending || !formData.name || formData.rate === ''}>
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
          title="Delete Shipping Zone"
          message={`Are you sure you want to delete the shipping zone "${confirmDelete.name}"? This action cannot be undone.`}
          onConfirm={() => deleteMutation.mutate(confirmDelete.id)}
          onCancel={() => setConfirmDelete(null)}
          loading={deleteMutation.isPending}
        />
      )}
    </div>
  );
}
