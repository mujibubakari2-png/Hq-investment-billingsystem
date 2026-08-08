import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cmsApi, type ContactMessage } from '../../api';
import { ConfirmModal, Pagination } from '../../components/ui';
import { Search, Trash2, Eye, Mail, MailOpen, XCircle, CheckCircle, MessageSquare } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  UNREAD: 'var(--warning)',
  READ: 'var(--text-muted)',
  REPLIED: 'var(--success)',
};

const STATUS_LABELS: Record<string, string> = {
  UNREAD: 'Unread',
  READ: 'Read',
  REPLIED: 'Replied',
};

export default function ContactsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [viewMsg, setViewMsg] = useState<ContactMessage | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['sa-contacts', page, search, statusFilter],
    queryFn: () => {
      const params: Record<string, string> = { page: String(page), limit: '25' };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      return cmsApi.contacts.list(params);
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      cmsApi.contacts.updateStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sa-contacts'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => cmsApi.contacts.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sa-contacts'] });
      setConfirmDelete(null);
      if (viewMsg && viewMsg.id === confirmDelete?.id) setViewMsg(null);
    },
  });

  const handleView = (msg: ContactMessage) => {
    setViewMsg(msg);
    if (msg.status === 'UNREAD') {
      statusMutation.mutate({ id: msg.id, status: 'READ' });
    }
  };

  const messages = data?.data ?? [];
  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;
  const unreadCount = messages.filter((m: ContactMessage) => m.status === 'UNREAD').length;

  return (
    <div>
      <div className="sa-page-header">
        <div className="sa-page-header-left">
          <h1>
            Contact Messages
            {unreadCount > 0 && (
              <span style={{
                marginLeft: 10,
                background: 'var(--danger)',
                color: '#fff',
                borderRadius: 99,
                fontSize: 12,
                padding: '2px 9px',
                fontWeight: 700,
                verticalAlign: 'middle'
              }}>
                {unreadCount} new
              </span>
            )}
          </h1>
          <p>Inquiries submitted through the landing page contact form.</p>
        </div>
      </div>

      <div className="sa-card">
        <div className="sa-card-header" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div className="sa-search-bar" style={{ flex: 1, minWidth: 220 }}>
            <Search className="sa-search-icon" size={15} />
            <input
              className="sa-input"
              placeholder="Search by name, email, message..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <select
            className="sa-input"
            style={{ width: 150 }}
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          >
            <option value="">All Status</option>
            <option value="UNREAD">Unread</option>
            <option value="READ">Read</option>
            <option value="REPLIED">Replied</option>
          </select>
        </div>

        <div className="sa-table-container">
          <table className="sa-table">
            <thead>
              <tr>
                <th style={{ width: 32 }}></th>
                <th>Name</th>
                <th>Email</th>
                <th>Message Preview</th>
                <th>Received</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="sa-text-center">Loading...</td></tr>
              ) : messages.length === 0 ? (
                <tr><td colSpan={7} className="sa-text-center sa-text-muted">No contact messages found.</td></tr>
              ) : (
                messages.map((m: ContactMessage) => (
                  <tr key={m.id} style={{ fontWeight: m.status === 'UNREAD' ? 600 : 400 }}>
                    <td>
                      {m.status === 'UNREAD'
                        ? <Mail size={15} style={{ color: 'var(--warning)' }} />
                        : <MailOpen size={15} className="sa-text-muted" />}
                    </td>
                    <td>{m.name}</td>
                    <td className="sa-text-muted" style={{ fontSize: 13 }}>{m.email}</td>
                    <td className="sa-text-muted" style={{ maxWidth: 280, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 13 }}>
                      {m.message}
                    </td>
                    <td className="sa-text-muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                      {new Date(m.createdAt).toLocaleString()}
                    </td>
                    <td>
                      <span style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: 99,
                        background: STATUS_COLORS[m.status] + '22',
                        color: STATUS_COLORS[m.status],
                        border: `1px solid ${STATUS_COLORS[m.status]}44`
                      }}>
                        {STATUS_LABELS[m.status] ?? m.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="sa-actions">
                        <button className="sa-btn sa-btn-icon" onClick={() => handleView(m)} title="View">
                          <Eye size={15} />
                        </button>
                        {m.status !== 'REPLIED' && (
                          <button
                            className="sa-btn sa-btn-icon"
                            title="Mark as Replied"
                            style={{ color: 'var(--success)' }}
                            onClick={() => statusMutation.mutate({ id: m.id, status: 'REPLIED' })}
                          >
                            <CheckCircle size={15} />
                          </button>
                        )}
                        <button
                          className="sa-btn sa-btn-icon"
                          style={{ color: 'var(--danger)' }}
                          onClick={() => setConfirmDelete({ id: m.id, name: m.name })}
                          title="Delete"
                        >
                          <Trash2 size={15} />
                        </button>
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

      {/* View Message Modal */}
      {viewMsg && (
        <div className="sa-modal-overlay" onClick={() => setViewMsg(null)}>
          <div className="sa-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="sa-modal-header">
              <div className="sa-modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <MessageSquare size={18} /> Message from {viewMsg.name}
              </div>
              <button className="sa-modal-close" onClick={() => setViewMsg(null)}><XCircle size={18} /></button>
            </div>
            <div className="sa-modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px', marginBottom: 20 }}>
                <div>
                  <div className="sa-label">From</div>
                  <div style={{ fontWeight: 500 }}>{viewMsg.name}</div>
                </div>
                <div>
                  <div className="sa-label">Email</div>
                  <a href={`mailto:${viewMsg.email}`} style={{ color: 'var(--primary)', fontWeight: 500 }}>{viewMsg.email}</a>
                </div>
                <div>
                  <div className="sa-label">Received</div>
                  <div className="sa-text-muted">{new Date(viewMsg.createdAt).toLocaleString()}</div>
                </div>
                <div>
                  <div className="sa-label">Status</div>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
                    background: STATUS_COLORS[viewMsg.status] + '22',
                    color: STATUS_COLORS[viewMsg.status]
                  }}>
                    {STATUS_LABELS[viewMsg.status]}
                  </span>
                </div>
              </div>
              <div className="sa-label" style={{ marginBottom: 8 }}>Message</div>
              <div style={{
                background: 'var(--surface-color)',
                border: '1px solid var(--border-color)',
                borderRadius: 8,
                padding: '14px 16px',
                lineHeight: 1.7,
                whiteSpace: 'pre-wrap',
                fontSize: 14
              }}>
                {viewMsg.message}
              </div>
            </div>
            <div className="sa-modal-footer">
              <button className="sa-btn sa-btn-ghost" onClick={() => setViewMsg(null)}>Close</button>
              <a href={`mailto:${viewMsg.email}?subject=Re: Your Inquiry`} className="sa-btn sa-btn-primary" onClick={() => statusMutation.mutate({ id: viewMsg.id, status: 'REPLIED' })}>
                <Mail size={15} /> Reply via Email
              </a>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <ConfirmModal
          danger
          title="Delete Message"
          message={`Are you sure you want to permanently delete the message from "${confirmDelete.name}"?`}
          onConfirm={() => deleteMutation.mutate(confirmDelete.id)}
          onCancel={() => setConfirmDelete(null)}
          loading={deleteMutation.isPending}
        />
      )}
    </div>
  );
}
