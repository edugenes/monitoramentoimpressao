'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAlertsContext } from '@/contexts/AlertsContext';
import { Bell, Volume2, VolumeX, AlertOctagon, AlertTriangle, Check } from 'lucide-react';

function formatRelative(dateStr: string): string {
  const d = new Date(dateStr.replace(' ', 'T') + '-03:00');
  const diff = Date.now() - d.getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `há ${hrs} h`;
  const days = Math.floor(hrs / 24);
  return `há ${days} d`;
}

export default function AlertBell() {
  const { count, recent, muted, setMuted, acknowledge, acknowledgeAll } = useAlertsContext();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const hasAny = count.total > 0;
  const hasCritical = count.critical > 0;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative flex items-center justify-center w-9 h-9 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
        title="Alertas"
      >
        <Bell className="h-5 w-5" />
        {hasAny && (
          <span
            className={`absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${
              hasCritical ? 'bg-red-500 text-white animate-pulse-badge' : 'bg-amber-500 text-white'
            }`}
          >
            {count.total > 99 ? '99+' : count.total}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-full top-0 ml-2 w-80 bg-white text-slate-800 rounded-lg shadow-xl border border-slate-200 overflow-hidden z-40">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Alertas</h3>
              <p className="text-xs text-slate-500">
                {count.total === 0 ? 'Nenhum alerta pendente' :
                  `${count.critical} crítico${count.critical !== 1 ? 's' : ''} · ${count.warning} aviso${count.warning !== 1 ? 's' : ''}`}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setMuted(!muted)}
                className="p-1.5 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                title={muted ? 'Ativar som' : 'Silenciar'}
              >
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {recent.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-400">
                Tudo certo. Nenhum alerta ativo.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {recent.map(a => (
                  <li key={a.id} className="p-3 hover:bg-slate-50 transition-colors flex gap-2">
                    <div className={`flex-shrink-0 mt-0.5 ${a.severity === 'critical' ? 'text-red-500' : 'text-amber-500'}`}>
                      {a.severity === 'critical' ? (
                        <AlertOctagon className="h-4 w-4" />
                      ) : (
                        <AlertTriangle className="h-4 w-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-800 leading-snug">{a.message}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {a.sector_name && (
                          <span className="text-[10px] text-slate-500">{a.sector_name}</span>
                        )}
                        <span className="text-[10px] text-slate-400">{formatRelative(a.created_at)}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => acknowledge(a.id)}
                      className="flex-shrink-0 p-1 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                      title="Marcar como reconhecido"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {recent.length > 0 && (
            <div className="p-2 border-t border-slate-100 flex items-center justify-between bg-slate-50">
              <button
                onClick={acknowledgeAll}
                className="text-xs text-slate-600 hover:text-slate-900 px-2 py-1 rounded hover:bg-slate-100 transition-colors"
              >
                Reconhecer todos
              </button>
              <Link
                href="/alertas"
                onClick={() => setOpen(false)}
                className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50 transition-colors font-medium"
              >
                Ver todos →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
