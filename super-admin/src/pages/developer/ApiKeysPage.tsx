import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { developerApi } from '../../api';
import type { ApiKey } from '../../api';
import { ConfirmModal, Alert, Pagination } from '../../components/ui';
import { Plus, Trash2, XCircle, Save, Key, Copy, AlertTriangle, CheckCircle2 } from 'lucide-react';

const AVAILABLE_SCOPES = [
  'orders:read', 'orders:write',
  'products:read', 'products:write',
  'customers:read', 'customers:write',
  'inventory:read', 'inventory:write',
];

export default function ApiKeysPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState<{ name: string; scopes: string[]; expiresAt: string }>({ name: '', scopes: [], expiresAt: '' });
  const [newRawKey, setNewRawKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState<{ id: string; name: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['sa-api-keys', page],
    queryFn: () => developerApi.apiKeys.list({ page: String(page), limit: '25' }),
  });

  const createMutation = useMutation({
    mutationFn: (body: { name: string; scopes: string[]; expiresAt: string }) => developerApi.apiKeys.create(body as any),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ['sa-api-keys'] });
      setShowModal(false);
      setNewRawKey(res.rawKey);
      setErrorMsg('');
    },
    onError: (err: any) => setErrorMsg(err.message || 'Failed to create API key')
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => developerApi.apiKeys.revoke(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sa-api-keys'] }); setConfirmRevoke(null); }
  });

  const handleOpenNew = () => {
    setFormData({ name: '', scopes: [], expiresAt: '' });
    setShowModal(true);
    setErrorMsg('');
  };

  const toggleScope = (scope: string) => {
    setFormData((f: any) => ({
      ...f,
      scopes: f.scopes.includes(scope) ? f.scopes.filter((s: string) => s !== scope) : [...f.scopes, scope]
    }));
  };

  const copyKey = () => {
    if (newRawKey) {
      navigator.clipboard.writeText(newRawKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const keys = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const totalPages = data?.meta?.totalPages ?? 1;

  return (
    <div>
      <div className="sa-page-header">
        <div className="sa-page-header-left">
          <h1>Developer & API Keys</h1>
          <p>Manage API keys, scopes, and integration access. Keys are hashed — raw values shown only once.</p>
        </div>
        <button className="sa-btn sa-btn-primary" onClick={handleOpenNew}>
          <Plus size={16} /> Generate Key
        </button>
      </div>

      {/* Security notice */}
      <div style={{ background: 'rgba(var(--warning-rgb), 0.1)', border: '1px solid rgba(var(--warning-rgb), 0.3)', borderRadius: 8, padding: '12px 16px', marginBottom: 20, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <AlertTriangle size={16} style={{ color: 'var(--warning)', marginTop: 1, flexShrink: 0 }} />
        <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
          API keys are hashed using SHA-256. The raw key is shown <strong>only once</strong> at creation — store it in your secrets manager immediately.
        </span>
      </div>

      <div className="sa-card">
        <div className="sa-table-container">
          <table className="sa-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}></th>
                <th>Name</th>
                <th>Scopes</th>
                <th>Last Used</th>
                <th>Expires</th>
                <th>Created</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="sa-text-center">Loading...</td></tr>
              ) : keys.length === 0 ? (
                <tr><td colSpan={7} className="sa-text-center sa-text-muted">No API keys found. Generate your first key.</td></tr>
              ) : keys.map((k: ApiKey & { scopes?: string[] }) => (
                <tr key={k.id}>
                  <td><Key size={16} className="sa-text-muted" /></td>
                  <td style={{ fontWeight: 500 }}>{k.name}</td>
                  <td>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {(k.scopes?.length ?? 0) > 0 ? (k.scopes ?? []).map((s: string) => (
                        <code key={s} style={{ fontSize: 11, background: 'var(--bg-2)', padding: '1px 5px', borderRadius: 3 }}>{s}</code>
                      )) : <span className="sa-text-muted">No scopes</span>}
                    </div>
                  </td>
                  <td className="sa-text-muted">{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : 'Never'}</td>
                  <td className="sa-text-muted">{(k as any).expiresAt ? new Date((k as any).expiresAt).toLocaleDateString() : '∞ Never'}</td>
                  <td className="sa-text-muted" style={{ fontSize: 12 }}>{new Date(k.createdAt).toLocaleDateString()}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="sa-btn sa-btn-icon" style={{ color: 'var(--danger)' }} onClick={() => setConfirmRevoke({ id: k.id, name: k.name })} title="Revoke Key">
                      <Trash2 size={15} />
                    </button>
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

      {/* New Key Modal */}
      {showModal && (
        <div className="sa-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="sa-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="sa-modal-header">
              <div className="sa-modal-title">Generate API Key</div>
              <button className="sa-modal-close" onClick={() => setShowModal(false)}><XCircle size={18} /></button>
            </div>
            <div className="sa-modal-body">
              {errorMsg && <div className="sa-mb-16"><Alert type="danger" title="Error" message={errorMsg} /></div>}
              <div className="sa-form-group">
                <label className="sa-label">Key Name *</label>
                <input className="sa-input" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Mobile App Integration" required />
              </div>
              <div className="sa-form-group">
                <label className="sa-label">Expires At (optional)</label>
                <input className="sa-input" type="date" value={formData.expiresAt} onChange={e => setFormData({ ...formData, expiresAt: e.target.value })} />
              </div>
              <div className="sa-form-group">
                <label className="sa-label">Scopes</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                  {AVAILABLE_SCOPES.map(scope => (
                    <label key={scope} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', padding: '6px 10px', borderRadius: 6, background: formData.scopes.includes(scope) ? 'rgba(var(--primary-rgb), 0.1)' : 'var(--bg-2)', border: `1px solid ${formData.scopes.includes(scope) ? 'rgba(var(--primary-rgb), 0.4)' : 'var(--border)'}` }}>
                      <input type="checkbox" checked={formData.scopes.includes(scope)} onChange={() => toggleScope(scope)} />
                      <code style={{ fontSize: 11 }}>{scope}</code>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="sa-modal-footer">
              <button className="sa-btn sa-btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="sa-btn sa-btn-primary" onClick={() => createMutation.mutate({ ...formData, expiresAt: formData.expiresAt })}
                disabled={createMutation.isPending || !formData.name}>
                {createMutation.isPending ? <span className="sa-spinner-sm sa-spinner" /> : <Key size={16} />}
                Generate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Show raw key one-time modal */}
      {newRawKey && (
        <div className="sa-modal-overlay">
          <div className="sa-modal" style={{ maxWidth: 520 }}>
            <div className="sa-modal-header">
              <div className="sa-modal-title" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <CheckCircle2 size={18} style={{ color: 'var(--success)' }} /> API Key Created
              </div>
            </div>
            <div className="sa-modal-body">
              <div style={{ background: 'rgba(var(--warning-rgb), 0.1)', border: '1px solid rgba(var(--warning-rgb), 0.4)', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13 }}>
                <strong>⚠️ Copy this key now.</strong> It will NOT be shown again after you close this dialog.
              </div>
              <div style={{ background: 'var(--bg-2)', borderRadius: 8, padding: '12px 14px', fontFamily: 'monospace', fontSize: 13, wordBreak: 'break-all', border: '1px solid var(--border)' }}>
                {newRawKey}
              </div>
            </div>
            <div className="sa-modal-footer">
              <button className="sa-btn sa-btn-primary" onClick={copyKey}>
                {copiedKey ? <><CheckCircle2 size={15} /> Copied!</> : <><Copy size={15} /> Copy Key</>}
              </button>
              <button className="sa-btn sa-btn-ghost" onClick={() => setNewRawKey(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {confirmRevoke && (
        <ConfirmModal danger title="Revoke API Key"
          message={`Revoke "${confirmRevoke.name}"? Any integrations using this key will immediately lose access.`}
          onConfirm={() => revokeMutation.mutate(confirmRevoke.id)}
          onCancel={() => setConfirmRevoke(null)}
          loading={revokeMutation.isPending}
        />
      )}
    </div>
  );
}
