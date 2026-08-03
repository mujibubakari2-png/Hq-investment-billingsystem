import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cmsApi } from '../../api';
import { StatusBadge, ConfirmModal, Alert, Pagination } from '../../components/ui';
import { Search, Plus, Edit, Trash2, XCircle, Save, File } from 'lucide-react';

export default function PagesPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<any>({ title: '', slug: '', content: '', isPublished: false });
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; title: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['sa-pages', page, search],
    queryFn: () => cmsApi.pages.list({ page: String(page), limit: '25', search }),
  });

  const saveMutation = useMutation({
    mutationFn: (body: any) => isEditing && formData.id ? cmsApi.pages.update(formData.id, body) : cmsApi.pages.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sa-pages'] });
      setShowModal(false);
      setErrorMsg('');
    },
    onError: (err: any) => setErrorMsg(err.message || 'Failed to save page')
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => cmsApi.pages.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sa-pages'] });
      setConfirmDelete(null);
    },
  });

  const handleOpenNew = () => {
    setIsEditing(false);
    setFormData({ title: '', slug: '', content: '', isPublished: false });
    setShowModal(true);
    setErrorMsg('');
  };

  const handleOpenEdit = (p: any) => {
    setIsEditing(true);
    setFormData(p);
    setShowModal(true);
    setErrorMsg('');
  };

  const pages = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.pages ?? 1;

  return (
    <div>
      <div className="sa-page-header">
        <div className="sa-page-header-left">
          <h1>Custom Pages</h1>
          <p>Manage static pages like About Us, Privacy Policy, or Terms of Service.</p>
        </div>
        <button className="sa-btn sa-btn-primary" onClick={handleOpenNew}>
          <Plus size={16} /> Add Page
        </button>
      </div>

      <div className="sa-card">
        <div className="sa-card-header">
          <div className="sa-search-bar">
            <Search className="sa-search-icon" size={15} />
            <input
              className="sa-input"
              placeholder="Search pages..."
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
                <th>Title & Slug</th>
                <th>Created At</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="sa-text-center">Loading...</td></tr>
              ) : pages.length === 0 ? (
                <tr><td colSpan={5} className="sa-text-center sa-text-muted">No custom pages found.</td></tr>
              ) : (
                pages.map((p: any) => (
                  <tr key={p.id}>
                    <td><File size={18} className="sa-text-muted" /></td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{p.title}</div>
                      <div className="sa-text-muted" style={{ fontSize: '12px' }}>/{p.slug}</div>
                    </td>
                    <td className="sa-text-muted">{new Date(p.createdAt).toLocaleDateString()}</td>
                    <td>
                      {p.isPublished ? <StatusBadge status="ACTIVE" /> : <StatusBadge status="PENDING_APPROVAL" />}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="sa-actions">
                        <button className="sa-btn sa-btn-icon" onClick={() => handleOpenEdit(p)} title="Edit"><Edit size={15} /></button>
                        <button className="sa-btn sa-btn-icon" style={{ color: 'var(--danger)' }} onClick={() => setConfirmDelete({ id: p.id, title: p.title })} title="Delete"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
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
          <div className="sa-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 700, width: '100%' }}>
            <div className="sa-modal-header">
              <div className="sa-modal-title">{isEditing ? 'Edit Page' : 'New Page'}</div>
              <button className="sa-modal-close" onClick={() => setShowModal(false)}><XCircle size={18} /></button>
            </div>
            <div className="sa-modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              {errorMsg && <div className="sa-mb-16"><Alert type="danger" title="Error" message={errorMsg} /></div>}
              
              <div className="sa-form-group">
                <label className="sa-label">Title *</label>
                <input className="sa-input" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} required />
              </div>

              <div className="sa-form-group">
                <label className="sa-label">URL Slug *</label>
                <input className="sa-input" value={formData.slug} onChange={e => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })} required />
              </div>

              <div className="sa-form-group">
                <label className="sa-label">Content (HTML/Markdown) *</label>
                <textarea 
                  className="sa-input" 
                  style={{ minHeight: 200, resize: 'vertical', fontFamily: 'monospace' }} 
                  value={formData.content} 
                  onChange={e => setFormData({ ...formData, content: e.target.value })} 
                  required
                />
              </div>

              <div className="sa-form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--font-size-sm)' }}>
                  <input type="checkbox" checked={formData.isPublished} onChange={e => setFormData({ ...formData, isPublished: e.target.checked })} /> Published
                </label>
              </div>

            </div>
            <div className="sa-modal-footer">
              <button className="sa-btn sa-btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="sa-btn sa-btn-primary" onClick={() => saveMutation.mutate(formData)} disabled={saveMutation.isPending || !formData.title || !formData.slug || !formData.content}>
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
          title="Delete Page"
          message={`Are you sure you want to delete the page "${confirmDelete.title}"? This action cannot be undone.`}
          onConfirm={() => deleteMutation.mutate(confirmDelete.id)}
          onCancel={() => setConfirmDelete(null)}
          loading={deleteMutation.isPending}
        />
      )}
    </div>
  );
}
