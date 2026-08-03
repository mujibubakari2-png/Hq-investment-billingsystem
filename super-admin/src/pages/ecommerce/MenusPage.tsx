import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ecommerceApi } from '../../api';
import { ConfirmModal, Alert, Pagination } from '../../components/ui';
import { Search, Plus, Edit, Trash2, XCircle, Save, Menu as MenuIcon, Link as LinkIcon } from 'lucide-react';

export default function MenusPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<any>({ name: '', slug: '', description: '', isActive: true });
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['sa-menus', page, search],
    queryFn: () => ecommerceApi.menus.list({ page: String(page), limit: '25', search }),
  });

  const saveMutation = useMutation({
    mutationFn: (body: any) => isEditing && formData.id ? ecommerceApi.menus.update(formData.id, body) : ecommerceApi.menus.create(body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sa-menus'] }); setShowModal(false); setErrorMsg(''); },
    onError: (err: any) => setErrorMsg(err.message || 'Failed to save menu')
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ecommerceApi.menus.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sa-menus'] }); setConfirmDelete(null); }
  });

  const handleOpenNew = () => {
    setIsEditing(false);
    setFormData({ name: '', slug: '', description: '', isActive: true });
    setShowModal(true);
    setErrorMsg('');
  };

  const handleOpenEdit = (m: any) => {
    setIsEditing(true);
    setFormData({ ...m });
    setShowModal(true);
    setErrorMsg('');
  };

  const slugify = (s: string) => s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  const menus = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const totalPages = data?.meta?.totalPages ?? 1;

  return (
    <div>
      <div className="sa-page-header">
        <div className="sa-page-header-left">
          <h1>Navigation Menus</h1>
          <p>Configure header, footer, and mega-menu structures for the storefront.</p>
        </div>
        <button className="sa-btn sa-btn-primary" onClick={handleOpenNew}>
          <Plus size={16} /> New Menu
        </button>
      </div>

      <div className="sa-card">
        <div className="sa-card-header">
          <div className="sa-search-bar">
            <Search className="sa-search-icon" size={15} />
            <input className="sa-input" placeholder="Search menus..." value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
        </div>
        <div className="sa-table-container">
          <table className="sa-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}></th>
                <th>Name</th>
                <th>Slug</th>
                <th>Description</th>
                <th>Items</th>
                <th>Active</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="sa-text-center">Loading...</td></tr>
              ) : menus.length === 0 ? (
                <tr><td colSpan={7} className="sa-text-center sa-text-muted">No menus found. Create your first navigation menu.</td></tr>
              ) : menus.map((m: any) => (
                <tr key={m.id}>
                  <td><MenuIcon size={16} className="sa-text-muted" /></td>
                  <td style={{ fontWeight: 500 }}>{m.name}</td>
                  <td><code style={{ fontSize: 12, background: 'var(--bg-2)', padding: '2px 6px', borderRadius: 4 }}>{m.slug}</code></td>
                  <td className="sa-text-muted">{m.description || '—'}</td>
                  <td>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <LinkIcon size={13} />{m.items?.length ?? 0} items
                    </span>
                  </td>
                  <td>
                    <span style={{ color: m.isActive ? 'var(--success)' : 'var(--danger)', fontWeight: 600, fontSize: 13 }}>
                      {m.isActive ? '● Active' : '○ Inactive'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="sa-actions">
                      <button className="sa-btn sa-btn-icon" onClick={() => handleOpenEdit(m)} title="Edit"><Edit size={15} /></button>
                      <button className="sa-btn sa-btn-icon" style={{ color: 'var(--danger)' }} onClick={() => setConfirmDelete({ id: m.id, name: m.name })} title="Delete"><Trash2 size={15} /></button>
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
          <div className="sa-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="sa-modal-header">
              <div className="sa-modal-title">{isEditing ? 'Edit Menu' : 'New Menu'}</div>
              <button className="sa-modal-close" onClick={() => setShowModal(false)}><XCircle size={18} /></button>
            </div>
            <div className="sa-modal-body">
              {errorMsg && <div className="sa-mb-16"><Alert type="danger" title="Error" message={errorMsg} /></div>}
              <div className="sa-form-group">
                <label className="sa-label">Menu Name *</label>
                <input className="sa-input" value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value, slug: isEditing ? formData.slug : slugify(e.target.value) })}
                  placeholder="e.g. Main Navigation" required />
              </div>
              <div className="sa-form-group">
                <label className="sa-label">Slug *</label>
                <input className="sa-input" value={formData.slug} onChange={e => setFormData({ ...formData, slug: slugify(e.target.value) })} placeholder="main-navigation" required />
              </div>
              <div className="sa-form-group">
                <label className="sa-label">Description</label>
                <input className="sa-input" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="e.g. Primary header navigation" />
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
        <ConfirmModal danger title="Delete Menu"
          message={`Delete menu "${confirmDelete.name}" and all its items? This cannot be undone.`}
          onConfirm={() => deleteMutation.mutate(confirmDelete.id)}
          onCancel={() => setConfirmDelete(null)}
          loading={deleteMutation.isPending}
        />
      )}
    </div>
  );
}
