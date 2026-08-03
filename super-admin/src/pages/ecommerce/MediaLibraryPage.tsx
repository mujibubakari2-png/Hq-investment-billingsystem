import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ecommerceApi, MediaAsset } from '../../api';
import { ConfirmModal, Alert, Pagination } from '../../components/ui';
import { Search, Plus, Trash2, XCircle, Save, Image as ImageIcon, FileText, Video, File } from 'lucide-react';

const TYPE_ICONS: Record<string, any> = {
  IMAGE: <ImageIcon size={16} />,
  VIDEO: <Video size={16} />,
  DOCUMENT: <FileText size={16} />,
  OTHER: <File size={16} />
};

type MediaForm = {
  url?: string;
  filename?: string;
  fileType?: MediaAsset['fileType'];
  mimeType?: string;
  sizeBytes?: string;
  altText?: string;
};

export default function MediaLibraryPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState<MediaForm>({ url: '', filename: '', fileType: 'IMAGE', mimeType: '', sizeBytes: '', altText: '' });
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; filename: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['sa-media', page, search],
    queryFn: () => ecommerceApi.media.list({ page: String(page), limit: '25', search }),
  });

  const saveMutation = useMutation({
    mutationFn: (body: MediaForm) => ecommerceApi.media.create(body as any),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sa-media'] }); setShowModal(false); setErrorMsg(''); },
    onError: (err: any) => setErrorMsg(err.message || 'Failed to add media asset')
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ecommerceApi.media.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sa-media'] }); setConfirmDelete(null); }
  });

  const handleOpenNew = () => {
    setFormData({ url: '', filename: '', fileType: 'IMAGE', mimeType: '', sizeBytes: '', altText: '' });
    setShowModal(true);
    setErrorMsg('');
  };

  const assets = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const totalPages = data?.meta?.totalPages ?? 1;

  const formatSize = (bytes: number) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <div>
      <div className="sa-page-header">
        <div className="sa-page-header-left">
          <h1>Media Library</h1>
          <p>Organize product images, banners, documents, and brand assets.</p>
        </div>
        <button className="sa-btn sa-btn-primary" onClick={handleOpenNew}>
          <Plus size={16} /> Add Asset
        </button>
      </div>

      <div className="sa-card">
        <div className="sa-card-header">
          <div className="sa-search-bar">
            <Search className="sa-search-icon" size={15} />
            <input className="sa-input" placeholder="Search by filename..." value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
        </div>
        <div className="sa-table-container">
          <table className="sa-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}></th>
                <th>Preview</th>
                <th>Filename</th>
                <th>Type</th>
                <th>Size</th>
                <th>Alt Text</th>
                <th>Added</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} className="sa-text-center">Loading...</td></tr>
              ) : assets.length === 0 ? (
                <tr><td colSpan={8} className="sa-text-center sa-text-muted">No media assets found.</td></tr>
              ) : assets.map((a: MediaAsset) => (
                <tr key={a.id}>
                  <td>{TYPE_ICONS[a.fileType] ?? <File size={16} />}</td>
                  <td>
                    {a.fileType === 'IMAGE' ? (
                      <img src={a.url} alt={a.altText || a.filename} style={{ width: 48, height: 36, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--border)' }}
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ) : <span className="sa-text-muted">—</span>}
                  </td>
                  <td style={{ fontWeight: 500, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.filename}</td>
                  <td><span className="sa-badge">{a.fileType}</span></td>
                  <td>{formatSize(a.sizeBytes)}</td>
                  <td className="sa-text-muted">{a.altText || '—'}</td>
                  <td className="sa-text-muted" style={{ fontSize: 12 }}>{new Date(a.createdAt).toLocaleDateString()}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="sa-actions">
                      <a href={a.url} target="_blank" rel="noopener noreferrer" className="sa-btn sa-btn-icon" title="Open URL"><ImageIcon size={15} /></a>
                      <button className="sa-btn sa-btn-icon" style={{ color: 'var(--danger)' }} onClick={() => setConfirmDelete({ id: a.id, filename: a.filename })} title="Delete"><Trash2 size={15} /></button>
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
              <div className="sa-modal-title">Add Media Asset</div>
              <button className="sa-modal-close" onClick={() => setShowModal(false)}><XCircle size={18} /></button>
            </div>
            <div className="sa-modal-body">
              {errorMsg && <div className="sa-mb-16"><Alert type="danger" title="Error" message={errorMsg} /></div>}
              <div className="sa-form-group">
                <label className="sa-label">Asset URL *</label>
                <input className="sa-input" value={formData.url} onChange={e => setFormData({ ...formData, url: e.target.value })} placeholder="https://cdn.example.com/image.jpg" required />
              </div>
              <div className="sa-form-group">
                <label className="sa-label">Filename *</label>
                <input className="sa-input" value={formData.filename} onChange={e => setFormData({ ...formData, filename: e.target.value })} placeholder="banner-hero.jpg" required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="sa-form-group">
                  <label className="sa-label">File Type</label>
                  <select className="sa-input" value={formData.fileType} onChange={e => setFormData({ ...formData, fileType: e.target.value as MediaAsset['fileType'] })}>
                    <option value="IMAGE">Image</option>
                    <option value="VIDEO">Video</option>
                    <option value="DOCUMENT">Document</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div className="sa-form-group">
                  <label className="sa-label">Size (bytes)</label>
                  <input className="sa-input" type="number" min="0" value={formData.sizeBytes ?? ''} onChange={e => setFormData({ ...formData, sizeBytes: e.target.value })} placeholder="0" />
                </div>
              </div>
              <div className="sa-form-group">
                <label className="sa-label">MIME Type</label>
                <input className="sa-input" value={formData.mimeType} onChange={e => setFormData({ ...formData, mimeType: e.target.value })} placeholder="image/jpeg" />
              </div>
              <div className="sa-form-group">
                <label className="sa-label">Alt Text</label>
                <input className="sa-input" value={formData.altText} onChange={e => setFormData({ ...formData, altText: e.target.value })} placeholder="Descriptive text for accessibility" />
              </div>
              {formData.url && formData.fileType === 'IMAGE' && (
                <div className="sa-form-group">
                  <label className="sa-label">Preview</label>
                  <img src={formData.url} alt="preview" style={{ maxWidth: '100%', maxHeight: 150, borderRadius: 6, border: '1px solid var(--border)' }}
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </div>
              )}
            </div>
            <div className="sa-modal-footer">
              <button className="sa-btn sa-btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="sa-btn sa-btn-primary" onClick={() => saveMutation.mutate({ ...formData, sizeBytes: parseInt(formData.sizeBytes ?? '0', 10) } as any)} disabled={saveMutation.isPending || !formData.url || !formData.filename}>
                {saveMutation.isPending ? <span className="sa-spinner-sm sa-spinner" /> : <Save size={16} />}
                Save Asset
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <ConfirmModal danger title="Delete Media Asset"
          message={`Delete "${confirmDelete.filename}"? The asset URL will remain but the record will be removed.`}
          onConfirm={() => deleteMutation.mutate(confirmDelete.id)}
          onCancel={() => setConfirmDelete(null)}
          loading={deleteMutation.isPending}
        />
      )}
    </div>
  );
}
