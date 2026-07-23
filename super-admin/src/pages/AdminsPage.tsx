import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminsApi, type PlatformAdmin } from '../api';
import { StatusBadge, Alert, ConfirmModal, fmtDate } from '../components/ui';
import { Plus, RefreshCw, Shield, Key, UserX, Pencil, X, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../AuthContext';

export default function AdminsPage() {
  const { user: currentUser } = useAuth();
  const qc = useQueryClient();
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editAdmin, setEditAdmin] = useState<PlatformAdmin | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<PlatformAdmin | null>(null);
  const [credsModal, setCredsModal] = useState<{ email: string; tempPassword: string } | null>(null);
  const [resetResult, setResetResult] = useState<{ email: string; tempPassword: string } | null>(null);
  const [showPwd, setShowPwd] = useState(false);
  const [form, setForm] = useState({ username: '', email: '', fullName: '', phone: '' });

  const flash = (m: string, isErr = false) => {
    if (isErr) { setErr(m); setTimeout(() => setErr(''), 5000); }
    else { setMsg(m); setTimeout(() => setMsg(''), 4000); }
  };

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['sa-admins'],
    queryFn: adminsApi.list,
  });

  const admins: PlatformAdmin[] = data?.data ?? [];

  const createMutation = useMutation({
    mutationFn: () => adminsApi.create({ ...form }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['sa-admins'] });
      setCredsModal({ email: form.email, tempPassword: res.credentials.tempPassword });
      setShowCreate(false);
      setForm({ username: '', email: '', fullName: '', phone: '' });
    },
    onError: (e: Error) => flash(e.message, true),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: unknown }) => adminsApi.update(id, body),
    onSuccess: (res) => { qc.invalidateQueries({ queryKey: ['sa-admins'] }); flash(res.message); setEditAdmin(null); },
    onError: (e: Error) => flash(e.message, true),
  });

  const resetMutation = useMutation({
    mutationFn: (id: string) => adminsApi.resetPassword(id),
    onSuccess: (res, id) => {
      const admin = admins.find(a => a.id === id);
      setResetResult({ email: admin?.email ?? '', tempPassword: res.tempPassword });
      flash(res.message);
    },
    onError: (e: Error) => flash(e.message, true),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => adminsApi.toggleStatus(id, status),
    onSuccess: (res) => { qc.invalidateQueries({ queryKey: ['sa-admins'] }); flash(res.message); },
    onError: (e: Error) => flash(e.message, true),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminsApi.delete(id),
    onSuccess: (res) => { qc.invalidateQueries({ queryKey: ['sa-admins'] }); flash(res.message); setConfirmDelete(null); },
    onError: (e: Error) => { flash(e.message, true); setConfirmDelete(null); },
  });

  return (
    <div>
      <div className="sa-page-header">
        <div className="sa-page-header-left">
          <h1>Platform <span className="sa-gradient-text">Admins</span></h1>
          <p>Manage platform-level administrator accounts</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="sa-btn sa-btn-ghost" onClick={() => refetch()}><RefreshCw size={14} /> Refresh</button>
          <button className="sa-btn sa-btn-primary" onClick={() => setShowCreate(true)}><Plus size={14} /> Add Admin</button>
        </div>
      </div>

      {msg && <Alert type="success" title={msg} />}
      {err && <Alert type="danger" title={err} />}

      <Alert type="warning" title="Security Notice" message="Platform admins have full access to all tenant management functions. Only add trusted individuals." />

      <div className="sa-card" style={{ padding: 0 }}>
        <div className="sa-table-container">
          <table className="sa-table">
            <thead>
              <tr>
                <th>Admin</th>
                <th>Username</th>
                <th>Status</th>
                <th>Last Login</th>
                <th>Created</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 6 }).map((_, j) => (
                    <td key={j}><div className="sa-skeleton" style={{ height: 14, width: j === 0 ? 140 : 80, borderRadius: 3 }} /></td>
                  ))}</tr>
                ))
                : admins.length === 0
                  ? <tr><td colSpan={6}><div className="sa-empty"><div className="sa-empty-icon"><Shield size={26} /></div><div className="sa-empty-title">No platform admins found</div></div></td></tr>
                  : admins.map(admin => (
                    <tr key={admin.id} style={{ opacity: admin.id === currentUser?.id ? 1 : undefined }}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                            {(admin.fullName || admin.username).slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)' }}>
                              {admin.fullName || admin.username}
                              {admin.id === currentUser?.id && <span style={{ marginLeft: 6, fontSize: 10, background: 'var(--accent)', color: '#fff', padding: '1px 6px', borderRadius: 10 }}>You</span>}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{admin.email}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>@{admin.username}</td>
                      <td><StatusBadge status={admin.status} /></td>
                      <td style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{admin.lastLogin ? fmtDate(admin.lastLogin) : 'Never'}</td>
                      <td style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{fmtDate(admin.createdAt)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          <button className="sa-btn sa-btn-sm sa-btn-ghost" title="Edit" onClick={() => setEditAdmin(admin)}><Pencil size={12} /></button>
                          <button className="sa-btn sa-btn-sm sa-btn-ghost" title="Reset Password" disabled={resetMutation.isPending} onClick={() => resetMutation.mutate(admin.id)}><Key size={12} /></button>
                          {admin.id !== currentUser?.id && (
                            <>
                              <button
                                className={`sa-btn sa-btn-sm ${admin.status === 'ACTIVE' ? 'sa-btn-warning' : 'sa-btn-success'}`}
                                title={admin.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                                disabled={toggleMutation.isPending}
                                onClick={() => toggleMutation.mutate({ id: admin.id, status: admin.status })}
                              >
                                <UserX size={12} />
                              </button>
                              <button className="sa-btn sa-btn-sm sa-btn-danger" title="Delete" onClick={() => setConfirmDelete(admin)}><X size={12} /></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="sa-modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="sa-modal" onClick={e => e.stopPropagation()}>
            <div className="sa-modal-header">
              <div><div className="sa-modal-title">Add Platform Admin</div><div className="sa-modal-sub">New admin will have full platform access</div></div>
              <button className="sa-modal-close" onClick={() => setShowCreate(false)}><X size={18} /></button>
            </div>
            <div className="sa-modal-body">
              <div className="sa-grid-2">
                <div className="sa-form-group">
                  <label className="sa-label">Username *</label>
                  <input className="sa-input" placeholder="e.g. johndoe" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
                </div>
                <div className="sa-form-group">
                  <label className="sa-label">Email *</label>
                  <input className="sa-input" type="email" placeholder="admin@platform.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="sa-form-group">
                  <label className="sa-label">Full Name</label>
                  <input className="sa-input" placeholder="John Doe" value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} />
                </div>
                <div className="sa-form-group">
                  <label className="sa-label">Phone</label>
                  <input className="sa-input" placeholder="+255..." value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
              </div>
              {createMutation.error && <Alert type="danger" title={String(createMutation.error)} />}
            </div>
            <div className="sa-modal-footer">
              <button className="sa-btn sa-btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="sa-btn sa-btn-primary" disabled={createMutation.isPending || !form.email || !form.username} onClick={() => createMutation.mutate()}>
                {createMutation.isPending ? <span className="sa-spinner sa-spinner-sm" /> : <Plus size={14} />} Create Admin
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editAdmin && (
        <div className="sa-modal-overlay" onClick={() => setEditAdmin(null)}>
          <div className="sa-modal" onClick={e => e.stopPropagation()}>
            <div className="sa-modal-header">
              <div><div className="sa-modal-title">Edit Admin</div><div className="sa-modal-sub">{editAdmin.email}</div></div>
              <button className="sa-modal-close" onClick={() => setEditAdmin(null)}><X size={18} /></button>
            </div>
            <div className="sa-modal-body">
              <div className="sa-grid-2">
                <div className="sa-form-group">
                  <label className="sa-label">Full Name</label>
                  <input className="sa-input" defaultValue={editAdmin.fullName || ''} id="edit-fullname" />
                </div>
                <div className="sa-form-group">
                  <label className="sa-label">Email</label>
                  <input className="sa-input" type="email" defaultValue={editAdmin.email} id="edit-email" />
                </div>
                <div className="sa-form-group">
                  <label className="sa-label">Phone</label>
                  <input className="sa-input" defaultValue={editAdmin.phone || ''} id="edit-phone" />
                </div>
              </div>
            </div>
            <div className="sa-modal-footer">
              <button className="sa-btn sa-btn-ghost" onClick={() => setEditAdmin(null)}>Cancel</button>
              <button className="sa-btn sa-btn-primary" disabled={updateMutation.isPending} onClick={() => {
                updateMutation.mutate({
                  id: editAdmin.id,
                  body: {
                    fullName: (document.getElementById('edit-fullname') as HTMLInputElement)?.value,
                    email: (document.getElementById('edit-email') as HTMLInputElement)?.value,
                    phone: (document.getElementById('edit-phone') as HTMLInputElement)?.value,
                  },
                });
              }}>
                {updateMutation.isPending ? <span className="sa-spinner sa-spinner-sm" /> : null} Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Credentials Modal */}
      {(credsModal || resetResult) && (
        <div className="sa-modal-overlay" onClick={() => { setCredsModal(null); setResetResult(null); }}>
          <div className="sa-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="sa-modal-header">
              <div><div className="sa-modal-title">🔐 Credentials</div><div className="sa-modal-sub">Copy and share securely — shown once!</div></div>
            </div>
            <div className="sa-modal-body">
              <Alert type="warning" title="Save these credentials immediately — they won't be shown again." />
              <div className="sa-form-group">
                <label className="sa-label">Email</label>
                <div className="sa-input" style={{ cursor: 'text', userSelect: 'all' }}>{(credsModal || resetResult)?.email}</div>
              </div>
              <div className="sa-form-group">
                <label className="sa-label">Temporary Password</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div className="sa-input" style={{ flex: 1, fontFamily: 'var(--font-mono)', letterSpacing: showPwd ? 2 : 4, cursor: 'text', userSelect: 'all' }}>
                    {showPwd ? (credsModal || resetResult)?.tempPassword : '••••••••••••••'}
                  </div>
                  <button className="sa-btn sa-btn-ghost" onClick={() => setShowPwd(p => !p)}>
                    {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            </div>
            <div className="sa-modal-footer">
              <button className="sa-btn sa-btn-primary" onClick={() => { setCredsModal(null); setResetResult(null); }}>I've Saved The Credentials</button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <ConfirmModal
          title="Delete Platform Admin?"
          message={<span>Permanently delete <strong>{confirmDelete.fullName || confirmDelete.username}</strong> ({confirmDelete.email})? This cannot be undone.</span>}
          confirmLabel="Delete Admin"
          danger
          loading={deleteMutation.isPending}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => deleteMutation.mutate(confirmDelete.id)}
        />
      )}
    </div>
  );
}
