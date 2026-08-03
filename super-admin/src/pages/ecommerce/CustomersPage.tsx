import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ecommerceApi, Customer } from '../../api';
import { ConfirmModal, Alert, Pagination, StatusBadge } from '../../components/ui';
import { Search, Plus, Edit, Trash2, XCircle, Save, Users2, Mail, Phone } from 'lucide-react';

export default function CustomersPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<Customer>>({ name: '', email: '', phone: '', status: 'ACTIVE', notes: '' });
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['sa-ecom-customers', page, search],
    queryFn: () => ecommerceApi.customers.list({ page: String(page), limit: '25', search }),
  });

  const saveMutation = useMutation({
    mutationFn: (body: Partial<Customer>) => isEditing && formData.id ? ecommerceApi.customers.update(formData.id, body) : ecommerceApi.customers.create(body as any),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sa-ecom-customers'] }); setShowModal(false); setErrorMsg(''); },
    onError: (err: any) => setErrorMsg(err.message || 'Failed to save customer')
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ecommerceApi.customers.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sa-ecom-customers'] }); setConfirmDelete(null); }
  });

  const handleOpenNew = () => {
    setIsEditing(false);
    setFormData({ name: '', email: '', phone: '', status: 'ACTIVE', notes: '' });
    setShowModal(true);
    setErrorMsg('');
  };

  const handleOpenEdit = (c: Customer) => {
    setIsEditing(true);
    setFormData({ ...c });
    setShowModal(true);
    setErrorMsg('');
  };

  const customers = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const totalPages = data?.meta?.totalPages ?? 1;

  return (
    <div>
      <div className="sa-page-header">
        <div className="sa-page-header-left">
          <h1>E-Commerce Customers</h1>
          <p>Manage CRM profiles, order history, and customer status.</p>
        </div>
        <button className="sa-btn sa-btn-primary" onClick={handleOpenNew}>
          <Plus size={16} /> Add Customer
        </button>
      </div>

      <div className="sa-card">
        <div className="sa-card-header">
          <div className="sa-search-bar">
            <Search className="sa-search-icon" size={15} />
            <input className="sa-input" placeholder="Search by name, email or phone..." value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
        </div>
        <div className="sa-table-container">
          <table className="sa-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}></th>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Orders</th>
                <th>Total Spent</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} className="sa-text-center">Loading...</td></tr>
              ) : customers.length === 0 ? (
                <tr><td colSpan={8} className="sa-text-center sa-text-muted">No customers found.</td></tr>
              ) : customers.map((c: Customer) => (
                <tr key={c.id}>
                  <td><Users2 size={16} className="sa-text-muted" /></td>
                  <td style={{ fontWeight: 500 }}>{c.name}</td>
                  <td><span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Mail size={13} />{c.email}</span></td>
                  <td><span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Phone size={13} />{c.phone || '—'}</span></td>
                  <td>{c.totalOrders ?? 0}</td>
                  <td>TZS {Number(c.totalSpent ?? 0).toLocaleString()}</td>
                  <td><StatusBadge status={c.status} /></td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="sa-actions">
                      <button className="sa-btn sa-btn-icon" onClick={() => handleOpenEdit(c)} title="Edit"><Edit size={15} /></button>
                      <button className="sa-btn sa-btn-icon" style={{ color: 'var(--danger)' }} onClick={() => setConfirmDelete({ id: c.id, name: c.name })} title="Delete"><Trash2 size={15} /></button>
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
              <div className="sa-modal-title">{isEditing ? 'Edit Customer' : 'Add Customer'}</div>
              <button className="sa-modal-close" onClick={() => setShowModal(false)}><XCircle size={18} /></button>
            </div>
            <div className="sa-modal-body">
              {errorMsg && <div className="sa-mb-16"><Alert type="danger" title="Error" message={errorMsg} /></div>}

              <div className="sa-form-group">
                <label className="sa-label">Full Name *</label>
                <input className="sa-input" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. John Doe" required />
              </div>
              <div className="sa-form-group">
                <label className="sa-label">Email *</label>
                <input className="sa-input" type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="john@example.com" required />
              </div>
              <div className="sa-form-group">
                <label className="sa-label">Phone</label>
                <input className="sa-input" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="+255 712 345 678" />
              </div>
              <div className="sa-form-group">
                <label className="sa-label">Status</label>
                <select className="sa-input" value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value as Customer['status'] })}>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="BLOCKED">Blocked</option>
                </select>
              </div>
              <div className="sa-form-group">
                <label className="sa-label">Notes</label>
                <textarea className="sa-input" rows={2} value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} placeholder="Internal notes..." />
              </div>
            </div>
            <div className="sa-modal-footer">
              <button className="sa-btn sa-btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="sa-btn sa-btn-primary" onClick={() => saveMutation.mutate(formData)} disabled={saveMutation.isPending || !formData.name || !formData.email}>
                {saveMutation.isPending ? <span className="sa-spinner-sm sa-spinner" /> : <Save size={16} />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <ConfirmModal danger title="Delete Customer"
          message={`Are you sure you want to delete "${confirmDelete.name}"?`}
          onConfirm={() => deleteMutation.mutate(confirmDelete.id)}
          onCancel={() => setConfirmDelete(null)}
          loading={deleteMutation.isPending}
        />
      )}
    </div>
  );
}
