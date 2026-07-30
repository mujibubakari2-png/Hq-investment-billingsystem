import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { usePopupStore, type PopupType } from '../../stores/popupStore';
import { CheckCircle2, XCircle, Loader2, AlertTriangle, Info, X } from 'lucide-react';
import './GlobalPopup.css';

const IconMap: Record<PopupType, React.ElementType> = {
  loading: Loader2,
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const getButtonClass = (type: PopupType) => {
  switch (type) {
    case 'success':
      return 'global-popup-btn-success';
    case 'error':
      return 'global-popup-btn-error';
    case 'warning':
      return 'global-popup-btn-warning';
    case 'info':
      return 'global-popup-btn-info';
    default:
      return 'global-popup-btn-primary';
  }
};

export const GlobalPopup: React.FC = () => {
  const { isOpen, type, title, message, action, onClose, isClosable, close } = usePopupStore();

  const handleClose = () => {
    if (isClosable) {
      onClose?.();
      close();
    }
  };

  // Keyboard accessibility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isClosable) {
        handleClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isClosable]);

  const Icon = IconMap[type];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="global-popup-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <motion.div
            className="global-popup-content"
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="global-popup-title"
            aria-describedby="global-popup-desc"
          >
            {isClosable && (
              <button
                className="global-popup-close-btn"
                onClick={handleClose}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            )}

            <div className="global-popup-icon-container">
              <AnimatePresence mode="wait">
                <motion.div
                  key={type}
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  exit={{ scale: 0, rotate: 180 }}
                  transition={{ type: 'spring', damping: 20, stiffness: 200, duration: 0.4 }}
                >
                  <Icon
                    className={`global-popup-icon ${type} ${type === 'loading' ? 'lucide-spin' : ''}`}
                    style={type === 'loading' ? { animation: 'spin 1s linear infinite' } : {}}
                  />
                  {type === 'loading' && (
                    <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            <motion.h2
              key={`title-${title}`}
              id="global-popup-title"
              className="global-popup-title"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {title}
            </motion.h2>

            <motion.div
              key={`message-${typeof message === 'string' ? message : 'custom'}`}
              id="global-popup-desc"
              className="global-popup-message"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              {message}
            </motion.div>

            {type !== 'loading' && (
              <motion.div
                className="global-popup-actions"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                {isClosable && (
                  <button className="global-popup-btn global-popup-btn-secondary" onClick={handleClose}>
                    Close
                  </button>
                )}
                {action && (
                  <button
                    className={`global-popup-btn ${getButtonClass(type)}`}
                    onClick={() => {
                      action.onAction();
                      // We don't automatically close on action to allow the caller to transition to loading
                    }}
                  >
                    {action.text}
                  </button>
                )}
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
