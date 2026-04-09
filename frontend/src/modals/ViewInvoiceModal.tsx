import ReceiptIcon from '@mui/icons-material/Receipt';
import CloseIcon from '@mui/icons-material/Close';
import PrintIcon from '@mui/icons-material/Print';
import type { Invoice } from '../types';
import { formatDate } from '../utils/formatters';

interface ViewInvoiceModalProps {
    invoice: Invoice;
    onClose: () => void;
}

export default function ViewInvoiceModal({ invoice, onClose }: ViewInvoiceModalProps) {
    const handlePrint = () => {
        const printContent = `
            <html><head><title>Invoice ${invoice.invoiceNumber}</title>
            <style>
                body { font-family: 'Segoe UI', sans-serif; padding: 40px; color: #333; }
                h1 { font-size: 1.8rem; margin-bottom: 4px; }
                .inv-header { display: flex; justify-content: space-between; margin-bottom: 30px; }
                .badge { padding: 4px 12px; border-radius: 12px; font-size: 0.8rem; font-weight: 600; }
                .badge.paid { background: #e8f5e9; color: #2e7d32; }
                .badge.unpaid { background: #fff3e0; color: #e65100; }
                .badge.overdue { background: #ffebee; color: #c62828; }
                .badge.draft { background: #f5f5f5; color: #757575; }
                table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #e0e0e0; }
                th { background: #f5f5f5; font-weight: 600; font-size: 0.85rem; }
                .total-row { font-weight: 700; font-size: 1.1rem; }
                .meta { font-size: 0.85rem; color: #666; }
            </style></head><body>
            <div class="inv-header">
                <div>
                    <h1>Invoice ${invoice.invoiceNumber}</h1>
                    <p class="meta">Client: <strong>${invoice.client}</strong></p>
                </div>
                <div style="text-align: right;">
                    <span class="badge ${invoice.status.toLowerCase()}">${invoice.status}</span>
                    <p class="meta" style="margin-top: 8px">Issued: ${formatDate(invoice.issuedDate)}<br/>Due: ${formatDate(invoice.dueDate)}</p>
                </div>
            </div>
            <table>
                <thead><tr><th>Description</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead>
                <tbody>
                    ${(invoice.items || []).map(item =>
                        `<tr><td>${item.description}</td><td>${item.quantity}</td><td>${item.unitPrice.toLocaleString()} TZS</td><td>${item.total.toLocaleString()} TZS</td></tr>`
                    ).join('')}
                    <tr class="total-row"><td colspan="3" style="text-align: right">Total</td><td>${invoice.amount.toLocaleString()} TZS</td></tr>
                </tbody>
            </table>
            </body></html>
        `;
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(printContent);
            printWindow.document.close();
            printWindow.print();
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-header-left">
                        <div className="modal-header-icon" style={{ background: 'var(--info-light)', color: 'var(--info)' }}>
                            <ReceiptIcon fontSize="small" />
                        </div>
                        <div>
                            <div className="modal-title">Invoice {invoice.invoiceNumber}</div>
                            <div className="modal-subtitle">{invoice.client}</div>
                        </div>
                    </div>
                    <button className="modal-close" onClick={onClose}><CloseIcon fontSize="small" /></button>
                </div>

                <div className="modal-body">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
                        <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Status</div>
                            <span className={`badge ${invoice.status === 'Paid' ? 'active' : invoice.status === 'Overdue' ? 'expired' : 'inactive'}`}>
                                {invoice.status}
                            </span>
                        </div>
                        <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Issued Date</div>
                            <div style={{ fontWeight: 500, marginTop: 4 }}>{formatDate(invoice.issuedDate)}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Due Date</div>
                            <div style={{ fontWeight: 500, marginTop: 4, color: invoice.status === 'Overdue' ? 'var(--danger)' : 'inherit' }}>{formatDate(invoice.dueDate)}</div>
                        </div>
                    </div>

                    <div className="table-container" style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius)' }}>
                        <table className="data-table" style={{ marginBottom: 0 }}>
                            <thead>
                                <tr>
                                    <th>Description</th>
                                    <th>Qty</th>
                                    <th>Unit Price</th>
                                    <th>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(invoice.items || []).length === 0 ? (
                                    <tr>
                                        <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem' }}>
                                            No line items
                                        </td>
                                    </tr>
                                ) : (
                                    invoice.items.map((item, i) => (
                                        <tr key={i}>
                                            <td style={{ fontWeight: 500 }}>{item.description}</td>
                                            <td>{item.quantity}</td>
                                            <td>{item.unitPrice.toLocaleString()} TZS</td>
                                            <td style={{ fontWeight: 600 }}>{item.total.toLocaleString()} TZS</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div style={{ textAlign: 'right', padding: '16px 0', fontWeight: 700, fontSize: '1.2rem' }}>
                        Total: {invoice.amount.toLocaleString()} TZS
                    </div>
                </div>

                <div className="modal-footer">
                    <div className="modal-footer-left" />
                    <div className="modal-footer-right">
                        <button className="btn btn-secondary" onClick={handlePrint}>
                            <PrintIcon fontSize="small" /> Print
                        </button>
                        <button className="btn btn-primary" onClick={onClose}>Close</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
