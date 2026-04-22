'use client';

import { useEffect, useState, useMemo } from 'react';
import { api } from '@/lib/api';
import { Alert, AlertSeverity, AlertType } from '@/lib/types';
import { useAlertsContext } from '@/contexts/AlertsContext';
import { useAuth } from '@/contexts/AuthContext';
import { usePolling } from '@/hooks/usePolling';
import AlertSoundTester from '@/components/AlertSoundTester';
import {
  AlertOctagon,
  AlertTriangle,
  Check,
  RefreshCw,
  Volume2,
  VolumeX,
  Filter,
  CheckCheck,
  Printer as PrinterIcon,
  Droplet,
  WifiOff,
  Gauge,
} from 'lucide-react';

const TYPE_LABELS: Record<AlertType, string> = {
  TONER_CRITICAL: 'Toner crítico',
  TONER_LOW: 'Toner baixo',
  PRINTER_OFFLINE: 'Impressora offline',
  PRINTER_ERROR: 'Status de erro',
  QUOTA_EXCEEDED: 'Cota estourada',
  QUOTA_WARNING: 'Cota quase no fim',
};

function iconForType(type: AlertType) {
  if (type === 'TONER_CRITICAL' || type === 'TONER_LOW') return Droplet;
  if (type === 'PRINTER_OFFLINE') return WifiOff;
  if (type === 'QUOTA_EXCEEDED' || type === 'QUOTA_WARNING') return Gauge;
  return PrinterIcon;
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr.replace(' ', 'T') + '-03:00');
  return d.toLocaleString('pt-BR', { timeZone: 'America/Recife' });
}

