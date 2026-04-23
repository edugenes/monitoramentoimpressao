'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { Summary, Quota, SnmpStatus, PrinterTypePoolStatus } from '@/lib/types';
import { getCurrentPeriod, getMonthOptions, formatDateTime } from '@/lib/dateUtils';
import { usePolling } from '@/hooks/usePolling';
import Card from '@/components/Card';
import ProgressBar from '@/components/ProgressBar';
import PoolStatusCards from '@/components/PoolStatusCards';
import { Printer, Building2, AlertTriangle, KeyRound, TrendingUp, Activity, Droplets, Layers } from 'lucide-react';
import Link from 'next/link';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#84cc16', '#14b8a6'];

export default function Dashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [criticalQuotas, setCriticalQuotas] = useState<Quota[]>([]);
  const [snmpStatus, setSnmpStatus] = useState<SnmpStatus | null>(null);
  const [pools, setPools] = useState<PrinterTypePoolStatus[]>([]);
  const [period, setPeriod] = useState(getCurrentPeriod());
  const [loading, setLoading] = useState(true);
  const monthOptions = getMonthOptions();

  const fetchData = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const [summaryData, quotasData, snmpData, poolData] = await Promise.all([
        api.get<Summary>(`/reports/summary?period=${period}`),
        api.get<Quota[]>(`/quotas?period=${period}`),
        api.get<SnmpStatus>('/snmp/status').catch(() => null),
        api.get<PrinterTypePoolStatus[]>(`/printer-types/status?period=${period}`).catch(() => []),
      ]);
      setSummary(summaryData);
      setSnmpStatus(snmpData);
      setPools(poolData);

      const sorted = quotasData
        .filter(q => q.monthly_limit > 0)
        .sort((a, b) => {
          const pctA = a.current_usage / a.monthly_limit;
          const pctB = b.current_usage / b.monthly_limit;
          return pctB - pctA;
        })
        .slice(0, 8);
      setCriticalQuotas(sorted);
    } catch {
      console.error('Erro ao carregar resumo');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [period]);

  useEffect(() => { fetchData(true); }, [fetchData]);

  usePolling(() => fetchData(false), { intervalMs: 30000 });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-slate-400 text-lg">Carregando dashboard...</div>
      </div>
    );
  }

  const sectorChartData = summary?.by_sector
    .filter(s => parseInt(s.total_usage) > 0)
    .sort((a, b) => parseInt(b.total_usage) - parseInt(a.total_usage))
    .map(s => ({
      name: s.sector_name.length > 14 ? s.sector_name.slice(0, 14) + '…' : s.sector_name,
      uso: parseInt(s.total_usage),
      limite: parseInt(s.total_limit),
    })) || [];

  const sectorPieData = summary?.by_sector
    .filter(s => parseInt(s.total_usage) > 0)
    .sort((a, b) => parseInt(b.total_usage) - parseInt(a.total_usage))
    .map(s => ({
      name: s.sector_name,
      value: parseInt(s.total_usage),
    })) || [];

  const topPrinters = summary?.by_printer
    .filter(p => parseInt(p.total_usage) > 0)
    .sort((a, b) => parseInt(b.total_usage) - parseInt(a.total_usage))
    .slice(0, 10)
    .map(p => ({
      name: p.printer_name.length > 20 ? p.printer_name.slice(0, 20) + '…' : p.printer_name,
      fullName: p.printer_name,
      uso: parseInt(p.total_usage),
      limite: parseInt(p.total_limit),
      pct: parseFloat(p.usage_percentage),
    })) || [];

  const usagePercent = summary && summary.total_limit > 0
    ? Math.round((summary.total_usage / summary.total_limit) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-slate-500 mt-1">Visão geral do controle de impressão</p>
        </div>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="px-4 py-2 border border-slate-300 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {monthOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card title="Impressoras Ativas" value={summary?.printers_active || 0} icon={Printer} color="blue" />
        <Card title="Setores Ativos" value={summary?.sectors_active || 0} icon={Building2} color="green" />
        <Card
          title="Cotas no Limite"
          value={summary?.quotas_at_limit || 0}
          icon={AlertTriangle}
          color="red"
        />
        <Card
          title="Liberações no Mês"
          value={summary?.releases_count || 0}
          icon={KeyRound}
          color="purple"
          subtitle={summary?.releases_pages ? `${summary.releases_pages.toLocaleString('pt-BR')} págs liberadas` : undefined}
        />
      </div>

      {/* Barra de uso geral */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-slate-400" />
            <span className="font-semibold text-slate-800">Uso Geral do Período</span>
          </div>
          <span className="text-sm text-slate-500">
            {summary?.total_usage?.toLocaleString('pt-BR') || 0} de {summary?.total_limit?.toLocaleString('pt-BR') || 0} páginas
          </span>
        </div>
        <ProgressBar percentage={usagePercent} />
      </div>

      {/* Cotas contratadas por tipo de impressora */}
      {pools.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Layers className="h-5 w-5 text-slate-400" />
              <div>
                <h3 className="text-base font-semibold text-slate-800">Cotas Contratadas por Tipo</h3>
                <p className="text-xs text-slate-400">Pool mensal acordado com a Simpress</p>
              </div>
            </div>
            <Link
              href="/cotas"
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              Gerenciar em Cotas →
            </Link>
          </div>
          <PoolStatusCards pools={pools} />
        </div>
      )}

      {/* Graficos - Setor (barra) + Setor (pizza) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-base font-semibold text-slate-800 mb-4">Consumo por Setor</h3>
          {sectorChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={sectorChartData} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" fontSize={11} tickFormatter={(v) => v.toLocaleString('pt-BR')} />
                <YAxis type="category" dataKey="name" fontSize={11} width={110} />
                <Tooltip
                  formatter={(value) => Number(value).toLocaleString('pt-BR') + ' págs'}
                  labelStyle={{ fontWeight: 'bold' }}
                />
                <Legend />
                <Bar dataKey="uso" fill="#3b82f6" name="Uso" radius={[0, 4, 4, 0]} barSize={14} />
                <Bar dataKey="limite" fill="#e2e8f0" name="Limite" radius={[0, 4, 4, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[320px] text-slate-400">
              Nenhum dado para este período
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-base font-semibold text-slate-800 mb-4">Distribuição por Setor</h3>
          {sectorPieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={sectorPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {sectorPieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => Number(value).toLocaleString('pt-BR') + ' págs'} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 space-y-1.5 max-h-[140px] overflow-y-auto">
                {sectorPieData.map((item, i) => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-slate-600 truncate">{item.name}</span>
                    </div>
                    <span className="text-slate-500 font-medium ml-2">{item.value.toLocaleString('pt-BR')}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-[320px] text-slate-400">
              Nenhum dado para este período
            </div>
          )}
        </div>
      </div>

      {/* Top 10 Impressoras + Cotas Criticas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-base font-semibold text-slate-800 mb-4">Top 10 Impressoras (maior uso)</h3>
          {topPrinters.length > 0 ? (
            <div className="space-y-3">
              {topPrinters.map((p, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-400 w-5 text-right">{i + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-slate-700 truncate" title={p.fullName}>{p.name}</span>
                      <span className="text-xs text-slate-500 ml-2 flex-shrink-0">
                        {p.uso.toLocaleString('pt-BR')} / {p.limite.toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <ProgressBar percentage={p.pct} showLabel={false} />
                  </div>
                  <span className={`text-xs font-semibold w-10 text-right ${
                    p.pct >= 100 ? 'text-red-600' : p.pct >= 80 ? 'text-yellow-600' : 'text-green-600'
                  }`}>{p.pct}%</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-slate-400 py-8">Nenhum dado</div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-base font-semibold text-slate-800 mb-1">Cotas que Exigem Atenção</h3>
          <p className="text-xs text-slate-400 mb-4">Cotas com maior percentual de uso no período</p>
          {criticalQuotas.length > 0 ? (
            <div className="space-y-3">
              {criticalQuotas.map((q) => {
                const pct = q.monthly_limit > 0 ? Math.round((q.current_usage / q.monthly_limit) * 100) : 0;
                return (
                  <div key={q.id} className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-yellow-500' : 'bg-green-500'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-700 truncate">
                          {q.printer_name}
                        </span>
                        <span className={`text-xs font-bold ml-2 flex-shrink-0 ${
                          pct >= 100 ? 'text-red-600' : pct >= 80 ? 'text-yellow-600' : 'text-green-600'
                        }`}>{pct}%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400">{q.sector_name}</span>
                        <span className="text-xs text-slate-400">
                          {q.current_usage.toLocaleString('pt-BR')} / {q.monthly_limit.toLocaleString('pt-BR')}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center text-slate-400 py-8">Nenhuma cota crítica</div>
          )}
        </div>
      </div>

      {/* SNMP Status + Toner Baixo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-5 w-5 text-cyan-500" />
            <h3 className="text-base font-semibold text-slate-800">Monitoramento SNMP</h3>
          </div>
          {snmpStatus ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500">Última Coleta</p>
                  <p className="text-sm font-medium text-slate-700">
                    {snmpStatus.last_collection ? formatDateTime(snmpStatus.last_collection) : 'Nenhuma'}
                  </p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500">Impressoras Monitoradas</p>
                  <p className="text-sm font-medium text-slate-700">{snmpStatus.printers_monitored}</p>
                </div>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-500">Total de Leituras</p>
                <p className="text-sm font-medium text-slate-700">{snmpStatus.total_readings.toLocaleString('pt-BR')}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400">Monitoramento SNMP não configurado</p>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Droplets className="h-5 w-5 text-yellow-500" />
            <h3 className="text-base font-semibold text-slate-800">Toner Baixo (&lt;20%)</h3>
          </div>
          {snmpStatus && snmpStatus.low_toner.length > 0 ? (
            <div className="space-y-2">
              {snmpStatus.low_toner.map((item) => (
                <div key={item.printer_id} className="flex items-center justify-between p-2 bg-yellow-50 rounded-lg border border-yellow-100">
                  <span className="text-sm text-slate-700">{item.printer_name}</span>
                  <span className={`text-sm font-bold ${
                    item.toner_level < 10 ? 'text-red-600' : 'text-yellow-600'
                  }`}>{item.toner_level}%</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 py-4 text-center">Nenhuma impressora com toner baixo</p>
          )}
        </div>
      </div>
    </div>
  );
}
