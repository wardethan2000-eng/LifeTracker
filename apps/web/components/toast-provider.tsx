"use client";

import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

type ToastTone = "info" | "success" | "danger";

type ToastOptions = {
  message: string;
  duration?: number;
  tone?: ToastTone;
  actionLabel?: string;
  onAction?: () => void;
  onExpire?: () => void | Promise<void>;
};

type ToastRecord = ToastOptions & {
  id: string;
};

type ToastContextValue = {
  pushToast: (options: ToastOptions) => string;
  dismissToast: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

type ToastProviderProps = {
  children: ReactNode;
};

export function ToastProvider({ children }: ToastProviderProps): ReactNode {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const timersRef = useRef<Map<string, number>>(new Map());
  const toastMapRef = useRef<Map<string, ToastRecord>>(new Map());

  const dismissToast = useCallback((id: string, finalize = true): void => {
    const timer = timersRef.current.get(id);
    const toast = toastMapRef.current.get(id);

    if (timer) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }

    toastMapRef.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));

    if (finalize) {
      void Promise.resolve(toast?.onExpire?.()).catch((error) => {
        console.error("[toast-provider] Toast expiry action failed", error);
      });
    }
  }, []);

  const pushToast = useCallback((options: ToastOptions): string => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const duration = options.duration ?? (options.tone === "danger" ? 8000 : 4000);
    const toast: ToastRecord = {
      id,
      tone: options.tone ?? "info",
      duration,
      ...options
    };

    setToasts((current) => [toast, ...current]);
    toastMapRef.current.set(id, toast);

    const timer = window.setTimeout(async () => {
      timersRef.current.delete(id);
      toastMapRef.current.delete(id);
      setToasts((current) => current.filter((item) => item.id !== id));

      try {
        await toast.onExpire?.();
      } catch (error) {
        console.error("[toast-provider] Toast expiry action failed", error);
      }
    }, duration);

    timersRef.current.set(id, timer);
    return id;
  }, []);

  const value = useMemo<ToastContextValue>(() => ({ pushToast, dismissToast }), [dismissToast, pushToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast--${toast.tone}`} role="status">
            <p className="toast__message">{toast.message}</p>
            <div className="toast__actions">
              {toast.actionLabel && toast.onAction ? (
                <button
                  type="button"
                  className="button button--ghost button--sm"
                  onClick={() => {
                    toast.onAction?.();
                    dismissToast(toast.id, false);
                  }}
                >
                  {toast.actionLabel}
                </button>
              ) : null}
              <button type="button" className="toast__dismiss" aria-label="Dismiss notification" onClick={() => dismissToast(toast.id)}>
                Dismiss
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used within ToastProvider.");
  }

  return context;
}