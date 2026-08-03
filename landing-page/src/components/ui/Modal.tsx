"use client";
import { useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  className?: string;
}

const sizeMap = {
  sm: "max-w-[min(92vw,24rem)]",
  md: "max-w-[min(92vw,36rem)]",
  lg: "max-w-[min(92vw,42rem)]",
  xl: "max-w-[min(92vw,56rem)]",
  full: "max-w-[min(96vw,96vw)]",
};

export default function Modal({
  isOpen,
  onClose,
  children,
  title,
  size = "md",
  className,
}: ModalProps) {
  const handleKey = useCallback(
    (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKey);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleKey]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="modal-backdrop"
            onClick={onClose}
            aria-hidden="true"
          />
          {/* Modal Box */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ duration: 0.25, ease: [0.34, 1.56, 0.64, 1] }}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={cn(
              "fixed inset-0 z-[1001] flex items-center justify-center p-2 sm:p-4 pointer-events-none"
            )}
          >
            <div
              className={cn(
                "modal-box pointer-events-auto w-full max-h-[90dvh] overflow-y-auto rounded-2xl bg-white shadow-2xl",
                sizeMap[size],
                className
              )}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              {title && (
                <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-100">
                  <h2 className="text-lg font-bold text-slate-900">{title}</h2>
                  <button
                    onClick={onClose}
                    className="p-2 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-all"
                    aria-label="Close modal"
                  >
                    <X size={20} />
                  </button>
                </div>
              )}
              {/* Close button when no title */}
              {!title && (
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/80 backdrop-blur-sm shadow-md hover:bg-white text-slate-600 hover:text-slate-900 transition-all"
                  aria-label="Close modal"
                >
                  <X size={20} />
                </button>
              )}
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
