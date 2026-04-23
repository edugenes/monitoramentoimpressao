'use client';

import { PrinterTypePoolStatus } from '@/lib/types';
import { Printer, Layers, Palette, Pencil } from 'lucide-react';

interface Props {
  pools: PrinterTypePoolStatus[];
  isAdmin?: boolean;
  onEdit?: (pool: PrinterTypePoolStatus) => void;
  onFilter?: (code: PrinterTypePoolStatus['code'] | null) => void;
  activeFilter?: PrinterTypePoolStatus['code'] | null;
}

const ICONS: Record<string, typeof Printer> = {
  MONOCROMATICA: Printer,
  MULTIFUNCIONAL_MONO: Layers,
  MULTIFUNCIONAL_COLOR: Palette,
};

function fmt(n: number): string {
  return (n ?? 0).toLocaleString('pt-BR');
}

export default function PoolStatusCards({ pools, isAdmin, onEdit, onFilter, activeFilter }: Props) {
  if (!pools || pools.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {pools.map((p) => {
        const Icon = ICONS[p.code] || Printer;
        const pct = Math.min(p.usage_pct, 100);
        const over = p.usage_pct > 100;
        const warn = p.usage_pct >= 80 && p.usage_pct < 100;
        const barColor = over ? 'bg-red-500' : warn ? 'bg-yellow-500' : 'bg-emerald-500';
        const accentRing = over ? 'ring-red-200' : warn ? 'ring-yellow-200' : 'ring-emerald-200';
        const isActive = activeFilter === p.code;
        const consumed = p.usage_total + p.releases_total;

        return (
          <div
            key={p.type_id}
            className={`relative bg-white rounded-xl border p-5 shadow-sm transition-all hover:shadow-md ${
              isActive ? `border-blue-400 ring-2 ring-blue-200` : 'border-slate-200'
            }`}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-lg ring-1 ${accentRing} bg-slate-50`}>
                  <Icon className={`h-5 w-5 ${over ? 'text-red-600' : warn ? 'text-yellow-600' : 'text-emerald-600'}`} />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                    Cota Contratada
                  </p>
                  <h3 className="text-sm font-bold text-slate-800 leading-tight">{p.name}</h3>
                  <p className="text-xs text-slate-500">
                    {p.printer_count} {p.printer_count === 1 ? 'impressora' : 'impressoras'}
                  </p>
                </div>
              </div>
              {isAdmin && onEdit && (
                <button
                  onClick={() => onEdit(p)}
                  title="Editar cota contratada"
                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-baseline justify-between mb-2">
              <div className="text-2xl font-bold text-slate-800 tabular-nums">
                {fmt(consumed)}
                <span className="text-base font-normal text-slate-400"> / {fmt(p.pool_total)}</span>
              </div>
              <span
                className={`text-sm font-bold ${
                  over ? 'text-red-600' : warn ? 'text-yellow-600' : 'text-emerald-600'
                }`}
              >
                {p.usage_pct}%
              </span>
            </div>

            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${barColor}`}
                style={{ width: `${pct}%` }}
              />
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-400">Uso</p>
                <p className="text-sm font-semibold text-slate-700 tabular-nums">{fmt(p.usage_total)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-400">Liberado</p>
                <p className="text-sm font-semibold text-purple-600 tabular-nums">
                  {p.releases_total > 0 ? `+${fmt(p.releases_total)}` : fmt(0)}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-400">Saldo</p>
                <p
                  className={`text-sm font-semibold tabular-nums ${
                    p.remaining < 0 ? 'text-red-600' : 'text-emerald-600'
                  }`}
                >
                  {fmt(p.remaining)}
                </p>
              </div>
            </div>

            {onFilter && (
              <button
                onClick={() => onFilter(isActive ? null : p.code)}
                className={`mt-3 w-full text-xs py-1.5 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {isActive ? 'Remover filtro' : 'Filtrar impressoras deste tipo'}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
