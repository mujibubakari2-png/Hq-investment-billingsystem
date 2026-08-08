import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cmsApi, type CmsBanner } from '../../api';
import { StatusBadge, ConfirmModal, Alert, fmtDate } from '../../components/ui';
import { Search, Plus, Edit, Trash2, XCircle, Save } from 'lucide-react';

export default function BannersPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<CmsBanner>>({
    title: '', subtitle: '', imageUrl: '', linkUrl: '', linkText: '', position: 0, isActive: true, startDate: null, endDate: null
  });
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['sa-cms-banners'],
    queryFn: () => cmsApi.banners.list(),
  });

  const saveMutation = useMutation({
    mutationFn: (body: Partial<CmsBanner>) => isEditing && formData.id ? cmsApi.banners.update(formData.id, body) : cmsApi.banners.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sa-cms-banners'] });
      setShowModal(false);
      setErrorMsg('');
    },
    onError: (err: Error) => setErrorMsg(err.message || 'Failed to save banner')
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => cmsApi.banners.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sa-cms-banners'] });
      setConfirmDelete(null);
    },
  });

  const handleOpenNew = () => {
    setIsEditing(false);
    setFormData({ title: '', subtitle: '', imageUrl: '', linkUrl: '', linkText: '', position: 0, isActive: true, startDate: '', endDate: '' });
    setShowModal(true);
    setErrorMsg('');
  };

  const handleOpenEdit = (banner: CmsBanner) => {
    setIsEditing(true);
    setFormData({ 
        ...banner,
        startDate: banner.startDate ? banner.startDate.slice(0, 10) : '',
        endDate: banner.endDate ? banner.endDate.slice(0, 10) : ''
    });
    setShowModal(true);
    setErrorMsg('');
  };

  const banners = data?.data ?? [];

  return (
    <div>
      <div className="sa-page-header">
        <div className="sa-page-header-left">
          <h1>Banners</h1>
          <p>Manage promotional banners displayed on the storefront.</p>
        </div>
        <button className="sa-btn sa-btn-primary" onClick={handleOpenNew}>
          <Plus size={16} /> Add Banner
        </button>
      </div>

      <div className="sa-card">
        <div className="sa-table-container">
          <table className="sa-table">
            <thead>
              <tr>
                <th>Image</th>
                <th>Details</th>
                <th>Link</th>
                <th>Position</th>
                <th>Status</th>
                <th>Active Dates</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="sa-text-center">Loading...</td></tr>
              ) : banners.length === 0 ? (
                <tr><td colSpan={7} className="sa-text-center sa-text-muted">No banners found.</td></tr>
              ) : (
                banners.map((b: CmsBanner) => (
                  <tr key={b.id}>
                    <td>
                      <img src={b.imageUrl} alt="banner" style={{ width: 100, height: 50, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--border-color)' }} />
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{b.title || '—'}</div>
                      <div className="sa-text-muted" style={{ fontSize: 12 }}>{b.subtitle}</div>
                    </td>
                    <td>
                        {b.linkUrl ? <a href={b.linkUrl} target="_blank" rel="noreferrer" className="sa-text-primary">{b.linkText || 'Link'}</a> : '—'}
                    </td>
                    <td>{b.position}</td>
                    <td>
                      {b.isActive ? <StatusBadge status="ACTIVE" /> : <StatusBadge status="INACTIVE" />}
                    </td>
                    <td className="sa-text-muted" style={{ fontSize: 12 }}>
                        {b.startDate || b.endDate ? `${fmtDate(b.startDate)} - ${fmtDate(b.endDate)}` : 'Always'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="sa-actions">
                        <button className="sa-btn sa-btn-icon" onClick={() => handleOpenEdit(b)} title="Edit"><Edit size={15} /></button>
                        <button className="sa-btn sa-btn-icon" style={{ color: 'var(--danger)' }} onClick={() => setConfirmDelete({ id: b.id, name: b.title || 'Banner' })} title="Delete"><Trash2 size={15} /></button>
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
          <div className="sa-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="sa-modal-header">
              <div className="sa-modal-title">{isEditing ? 'Edit Banner' : 'New Banner'}</div>
              <button className="sa-modal-close" onClick={() => setShowModal(false)}><XCircle size={18} /></button>
            </div>
            <div className="sa-modal-body">
              {errorMsg && <div className="sa-mb-16"><Alert type="danger" title="Error" message={errorMsg} /></div>}
              
              <div className="sa-form-group">
                <label className="sa-label">Image URL *</label>
                <input className="sa-input" value={formData.imageUrl} onChange={e => setFormData({ ...formData, imageUrl: e.target.value })} required />
              </div>
              
              <div className="sa-form-row">
                <div className="sa-form-group">
                  <label className="sa-label">Title</label>
                  <input className="sa-input" value={formData.title ?? ''} onChange={e => setFormData({ ...formData, title: e.target.value })} />
                </div>
                <div className="sa-form-group">
                  <label className="sa-label">Subtitle</label>
                  <input className="sa-input" value={formData.subtitle ?? ''} onChange={e => setFormData({ ...formData, subtitle: e.target.value })} />
                </div>
              </div>

              <div className="sa-form-row">
                <div className="sa-form-group">
                  <label className="sa-label">Link URL</label>
                  <input className="sa-input" value={formData.linkUrl ?? ''} onChange={e => setFormData({ ...formData, linkUrl: e.target.value })} />
                </div>
                <div className="sa-form-group">
                  <label className="sa-label">Link Text (Button label)</label>
                  <input className="sa-input" value={formData.linkText ?? ''} onChange={e => setFormData({ ...formData, linkText: e.target.value })} />
                </div>
              </div>

              <div className="sa-form-row">
                <div className="sa-form-group">
                  <label className="sa-label">Start Date</label>
                  <input className="sa-input" type="date" value={formData.startDate ?? ''} onChange={e => setFormData({ ...formData, startDate: e.target.value })} />
                </div>
                <div className="sa-form-group">
                  <label className="sa-label">End Date</label>
                  <input className="sa-input" type="date" value={formData.endDate ?? ''} onChange={e => setFormData({ ...formData, endDate: e.target.value })} />
                </div>
              </div>

              <div className="sa-form-row">
                <div className="sa-form-group">
                  <label className="sa-label">Sort Position</label>
                  <input className="sa-input" type="number" value={formData.position} onChange={e => setFormData({ ...formData, position: parseInt(e.target.value) || 0 })} />
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
              <button className="sa-btn sa-btn-primary" onClick={() => saveMutation.mutate(formData)} disabled={saveMutation.isPending || !formData.imageUrl}>
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
          title="Delete Banner"
          message={`Are you sure you want to delete this banner?`}
          onConfirm={() => deleteMutation.mutate(confirmDelete.id)}
          onCancel={() => setConfirmDelete(null)}
          loading={deleteMutation.isPending}
        />
      )}
    </div>
  );
}
