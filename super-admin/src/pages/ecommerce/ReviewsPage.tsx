import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ecommerceApi } from '../../api';
import { StatusBadge, Pagination, ConfirmModal, fmtDateTime } from '../../components/ui';
import { Search, CheckCircle, XCircle, Trash2 } from 'lucide-react';

export default function ReviewsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<{ id: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['sa-ecommerce-reviews', page, search],
    queryFn: () => ecommerceApi.reviews.list({ page: String(page), limit: '25', search }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, isApproved }: { id: string; isApproved: boolean }) => ecommerceApi.reviews.update(id, { isApproved }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sa-ecommerce-reviews'] })
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ecommerceApi.reviews.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sa-ecommerce-reviews'] });
      setConfirmDelete(null);
    }
  });

  const reviews = data?.data ?? [];
  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;

  return (
    <div>
      <div className="sa-page-header">
        <div className="sa-page-header-left">
          <h1>Product Reviews</h1>
          <p>Moderate customer reviews and feedback.</p>
        </div>
      </div>

      <div className="sa-card">
        <div className="sa-card-header">
          <div className="sa-search-bar">
            <Search className="sa-search-icon" size={15} />
            <input
              className="sa-input"
              placeholder="Search author or comment..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
        </div>
        <div className="sa-table-container">
          <table className="sa-table">
            <thead>
              <tr>
                <th>Author</th>
                <th>Product</th>
                <th>Rating</th>
                <th>Comment</th>
                <th>Status</th>
                <th>Date</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="sa-text-center">Loading...</td></tr>
              ) : reviews.length === 0 ? (
                <tr><td colSpan={7} className="sa-text-center sa-text-muted">No reviews found.</td></tr>
              ) : (
                reviews.map((r: any) => (
                  <tr key={r.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{r.authorName}</div>
                      <div className="sa-text-muted" style={{ fontSize: 12 }}>{r.email || '—'}</div>
                    </td>
                    <td>{r.product?.name}</td>
                    <td>{r.rating} / 5</td>
                    <td style={{ maxWidth: 300, whiteSpace: 'normal' }}>
                      <div style={{ fontWeight: 500 }}>{r.title}</div>
                      <div className="sa-text-muted" style={{ fontSize: 12 }}>{r.comment}</div>
                    </td>
                    <td>
                      {r.isApproved ? <StatusBadge status="ACTIVE" /> : <StatusBadge status="PENDING_APPROVAL" />}
                    </td>
                    <td>{fmtDateTime(r.createdAt)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="sa-actions">
                        <button 
                          className="sa-btn sa-btn-icon" 
                          onClick={() => updateMutation.mutate({ id: r.id, isApproved: !r.isApproved })} 
                          title={r.isApproved ? "Unapprove" : "Approve"}
                        >
                          {r.isApproved ? <XCircle size={15} color="var(--warning)" /> : <CheckCircle size={15} color="var(--success)" />}
                        </button>
                        <button className="sa-btn sa-btn-icon" style={{ color: 'var(--danger)' }} onClick={() => setConfirmDelete({ id: r.id })} title="Delete">
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
          title="Delete Review"
          message="Are you sure you want to delete this review permanently?"
          onConfirm={() => deleteMutation.mutate(confirmDelete.id)}
          onCancel={() => setConfirmDelete(null)}
          loading={deleteMutation.isPending}
        />
      )}
    </div>
  );
}
