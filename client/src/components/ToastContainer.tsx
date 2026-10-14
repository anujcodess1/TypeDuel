import React from 'react';
import { useToastStore } from '@/store/toast';
import { X } from 'lucide-react';

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const remove = useToastStore((s) => s.remove);

  return (
    <div className="toast-container" role="region" aria-label="Notifications" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast ${toast.type} flex items-start justify-between gap-3`}>
          <span>{toast.message}</span>
          <button
            onClick={() => remove(toast.id)}
            className="flex-shrink-0 text-[var(--muted)] hover:text-[var(--text)] transition-colors"
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
