'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { Release, Printer, Sector } from '@/lib/types';
import { formatDateTime, getCurrentPeriod, getMonthOptions } from '@/lib/dateUtils';
import { usePolling } from '@/hooks/usePolling';
import SortableTh from '@/components/SortableTh';
import { useTableSort } from '@/hooks/useTableSort';

export default function Liberacoes() {
  const [releases, setReleases] = useState<Release[]>([]);
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [period, setPeriod] = useState(getCurrentPeriod());
  const [sectorFilter, setSectorFilter] = useState('');
  const [printerFilter, setPrinterFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const monthOptions = getMonthOptions();

  const fetchFilters = useCallback(async () => {
    try {
      const [printerData, sectorData] = await Promise.all([
        api.get<Printer[]>('/printers'),
        api.get<Sector[]>('/sectors'),
      ]);
      setPrinters(printerData);
      setSectors(sectorData);
    } catch {
      console.error('Erro ao carregar filtros');
    }
  }, []);

  const fetchReleases = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      let url = `/releases?period=${period}`;
      if (sectorFilter) url += `&sector_id=${sectorFilter}`;
      if (printerFilter) url += `&printer_id=${printerFilter}`;
      const data = await api.get<Release[]>(url);
      setReleases(data);
    } catch {
      console.error('Erro ao carregar liberações');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [period, sectorFilter, printerFilter]);

  useEffect(() => { fetchFilters(); }, [fetchFilters]);
  useEffect(() => { fetchReleases(true); }, [fetchReleases]);

  usePolling(() => fetchReleases(false), { intervalMs: 30000 });

  const totalPages = releases.reduce((sum, r) => sum + r.amount, 0);

  const { sortKey, sortDir, handleSort, sortedData } = useTableSort(releases, {
    columns: {
      created_at: { key: 'created_at', getter: (r) => r.created_at || '', defaultDir: 'desc' },
      printer_name: { key: 'printer_name', getter: (r) => r.printer_name || '' },
      sector_name: { key: 'sector_name', getter: (r) => r.sector_name || '' },
      amount: { key: 'amount', getter: (r) => r.amount, defaultDir: 'desc' },
      reason: { key: 'reason', getter: (r) => r.reason || '' },
      released_by: { key: 'released_by', getter: (r) => r.released_by || '' },
      operator_name: { key: 'operator_name', getter: (r) => r.operator_name || r.operator_username || '' },
    },
    defaultKey: 'created_at',
    defaultDir: 'desc',
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Liberações</h1>
        <p className="text-slate-500 mt-1">Histórico de liberações de cotas extras</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Período</label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {monthOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Setor</label>
            <select
              value={sectorFilter}
              onChange={(e) => setSectorFilter(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              {sectors.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Impressora</label>
            <select
              value={printerFilter}
              onChange={(e) => setPrinterFilter(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todas</option>
              {printers.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-4 p-4">
        <div className="flex items-center gap-6 text-sm">
          <span className="text-slate-500">
            Total de liberações: <strong className="text-slate-800">{releases.length}</strong>
          </span>
          <span className="text-slate-500">
            Total de páginas liberadas: <strong className="text-slate-800">{totalPages.toLocaleString('pt-BR')}</strong>
          </span>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Carregando...</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <SortableTh label="Data/Hora" sortKey="created_at" align="left"
                  currentKey={sortKey} currentDir={sortDir} onSortChange={handleSort} />
                <SortableTh label="Impressora" sortKey="printer_name" align="left"
                  currentKey={sortKey} currentDir={sortDir} onSortChange={handleSort} />
                <SortableTh label="Setor" sortKey="sector_name" align="left"
                  currentKey={sortKey} currentDir={sortDir} onSortChange={handleSort} />
                <SortableTh label="Páginas" sortKey="amount" align="left"
                  currentKey={sortKey} currentDir={sortDir} onSortChange={handleSort} />
                <SortableTh label="Motivo" sortKey="reason" align="left"
                  currentKey={sortKey} currentDir={sortDir} onSortChange={handleSort} />
                <SortableTh label="Autorizado por" sortKey="released_by" align="left"
                  currentKey={sortKey} currentDir={sortDir} onSortChange={handleSort} />
                <SortableTh label="Operador" sortKey="operator_name" align="left"
                  currentKey={sortKey} currentDir={sortDir} onSortChange={handleSort} />
              </tr>
            </thead>
            <tbody>
              {sortedData.map((release) => (
                <tr key={release.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="p-4 text-slate-500 text-sm">{formatDateTime(release.created_at)}</td>
                  <td className="p-4 font-medium text-slate-800">{release.printer_name}</td>
                  <td className="p-4 text-slate-600">{release.sector_name}</td>
                  <td className="p-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                      +{release.amount.toLocaleString('pt-BR')}
                    </span>
                  </td>
                  <td className="p-4 text-slate-600 text-sm max-w-[200px] truncate">
                    {release.reason || '-'}
                  </td>
                  <td className="p-4 text-slate-600 text-sm">{release.released_by || '-'}</td>
                  <td className="p-4 text-slate-500 text-sm">
                    {release.operator_name ? (
                      <div className="flex flex-col leading-tight">
                        <span className="text-slate-700">{release.operator_name}</span>
                        {release.operator_username && (
                          <span className="text-xs text-slate-400">@{release.operator_username}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-400 italic text-xs">legado</span>
                    )}
                  </td>
                </tr>
              ))}
              {sortedData.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    Nenhuma liberação encontrada para este período
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
