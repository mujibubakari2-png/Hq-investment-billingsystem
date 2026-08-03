import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ecommerceApi, type Product } from '../../api';
import { StatusBadge, Pagination, ConfirmModal, fmtCurrency, fmtDate } from '../../components/ui';
import { Search, Plus, Edit, Trash2 } from 'lucide-react';

export default function ProductsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState(searchParams.get('search') || '');

  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);

  const params: Record<string, string> = { page: String(page), limit: '25' };
  if (search) params.search = search;

  const { data, isLoading } = useQuery({
    queryKey: ['sa-ecommerce-products', page, search],
    queryFn: () => ecommerceApi.products.list(params),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ecommerceApi.products.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sa-ecommerce-products'] });
      setConfirmDelete(null);
    },
  });

  const handleSearch = (val: string) => {
    setSearch(val);
    setPage(1);
    const p = new URLSearchParams(searchParams);
    if (val) p.set('search', val); else p.delete('search');
    setSearchParams(p, { replace: true });
  };

  const products: Product[] = data?.data ?? [];
  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;

  return (
    <div>
      <div className="sa-page-header">
        <div className="sa-page-header-left">
          <h1>Products</h1>
          <p>Manage e-commerce products for the storefront.</p>
        </div>
        <button className="sa-btn sa-btn-primary" onClick={() => navigate('/ecommerce/products/new')}>
          <Plus size={16} /> Add Product
        </button>
      </div>

      <div className="sa-card">
        <div className="sa-card-header">
          <div className="sa-search-bar">
            <Search className="sa-search-icon" size={15} />
            <input
              className="sa-input"
              placeholder="Search by name or SKU..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="sa-table-container">
          <table className="sa-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th>Category</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Status</th>
                <th>Added</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} className="sa-text-center">Loading products...</td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan={8} className="sa-text-center sa-text-muted">No products found.</td></tr>
              ) : (
                products.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {p.images?.[0] ? (
                          <img src={p.images[0].url} alt={p.name} style={{ width: 40, height: 40, borderRadius: 4, objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: 40, height: 40, borderRadius: 4, background: 'var(--bg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>No Img</div>
                        )}
                        <span style={{ fontWeight: 500 }}>{p.name}</span>
                      </div>
                    </td>
                    <td><span className="sa-text-muted">{p.sku || '—'}</span></td>
                    <td>{p.category?.name || '—'}</td>
                    <td>{fmtCurrency(Number(p.price), p.currency)}</td>
                    <td>{p.quantity}</td>
                    <td><StatusBadge status={p.status} /></td>
                    <td>{fmtDate(p.createdAt)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="sa-actions">
                        <button className="sa-btn sa-btn-icon" onClick={() => navigate(`/ecommerce/products/${p.id}`)} title="Edit">
                          <Edit size={15} />
                        </button>
                        <button className="sa-btn sa-btn-icon" style={{ color: 'var(--danger)' }} onClick={() => setConfirmDelete({ id: p.id, name: p.name })} title="Delete">
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

      {confirmDelete && (
        <ConfirmModal
          danger
          title="Delete Product"
          message={
            <>
              Are you sure you want to delete the product <strong>{confirmDelete.name}</strong>?
              This action cannot be undone unless it has existing orders, in which case it will be archived.
            </>
          }
          onConfirm={() => deleteMutation.mutate(confirmDelete.id)}
          onCancel={() => setConfirmDelete(null)}
          loading={deleteMutation.isPending}
        />
      )}
    </div>
  );
}