export default function AlertasPage() {
  const { isAdmin } = useAuth();
  const { muted, setMuted, acknowledge, acknowledgeAll, refresh } = useAlertsContext();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSeverity, setFilterSeverity] = useState<AlertSeverity | 'all'>('all');
  const [filterType, setFilterType] = useState<AlertType | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<'unack' | 'resolved' | 'all'>('unack');

  async function fetchAlerts(showLoading = false) {
    if (showLoading) setLoading(true);
    try {
      const onlyUnack = filterStatus === 'unack';
      const data = await api.get<Alert[]>(
        `/alerts?limit=500${onlyUnack ? '&unacknowledged=true' : ''}`
      );
      setAlerts(data);
    } catch {
      /* silencioso */
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  useEffect(() => {
    fetchAlerts(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus]);

  usePolling(() => fetchAlerts(false), { intervalMs: 15000 });

  const filtered = useMemo(() => {
    return alerts.filter(a => {
      if (filterSeverity !== 'all' && a.severity !== filterSeverity) return false;
      if (filterType !== 'all' && a.type !== filterType) return false;
      if (filterStatus === 'resolved' && !a.resolved_at) return false;
      return true;
    });
  }, [alerts, filterSeverity, filterType, filterStatus]);

  async function handleAck(id: number) {
    await api.post(`/alerts/${id}/acknowledge`, {});
    await fetchAlerts(false);
    await refresh();
  }

  async function handleAckAll() {
    if (!confirm('Reconhecer TODOS os alertas visíveis agora?')) return;
    await acknowledgeAll();
    await fetchAlerts(false);
  }

  async function handleGenerateNow() {
    try {
      await api.post('/alerts/generate', {});
      await fetchAlerts(false);
      await refresh();
    } catch {
      alert('Erro ao reprocessar alertas');
    }
  }

  const stats = useMemo(() => {
    const unackFiltered = alerts.filter(a => !a.acknowledged && !a.resolved_at);
    return {
      total: alerts.length,
      critical: unackFiltered.filter(a => a.severity === 'critical').length,
      warning: unackFiltered.filter(a => a.severity === 'warning').length,
      resolved: alerts.filter(a => a.resolved_at).length,
    };
  }, [alerts]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Alertas</h1>
          <p className="text-sm text-slate-500">
            Central de alertas do sistema. Som por voz em pt-BR quando chega alerta novo.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMuted(!muted)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
              muted
                ? 'border-slate-300 text-slate-600 bg-white hover:bg-slate-50'
                : 'border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100'
            }`}
            title={muted ? 'Ativar som' : 'Silenciar som'}
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            {muted ? 'Som desligado' : 'Som ligado'}
          </button>
          {isAdmin && (
            <button
              onClick={handleGenerateNow}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Verificar agora
            </button>
          )}
          <button
            onClick={handleAckAll}
            className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
          >
            <CheckCheck className="h-4 w-4" />
            Reconhecer todos
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="text-xs text-slate-500 uppercase font-semibold">Total listados</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{stats.total}</div>
        </div>
        <div className="bg-white rounded-lg border-l-4 border-red-500 border-y border-r p-4">
          <div className="text-xs text-red-600 uppercase font-semibold">Críticos pendentes</div>
          <div className="text-2xl font-bold text-red-700 mt-1">{stats.critical}</div>
        </div>
        <div className="bg-white rounded-lg border-l-4 border-amber-500 border-y border-r p-4">
          <div className="text-xs text-amber-600 uppercase font-semibold">Avisos pendentes</div>
          <div className="text-2xl font-bold text-amber-700 mt-1">{stats.warning}</div>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="text-xs text-slate-500 uppercase font-semibold">Já resolvidos</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{stats.resolved}</div>
        </div>
      </div>

      <AlertSoundTester />

      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Filter className="h-4 w-4" />
            <span className="font-medium">Filtros:</span>
          </div>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as 'unack' | 'resolved' | 'all')}
            className="border border-slate-300 rounded-md px-3 py-1.5 text-sm"
          >
            <option value="unack">Pendentes (não reconhecidos)</option>
            <option value="all">Todos (histórico completo)</option>
            <option value="resolved">Apenas já resolvidos</option>
          </select>
          <select
            value={filterSeverity}
            onChange={e => setFilterSeverity(e.target.value as AlertSeverity | 'all')}
            className="border border-slate-300 rounded-md px-3 py-1.5 text-sm"
          >
            <option value="all">Todas gravidades</option>
            <option value="critical">Apenas críticos</option>
            <option value="warning">Apenas avisos</option>
          </select>
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value as AlertType | 'all')}
            className="border border-slate-300 rounded-md px-3 py-1.5 text-sm"
          >
            <option value="all">Todos os tipos</option>
            {(Object.keys(TYPE_LABELS) as AlertType[]).map(t => (
              <option key={t} value={t}>{TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">Carregando alertas...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            {filterStatus === 'unack'
              ? 'Nenhum alerta pendente. Tudo tranquilo!'
              : 'Nenhum alerta com esses filtros.'}
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtered.map(a => {
              const Icon = iconForType(a.type);
              const color = a.severity === 'critical' ? 'text-red-500' : 'text-amber-500';
              const resolved = !!a.resolved_at;
              const acked = !!a.acknowledged;

              return (
                <li
                  key={a.id}
                  className={`p-4 flex items-start gap-4 hover:bg-slate-50 transition-colors ${
                    resolved ? 'opacity-60' : ''
                  }`}
                >
                  <div className={`flex-shrink-0 mt-0.5 ${color}`}>
                    {a.severity === 'critical' ? (
                      <AlertOctagon className="h-5 w-5" />
                    ) : (
                      <AlertTriangle className="h-5 w-5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded ${
                        a.severity === 'critical'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        <Icon className="h-3 w-3" />
                        {TYPE_LABELS[a.type]}
                      </span>
                      {resolved && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded bg-green-100 text-green-700">
                          Resolvido
                        </span>
                      )}
                      {acked && !resolved && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                          Reconhecido
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-800 mt-1">{a.message}</p>
                    <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                      {a.sector_name && <span>Setor: {a.sector_name}</span>}
                      {a.printer_name && <span>Impressora: {a.printer_name}</span>}
                      <span>Criado: {formatDateTime(a.created_at)}</span>
                      {a.resolved_at && <span>Resolvido: {formatDateTime(a.resolved_at)}</span>}
                      {a.acknowledged_at && a.acknowledged_by_name && (
                        <span>Reconhecido por {a.acknowledged_by_name} em {formatDateTime(a.acknowledged_at)}</span>
                      )}
                    </div>
                  </div>
                  {!acked && !resolved && (
                    <button
                      onClick={() => handleAck(a.id)}
                      className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg transition-colors"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Reconhecer
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
