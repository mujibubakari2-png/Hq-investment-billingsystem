import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cmsApi } from '../../api';
import { StatusBadge, ConfirmModal, Alert, Pagination } from '../../components/ui';
import { Search, Plus, Edit, Trash2, XCircle, Save } from 'lucide-react';

export default function TestimonialsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<any>({
    name: '', role: '', company: '', content: '', avatarUrl: '', rating: 5, isActive: true, sortOrder: 0
  });
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['sa-cms-testimonials', page, search],
    queryFn: () => cmsApi.testimonials.list({ page: String(page), limit: '25', search }),
  });

  const saveMutation = useMutation({
    mutationFn: (body: any) => isEditing && formData.id ? cmsApi.testimonials.update(formData.id, body) : cmsApi.testimonials.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sa-cms-testimonials'] });
      setShowModal(false);
      setErrorMsg('');
    },
    onError: (err: any) => setErrorMsg(err.message || 'Failed to save testimonial')
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => cmsApi.testimonials.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sa-cms-testimonials'] });
      setConfirmDelete(null);
    },
  });

  const handleOpenNew = () => {
    setIsEditing(false);
    setFormData({ name: '', role: '', company: '', content: '', avatarUrl: '', rating: 5, isActive: true, sortOrder: 0 });
    setShowModal(true);
    setErrorMsg('');
  };

  const handleOpenEdit = (testimonial: any) => {
    setIsEditing(true);
    setFormData(testimonial);
    setShowModal(true);
    setErrorMsg('');
  };

  const testimonials = data?.data ?? [];
  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;

  return (
    <div>
      <div className="sa-page-header">
        <div className="sa-page-header-left">
          <h1>Testimonials</h1>
          <p>Manage customer success stories and reviews displayed on the storefront.</p>
        </div>
        <button className="sa-btn sa-btn-primary" onClick={handleOpenNew}>
          <Plus size={16} /> Add Testimonial
        </button>
      </div>

      <div className="sa-card">
        <div className="sa-card-header">
          <div className="sa-search-bar">
            <Search className="sa-search-icon" size={15} />
            <input
              className="sa-input"
              placeholder="Search name, company or content..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
        </div>
        <div className="sa-table-container">
          <table className="sa-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Content</th>
                <th>Rating</th>
                <th>Sort Order</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="sa-text-center">Loading...</td></tr>
              ) : testimonials.length === 0 ? (
                <tr><td colSpan={6} className="sa-text-center sa-text-muted">No testimonials found.</td></tr>
              ) : (
                testimonials.map((t: any) => (
                  <tr key={t.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {t.avatarUrl ? (
                          <img src={t.avatarUrl} alt={t.name} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: 'var(--surface-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                            {t.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div style={{ fontWeight: 500 }}>{t.name}</div>
                          <div className="sa-text-muted" style={{ fontSize: 12 }}>
                            {t.role} {t.company && `at ${t.company}`}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ maxWidth: 300, whiteSpace: 'normal', fontSize: 13 }}>
                      "{t.content.length > 100 ? t.content.slice(0, 100) + '...' : t.content}"
                    </td>
                    <td>{t.rating} / 5</td>
                    <td>{t.sortOrder}</td>
                    <td>
                      {t.isActive ? <StatusBadge status="ACTIVE" /> : <StatusBadge status="INACTIVE" />}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="sa-actions">
                        <button className="sa-btn sa-btn-icon" onClick={() => handleOpenEdit(t)} title="Edit"><Edit size={15} /></button>
                        <button className="sa-btn sa-btn-icon" style={{ color: 'var(--danger)' }} onClick={() => setConfirmDelete({ id: t.id, name: t.name })} title="Delete"><Trash2 size={15} /></button>
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
          <div className="sa-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="sa-modal-header">
              <div className="sa-modal-title">{isEditing ? 'Edit Testimonial' : 'New Testimonial'}</div>
              <button className="sa-modal-close" onClick={() => setShowModal(false)}><XCircle size={18} /></button>
            </div>
            <div className="sa-modal-body">
              {errorMsg && <div className="sa-mb-16"><Alert type="danger" title="Error" message={errorMsg} /></div>}
              
              <div className="sa-form-row">
                <div className="sa-form-group">
                  <label className="sa-label">Customer Name *</label>
                  <input className="sa-input" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                </div>
                <div className="sa-form-group">
                  <label className="sa-label">Rating (1-5)</label>
                  <input className="sa-input" type="number" min="1" max="5" value={formData.rating} onChange={e => setFormData({ ...formData, rating: parseInt(e.target.value) || 5 })} />
                </div>
              </div>
              
              <div className="sa-form-row">
                <div className="sa-form-group">
                  <label className="sa-label">Role / Title</label>
                  <input className="sa-input" value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })} placeholder="e.g. CEO" />
                </div>
                <div className="sa-form-group">
                  <label className="sa-label">Company</label>
                  <input className="sa-input" value={formData.company} onChange={e => setFormData({ ...formData, company: e.target.value })} placeholder="e.g. Tech Inc." />
                </div>
              </div>

              <div className="sa-form-group">
                <label className="sa-label">Testimonial Content *</label>
                <textarea 
                  className="sa-input" 
                  style={{ minHeight: 100, resize: 'vertical' }} 
                  value={formData.content} 
                  onChange={e => setFormData({ ...formData, content: e.target.value })} 
                  required 
                />
              </div>

              <div className="sa-form-group">
                <label className="sa-label">Avatar URL</label>
                <input className="sa-input" value={formData.avatarUrl} onChange={e => setFormData({ ...formData, avatarUrl: e.target.value })} placeholder="https://..." />
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
              <button className="sa-btn sa-btn-primary" onClick={() => saveMutation.mutate(formData)} disabled={saveMutation.isPending || !formData.name || !formData.content}>
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
          title="Delete Testimonial"
          message={`Are you sure you want to delete the testimonial from ${confirmDelete.name}?`}
          onConfirm={() => deleteMutation.mutate(confirmDelete.id)}
          onCancel={() => setConfirmDelete(null)}
          loading={deleteMutation.isPending}
        />
      )}
    </div>
  );
}
