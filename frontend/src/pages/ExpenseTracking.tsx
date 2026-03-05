import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

const expenses = [
    { id: '1', description: 'Router Maintenance', category: 'Maintenance', amount: 50000, date: 'Feb 20, 2026', status: 'Approved' },
    { id: '2', description: 'Fiber Cable Purchase', category: 'Equipment', amount: 150000, date: 'Feb 18, 2026', status: 'Approved' },
    { id: '3', description: 'Office Rent', category: 'Operations', amount: 300000, date: 'Feb 15, 2026', status: 'Pending' },
];

export default function ExpenseTracking() {
    return (
        <div>
            <div className="page-header">
                <div className="page-header-left">
                    <div className="page-header-icon" style={{ background: 'var(--warning-light)', color: 'var(--warning)' }}>
                        <AccountBalanceWalletIcon />
                    </div>
                    <div>
                        <h1 className="page-title">Expense Tracking</h1>
                        <p className="page-subtitle">Track and manage business expenses</p>
                    </div>
                </div>
                <div className="page-header-right">
                    <button className="btn btn-primary"><AddIcon fontSize="small" /> Add Expense</button>
                </div>
            </div>

            <div className="stat-cards" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                <div className="stat-card blue">
                    <div className="stat-card-label">Total Expenses</div>
                    <div className="stat-card-value">500,000</div>
                </div>
                <div className="stat-card green">
                    <div className="stat-card-label">This Month</div>
                    <div className="stat-card-value">200,000</div>
                </div>
                <div className="stat-card orange">
                    <div className="stat-card-label">Pending</div>
                    <div className="stat-card-value">300,000</div>
                </div>
            </div>

            <div className="card">
                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Description</th>
                                <th>Category</th>
                                <th>Amount (TZS)</th>
                                <th>Date</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {expenses.map((exp) => (
                                <tr key={exp.id}>
                                    <td style={{ fontWeight: 500 }}>{exp.description}</td>
                                    <td><span className="badge active">{exp.category}</span></td>
                                    <td>{exp.amount.toLocaleString()}</td>
                                    <td>{exp.date}</td>
                                    <td><span className={`badge ${exp.status.toLowerCase() === 'approved' ? 'active' : 'pending'}`}>{exp.status}</span></td>
                                    <td>
                                        <div className="table-actions">
                                            <button className="btn-icon edit"><EditIcon style={{ fontSize: 16 }} /></button>
                                            <button className="btn-icon delete"><DeleteIcon style={{ fontSize: 16 }} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
