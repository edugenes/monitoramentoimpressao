'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { ReportBySector, ReportByPrinter, Release, PrinterTypePoolStatus } from '@/lib/types';
import { formatDateTime, getCurrentPeriod, getMonthOptions, formatPeriod } from '@/lib/dateUtils';
import { usePolling } from '@/hooks/usePolling';
import SortableTh from '@/components/SortableTh';
import { useTableSort } from '@/hooks/useTableSort';
import { Download } from 'lucide-react';
import { buildPrintReport } from '@/lib/buildPrintReport';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

export default function Relatorios() {
  const [period, setPeriod] = useState(getCurrentPeriod());
  const [week, setWeek] = useState(0);
  const [tab, setTab] = useState<'sector' | 'printer' | 'releases'>('sector');
  const [sectorData, setSectorData] = useState<ReportBySector[]>([]);
  const [printerData, setPrinterData] = useState<ReportByPrinter[]>([]);
  const [releasesData, setReleasesData] = useState<Release[]>([]);
  const [poolsData, setPoolsData] = useState<PrinterTypePoolStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const monthOptions = getMonthOptions();

  const weekParam = week > 0 ? `&week=${week}` : '';

  function getWeekLabel() {
    if (week === 0) return 'Mês Inteiro';
    const [y, m] = period.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const ranges = [
      { start: 1, end: 7 },
      { start: 8, end: 14 },
      { start: 15, end: 21 },
      { start: 22, end: lastDay },
    ];
    const r = ranges[week - 1];
    return r ? `Semana ${week} (${r.start}/${m} a ${r.end}/${m})` : '';
  }

  const fetchReport = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const poolsPromise = api
        .get<PrinterTypePoolStatus[]>(`/printer-types/status?period=${period}`)
        .then((d) => setPoolsData(d))
        .catch(() => {});

      if (tab === 'sector') {
        const data = await api.get<ReportBySector[]>(`/reports/by-sector?period=${period}${weekParam}`);
        setSectorData(data);
      } else if (tab === 'printer') {
        const data = await api.get<ReportByPrinter[]>(`/reports/by-printer?period=${period}${weekParam}`);
        setPrinterData(data);
      } else {
        const data = await api.get<Release[]>(`/reports/releases?period=${period}${weekParam}`);
        setReleasesData(data);
      }
      await poolsPromise;
    } catch {
      console.error('Erro ao carregar relatório');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [period, tab, weekParam]);

  useEffect(() => { fetchReport(true); }, [fetchReport]);

  usePolling(() => fetchReport(false), { intervalMs: 60000 });

  const {
    sortKey: sectorSortKey,
    sortDir: sectorSortDir,
    handleSort: handleSectorSort,
    sortedData: sortedSectors,
  } = useTableSort(sectorData, {
    columns: {
      sector_name: { key: 'sector_name', getter: (s) => s.sector_name || '' },
      total_limit: { key: 'total_limit', getter: (s) => parseFloat(s.total_limit) || 0, defaultDir: 'desc' },
      total_usage: { key: 'total_usage', getter: (s) => parseFloat(s.total_usage) || 0, defaultDir: 'desc' },
      usage_percentage: { key: 'usage_percentage', getter: (s) => parseFloat(s.usage_percentage) || 0, defaultDir: 'desc' },
    },
    defaultKey: 'usage_percentage',
    defaultDir: 'desc',
  });

  const {
    sortKey: printerSortKey,
    sortDir: printerSortDir,
    handleSort: handlePrinterSort,
    sortedData: sortedPrinters,
  } = useTableSort(printerData, {
    columns: {
      printer_name: { key: 'printer_name', getter: (p) => p.printer_name || '' },
      model: { key: 'model', getter: (p) => p.model || '' },
      total_limit: { key: 'total_limit', getter: (p) => parseFloat(p.total_limit) || 0, defaultDir: 'desc' },
      total_usage: { key: 'total_usage', getter: (p) => parseFloat(p.total_usage) || 0, defaultDir: 'desc' },
      usage_percentage: { key: 'usage_percentage', getter: (p) => parseFloat(p.usage_percentage) || 0, defaultDir: 'desc' },
    },
    defaultKey: 'usage_percentage',
    defaultDir: 'desc',
  });

  const {
    sortKey: releasesSortKey,
    sortDir: releasesSortDir,
    handleSort: handleReleasesSort,
    sortedData: sortedReleases,
  } = useTableSort(releasesData, {
    columns: {
      created_at: { key: 'created_at', getter: (r) => r.created_at || '', defaultDir: 'desc' },
      printer_name: { key: 'printer_name', getter: (r) => r.printer_name || '' },
      sector_name: { key: 'sector_name', getter: (r) => r.sector_name || '' },
      amount: { key: 'amount', getter: (r) => r.amount, defaultDir: 'desc' },
      reason: { key: 'reason', getter: (r) => r.reason || '' },
      released_by: { key: 'released_by', getter: (r) => r.released_by || '' },
    },
    defaultKey: 'created_at',
    defaultDir: 'desc',
  });

  function handlePrint() {
    const html = buildPrintReport({
      tab,
      periodLabel: formatPeriod(period),
      weekLabel: getWeekLabel(),
      sectorData,
      printerData,
      releasesData,
      pools: poolsData,
    });

    const win = window.open('', '_blank');
    if (!win) return;

    win.document.open();
    win.document.write(html);
    win.document.close();

    const trigger = () => {
      try {
        win.focus();
        win.print();
      } catch {
        // ignore
      }
    };

    if (win.document.readyState === 'complete') {
      setTimeout(trigger, 350);
    } else {
      win.addEventListener('load', () => setTimeout(trigger, 350));
    }
  }

  const sectorChartData = sectorData.map((s) => ({
    name: s.sector_name,
    uso: parseInt(s.total_usage),
    limite: parseInt(s.total_limit),
  }));

  const printerChartData = printerData.map((p) => ({
    name: p.printer_name,
    uso: parseInt(p.total_usage),
    limite: parseInt(p.total_limit),
  }));

  function getStatusBadge(pct: number) {
    if (pct >= 100) return { class: 'badge badge-red', label: 'Excedido' };
    if (pct >= 80) return { class: 'badge badge-yellow', label: 'Alerta' };
    return { class: 'badge badge-green', label: 'Normal' };
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Relatórios</h1>
          <p className="text-slate-500 mt-1">Relatórios de uso para a direção</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={period}
            onChange={(e) => { setPeriod(e.target.value); setWeek(0); }}
            className="px-4 py-2 border border-slate-300 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {monthOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <select
            value={week}
            onChange={(e) => setWeek(parseInt(e.target.value))}
            className="px-4 py-2 border border-slate-300 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={0}>Mês Inteiro</option>
            {[1, 2, 3, 4].map((w) => {
              const [y, m] = period.split('-').map(Number);
              const lastDay = new Date(y, m, 0).getDate();
              const ranges = [{ s: 1, e: 7 }, { s: 8, e: 14 }, { s: 15, e: 21 }, { s: 22, e: lastDay }];
              const r = ranges[w - 1];
              return (
                <option key={w} value={w}>Semana {w} ({r.s}/{m} a {r.e}/{m})</option>
              );
            })}
          </select>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Download className="h-4 w-4" />
            Exportar / Imprimir
          </button>
        </div>
      </div>

      <div className="flex gap-1 mb-6 bg-slate-100 rounded-lg p-1 w-fit">
        {[
          { key: 'sector' as const, label: 'Por Setor' },
          { key: 'printer' as const, label: 'Por Impressora' },
          { key: 'releases' as const, label: 'Liberações' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center text-slate-400">
          Carregando...
        </div>
      ) : (
        <>
          {tab !== 'releases' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">
                Consumo {tab === 'sector' ? 'por Setor' : 'por Impressora'} - {formatPeriod(period)}{week > 0 ? ` — ${getWeekLabel()}` : ''}
              </h3>
              {(tab === 'sector' ? sectorChartData : printerChartData).length > 0 ? (
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={tab === 'sector' ? sectorChartData : printerChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip formatter={(value) => Number(value).toLocaleString('pt-BR')} />
                    <Legend />
                    <Bar dataKey="uso" fill="#3b82f6" name="Páginas Usadas" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="limite" fill="#cbd5e1" name="Limite" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[200px] text-slate-400">
                  Nenhum dado para este período
                </div>
              )}
            </div>
          )}

          <div>
            {tab === 'sector' && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <SortableTh label="Setor" sortKey="sector_name" align="left"
                        currentKey={sectorSortKey} currentDir={sectorSortDir} onSortChange={handleSectorSort} />
                      <SortableTh label="Limite" sortKey="total_limit" align="right"
                        currentKey={sectorSortKey} currentDir={sectorSortDir} onSortChange={handleSectorSort} />
                      <SortableTh label="Uso" sortKey="total_usage" align="right"
                        currentKey={sectorSortKey} currentDir={sectorSortDir} onSortChange={handleSectorSort} />
                      <SortableTh label="%" sortKey="usage_percentage" align="right"
                        currentKey={sectorSortKey} currentDir={sectorSortDir} onSortChange={handleSectorSort} />
                      <th className="text-left p-4 text-sm font-medium text-slate-500">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedSectors.map((s) => {
                      const pct = parseFloat(s.usage_percentage);
                      const badge = getStatusBadge(pct);
                      return (
                        <tr key={s.sector_id} className="border-b border-slate-100">
                          <td className="p-4 font-medium text-slate-800">{s.sector_name}</td>
                          <td className="p-4 text-right text-slate-600">{parseInt(s.total_limit).toLocaleString('pt-BR')}</td>
                          <td className="p-4 text-right text-slate-600">{parseInt(s.total_usage).toLocaleString('pt-BR')}</td>
                          <td className="p-4 text-right text-slate-600">{pct}%</td>
                          <td className="p-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              pct >= 100 ? 'bg-red-100 text-red-700' :
                              pct >= 80 ? 'bg-yellow-100 text-yellow-700' :
                              'bg-green-100 text-green-700'
                            }`}>
                              {badge.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {sortedSectors.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-400">Nenhum dado para este período</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {tab === 'printer' && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <SortableTh label="Impressora" sortKey="printer_name" align="left"
                        currentKey={printerSortKey} currentDir={printerSortDir} onSortChange={handlePrinterSort} />
                      <SortableTh label="Modelo" sortKey="model" align="left"
                        currentKey={printerSortKey} currentDir={printerSortDir} onSortChange={handlePrinterSort} />
                      <SortableTh label="Limite" sortKey="total_limit" align="right"
                        currentKey={printerSortKey} currentDir={printerSortDir} onSortChange={handlePrinterSort} />
                      <SortableTh label="Uso" sortKey="total_usage" align="right"
                        currentKey={printerSortKey} currentDir={printerSortDir} onSortChange={handlePrinterSort} />
                      <SortableTh label="%" sortKey="usage_percentage" align="right"
                        currentKey={printerSortKey} currentDir={printerSortDir} onSortChange={handlePrinterSort} />
                      <th className="text-left p-4 text-sm font-medium text-slate-500">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPrinters.map((p) => {
                      const pct = parseFloat(p.usage_percentage);
                      const badge = getStatusBadge(pct);
                      return (
                        <tr key={p.printer_id} className="border-b border-slate-100">
                          <td className="p-4 font-medium text-slate-800">{p.printer_name}</td>
                          <td className="p-4 text-slate-600">{p.model || '-'}</td>
                          <td className="p-4 text-right text-slate-600">{parseInt(p.total_limit).toLocaleString('pt-BR')}</td>
                          <td className="p-4 text-right text-slate-600">{parseInt(p.total_usage).toLocaleString('pt-BR')}</td>
                          <td className="p-4 text-right text-slate-600">{pct}%</td>
                          <td className="p-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              pct >= 100 ? 'bg-red-100 text-red-700' :
                              pct >= 80 ? 'bg-yellow-100 text-yellow-700' :
                              'bg-green-100 text-green-700'
                            }`}>
                              {badge.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {sortedPrinters.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-400">Nenhum dado para este período</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {tab === 'releases' && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <SortableTh label="Data/Hora" sortKey="created_at" align="left"
                        currentKey={releasesSortKey} currentDir={releasesSortDir} onSortChange={handleReleasesSort} />
                      <SortableTh label="Impressora" sortKey="printer_name" align="left"
                        currentKey={releasesSortKey} currentDir={releasesSortDir} onSortChange={handleReleasesSort} />
                      <SortableTh label="Setor" sortKey="sector_name" align="left"
                        currentKey={releasesSortKey} currentDir={releasesSortDir} onSortChange={handleReleasesSort} />
                      <SortableTh label="Páginas" sortKey="amount" align="right"
                        currentKey={releasesSortKey} currentDir={releasesSortDir} onSortChange={handleReleasesSort} />
                      <SortableTh label="Motivo" sortKey="reason" align="left"
                        currentKey={releasesSortKey} currentDir={releasesSortDir} onSortChange={handleReleasesSort} />
                      <SortableTh label="Liberado por" sortKey="released_by" align="left"
                        currentKey={releasesSortKey} currentDir={releasesSortDir} onSortChange={handleReleasesSort} />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedReleases.map((r) => (
                      <tr key={r.id} className="border-b border-slate-100">
                        <td className="p-4 text-slate-500 text-sm">{formatDateTime(r.created_at)}</td>
                        <td className="p-4 font-medium text-slate-800">{r.printer_name}</td>
                        <td className="p-4 text-slate-600">{r.sector_name}</td>
                        <td className="p-4 text-right">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                            +{r.amount.toLocaleString('pt-BR')}
                          </span>
                        </td>
                        <td className="p-4 text-slate-600 text-sm">{r.reason || '-'}</td>
                        <td className="p-4 text-slate-600 text-sm">{r.released_by || '-'}</td>
                      </tr>
                    ))}
                    {sortedReleases.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-400">Nenhuma liberação neste período</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
