import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cmsApi } from '../../api';
import { StatusBadge, ConfirmModal, Alert, Pagination } from '../../components/ui';
import { Search, Plus, Edit, Trash2, XCircle, Save } from 'lucide-react';

export default function FaqsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<any>({
    question: '', answer: '', category: 'general', sortOrder: 0, isActive: true
  });
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['sa-cms-faqs', page, search],
    queryFn: () => cmsApi.faqs.list({ page: String(page), limit: '25', search }),
  });

  const saveMutation = useMutation({
    mutationFn: (body: any) => isEditing && formData.id ? cmsApi.faqs.update(formData.id, body) : cmsApi.faqs.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sa-cms-faqs'] });
      setShowModal(false);
      setErrorMsg('');
    },
    onError: (err: any) => setErrorMsg(err.message || 'Failed to save FAQ')
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => cmsApi.faqs.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sa-cms-faqs'] });
      setConfirmDelete(null);
    },
  });

  const handleOpenNew = () => {
    setIsEditing(false);
    setFormData({ question: '', answer: '', category: 'general', sortOrder: 0, isActive: true });
    setShowModal(true);
    setErrorMsg('');
  };

  const handleOpenEdit = (faq: any) => {
    setIsEditing(true);
    setFormData(faq);
    setShowModal(true);
    setErrorMsg('');
  };

  const faqs = data?.data ?? [];
  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;

  return (
    <div>
      <div className="sa-page-header">
        <div className="sa-page-header-left">
          <h1>FAQs</h1>
          <p>Manage Frequently Asked Questions for the storefront.</p>
        </div>
        <button className="sa-btn sa-btn-primary" onClick={handleOpenNew}>
          <Plus size={16} /> Add FAQ
        </button>
      </div>

      <div className="sa-card">
        <div className="sa-card-header">
          <div className="sa-search-bar">
            <Search className="sa-search-icon" size={15} />
            <input
              className="sa-input"
              placeholder="Search question or answer..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
        </div>
        <div className="sa-table-container">
          <table className="sa-table">
            <thead>
              <tr>
                <th>Question & Answer</th>
                <th>Category</th>
                <th>Sort Order</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="sa-text-center">Loading...</td></tr>
              ) : faqs.length === 0 ? (
                <tr><td colSpan={5} className="sa-text-center sa-text-muted">No FAQs found.</td></tr>
              ) : (
                faqs.map((f: any) => (
                  <tr key={f.id}>
                    <td style={{ maxWidth: 400, whiteSpace: 'normal' }}>
                      <div style={{ fontWeight: 500, marginBottom: 4 }}>{f.question}</div>
                      <div className="sa-text-muted" style={{ fontSize: 13 }}>
                        {f.answer.length > 150 ? f.answer.slice(0, 150) + '...' : f.answer}
                      </div>
                    </td>
                    <td><span className="sa-badge" style={{ backgroundColor: 'var(--surface-color)' }}>{f.category || 'general'}</span></td>
                    <td>{f.sortOrder}</td>
                    <td>
                      {f.isActive ? <StatusBadge status="ACTIVE" /> : <StatusBadge status="INACTIVE" />}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="sa-actions">
                        <button className="sa-btn sa-btn-icon" onClick={() => handleOpenEdit(f)} title="Edit"><Edit size={15} /></button>
                        <button className="sa-btn sa-btn-icon" style={{ color: 'var(--danger)' }} onClick={() => setConfirmDelete({ id: f.id, name: f.question })} title="Delete"><Trash2 size={15} /></button>
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
              <div className="sa-modal-title">{isEditing ? 'Edit FAQ' : 'New FAQ'}</div>
              <button className="sa-modal-close" onClick={() => setShowModal(false)}><XCircle size={18} /></button>
            </div>
            <div className="sa-modal-body">
              {errorMsg && <div className="sa-mb-16"><Alert type="danger" title="Error" message={errorMsg} /></div>}
              
              <div className="sa-form-group">
                <label className="sa-label">Question *</label>
                <input className="sa-input" value={formData.question} onChange={e => setFormData({ ...formData, question: e.target.value })} required />
              </div>

              <div className="sa-form-group">
                <label className="sa-label">Answer *</label>
                <textarea 
                  className="sa-input" 
                  style={{ minHeight: 100, resize: 'vertical' }} 
                  value={formData.answer} 
                  onChange={e => setFormData({ ...formData, answer: e.target.value })} 
                  required 
                />
              </div>

              <div className="sa-form-group">
                <label className="sa-label">Category</label>
                <input className="sa-input" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} placeholder="e.g. general, shipping, returns" />
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
              <button className="sa-btn sa-btn-primary" onClick={() => saveMutation.mutate(formData)} disabled={saveMutation.isPending || !formData.question || !formData.answer}>
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
          title="Delete FAQ"
          message={`Are you sure you want to delete this FAQ?`}
          onConfirm={() => deleteMutation.mutate(confirmDelete.id)}
          onCancel={() => setConfirmDelete(null)}
          loading={deleteMutation.isPending}
        />
      )}
    </div>
  );
}
