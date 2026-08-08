import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { ecommerceApi, type EcomOrder } from '../../api';
import { StatusBadge, Pagination, fmtCurrency, fmtDateTime } from '../../components/ui';
import { Search, Eye, XCircle, Save } from 'lucide-react';

export default function OrdersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [selectedOrder, setSelectedOrder] = useState<EcomOrder | null>(null);

  const [editStatus, setEditStatus] = useState('');
  const [editPaymentStatus, setEditPaymentStatus] = useState('');

  const params: Record<string, string> = { page: String(page), limit: '25' };
  if (search) params.search = search;

  const { data, isLoading } = useQuery({
    queryKey: ['sa-ecommerce-orders', page, search],
    queryFn: () => ecommerceApi.orders.list(params),
  });

  const { data: orderDetailsData, isLoading: detailsLoading } = useQuery({
    queryKey: ['sa-ecommerce-order', selectedOrder?.id],
    queryFn: () => ecommerceApi.orders.get(selectedOrder!.id),
    enabled: !!selectedOrder,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string, body: { status?: string; paymentStatus?: string } }) => ecommerceApi.orders.update(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sa-ecommerce-orders'] });
      qc.invalidateQueries({ queryKey: ['sa-ecommerce-order', selectedOrder?.id] });
      setSelectedOrder(null);
    }
  });

  const handleSearch = (val: string) => {
    setSearch(val);
    setPage(1);
    const p = new URLSearchParams(searchParams);
    if (val) p.set('search', val); else p.delete('search');
    setSearchParams(p, { replace: true });
  };

  const handleView = (order: EcomOrder) => {
    setSelectedOrder(order);
    setEditStatus(order.status);
    setEditPaymentStatus(order.paymentStatus);
  };

  const handleUpdate = () => {
    if (!selectedOrder) return;
    updateMutation.mutate({
      id: selectedOrder.id,
      body: { status: editStatus, paymentStatus: editPaymentStatus }
    });
  };

  const orders: EcomOrder[] = data?.data ?? [];
  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;
  const details = orderDetailsData?.data;

  return (
    <div>
      <div className="sa-page-header">
        <div className="sa-page-header-left">
          <h1>Orders</h1>
          <p>Manage customer orders and fulfillment.</p>
        </div>
      </div>

      <div className="sa-card">
        <div className="sa-card-header">
          <div className="sa-search-bar">
            <Search className="sa-search-icon" size={15} />
            <input
              className="sa-input"
              placeholder="Search by order # or customer..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="sa-table-container">
          <table className="sa-table">
            <thead>
              <tr>
                <th>Order Number</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Total</th>
                <th>Payment</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} className="sa-text-center">Loading orders...</td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan={8} className="sa-text-center sa-text-muted">No orders found.</td></tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id}>
                    <td style={{ fontWeight: 500 }}>{o.orderNumber}</td>
                    <td>{fmtDateTime(o.createdAt)}</td>
                    <td>
                      <div>{o.customerName}</div>
                      <div className="sa-text-muted" style={{ fontSize: 12 }}>{o.customerEmail}</div>
                    </td>
                    <td>{o._count?.items ?? 0}</td>
                    <td style={{ fontWeight: 500 }}>{fmtCurrency(Number(o.totalAmount))}</td>
                    <td><StatusBadge status={o.paymentStatus} /></td>
                    <td><StatusBadge status={o.status} /></td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="sa-btn sa-btn-icon" onClick={() => handleView(o)} title="View details">
                        <Eye size={15} />
                      </button>
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

      {selectedOrder && (
        <div className="sa-modal-overlay" onClick={() => setSelectedOrder(null)}>
          <div className="sa-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 700 }}>
            <div className="sa-modal-header">
              <div className="sa-modal-title">Order {selectedOrder.orderNumber}</div>
              <button className="sa-modal-close" onClick={() => setSelectedOrder(null)}><XCircle size={18} /></button>
            </div>
            
            <div className="sa-modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              {detailsLoading ? (
                <div className="sa-text-center sa-p-24">Loading order details...</div>
              ) : details ? (
                <div className="sa-grid-2" style={{ gap: 24 }}>
                  <div>
                    <h4 style={{ marginBottom: 12, borderBottom: '1px solid var(--border-color)', paddingBottom: 8 }}>Customer Details</h4>
                    <p style={{ margin: '4px 0' }}><strong>Name:</strong> {details.customerName}</p>
                    <p style={{ margin: '4px 0' }}><strong>Email:</strong> {details.customerEmail || '—'}</p>
                    <p style={{ margin: '4px 0' }}><strong>Phone:</strong> {(details as any).customerPhone || '—'}</p>
                    
                    <h4 style={{ margin: '24px 0 12px', borderBottom: '1px solid var(--border-color)', paddingBottom: 8 }}>Fulfillment</h4>
                    <div className="sa-form-group">
                      <label className="sa-label">Order Status</label>
                      <select className="sa-input" value={editStatus} onChange={e => setEditStatus(e.target.value)}>
                        <option value="PENDING">Pending</option>
                        <option value="CONFIRMED">Confirmed</option>
                        <option value="PROCESSING">Processing</option>
                        <option value="SHIPPED">Shipped</option>
                        <option value="DELIVERED">Delivered</option>
                        <option value="CANCELLED">Cancelled</option>
                        <option value="REFUNDED">Refunded</option>
                      </select>
                    </div>
                    <div className="sa-form-group">
                      <label className="sa-label">Payment Status</label>
                      <select className="sa-input" value={editPaymentStatus} onChange={e => setEditPaymentStatus(e.target.value)}>
                        <option value="PENDING">Pending</option>
                        <option value="COMPLETED">Completed</option>
                        <option value="FAILED">Failed</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <h4 style={{ marginBottom: 12, borderBottom: '1px solid var(--border-color)', paddingBottom: 8 }}>Order Items</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {(details as any).items?.map((item: any) => (
                        <div key={item.id} style={{ display: 'flex', gap: 12, border: '1px solid var(--border-color)', padding: 12, borderRadius: 6 }}>
                          {item.product?.images?.[0] ? (
                            <img src={item.product.images[0].url} alt="" style={{ width: 50, height: 50, borderRadius: 4, objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: 50, height: 50, borderRadius: 4, background: 'var(--bg-muted)' }} />
                          )}
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 500 }}>{item.product?.name || 'Unknown Product'}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.quantity} x {fmtCurrency(Number(item.unitPrice))}</div>
                            <div style={{ fontWeight: 600, marginTop: 4 }}>{fmtCurrency(Number(item.total))}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 600 }}>
                      <span>Total:</span>
                      <span>{fmtCurrency(Number(details.totalAmount))}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="sa-text-center sa-p-24 sa-text-danger">Failed to load order details.</div>
              )}
            </div>

            <div className="sa-modal-footer">
              <button className="sa-btn sa-btn-ghost" onClick={() => setSelectedOrder(null)}>Cancel</button>
              <button 
                className="sa-btn sa-btn-primary" 
                onClick={handleUpdate} 
                disabled={updateMutation.isPending || (!details) || (editStatus === details.status && editPaymentStatus === details.paymentStatus)}
              >
                {updateMutation.isPending ? <span className="sa-spinner-sm sa-spinner" /> : <Save size={16} />}
                Update Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
