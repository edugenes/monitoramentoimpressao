'use client';

import { useEffect, useState } from 'react';
import { Alert } from '@/lib/types';
import { useAlertsContext } from '@/contexts/AlertsContext';
import { AlertTriangle, AlertOctagon, X } from 'lucide-react';

interface ToastItem {
  alert: Alert;
  id: string;
}

export default function AlertToaster() {
  const { newAlerts, consumeNewAlerts } = useAlertsContext();
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    if (newAlerts.length === 0) return;
    const added: ToastItem[] = newAlerts.map(a => ({
      alert: a,
      id: `${a.id}-${Date.now()}-${Math.random()}`,
    }));
    setToasts(prev => [...added, ...prev].slice(0, 5));
    consumeNewAlerts();

    added.forEach(t => {
      const duration = t.alert.severity === 'critical' ? 15000 : 8000;
      setTimeout(() => {
        setToasts(prev => prev.filter(x => x.id !== t.id));
      }, duration);
    });
  }, [newAlerts, consumeNewAlerts]);

  function dismiss(id: string) {
    setToasts(prev => prev.filter(x => x.id !== id));
  }

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map(t => {
        const critical = t.alert.severity === 'critical';
        return (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-lg shadow-lg border-l-4 p-4 bg-white animate-slide-in-right ${
              critical ? 'border-red-500' : 'border-amber-500'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`flex-shrink-0 ${critical ? 'text-red-500' : 'text-amber-500'}`}>
                {critical ? <AlertOctagon className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-xs font-semibold uppercase tracking-wide ${
                  critical ? 'text-red-600' : 'text-amber-600'
                }`}>
                  {critical ? 'Alerta Crítico' : 'Aviso'}
                </div>
                <p className="text-sm text-slate-800 mt-0.5 leading-snug">{t.alert.message}</p>
                {t.alert.sector_name && (
                  <p className="text-xs text-slate-500 mt-1">Setor: {t.alert.sector_name}</p>
                )}
              </div>
              <button
                onClick={() => dismiss(t.id)}
                className="flex-shrink-0 text-slate-400 hover:text-slate-700 transition-colors"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
