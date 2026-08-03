import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ecommerceApi, StockMovement } from '../../api';
import { ConfirmModal, Alert, Pagination, StatusBadge } from '../../components/ui';
import { Search, Plus, Trash2, XCircle, Save, PackageOpen, TrendingDown, TrendingUp, RefreshCw } from 'lucide-react';

const MOVEMENT_TYPES: { value: StockMovement['type']; label: string }[] = [
  { value: 'IN', label: 'Stock In (Restock)' },
  { value: 'OUT', label: 'Stock Out (Adjustment)' },
  { value: 'ADJUSTMENT', label: 'Manual Adjustment' },
];

type InventoryForm = {
  productId?: string;
  type?: StockMovement['type'];
  quantity?: string;
  notes?: string;
};

export default function InventoryPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState<InventoryForm>({ productId: '', type: 'IN', quantity: '', notes: '' });
  const [errorMsg, setErrorMsg] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['sa-inventory', page, search],
    queryFn: () => ecommerceApi.inventory.list({ page: String(page), limit: '25', search }),
  });

  // Load products for the dropdown
  const { data: productsData } = useQuery({
    queryKey: ['sa-products-dropdown'],
    queryFn: () => ecommerceApi.products.list({ limit: '200' }),
  });

  const saveMutation = useMutation({
    mutationFn: (body: InventoryForm) => ecommerceApi.inventory.addMovement(body as any),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sa-inventory'] }); setShowModal(false); setErrorMsg(''); },
    onError: (err: any) => setErrorMsg(err.message || 'Failed to record stock movement')
  });

  const handleOpenNew = () => {
    setFormData({ productId: '', type: 'IN', quantity: '', notes: '' });
    setShowModal(true);
    setErrorMsg('');
  };

  const movements: StockMovement[] = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const totalPages = data?.meta?.totalPages ?? 1;
  const products = productsData?.data ?? [];

  return (
    <div>
      <div className="sa-page-header">
        <div className="sa-page-header-left">
          <h1>Inventory</h1>
          <p>Track stock movements, restock events, and SKU availability across the catalogue.</p>
        </div>
        <button className="sa-btn sa-btn-primary" onClick={handleOpenNew}>
          <Plus size={16} /> Record Movement
        </button>
      </div>

      {/* Summary Cards */}
      <div className="sa-stats-grid" style={{ marginBottom: 24 }}>
        <div className="sa-stat-card">
          <div className="sa-stat-header">
            <span className="sa-stat-label">Total Movements</span>
            <div className="sa-stat-icon primary"><PackageOpen size={18} /></div>
          </div>
          <div className="sa-stat-value">{total}</div>
          <div className="sa-stat-footer"><span className="sa-stat-sub">Recorded stock changes</span></div>
        </div>
        <div className="sa-stat-card">
          <div className="sa-stat-header">
            <span className="sa-stat-label">Restocks (IN)</span>
            <div className="sa-stat-icon success"><TrendingUp size={18} /></div>
          </div>
          <div className="sa-stat-value">{movements.filter((m: StockMovement) => m.type === 'IN').length}</div>
          <div className="sa-stat-footer"><span className="sa-stat-sub">This page</span></div>
        </div>
        <div className="sa-stat-card">
          <div className="sa-stat-header">
            <span className="sa-stat-label">Deductions (OUT)</span>
            <div className="sa-stat-icon danger"><TrendingDown size={18} /></div>
          </div>
          <div className="sa-stat-value">{movements.filter((m: StockMovement) => m.type === 'OUT').length}</div>
          <div className="sa-stat-footer"><span className="sa-stat-sub">This page</span></div>
        </div>
      </div>

      <div className="sa-card">
        <div className="sa-card-header">
          <div className="sa-search-bar">
            <Search className="sa-search-icon" size={15} />
            <input className="sa-input" placeholder="Search by product name..." value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
        </div>
        <div className="sa-table-container">
          <table className="sa-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}></th>
                <th>Product</th>
                <th>SKU</th>
                <th>Movement</th>
                <th>Quantity</th>
                <th>Current Stock</th>
                <th>Notes</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} className="sa-text-center">Loading...</td></tr>
              ) : movements.length === 0 ? (
                <tr><td colSpan={8} className="sa-text-center sa-text-muted">No stock movements recorded yet.</td></tr>
              ) : movements.map((m: StockMovement) => {
                const typeInfo = MOVEMENT_TYPES.find(t => t.value === m.type);
                return (
                  <tr key={m.id}>
                    <td>{m.type === 'IN' ? <TrendingUp size={14} style={{ color: 'var(--success)' }} /> : m.type === 'OUT' ? <TrendingDown size={14} style={{ color: 'var(--danger)' }} /> : <RefreshCw size={14} style={{ color: 'var(--primary)' }} />}</td>
                    <td style={{ fontWeight: 500 }}>{m.product?.name ?? '—'}</td>
                    <td><code style={{ fontSize: 11, background: 'var(--bg-2)', padding: '2px 4px', borderRadius: 3 }}>{m.product?.sku ?? '—'}</code></td>
                    <td>
                      <span className="sa-badge" style={{ background: m.type === 'IN' ? 'rgba(var(--success-rgb), 0.12)' : m.type === 'OUT' ? 'rgba(var(--danger-rgb), 0.12)' : 'rgba(var(--primary-rgb), 0.12)' }}>
                        {m.type}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: m.type === 'IN' ? 'var(--success)' : m.type === 'OUT' ? 'var(--danger)' : 'var(--primary)' }}>
                        {m.type === 'OUT' ? '-' : '+'}{m.quantity}
                      </span>
                    </td>
                    <td>{m.product?.quantity ?? '—'}</td>
                    <td className="sa-text-muted">{m.notes || '—'}</td>
                    <td className="sa-text-muted" style={{ fontSize: 12 }}>{new Date(m.createdAt).toLocaleString()}</td>
                  </tr>
                );
              })}
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
          <div className="sa-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="sa-modal-header">
              <div className="sa-modal-title">Record Stock Movement</div>
              <button className="sa-modal-close" onClick={() => setShowModal(false)}><XCircle size={18} /></button>
            </div>
            <div className="sa-modal-body">
              {errorMsg && <div className="sa-mb-16"><Alert type="danger" title="Error" message={errorMsg} /></div>}
              <div className="sa-form-group">
                <label className="sa-label">Product *</label>
                <select className="sa-input" value={formData.productId} onChange={e => setFormData({ ...formData, productId: e.target.value })} required>
                  <option value="">Select Product...</option>
                  {products.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                  ))}
                </select>
              </div>
              <div className="sa-form-group">
                <label className="sa-label">Movement Type *</label>
                <select className="sa-input" value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value as StockMovement['type'] })}>
                  {MOVEMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="sa-form-group">
                <label className="sa-label">Quantity *</label>
                <input className="sa-input" type="number" min="1" value={formData.quantity ?? ''} onChange={e => setFormData({ ...formData, quantity: e.target.value })} placeholder="e.g. 50" required />
              </div>
              <div className="sa-form-group">
                <label className="sa-label">Notes</label>
                <textarea className="sa-input" rows={2} value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} placeholder="e.g. Received from supplier XYZ" />
              </div>
            </div>
            <div className="sa-modal-footer">
              <button className="sa-btn sa-btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="sa-btn sa-btn-primary" onClick={() => saveMutation.mutate(formData)}
                disabled={saveMutation.isPending || !formData.productId || !formData.quantity}>
                {saveMutation.isPending ? <span className="sa-spinner-sm sa-spinner" /> : <Save size={16} />}
                Record Movement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
