import { useState, useEffect } from 'react';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { expensesApi } from '../api/client';
import type { Expense } from '../types';
import AddExpenseModal from '../modals/AddExpenseModal';
import EditExpenseModal from '../modals/EditExpenseModal';
import ConfirmDeleteModal from '../modals/ConfirmDeleteModal';
import { formatDate } from '../utils/formatters';

export default function ExpenseTracking() {
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editExpense, setEditExpense] = useState<Expense | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);

    const fetchExpenses = async () => {
        setLoading(true);
        try {
            const data = await expensesApi.list();
            setExpenses(data as unknown as Expense[]);
        } catch (err) {
            console.error('Failed to load expenses:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchExpenses();
    }, []);

    const handleAddExpense = async (data: object) => {
        try {
            await expensesApi.create(data as Record<string, unknown>);
            setShowAddModal(false);
            fetchExpenses();
        } catch (err) {
            console.error('Failed to add expense:', err);
            alert('Failed to add expense.');
        }
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        try {
            await expensesApi.delete(deleteId);
            setDeleteId(null);
            fetchExpenses();
        } catch (err) {
            console.error('Failed to delete expense:', err);
            alert('Failed to delete expense.');
        }
    };

    const handleEditExpense = async (updated: Expense) => {
        try {
            await expensesApi.update(updated.id, updated as unknown as Record<string, unknown>);
            setEditExpense(null);
            fetchExpenses();
        } catch (err) {
            console.error('Failed to update expense:', err);
            alert('Failed to update expense.');
        }
    };

    const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const pendingAmount = expenses.reduce((sum, exp) => sum + (exp.status?.toLowerCase() === 'pending' ? exp.amount : 0), 0);
    const thisMonthAmount = totalExpenses;

    return (
        <div>
            {showAddModal && <AddExpenseModal onClose={() => setShowAddModal(false)} onSave={handleAddExpense} />}
            {editExpense && (
                <EditExpenseModal
                    expense={editExpense}
                    onClose={() => setEditExpense(null)}
                    onSave={handleEditExpense}
                />
            )}
            {deleteId && (
                <ConfirmDeleteModal
                    title="Delete Expense"
                    message="Are you sure you want to delete this expense record? This action cannot be undone."
                    onClose={() => setDeleteId(null)}
                    onConfirm={handleDelete}
                />
            )}

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
                    <button className="btn btn-primary" onClick={() => setShowAddModal(true)}><AddIcon fontSize="small" /> Add Expense</button>
                </div>
            </div>

            <div className="stat-cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                <div className="stat-card blue">
                    <div className="stat-card-label">Total Expenses</div>
                    <div className="stat-card-value">{totalExpenses.toLocaleString()}</div>
                </div>
                <div className="stat-card green">
                    <div className="stat-card-label">This Month</div>
                    <div className="stat-card-value">{thisMonthAmount.toLocaleString()}</div>
                </div>
                <div className="stat-card orange">
                    <div className="stat-card-label">Pending</div>
                    <div className="stat-card-value">{pendingAmount.toLocaleString()}</div>
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
                            {loading ? (
                                <tr>
                                    <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                                        Loading expenses...
                                    </td>
                                </tr>
                            ) : expenses.length === 0 ? (
                                <tr>
                                    <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                                        No expenses found.
                                    </td>
                                </tr>
                            ) : (
                                expenses.map((exp) => (
                                    <tr key={exp.id}>
                                        <td style={{ fontWeight: 500 }}>{exp.description}</td>
                                        <td><span className="badge active">{exp.category}</span></td>
                                        <td>{exp.amount.toLocaleString()}</td>
                                        <td>{formatDate(exp.date)}</td>
                                        <td><span className={`badge ${(exp.status || 'approved').toLowerCase() === 'approved' ? 'active' : 'pending'}`}>{exp.status || 'Approved'}</span></td>
                                        <td>
                                            <div className="table-actions">
                                                <button className="btn-icon edit" title="Edit" onClick={() => setEditExpense(exp)}><EditIcon style={{ fontSize: 16 }} /></button>
                                                <button className="btn-icon delete" title="Delete" onClick={() => setDeleteId(exp.id)}><DeleteIcon style={{ fontSize: 16 }} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
