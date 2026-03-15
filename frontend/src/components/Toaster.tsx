"use client";

import { useState, useEffect, useCallback } from "react";
import { CheckCircle, AlertTriangle, Info, X } from "lucide-react";
import { FOUNDRY } from "@/lib/theme";

type ToastType = "success" | "warning" | "error" | "info";

interface Toast {
  id: string;
  message: string;
  sub?: string;
  type: ToastType;
}

// Global singleton for imperative usage
let _addToast: ((t: Omit<Toast, "id">) => void) | null = null;

export function toast(
  message: string,
  options: { sub?: string; type?: ToastType } = {}
) {
  _addToast?.({ message, sub: options.sub, type: options.type ?? "info" });
}

const TYPE_CONFIG: Record<ToastType, { icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>; color: string }> = {
  success: { icon: CheckCircle,    color: FOUNDRY.success },
  warning: { icon: AlertTriangle,  color: FOUNDRY.warning },
  error:   { icon: AlertTriangle,  color: FOUNDRY.danger  },
  info:    { icon: Info,           color: FOUNDRY.primary },
};

export default function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((t: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { ...t, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, 3000);
  }, []);

  useEffect(() => {
    _addToast = addToast;
    return () => { _addToast = null; };
  }, [addToast]);

  function dismiss(id: string) {
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }

  return (
    <>
      <style>{`
        @keyframes toastIn {
          from { transform: translateX(20px); opacity: 0; }
          to   { transform: none; opacity: 1; }
        }
      `}</style>
      <div
        aria-live="polite"
        aria-label="알림"
        style={{
          position: "fixed",
          top: 56,
          right: 16,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          zIndex: 300,
          pointerEvents: "none",
        }}
      >
        {toasts.map((t) => {
          const { icon: Icon, color } = TYPE_CONFIG[t.type];
          return (
            <div
              key={t.id}
              role="alert"
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: "12px 14px",
                width: 300,
                background: FOUNDRY.panel,
                border: `1px solid ${FOUNDRY.border}`,
                borderLeft: `3px solid ${color}`,
                borderRadius: 8,
                boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
                animation: "toastIn 200ms ease",
                pointerEvents: "all",
              }}
            >
              <Icon size={15} style={{ color, flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 12, color: FOUNDRY.text, fontWeight: 600 }}>{t.message}</p>
                {t.sub && (
                  <p style={{ margin: "2px 0 0", fontSize: 11, color: FOUNDRY.muted }}>{t.sub}</p>
                )}
              </div>
              <button
                onClick={() => dismiss(t.id)}
                aria-label="알림 닫기"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: FOUNDRY.muted,
                  padding: 0,
                  lineHeight: 1,
                  flexShrink: 0,
                }}
              >
                <X size={13} />
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
