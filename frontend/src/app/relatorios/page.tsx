'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { ReportBySector, ReportByPrinter, Release } from '@/lib/types';
import { formatDateTime, getCurrentPeriod, getMonthOptions, formatPeriod } from '@/lib/dateUtils';
import { usePolling } from '@/hooks/usePolling';
import { Download, FileText } from 'lucide-react';
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
  const [loading, setLoading] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);
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
    } catch {
      console.error('Erro ao carregar relatório');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [period, tab, weekParam]);

  useEffect(() => { fetchReport(true); }, [fetchReport]);

  usePolling(() => fetchReport(false), { intervalMs: 60000 });

  function handlePrint() {
    const content = printRef.current;
    if (!content) return;

    const win = window.open('', '_blank');
    if (!win) return;

    win.document.write(`
      <html>
        <head>
          <title>Relatório de Impressão - ${formatPeriod(period)}${week > 0 ? ` - ${getWeekLabel()}` : ''}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; color: #1e293b; }
            h1 { font-size: 24px; margin-bottom: 8px; }
            h2 { font-size: 18px; color: #475569; margin-bottom: 24px; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #e2e8f0; }
            th { background: #f8fafc; font-weight: 600; font-size: 13px; color: #64748b; }
            td { font-size: 14px; }
            .right { text-align: right; }
            .badge { 
              display: inline-block; padding: 2px 8px; border-radius: 12px; 
              font-size: 12px; font-weight: 500;
            }
            .badge-green { background: #dcfce7; color: #166534; }
            .badge-yellow { background: #fef9c3; color: #854d0e; }
            .badge-red { background: #fee2e2; color: #991b1b; }
            .footer { margin-top: 32px; font-size: 12px; color: #94a3b8; text-align: center; }
            @media print { body { padding: 20px; } }
          </style>
        </head>
        <body>
          <h1>Relatório de Controle de Impressão</h1>
          <h2>${tab === 'sector' ? 'Por Setor' : tab === 'printer' ? 'Por Impressora' : 'Liberações'} - ${formatPeriod(period)}${week > 0 ? ` - ${getWeekLabel()}` : ''}</h2>
          ${content.innerHTML}
          <div class="footer">
            Gerado em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} - Sistema de Controle de Impressão
          </div>
        </body>
      </html>
    `);
    win.document.close();
    win.print();
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

          <div ref={printRef}>
            {tab === 'sector' && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left p-4 text-sm font-medium text-slate-500">Setor</th>
                      <th className="text-right p-4 text-sm font-medium text-slate-500">Limite</th>
                      <th className="text-right p-4 text-sm font-medium text-slate-500">Uso</th>
                      <th className="text-right p-4 text-sm font-medium text-slate-500">%</th>
                      <th className="text-left p-4 text-sm font-medium text-slate-500">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sectorData.map((s) => {
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
                    {sectorData.length === 0 && (
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
                      <th className="text-left p-4 text-sm font-medium text-slate-500">Impressora</th>
                      <th className="text-left p-4 text-sm font-medium text-slate-500">Modelo</th>
                      <th className="text-right p-4 text-sm font-medium text-slate-500">Limite</th>
                      <th className="text-right p-4 text-sm font-medium text-slate-500">Uso</th>
                      <th className="text-right p-4 text-sm font-medium text-slate-500">%</th>
                      <th className="text-left p-4 text-sm font-medium text-slate-500">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {printerData.map((p) => {
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
                    {printerData.length === 0 && (
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
                      <th className="text-left p-4 text-sm font-medium text-slate-500">Data/Hora</th>
                      <th className="text-left p-4 text-sm font-medium text-slate-500">Impressora</th>
                      <th className="text-left p-4 text-sm font-medium text-slate-500">Setor</th>
                      <th className="text-right p-4 text-sm font-medium text-slate-500">Páginas</th>
                      <th className="text-left p-4 text-sm font-medium text-slate-500">Motivo</th>
                      <th className="text-left p-4 text-sm font-medium text-slate-500">Liberado por</th>
                    </tr>
                  </thead>
                  <tbody>
                    {releasesData.map((r: any) => (
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
                    {releasesData.length === 0 && (
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
