'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { SnmpReading, SnmpStatus, MonthlySnapshot, Printer } from '@/lib/types';
import { formatDateTime, getCurrentPeriod, getMonthOptions } from '@/lib/dateUtils';
import { usePolling } from '@/hooks/usePolling';
import Pagination from '@/components/Pagination';
import { Activity, Play, Droplets, RefreshCw, Clock } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

const PAGE_SIZE = 15;

export default function Monitoramento() {
  const [tab, setTab] = useState<'live' | 'snapshots'>('live');
  const [status, setStatus] = useState<SnmpStatus | null>(null);
  const [latestReadings, setLatestReadings] = useState<SnmpReading[]>([]);
  const [snapshots, setSnapshots] = useState<MonthlySnapshot[]>([]);
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<number | null>(null);
  const [printerHistory, setPrinterHistory] = useState<SnmpReading[]>([]);
  const [period, setPeriod] = useState(getCurrentPeriod());
  const [loading, setLoading] = useState(true);
  const [collecting, setCollecting] = useState(false);
  const [page, setPage] = useState(1);
  const monthOptions = getMonthOptions();

  const fetchData = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const [statusData, readingsData, printersData] = await Promise.all([
        api.get<SnmpStatus>('/snmp/status'),
        api.get<SnmpReading[]>('/snmp/latest'),
        api.get<Printer[]>('/printers'),
      ]);
      setStatus(statusData);
      setLatestReadings(readingsData);
      setPrinters(printersData.filter(p => p.active && p.ip_address));
    } catch { console.error('Erro ao carregar dados'); }
    finally { if (showLoading) setLoading(false); }
  }, []);

  const fetchSnapshots = useCallback(async () => {
    try {
      const data = await api.get<MonthlySnapshot[]>(`/snmp/snapshots?period=${period}`);
      setSnapshots(data);
    } catch { console.error('Erro ao carregar snapshots'); }
  }, [period]);

  const fetchPrinterHistory = useCallback(async (printerId: number) => {
    try {
      const data = await api.get<SnmpReading[]>(`/snmp/readings/${printerId}?limit=200`);
      setPrinterHistory(data.reverse());
    } catch { console.error('Erro ao carregar historico'); }
  }, []);

  useEffect(() => { fetchData(true); }, [fetchData]);
  useEffect(() => { if (tab === 'snapshots') fetchSnapshots(); }, [tab, fetchSnapshots]);
  useEffect(() => { if (selectedPrinter) fetchPrinterHistory(selectedPrinter); }, [selectedPrinter, fetchPrinterHistory]);

  usePolling(async () => {
    await fetchData(false);
    if (selectedPrinter) await fetchPrinterHistory(selectedPrinter);
    if (tab === 'snapshots') await fetchSnapshots();
  }, { intervalMs: 15000, enabled: !collecting });

  async function handleCollect() {
    setCollecting(true);
    try {
      await api.post('/snmp/collect', {});
      await fetchData(false);
      if (selectedPrinter) await fetchPrinterHistory(selectedPrinter);
    } catch { alert('Erro ao executar coleta'); }
    finally { setCollecting(false); }
  }

  function getTonerColor(level: number | null | undefined) {
    if (level == null) return 'text-slate-300';
    if (level < 10) return 'text-red-500';
    if (level < 20) return 'text-yellow-500';
    return 'text-green-500';
  }

  const liveData = tab === 'live' ? latestReadings : [];
  const paginatedLive = liveData.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const chartData = printerHistory.map(r => ({
    data: r.created_at.slice(5, 16).replace('-', '/'),
    contador: r.page_count,
    toner: r.toner_level,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Monitoramento SNMP</h1>
          <p className="text-slate-500 mt-1">Leitura automática de contadores e status das impressoras</p>
        </div>
        <button
          onClick={handleCollect}
          disabled={collecting}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50 transition-colors"
        >
          {collecting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {collecting ? 'Coletando...' : 'Coletar Agora'}
        </button>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-slate-400" />
            <p className="text-xs text-slate-500">Última Coleta</p>
          </div>
          <p className="text-sm font-medium text-slate-700 mt-1">
            {status?.last_collection ? formatDateTime(status.last_collection) : 'Nenhuma'}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 px-4 py-3">
          <p className="text-xs text-slate-500">Impressoras Monitoradas</p>
          <p className="text-xl font-bold text-slate-800">{status?.printers_monitored || 0}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 px-4 py-3">
          <p className="text-xs text-slate-500">Total de Leituras</p>
          <p className="text-xl font-bold text-slate-800">{status?.total_readings?.toLocaleString('pt-BR') || 0}</p>
        </div>
        <div className="bg-white rounded-lg border border-yellow-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <Droplets className="h-4 w-4 text-yellow-500" />
            <p className="text-xs text-yellow-600">Toner Baixo</p>
          </div>
          <p className="text-xl font-bold text-yellow-600">{status?.low_toner?.length || 0}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        <button onClick={() => { setTab('live'); setPage(1); }}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'live' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          Leituras em Tempo Real
        </button>
        <button onClick={() => setTab('snapshots')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'snapshots' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          Histórico Mensal
        </button>
      </div>

      {/* Grafico de historico por impressora */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-4 mb-4">
          <h3 className="text-base font-semibold text-slate-800">Histórico por Impressora</h3>
          <select
            value={selectedPrinter || ''}
            onChange={(e) => setSelectedPrinter(e.target.value ? parseInt(e.target.value) : null)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Selecione uma impressora</option>
            {printers.map(p => (
              <option key={p.id} value={p.id}>{p.name} ({p.ip_address})</option>
            ))}
          </select>
        </div>
        {selectedPrinter && chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="data" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip formatter={(value) => Number(value).toLocaleString('pt-BR')} />
              <Line type="monotone" dataKey="contador" stroke="#3b82f6" name="Contador" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[250px] text-slate-400 text-sm">
            {selectedPrinter ? 'Nenhuma leitura encontrada' : 'Selecione uma impressora para ver o histórico'}
          </div>
        )}
      </div>

      {/* Tabela live */}
      {tab === 'live' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          {loading ? (
            <div className="p-12 text-center text-slate-400">Carregando...</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/50">
                      <th className="text-left p-3 pl-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Impressora</th>
                      <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">IP</th>
                      <th className="text-right p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Contador Total</th>
                      <th className="text-center p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Toner</th>
                      <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                      <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Última Leitura</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedLive.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3 pl-4">
                          <div className="flex items-center gap-2">
                            <Activity className="h-4 w-4 text-cyan-500" />
                            <span className="text-sm font-medium text-slate-800">{r.printer_name}</span>
                          </div>
                        </td>
                        <td className="p-3 text-sm text-slate-500 font-mono">{r.ip_address}</td>
                        <td className="p-3 text-sm font-medium text-slate-700 text-right tabular-nums">{r.page_count.toLocaleString('pt-BR')}</td>
                        <td className="p-3">
                          {r.toner_cyan != null ? (
                            <div className="flex items-center gap-1.5 justify-center">
                              <div className="flex flex-col items-center" title={`Ciano: ${r.toner_cyan}%`}>
                                <div className="w-3 h-6 rounded-sm bg-slate-100 relative overflow-hidden">
                                  <div className="absolute bottom-0 w-full bg-cyan-500 transition-all" style={{ height: `${r.toner_cyan}%` }} />
                                </div>
                                <span className="text-[9px] text-slate-400 mt-0.5">C</span>
                              </div>
                              <div className="flex flex-col items-center" title={`Magenta: ${r.toner_magenta}%`}>
                                <div className="w-3 h-6 rounded-sm bg-slate-100 relative overflow-hidden">
                                  <div className="absolute bottom-0 w-full bg-pink-500 transition-all" style={{ height: `${r.toner_magenta ?? 0}%` }} />
                                </div>
                                <span className="text-[9px] text-slate-400 mt-0.5">M</span>
                              </div>
                              <div className="flex flex-col items-center" title={`Amarelo: ${r.toner_yellow}%`}>
                                <div className="w-3 h-6 rounded-sm bg-slate-100 relative overflow-hidden">
                                  <div className="absolute bottom-0 w-full bg-yellow-400 transition-all" style={{ height: `${r.toner_yellow ?? 0}%` }} />
                                </div>
                                <span className="text-[9px] text-slate-400 mt-0.5">Y</span>
                              </div>
                              <div className="flex flex-col items-center" title={`Preto: ${r.toner_black}%`}>
                                <div className="w-3 h-6 rounded-sm bg-slate-100 relative overflow-hidden">
                                  <div className="absolute bottom-0 w-full bg-slate-800 transition-all" style={{ height: `${r.toner_black ?? 0}%` }} />
                                </div>
                                <span className="text-[9px] text-slate-400 mt-0.5">K</span>
                              </div>
                            </div>
                          ) : r.toner_level != null ? (
                            <div className="flex items-center justify-center gap-1">
                              <Droplets className={`h-3.5 w-3.5 ${getTonerColor(r.toner_level)}`} />
                              <span className={`text-xs font-medium ${getTonerColor(r.toner_level)}`}>{r.toner_level}%</span>
                            </div>
                          ) : <span className="text-xs text-slate-300">—</span>}
                        </td>
                        <td className="p-3">
                          {r.status ? (
                            <span className="text-xs capitalize text-slate-600">{r.status}</span>
                          ) : <span className="text-xs text-slate-300">—</span>}
                        </td>
                        <td className="p-3 text-xs text-slate-400">{formatDateTime(r.created_at)}</td>
                      </tr>
                    ))}
                    {paginatedLive.length === 0 && (
                      <tr><td colSpan={6} className="p-12 text-center text-slate-400">
                        Nenhuma leitura SNMP ainda. Clique em &quot;Coletar Agora&quot; para iniciar.
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <Pagination currentPage={page} totalItems={liveData.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
            </>
          )}
        </div>
      )}

      {/* Tabela snapshots */}
      {tab === 'snapshots' && (
        <>
          <div className="flex items-center gap-3">
            <select value={period} onChange={(e) => setPeriod(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
              {monthOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50">
                    <th className="text-left p-3 pl-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Impressora</th>
                    <th className="text-right p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Contador Início</th>
                    <th className="text-right p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Contador Fim</th>
                    <th className="text-right p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Páginas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {snapshots.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3 pl-4 text-sm font-medium text-slate-800">{s.printer_name}</td>
                      <td className="p-3 text-sm text-slate-600 text-right tabular-nums">{s.start_count.toLocaleString('pt-BR')}</td>
                      <td className="p-3 text-sm text-slate-600 text-right tabular-nums">{s.end_count.toLocaleString('pt-BR')}</td>
                      <td className="p-3 text-right">
                        <span className="text-sm font-bold text-blue-600 tabular-nums">{s.total_pages.toLocaleString('pt-BR')}</span>
                      </td>
                    </tr>
                  ))}
                  {snapshots.length === 0 && (
                    <tr><td colSpan={4} className="p-12 text-center text-slate-400">
                      Nenhum snapshot para este período. Os snapshots são gerados automaticamente no fechamento do mês.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
