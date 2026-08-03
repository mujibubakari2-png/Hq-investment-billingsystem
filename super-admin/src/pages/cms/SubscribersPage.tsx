import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cmsApi } from '../../api';
import { StatusBadge, Pagination, fmtDateTime } from '../../components/ui';
import { Search, Download } from 'lucide-react';

export default function SubscribersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['sa-cms-subscribers', page, search],
    queryFn: () => cmsApi.subscribers.list({ page: String(page), limit: '50', search }),
  });

  const subscribers = data?.data ?? [];
  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;

  const exportCsv = () => {
    if (!subscribers.length) return;
    const csvContent = "data:text/csv;charset=utf-8," 
      + "Email,Status,Subscribed At\n"
      + subscribers.map((s: any) => `${s.email},${s.isActive ? 'Active' : 'Inactive'},${s.subscribedAt}`).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "newsletter_subscribers.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div>
      <div className="sa-page-header">
        <div className="sa-page-header-left">
          <h1>Newsletter Subscribers</h1>
          <p>View customers who opted in to marketing emails.</p>
        </div>
        <button className="sa-btn sa-btn-outline" onClick={exportCsv} disabled={subscribers.length === 0}>
          <Download size={16} /> Export CSV (Current Page)
        </button>
      </div>

      <div className="sa-card">
        <div className="sa-card-header">
          <div className="sa-search-bar">
            <Search className="sa-search-icon" size={15} />
            <input
              className="sa-input"
              placeholder="Search email..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
        </div>
        <div className="sa-table-container">
          <table className="sa-table">
            <thead>
              <tr>
                <th>Email Address</th>
                <th>Status</th>
                <th>Subscribed At</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={3} className="sa-text-center">Loading...</td></tr>
              ) : subscribers.length === 0 ? (
                <tr><td colSpan={3} className="sa-text-center sa-text-muted">No subscribers found.</td></tr>
              ) : (
                subscribers.map((s: any) => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 500 }}>{s.email}</td>
                    <td>
                      {s.isActive ? <StatusBadge status="ACTIVE" /> : <StatusBadge status="INACTIVE" />}
                    </td>
                    <td>{fmtDateTime(s.subscribedAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className="sa-card-footer">
            <Pagination page={page} pages={pages} total={total} limit={50} onPage={setPage} />
          </div>
        )}
      </div>
    </div>
  );
}
