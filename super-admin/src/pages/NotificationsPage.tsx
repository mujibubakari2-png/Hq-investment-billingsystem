import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { notificationsApi, tenantsApi, type NotificationRecord } from '../api';
import { Alert, Pagination, fmtDate } from '../components/ui';
import { Send, Bell, RefreshCw, X, Mail } from 'lucide-react';

export default function NotificationsPage() {
  const [page, setPage] = useState(1);
  const [showCompose, setShowCompose] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [form, setForm] = useState({ channel: 'email', tenantId: '', subject: '', message: '' });

  const flash = (m: string, isErr = false) => {
    if (isErr) { setErr(m); setTimeout(() => setErr(''), 5000); }
    else { setMsg(m); setTimeout(() => setMsg(''), 4000); }
  };

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['sa-notifications', page],
    queryFn: () => notificationsApi.list({ page: String(page) }),
  });

  const { data: tenantsData } = useQuery({
    queryKey: ['sa-tenants-all'],
    queryFn: () => tenantsApi.list({ limit: '200' }),
    enabled: showCompose,
  });

  const sendMutation = useMutation({
    mutationFn: () => notificationsApi.send({
      channel: form.channel,
      tenantId: form.tenantId || undefined,
      subject: form.subject,
      message: form.message,
    }),
    onSuccess: (res) => {
      flash(res.message);
      setShowCompose(false);
      setForm({ channel: 'email', tenantId: '', subject: '', message: '' });
      refetch();
    },
    onError: (e: Error) => flash(e.message, true),
  });

  const records: NotificationRecord[] = data?.data ?? [];

  return (
    <div>
      <div className="sa-page-header">
        <div className="sa-page-header-left">
          <h1>Platform <span className="sa-gradient-text">Notifications</span></h1>
          <p>Send announcements and alerts to tenants</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="sa-btn sa-btn-ghost" onClick={() => refetch()}><RefreshCw size={14} /> Refresh</button>
          <button className="sa-btn sa-btn-primary" onClick={() => setShowCompose(true)}>
            <Send size={14} /> Compose Message
          </button>
        </div>
      </div>

      {msg && <Alert type="success" title={msg} />}
      {err && <Alert type="danger" title={err} />}

      <Alert
        type="info"
        title="Broadcast System"
        message="Use this to send announcements, maintenance notices, or billing reminders to one or all tenants. Notifications are sent via email and logged here."
      />

      {/* History Table */}
      <div className="sa-card" style={{ padding: 0 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Bell size={15} /> Notification History
        </div>
        <div className="sa-table-container">
          <table className="sa-table">
            <thead>
              <tr>
                <th>Recipient</th>
                <th>Tenant</th>
                <th>Message</th>
                <th>Status</th>
                <th>Sent</th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 5 }).map((_, j) => (
                    <td key={j}><div className="sa-skeleton" style={{ height: 14, width: j === 2 ? 180 : 80, borderRadius: 3 }} /></td>
                  ))}</tr>
                ))
                : records.length === 0
                  ? (
                    <tr><td colSpan={5}>
                      <div className="sa-empty">
                        <div className="sa-empty-icon"><Bell size={26} /></div>
                        <div className="sa-empty-title">No notifications sent yet</div>
                        <div className="sa-empty-sub">Compose a message to get started</div>
                      </div>
                    </td></tr>
                  )
                  : records.map(rec => (
                    <tr key={rec.id}>
                      <td style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                        {rec.recipient}
                      </td>
                      <td style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
                        {rec.tenantName}
                      </td>
                      <td style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', maxWidth: 280 }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {rec.message}
                        </div>
                      </td>
                      <td>
                        <span style={{
                          background: rec.status === 'SENT' ? 'var(--success)20' : 'var(--danger)20',
                          color: rec.status === 'SENT' ? 'var(--success)' : 'var(--danger)',
                          padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600
                        }}>{rec.status}</span>
                      </td>
                      <td style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {fmtDate(rec.createdAt)}
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
        {!isLoading && (data?.pages ?? 0) > 1 && (
          <Pagination page={page} pages={data!.pages} total={data!.total} limit={50} onPage={setPage} />
        )}
      </div>

      {/* Compose Modal */}
      {showCompose && (
        <div className="sa-modal-overlay" onClick={() => setShowCompose(false)}>
          <div className="sa-modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <div className="sa-modal-header">
              <div>
                <div className="sa-modal-title"><Mail size={16} style={{ display: 'inline', marginRight: 6 }} />Compose Notification</div>
                <div className="sa-modal-sub">Send a platform announcement to tenant(s)</div>
              </div>
              <button className="sa-modal-close" onClick={() => setShowCompose(false)}><X size={18} /></button>
            </div>
            <div className="sa-modal-body">
              <div className="sa-grid-2">
                <div className="sa-form-group">
                  <label className="sa-label">Channel</label>
                  <select className="sa-select" value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value }))}>
                    <option value="email">Email</option>
                    <option value="broadcast">Log Only (No Email)</option>
                  </select>
                </div>
                <div className="sa-form-group">
                  <label className="sa-label">Recipient</label>
                  <select className="sa-select" value={form.tenantId} onChange={e => setForm(f => ({ ...f, tenantId: e.target.value }))}>
                    <option value="">📢 All Tenants</option>
                    {tenantsData?.data.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="sa-form-group">
                <label className="sa-label">Subject</label>
                <input className="sa-input" placeholder="e.g. Scheduled Maintenance Notice" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} />
              </div>
              <div className="sa-form-group">
                <label className="sa-label">Message *</label>
                <textarea
                  className="sa-input"
                  rows={6}
                  placeholder="Write your message here…"
                  value={form.message}
                  onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                  style={{ resize: 'vertical', minHeight: 120 }}
                />
              </div>
              {!form.tenantId && (
                <Alert type="warning" title="Broadcasting to ALL tenants" message="This message will be sent to every active tenant on the platform." />
              )}
              {sendMutation.error && <Alert type="danger" title={String(sendMutation.error)} />}
            </div>
            <div className="sa-modal-footer">
              <button className="sa-btn sa-btn-ghost" onClick={() => setShowCompose(false)}>Cancel</button>
              <button
                className="sa-btn sa-btn-primary"
                disabled={sendMutation.isPending || !form.message.trim()}
                onClick={() => sendMutation.mutate()}
              >
                {sendMutation.isPending ? <span className="sa-spinner sa-spinner-sm" /> : <Send size={14} />}
                Send Notification
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
