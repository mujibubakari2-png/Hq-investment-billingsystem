import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ecommerceApi, type ProductCategory } from '../../api';
import { ConfirmModal, Alert } from '../../components/ui';
import { Plus, Edit, Trash2, XCircle, Save } from 'lucide-react';

export default function CategoriesPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<ProductCategory>>({ name: '', slug: '', description: '', sortOrder: 0, isActive: true });
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['sa-ecommerce-categories'],
    queryFn: () => ecommerceApi.categories.list(),
  });

  const saveMutation = useMutation({
    mutationFn: (body: any) => isEditing && formData.id ? ecommerceApi.categories.update(formData.id, body) : ecommerceApi.categories.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sa-ecommerce-categories'] });
      setShowModal(false);
      setErrorMsg('');
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Failed to save category');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ecommerceApi.categories.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sa-ecommerce-categories'] });
      setConfirmDelete(null);
    },
  });

  const handleOpenNew = () => {
    setIsEditing(false);
    setFormData({ name: '', slug: '', description: '', sortOrder: 0, isActive: true });
    setShowModal(true);
    setErrorMsg('');
  };

  const handleOpenEdit = (cat: ProductCategory) => {
    setIsEditing(true);
    setFormData({ ...cat });
    setShowModal(true);
    setErrorMsg('');
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    if (!isEditing) {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
      setFormData(p => ({ ...p, name, slug }));
    } else {
      setFormData(p => ({ ...p, name }));
    }
  };

  const categories = data?.data ?? [];

  return (
    <div>
      <div className="sa-page-header">
        <div className="sa-page-header-left">
          <h1>Categories</h1>
          <p>Organize products into categories for the storefront.</p>
        </div>
        <button className="sa-btn sa-btn-primary" onClick={handleOpenNew}>
          <Plus size={16} /> Add Category
        </button>
      </div>

      <div className="sa-card">
        <div className="sa-table-container">
          <table className="sa-table">
            <thead>
              <tr>
                <th>Category Name</th>
                <th>Slug</th>
                <th>Status</th>
                <th>Products</th>
                <th>Sort Order</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="sa-text-center">Loading...</td></tr>
              ) : categories.length === 0 ? (
                <tr><td colSpan={6} className="sa-text-center sa-text-muted">No categories found.</td></tr>
              ) : (
                categories.map((c) => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 500 }}>{c.name}</td>
                    <td><span className="sa-text-muted">{c.slug}</span></td>
                    <td>
                      {c.isActive ? <span className="sa-badge active"><span className="sa-badge-dot"/>Active</span> : <span className="sa-badge inactive"><span className="sa-badge-dot"/>Inactive</span>}
                    </td>
                    <td>{c.productCount ?? 0}</td>
                    <td>{c.sortOrder}</td>
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
      </div>

      {showModal && (
        <div className="sa-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="sa-modal" onClick={e => e.stopPropagation()}>
            <div className="sa-modal-header">
              <div className="sa-modal-title">{isEditing ? 'Edit Category' : 'New Category'}</div>
              <button className="sa-modal-close" onClick={() => setShowModal(false)}><XCircle size={18} /></button>
            </div>
            <div className="sa-modal-body">
              {errorMsg && <div className="sa-mb-16"><Alert type="danger" title="Error" message={errorMsg} /></div>}
              <div className="sa-form-group">
                <label className="sa-label">Name *</label>
                <input className="sa-input" value={formData.name} onChange={handleNameChange} />
              </div>
              <div className="sa-form-group">
                <label className="sa-label">Slug *</label>
                <input className="sa-input" value={formData.slug} onChange={e => setFormData({ ...formData, slug: e.target.value })} />
              </div>
              <div className="sa-form-group">
                <label className="sa-label">Description</label>
                <textarea className="sa-input" rows={3} value={formData.description || ''} onChange={e => setFormData({ ...formData, description: e.target.value })} />
              </div>
              <div className="sa-form-row">
                <div className="sa-form-group">
                  <label className="sa-label">Sort Order</label>
                  <input className="sa-input" type="number" value={formData.sortOrder} onChange={e => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="sa-form-group" style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 8 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--font-size-sm)' }}>
                    <input type="checkbox" checked={formData.isActive} onChange={e => setFormData({ ...formData, isActive: e.target.checked })} /> Active
                  </label>
                </div>
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
          title="Delete Category"
          message={`Are you sure you want to delete "${confirmDelete.name}"? You cannot delete a category if it has products assigned to it.`}
          onConfirm={() => deleteMutation.mutate(confirmDelete.id)}
          onCancel={() => setConfirmDelete(null)}
          loading={deleteMutation.isPending}
        />
      )}
    </div>
  );
}
