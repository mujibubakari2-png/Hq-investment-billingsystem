import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ecommerceApi } from '../../api';
import { StatusBadge, ConfirmModal, Alert, Pagination } from '../../components/ui';
import { Search, Plus, Edit, Trash2, XCircle, Save, Image as ImageIcon } from 'lucide-react';

export default function CollectionsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<any>({ name: '', slug: '', description: '', imageUrl: '', isActive: true });
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['sa-collections', page, search],
    queryFn: () => ecommerceApi.collections.list({ page: String(page), limit: '25', search }),
  });

  const saveMutation = useMutation({
    mutationFn: (body: any) => isEditing && formData.id ? ecommerceApi.collections.update(formData.id, body) : ecommerceApi.collections.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sa-collections'] });
      setShowModal(false);
      setErrorMsg('');
    },
    onError: (err: any) => setErrorMsg(err.message || 'Failed to save collection')
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ecommerceApi.collections.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sa-collections'] });
      setConfirmDelete(null);
    },
  });

  const handleOpenNew = () => {
    setIsEditing(false);
    setFormData({ name: '', slug: '', description: '', imageUrl: '', isActive: true });
    setShowModal(true);
    setErrorMsg('');
  };

  const handleOpenEdit = (col: any) => {
    setIsEditing(true);
    setFormData(col);
    setShowModal(true);
    setErrorMsg('');
  };

  const collections = data?.data ?? [];
  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;

  return (
    <div>
      <div className="sa-page-header">
        <div className="sa-page-header-left">
          <h1>Collections</h1>
          <p>Group products into collections (e.g. Summer Sale, New Arrivals).</p>
        </div>
        <button className="sa-btn sa-btn-primary" onClick={handleOpenNew}>
          <Plus size={16} /> Add Collection
        </button>
      </div>

      <div className="sa-card">
        <div className="sa-card-header">
          <div className="sa-search-bar">
            <Search className="sa-search-icon" size={15} />
            <input
              className="sa-input"
              placeholder="Search collections..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
        </div>
        <div className="sa-table-container">
          <table className="sa-table">
            <thead>
              <tr>
                <th style={{ width: 60 }}>Image</th>
                <th>Name & Slug</th>
                <th>Description</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="sa-text-center">Loading...</td></tr>
              ) : collections.length === 0 ? (
                <tr><td colSpan={5} className="sa-text-center sa-text-muted">No collections found.</td></tr>
              ) : (
                collections.map((c: any) => (
                  <tr key={c.id}>
                    <td>
                      {c.imageUrl ? (
                        <img src={c.imageUrl} alt={c.name} style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--border-color)', backgroundColor: '#fff' }} />
                      ) : (
                        <div style={{ width: 40, height: 40, borderRadius: 4, backgroundColor: 'var(--surface-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                          <ImageIcon size={18} />
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{c.name}</div>
                      <div className="sa-text-muted" style={{ fontSize: '12px' }}>/{c.slug}</div>
                    </td>
                    <td className="sa-text-muted" style={{ maxWidth: 250, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {c.description || '—'}
                    </td>
                    <td>
                      {c.isActive ? <StatusBadge status="ACTIVE" /> : <StatusBadge status="INACTIVE" />}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="sa-actions">
                        <button className="sa-btn sa-btn-icon" onClick={() => handleOpenEdit(c)} title="Edit"><Edit size={15} /></button>
                        <button className="sa-btn sa-btn-icon" style={{ color: 'var(--danger)' }} onClick={() => setConfirmDelete({ id: c.id, name: c.name })} title="Delete"><Trash2 size={15} /></button>
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
              <div className="sa-modal-title">{isEditing ? 'Edit Collection' : 'New Collection'}</div>
              <button className="sa-modal-close" onClick={() => setShowModal(false)}><XCircle size={18} /></button>
            </div>
            <div className="sa-modal-body">
              {errorMsg && <div className="sa-mb-16"><Alert type="danger" title="Error" message={errorMsg} /></div>}
              
              <div className="sa-form-group">
                <label className="sa-label">Collection Name *</label>
                <input className="sa-input" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
              </div>
              
              <div className="sa-form-group">
                <label className="sa-label">URL Slug *</label>
                <input className="sa-input" value={formData.slug} onChange={e => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })} required />
              </div>

              <div className="sa-form-group">
                <label className="sa-label">Cover Image URL</label>
                <input className="sa-input" value={formData.imageUrl} onChange={e => setFormData({ ...formData, imageUrl: e.target.value })} placeholder="https://..." />
              </div>

              <div className="sa-form-group">
                <label className="sa-label">Description</label>
                <textarea 
                  className="sa-input" 
                  style={{ minHeight: 80, resize: 'vertical' }} 
                  value={formData.description} 
                  onChange={e => setFormData({ ...formData, description: e.target.value })} 
                />
              </div>

              <div className="sa-form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--font-size-sm)' }}>
                  <input type="checkbox" checked={formData.isActive} onChange={e => setFormData({ ...formData, isActive: e.target.checked })} /> Active
                </label>
              </div>

            </div>
            <div className="sa-modal-footer">
              <button className="sa-btn sa-btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="sa-btn sa-btn-primary" onClick={() => saveMutation.mutate(formData)} disabled={saveMutation.isPending || !formData.name || !formData.slug}>
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
          title="Delete Collection"
          message={`Are you sure you want to delete the collection "${confirmDelete.name}"? This action cannot be undone.`}
          onConfirm={() => deleteMutation.mutate(confirmDelete.id)}
          onCancel={() => setConfirmDelete(null)}
          loading={deleteMutation.isPending}
        />
      )}
    </div>
  );
}
