import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cmsApi, type BlogPost } from '../../api';
import { StatusBadge, ConfirmModal, Alert, Pagination } from '../../components/ui';
import { Search, Plus, Edit, Trash2, XCircle, Save, FileText } from 'lucide-react';

export default function BlogsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<BlogPost>>({ title: '', slug: '', author: null, coverImageUrl: null, content: '', isPublished: false });
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; title: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['sa-blogs', page, search],
    queryFn: () => cmsApi.blogs.list({ page: String(page), limit: '25', search }),
  });

  const saveMutation = useMutation({
    mutationFn: (body: Partial<BlogPost>) => isEditing && formData.id ? cmsApi.blogs.update(formData.id, body) : cmsApi.blogs.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sa-blogs'] });
      setShowModal(false);
      setErrorMsg('');
    },
    onError: (err: Error) => setErrorMsg(err.message || 'Failed to save blog post')
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => cmsApi.blogs.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sa-blogs'] });
      setConfirmDelete(null);
    },
  });

  const handleOpenNew = () => {
    setIsEditing(false);
    setFormData({ title: '', slug: '', author: '', coverImageUrl: '', content: '', isPublished: false });
    setShowModal(true);
    setErrorMsg('');
  };

  const handleOpenEdit = (b: BlogPost) => {
    setIsEditing(true);
    setFormData(b);
    setShowModal(true);
    setErrorMsg('');
  };

  const blogs = data?.data ?? [];
  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;

  return (
    <div>
      <div className="sa-page-header">
        <div className="sa-page-header-left">
          <h1>Blog Posts</h1>
          <p>Manage articles, news, and updates for the storefront blog.</p>
        </div>
        <button className="sa-btn sa-btn-primary" onClick={handleOpenNew}>
          <Plus size={16} /> Add Post
        </button>
      </div>

      <div className="sa-card">
        <div className="sa-card-header">
          <div className="sa-search-bar">
            <Search className="sa-search-icon" size={15} />
            <input
              className="sa-input"
              placeholder="Search posts..."
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
                <th>Author</th>
                <th>Created At</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="sa-text-center">Loading...</td></tr>
              ) : blogs.length === 0 ? (
                <tr><td colSpan={6} className="sa-text-center sa-text-muted">No posts found.</td></tr>
              ) : (
                blogs.map((b: any) => (
                  <tr key={b.id}>
                    <td><FileText size={18} className="sa-text-muted" /></td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{b.title}</div>
                      <div className="sa-text-muted" style={{ fontSize: '12px' }}>/{b.slug}</div>
                    </td>
                    <td className="sa-text-muted">{b.author || '—'}</td>
                    <td className="sa-text-muted">{new Date(b.createdAt).toLocaleDateString()}</td>
                    <td>
                      {b.isPublished ? <StatusBadge status="ACTIVE" /> : <StatusBadge status="PENDING_APPROVAL" />}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="sa-actions">
                        <button className="sa-btn sa-btn-icon" onClick={() => handleOpenEdit(b)} title="Edit"><Edit size={15} /></button>
                        <button className="sa-btn sa-btn-icon" style={{ color: 'var(--danger)' }} onClick={() => setConfirmDelete({ id: b.id, title: b.title })} title="Delete"><Trash2 size={15} /></button>
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
          <div className="sa-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 700, width: '100%' }}>
            <div className="sa-modal-header">
              <div className="sa-modal-title">{isEditing ? 'Edit Post' : 'New Post'}</div>
              <button className="sa-modal-close" onClick={() => setShowModal(false)}><XCircle size={18} /></button>
            </div>
            <div className="sa-modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              {errorMsg && <div className="sa-mb-16"><Alert type="danger" title="Error" message={errorMsg} /></div>}
              
              <div className="sa-form-group">
                <label className="sa-label">Title *</label>
                <input className="sa-input" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} required />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="sa-form-group">
                  <label className="sa-label">URL Slug *</label>
                  <input className="sa-input" value={formData.slug} onChange={e => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })} required />
                </div>
                <div className="sa-form-group">
                  <label className="sa-label">Author</label>
                  <input className="sa-input" value={formData.author ?? ''} onChange={e => setFormData({ ...formData, author: e.target.value })} />
                </div>
              </div>

              <div className="sa-form-group">
                <label className="sa-label">Cover Image URL</label>
                <input className="sa-input" value={formData.coverImageUrl ?? ''} onChange={e => setFormData({ ...formData, coverImageUrl: e.target.value })} />
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
          title="Delete Post"
          message={`Are you sure you want to delete the post "${confirmDelete.title}"? This action cannot be undone.`}
          onConfirm={() => deleteMutation.mutate(confirmDelete.id)}
          onCancel={() => setConfirmDelete(null)}
          loading={deleteMutation.isPending}
        />
      )}
    </div>
  );
}
