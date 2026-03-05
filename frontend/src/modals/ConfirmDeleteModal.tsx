import CloseIcon from '@mui/icons-material/Close';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import DeleteIcon from '@mui/icons-material/Delete';

interface ConfirmDeleteModalProps {
    title?: string;
    message?: string;
    confirmLabel?: string;
    onClose: () => void;
    onConfirm: () => void;
}

export default function ConfirmDeleteModal({
    title = 'Confirm Delete',
    message = 'Are you sure you want to delete this item? This action cannot be undone.',
    confirmLabel = 'Delete',
    onClose,
    onConfirm,
}: ConfirmDeleteModalProps) {
    const handleConfirm = () => {
        onConfirm();
        onClose();
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-header-left">
                        <div className="modal-header-icon" style={{ background: 'var(--danger-light)', color: 'var(--danger)' }}>
                            <WarningAmberIcon fontSize="small" />
                        </div>
                        <div>
                            <div className="modal-title">{title}</div>
                        </div>
                    </div>
                    <button className="modal-close" onClick={onClose}><CloseIcon fontSize="small" /></button>
                </div>

                <div className="modal-body">
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
                        {message}
                    </p>
                </div>

                <div className="modal-footer">
                    <div className="modal-footer-left" />
                    <div className="modal-footer-right">
                        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleConfirm}>
                            <DeleteIcon fontSize="small" /> {confirmLabel}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
