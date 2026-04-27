'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { getCurrentPeriod } from '@/lib/dateUtils';
import {
  BalanceOverview,
  BalanceSector,
  BalancePrinter,
  BalanceStatus,
  BalanceTypePool,
  QuotaProposal,
  ProposalSummary,
  ProposalTotalsByType,
} from '@/lib/types';
import {
  Scale,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Activity,
  Eye,
  ListTodo,
  RefreshCw,
  Plus,
  ArrowRight,
  Save,
  XCircle,
  Calendar,
  Printer as PrinterIcon,
  Layers,
  Palette,
} from 'lucide-react';

type Tab = 'overview' | 'proposal';

const STATUS_COLORS: Record<BalanceStatus, string> = {
  overflow: 'bg-red-100 text-red-700 border-red-200',
  critical: 'bg-orange-100 text-orange-700 border-orange-200',
  warning: 'bg-amber-100 text-amber-700 border-amber-200',
  ok: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  idle: 'bg-sky-100 text-sky-700 border-sky-200',
  unset: 'bg-slate-100 text-slate-600 border-slate-200',
};

const STATUS_LABELS: Record<BalanceStatus, string> = {
  overflow: 'Estourada',
  critical: 'Critica',
  warning: 'Atencao',
  ok: 'OK',
  idle: 'Ociosa',
  unset: 'Sem cota',
};

function formatNumber(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '-';
  return new Intl.NumberFormat('pt-BR').format(n);
}

function formatPercent(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '-';
  return `${n.toFixed(1)}%`;
}

function formatPeriodLabel(period: string): string {
  const [year, month] = period.split('-');
  const months = ['Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  return `${months[parseInt(month, 10) - 1]}/${year}`;
}

export default function BalanceamentoPage() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');
  const period = getCurrentPeriod();

  // ========== Overview state ==========
  const [overview, setOverview] = useState<BalanceOverview | null>(null);
  const [bySector, setBySector] = useState<BalanceSector[]>([]);
  const [printers, setPrinters] = useState<BalancePrinter[]>([]);
  const [filterStatus, setFilterStatus] = useState<BalanceStatus | ''>('');
  const [searchPrinter, setSearchPrinter] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Rebalance modal
  const [rebalOpen, setRebalOpen] = useState(false);
  const [rebalFrom, setRebalFrom] = useState<number | ''>('');
  const [rebalTo, setRebalTo] = useState<number | ''>('');
  const [rebalAmount, setRebalAmount] = useState('');
  const [rebalReason, setRebalReason] = useState('');
  const [rebalSaving, setRebalSaving] = useState(false);

  // ========== Proposal state ==========
  const [proposalsList, setProposalsList] = useState<ProposalSummary[]>([]);
  const [activeProposal, setActiveProposal] = useState<QuotaProposal | null>(null);
  const [loadingProp, setLoadingProp] = useState(false);
  const [editedItems, setEditedItems] = useState<Record<number, number | null>>({});

  // ============ Fetchers ============
  const fetchOverview = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [ov, bs, prs] = await Promise.all([
        api.get<BalanceOverview>(`/quota-balance/overview?period=${period}`),
        api.get<BalanceSector[]>(`/quota-balance/by-sector?period=${period}`),
        api.get<BalancePrinter[]>(`/quota-balance/printers?period=${period}`),
      ]);
      setOverview(ov);
      setBySector(bs);
      setPrinters(prs);
    } catch (err) {
      console.error('Erro ao carregar balanceamento', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period]);

  const fetchProposalsList = useCallback(async () => {
    try {
      const list = await api.get<ProposalSummary[]>('/quota-proposals');
      setProposalsList(list);
      // Carrega proposta mais recente automaticamente
      if (list.length > 0) {
        const top = await api.get<QuotaProposal>(`/quota-proposals/${list[0].id}`);
        setActiveProposal(top);
        setEditedItems({});
      }
    } catch (err) {
      console.error('Erro ao listar propostas', err);
    }
  }, []);

  useEffect(() => {
    if (tab === 'overview') fetchOverview();
    else fetchProposalsList();
  }, [tab, fetchOverview, fetchProposalsList]);

  // ============ Proposal actions ============
  const generateProposal = async () => {
    if (!isAdmin) return;
    setLoadingProp(true);
    try {
      // Por padrao gera para o proximo mes (relativo a data atual)
      const created = await api.post<QuotaProposal>('/quota-proposals/generate', {});
      setActiveProposal(created);
      setEditedItems({});
      await fetchProposalsList();
    } catch (err) {
      alert(`Erro ao gerar proposta: ${(err as Error).message}`);
    } finally {
      setLoadingProp(false);
    }
  };

  const loadProposal = async (id: number) => {
    setLoadingProp(true);
    try {
      const p = await api.get<QuotaProposal>(`/quota-proposals/${id}`);
      setActiveProposal(p);
      setEditedItems({});
    } finally {
      setLoadingProp(false);
    }
  };

  const saveItemEdit = async (itemId: number, newValue: number | null) => {
    if (!activeProposal) return;
    try {
      const updated = await api.put<QuotaProposal>(
        `/quota-proposals/${activeProposal.id}/items/${itemId}`,
        { approved_limit: newValue }
      );
      setActiveProposal(updated);
      setEditedItems(prev => {
        const c = { ...prev };
        delete c[itemId];
        return c;
      });
    } catch (err) {
      alert(`Erro ao atualizar item: ${(err as Error).message}`);
    }
  };

  const fillSuggested = async () => {
    if (!activeProposal) return;
    if (!confirm('Aplicar todas as sugestoes do sistema como aprovadas? Itens ja editados serao mantidos.')) return;
    try {
      const updated = await api.post<QuotaProposal>(`/quota-proposals/${activeProposal.id}/fill-suggested`, {});
      setActiveProposal(updated);
      setEditedItems({});
    } catch (err) {
      alert(`Erro: ${(err as Error).message}`);
    }
  };

  const approveProposal = async () => {
    if (!activeProposal) return;
    if (!confirm(`Aprovar proposta para ${formatPeriodLabel(activeProposal.period)}?\n\nApos aprovada, ela sera aplicada AUTOMATICAMENTE no dia 1 do periodo, atualizando todas as cotas.`)) return;
    try {
      const updated = await api.post<QuotaProposal>(`/quota-proposals/${activeProposal.id}/approve`, {});
      setActiveProposal(updated);
      await fetchProposalsList();
      alert('Proposta aprovada! Sera aplicada automaticamente no dia 1.');
    } catch (err) {
      alert(`Erro: ${(err as Error).message}`);
    }
  };

  const rejectProposal = async () => {
    if (!activeProposal) return;
    const notes = prompt('Motivo da rejeicao (opcional):') ?? undefined;
    if (notes === null) return;
    try {
      const updated = await api.post<QuotaProposal>(`/quota-proposals/${activeProposal.id}/reject`, { notes });
      setActiveProposal(updated);
      await fetchProposalsList();
    } catch (err) {
      alert(`Erro: ${(err as Error).message}`);
    }
  };

  // ============ Rebalance ============
  const submitRebalance = async () => {
    if (!isAdmin) return;
    if (!rebalFrom || !rebalTo || !rebalAmount) return;
    setRebalSaving(true);
    try {
      await api.post('/quota-balance/rebalance', {
        from_printer_id: rebalFrom,
        to_printer_id: rebalTo,
        amount: parseInt(rebalAmount, 10),
        reason: rebalReason,
      });
      setRebalOpen(false);
      setRebalFrom(''); setRebalTo(''); setRebalAmount(''); setRebalReason('');
      await fetchOverview(true);
    } catch (err) {
      alert(`Erro no remanejamento: ${(err as Error).message}`);
    } finally {
      setRebalSaving(false);
    }
  };

  // ============ Filtragem da tabela ============
  const filteredPrinters = printers.filter(p => {
    if (filterStatus && p.status !== filterStatus) return false;
    if (searchPrinter) {
      const s = searchPrinter.toLowerCase();
      if (!p.name.toLowerCase().includes(s) && !(p.ip_address || '').includes(s) && !(p.sector_name || '').toLowerCase().includes(s)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Scale className="h-8 w-8 text-blue-600" />
            Balanceamento de Cotas
          </h1>
          <p className="text-slate-600 mt-1">
            Visao da frota e propostas mensais com aprovacao para evitar estourar a cota total.
          </p>
        </div>
        {tab === 'overview' && (
          <button
            onClick={() => fetchOverview(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-1">
          {[
            { id: 'overview' as Tab, label: 'Visao Atual', icon: Eye },
            { id: 'proposal' as Tab, label: 'Proposta Mensal', icon: ListTodo },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition ${
                tab === t.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'overview' && (
        <OverviewTab
          loading={loading}
          overview={overview}
          bySector={bySector}
          printers={printers}
          filteredPrinters={filteredPrinters}
          filterStatus={filterStatus}
          setFilterStatus={setFilterStatus}
          searchPrinter={searchPrinter}
          setSearchPrinter={setSearchPrinter}
          isAdmin={isAdmin}
          onOpenRebalance={() => setRebalOpen(true)}
        />
      )}

      {tab === 'proposal' && (
        <ProposalTab
          period={period}
          isAdmin={isAdmin}
          loading={loadingProp}
          proposalsList={proposalsList}
          activeProposal={activeProposal}
          editedItems={editedItems}
          setEditedItems={setEditedItems}
          onGenerate={generateProposal}
          onLoadProposal={loadProposal}
          onSaveItem={saveItemEdit}
          onFillSuggested={fillSuggested}
          onApprove={approveProposal}
          onReject={rejectProposal}
        />
      )}

      {/* Modal de Remanejamento */}
      {rebalOpen && (
        <RebalanceModal
          printers={printers}
          fromId={rebalFrom}
          toId={rebalTo}
          amount={rebalAmount}
          reason={rebalReason}
          saving={rebalSaving}
          setFromId={setRebalFrom}
          setToId={setRebalTo}
          setAmount={setRebalAmount}
          setReason={setRebalReason}
          onClose={() => setRebalOpen(false)}
          onSubmit={submitRebalance}
        />
      )}
    </div>
  );
}

// ============================================================================
// OVERVIEW TAB
// ============================================================================
type OverviewProps = {
  loading: boolean;
  overview: BalanceOverview | null;
  bySector: BalanceSector[];
  printers: BalancePrinter[];
  filteredPrinters: BalancePrinter[];
  filterStatus: BalanceStatus | '';
  setFilterStatus: (s: BalanceStatus | '') => void;
  searchPrinter: string;
  setSearchPrinter: (s: string) => void;
  isAdmin: boolean;
  onOpenRebalance: () => void;
};

function OverviewTab(props: OverviewProps) {
  const {
    loading, overview, bySector, printers, filteredPrinters,
    filterStatus, setFilterStatus, searchPrinter, setSearchPrinter,
    isAdmin, onOpenRebalance,
  } = props;

  if (loading) {
    return <div className="text-slate-500 text-center py-12">Carregando...</div>;
  }
  if (!overview) {
    return <div className="text-slate-500 text-center py-12">Sem dados.</div>;
  }

  const usagePctClass = overview.usage_pct >= 100 ? 'bg-red-500' :
    overview.usage_pct >= 90 ? 'bg-orange-500' :
    overview.usage_pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500';

  const overflowed = printers.filter(p => p.status === 'overflow');
  const idlePrinters = printers.filter(p => p.status === 'idle');

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Activity className="h-5 w-5 text-blue-600" />
          Frota Total - {formatPeriodLabel(overview.period)}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
          <KPICard
            label="Cota total alocada"
            value={formatNumber(overview.total_alloc)}
            sub={`${overview.printer_count} impressoras`}
            icon={Scale}
            color="text-blue-600"
          />
          <KPICard
            label="Total usado"
            value={formatNumber(overview.total_used)}
            sub={`${formatPercent(overview.usage_pct)} do limite efetivo`}
            icon={TrendingUp}
            color="text-orange-600"
          />
          <KPICard
            label="Disponivel"
            value={formatNumber(overview.available)}
            sub={`+${formatNumber(overview.total_releases)} liberacoes`}
            icon={CheckCircle2}
            color="text-emerald-600"
          />
          <KPICard
            label="Status"
            value={`${overview.overflowed_count} estouradas`}
            sub={`${overview.idle_count} ociosas (<30%)`}
            icon={AlertTriangle}
            color={overview.overflowed_count > 0 ? 'text-red-600' : 'text-slate-500'}
          />
        </div>
        <div>
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>Uso da frota</span>
            <span className="font-semibold">{formatPercent(overview.usage_pct)}</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${usagePctClass}`}
              style={{ width: `${Math.min(100, overview.usage_pct)}%` }}
            />
          </div>
        </div>
        {isAdmin && (
          <div className="mt-5 flex justify-end">
            <button
              onClick={onOpenRebalance}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <ArrowRight className="h-4 w-4" />
              Remanejar cota entre impressoras
            </button>
          </div>
        )}
      </div>

      {/* Cotas Contratadas por Tipo (custos diferentes => pools separados) */}
      {overview.by_type && overview.by_type.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Layers className="h-5 w-5 text-violet-600" />
                Cotas Contratadas por Tipo
              </h2>
              <p className="text-sm text-slate-500">Pool mensal acordado com a Simpress</p>
            </div>
            <a href="/cotas" className="text-sm text-blue-600 hover:underline">Gerenciar em Cotas &rarr;</a>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {overview.by_type.map((t) => (
              <TypePoolCard key={t.type_id} pool={t} />
            ))}
          </div>
        </div>
      )}

      {/* Por setor */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Por Setor</h2>
          <p className="text-sm text-slate-500">Agrupa todas as impressoras pelo setor responsavel.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left">Setor</th>
                <th className="px-4 py-3 text-right">Impressoras</th>
                <th className="px-4 py-3 text-right">Cota mensal</th>
                <th className="px-4 py-3 text-right">Liberacoes</th>
                <th className="px-4 py-3 text-right">Uso</th>
                <th className="px-4 py-3 text-left">% Uso</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bySector.map(s => (
                <tr key={s.sector_id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{s.sector_name}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{s.printer_count}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatNumber(s.monthly_limit)}</td>
                  <td className="px-4 py-3 text-right font-mono text-emerald-600">{s.releases > 0 ? `+${formatNumber(s.releases)}` : '-'}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatNumber(s.current_usage)}</td>
                  <td className="px-4 py-3 w-44">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-slate-100 rounded-full h-2 min-w-[60px]">
                        <div
                          className={`h-2 rounded-full ${
                            s.usage_pct >= 100 ? 'bg-red-500' :
                            s.usage_pct >= 90 ? 'bg-orange-500' :
                            s.usage_pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(100, s.usage_pct)}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium tabular-nums w-12 text-right">{formatPercent(s.usage_pct)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge status={s.status} />
                  </td>
                </tr>
              ))}
              {bySector.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Sem dados</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick views */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <QuickList
          title="Estouradas (acao prioritaria)"
          icon={AlertTriangle}
          color="text-red-600"
          rows={overflowed.slice(0, 8)}
          renderRow={p => (
            <>
              <span className="font-medium">{p.name}</span>
              <span className="text-xs text-slate-500 ml-2">{p.sector_name || '-'}</span>
              <span className="ml-auto font-mono text-sm text-red-600">
                {formatNumber(p.current_usage)} / {formatNumber(p.effective_limit)} ({formatPercent(p.usage_pct)})
              </span>
            </>
          )}
          emptyMessage="Nenhuma impressora estourada. Tudo sob controle."
        />
        <QuickList
          title="Ociosas (margem disponivel)"
          icon={CheckCircle2}
          color="text-sky-600"
          rows={idlePrinters.slice(0, 8)}
          renderRow={p => (
            <>
              <span className="font-medium">{p.name}</span>
              <span className="text-xs text-slate-500 ml-2">{p.sector_name || '-'}</span>
              <span className="ml-auto font-mono text-sm text-sky-600">
                {formatNumber(p.current_usage)} / {formatNumber(p.monthly_limit)} (sobra {formatNumber((p.monthly_limit || 0) - (p.current_usage || 0))})
              </span>
            </>
          )}
          emptyMessage="Nenhuma impressora ociosa neste mes."
        />
      </div>

      {/* Tabela completa */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Todas as Impressoras</h2>
            <p className="text-sm text-slate-500">{filteredPrinters.length} de {printers.length} impressoras</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder="Buscar por nome, IP ou setor..."
              value={searchPrinter}
              onChange={e => setSearchPrinter(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as BalanceStatus | '')}
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
            >
              <option value="">Todos status</option>
              <option value="overflow">Estouradas</option>
              <option value="critical">Criticas</option>
              <option value="warning">Atencao</option>
              <option value="ok">OK</option>
              <option value="idle">Ociosas</option>
              <option value="unset">Sem cota</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto max-h-[600px]">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left">Impressora</th>
                <th className="px-4 py-3 text-left">Setor</th>
                <th className="px-4 py-3 text-right">Limite</th>
                <th className="px-4 py-3 text-right">Liberacoes</th>
                <th className="px-4 py-3 text-right">Uso</th>
                <th className="px-4 py-3 text-left">% Uso</th>
                <th className="px-4 py-3 text-center">Sync</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPrinters.map(p => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{p.name}</div>
                    <div className="text-xs text-slate-500">{p.ip_address || '-'}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{p.sector_name || '-'}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatNumber(p.monthly_limit)}</td>
                  <td className="px-4 py-3 text-right font-mono text-emerald-600">{p.releases > 0 ? `+${formatNumber(p.releases)}` : '-'}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatNumber(p.current_usage)}</td>
                  <td className="px-4 py-3 w-44">
                    {p.usage_pct == null ? (
                      <span className="text-slate-400 text-xs">-</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-100 rounded-full h-2 min-w-[60px]">
                          <div
                            className={`h-2 rounded-full ${
                              p.usage_pct >= 100 ? 'bg-red-500' :
                              p.usage_pct >= 90 ? 'bg-orange-500' :
                              p.usage_pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(100, p.usage_pct)}%` }}
                          />
                        </div>
                        <span className="text-xs tabular-nums w-12 text-right">{formatPercent(p.usage_pct)}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {p.quota_sync_enabled ? (
                      <span title="Sync EWS ativo" className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-emerald-100 text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </span>
                    ) : (
                      <span className="text-slate-300 text-xs">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center"><StatusBadge status={p.status} /></td>
                </tr>
              ))}
              {filteredPrinters.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">Nenhuma impressora encontrada</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// PROPOSAL TAB
// ============================================================================
type ProposalProps = {
  period: string;
  isAdmin: boolean;
  loading: boolean;
  proposalsList: ProposalSummary[];
  activeProposal: QuotaProposal | null;
  editedItems: Record<number, number | null>;
  setEditedItems: (v: Record<number, number | null> | ((prev: Record<number, number | null>) => Record<number, number | null>)) => void;
  onGenerate: () => void;
  onLoadProposal: (id: number) => void;
  onSaveItem: (itemId: number, value: number | null) => void;
  onFillSuggested: () => void;
  onApprove: () => void;
  onReject: () => void;
};

function ProposalTab(props: ProposalProps) {
  const {
    period, isAdmin, loading, proposalsList, activeProposal,
    editedItems, setEditedItems,
    onGenerate, onLoadProposal, onSaveItem, onFillSuggested, onApprove, onReject,
  } = props;

  if (proposalsList.length === 0 && !activeProposal) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
        <ListTodo className="h-12 w-12 text-slate-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-slate-900">Nenhuma proposta ainda</h3>
        <p className="text-sm text-slate-500 mt-1 mb-6">
          Gere uma proposta com base no consumo dos ultimos 3 meses, edite os limites por impressora e aprove. Sera aplicada no dia 1 do periodo automaticamente.
        </p>
        {isAdmin && (
          <button
            onClick={onGenerate}
            disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Plus className="h-5 w-5" />
            Gerar proposta para o proximo mes
          </button>
        )}
      </div>
    );
  }

  if (!activeProposal) {
    return <div className="text-slate-500 text-center py-12">Carregando...</div>;
  }

  const totals = activeProposal.totals;
  const isReadOnly = activeProposal.status === 'applied' || !isAdmin;

  return (
    <div className="space-y-6">
      {/* Header da proposta */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
              <Calendar className="h-6 w-6 text-blue-600" />
              Proposta - {formatPeriodLabel(activeProposal.period)}
            </h2>
            <div className="flex items-center gap-3 mt-2 text-sm">
              <ProposalStatusBadge status={activeProposal.status} />
              <span className="text-slate-500">
                Gerada em {new Date(activeProposal.generated_at).toLocaleString('pt-BR')}
                {activeProposal.generated_by_name && ` por ${activeProposal.generated_by_name}`}
              </span>
              {activeProposal.approved_at && (
                <span className="text-emerald-600 text-xs">
                  Aprovada em {new Date(activeProposal.approved_at).toLocaleString('pt-BR')}
                  {activeProposal.approved_by_name && ` por ${activeProposal.approved_by_name}`}
                </span>
              )}
            </div>
          </div>
          {isAdmin && (
            <div className="flex flex-wrap gap-2">
              {activeProposal.status !== 'applied' && (
                <>
                  <button
                    onClick={onFillSuggested}
                    className="px-3 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50"
                    title="Preenche approved_limit com a sugestao em itens nao editados"
                  >
                    Aplicar sugestoes
                  </button>
                  <button
                    onClick={onGenerate}
                    className="px-3 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50"
                    title="Recalcula a proposta com base nos dados mais recentes"
                  >
                    <RefreshCw className="h-3.5 w-3.5 inline mr-1" /> Regerar
                  </button>
                </>
              )}
              {activeProposal.status === 'draft' && (
                <button
                  onClick={onApprove}
                  className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-1"
                >
                  <CheckCircle2 className="h-4 w-4" /> Aprovar
                </button>
              )}
              {(activeProposal.status === 'draft' || activeProposal.status === 'approved') && (
                <button
                  onClick={onReject}
                  className="px-4 py-2 text-sm bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 flex items-center gap-1"
                >
                  <XCircle className="h-4 w-4" /> Rejeitar
                </button>
              )}
            </div>
          )}
        </div>

        {/* Totais */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-200">
          <div>
            <div className="text-xs text-slate-500 uppercase">Atual</div>
            <div className="text-2xl font-bold text-slate-900 font-mono">{formatNumber(totals.totalCurrent)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 uppercase">Sugerido</div>
            <div className="text-2xl font-bold text-blue-600 font-mono">{formatNumber(totals.totalSuggested)}</div>
            <div className={`text-xs ${totals.deltaSuggested >= 0 ? 'text-orange-600' : 'text-emerald-600'}`}>
              {totals.deltaSuggested >= 0 ? '+' : ''}{formatNumber(totals.deltaSuggested)} vs atual
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500 uppercase">Aprovado/Final</div>
            <div className="text-2xl font-bold text-emerald-600 font-mono">{formatNumber(totals.totalApproved)}</div>
            <div className={`text-xs ${totals.deltaApproved >= 0 ? 'text-orange-600' : 'text-emerald-600'}`}>
              {totals.deltaApproved >= 0 ? '+' : ''}{formatNumber(totals.deltaApproved)} vs atual
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500 uppercase">Variacao %</div>
            <div className="text-2xl font-bold text-slate-900 font-mono">
              {totals.totalCurrent > 0
                ? `${((totals.deltaApproved / totals.totalCurrent) * 100).toFixed(1)}%`
                : '-'}
            </div>
          </div>
        </div>

        {/* Totais por tipo (custos diferentes => pools diferentes contratados) */}
        {totals.byType && totals.byType.length > 0 && (
          <div className="mt-6 pt-6 border-t border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-3">
              <Layers className="h-4 w-4 text-violet-600" />
              Por tipo de impressora (vs pool contratado)
            </h3>
            {totals.byType.some(t => t.overflowApproved) && (
              <div className="mb-3 flex items-start gap-2 p-3 rounded-lg border border-red-200 bg-red-50">
                <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-red-700">
                  <strong>Atencao:</strong> a soma dos limites aprovados ultrapassa o pool contratado em pelo menos um tipo.
                  Reduza limites individuais ou renegocie a cota com a Simpress antes de aplicar.
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {totals.byType.map(t => <ProposalTypeCard key={t.type_code} t={t} />)}
            </div>
          </div>
        )}
      </div>

      {/* Tabela de itens */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Itens por impressora</h2>
            <p className="text-sm text-slate-500">{activeProposal.items.length} impressoras</p>
          </div>
        </div>
        <div className="overflow-x-auto max-h-[700px]">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left">Impressora</th>
                <th className="px-4 py-3 text-left">Setor</th>
                <th className="px-4 py-3 text-right">Limite atual</th>
                <th className="px-4 py-3 text-right">Uso atual</th>
                <th className="px-4 py-3 text-right">Media 3M</th>
                <th className="px-4 py-3 text-right">Sugestao</th>
                <th className="px-4 py-3 text-right">Aprovado</th>
                <th className="px-4 py-3 text-left">Razao</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activeProposal.items.map(it => {
                const editing = it.id in editedItems;
                const editedValue = editedItems[it.id];
                const finalApproved = it.approved_limit ?? it.suggested_limit;
                const delta = finalApproved - it.current_limit;
                return (
                  <tr key={it.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{it.printer_name}</div>
                      <div className="text-xs text-slate-500">{it.ip_address}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{it.sector_name || '-'}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatNumber(it.current_limit)}</td>
                    <td className="px-4 py-3 text-right font-mono text-orange-600">{formatNumber(it.current_usage)}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-500">{formatNumber(it.avg_3m)}</td>
                    <td className="px-4 py-3 text-right font-mono text-blue-600">{formatNumber(it.suggested_limit)}</td>
                    <td className="px-4 py-3 text-right">
                      {isReadOnly ? (
                        <span className="font-mono font-semibold">{formatNumber(finalApproved)}</span>
                      ) : (
                        <div className="flex items-center gap-1 justify-end">
                          <input
                            type="number"
                            min={0}
                            value={editing ? (editedValue ?? '') : (it.approved_limit ?? '')}
                            placeholder={String(it.suggested_limit)}
                            onChange={e => {
                              const val = e.target.value === '' ? null : parseInt(e.target.value, 10);
                              setEditedItems(prev => ({ ...prev, [it.id]: val }));
                            }}
                            className="w-24 px-2 py-1 text-right text-sm font-mono border border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                          />
                          {editing && (
                            <button
                              onClick={() => onSaveItem(it.id, editedValue)}
                              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                              title="Salvar"
                            >
                              <Save className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      )}
                      {!editing && delta !== 0 && (
                        <div className={`text-xs ${delta > 0 ? 'text-orange-600' : 'text-emerald-600'}`}>
                          {delta > 0 ? '+' : ''}{formatNumber(delta)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{it.reason || '-'}</td>
                    <td className="px-4 py-3"></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Historico de propostas */}
      {proposalsList.length > 1 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">Historico de propostas</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {proposalsList.map(p => (
              <div key={p.id} className={`flex items-center gap-4 p-4 hover:bg-slate-50 ${p.id === activeProposal?.id ? 'bg-blue-50/50' : ''}`}>
                <div className="flex-1">
                  <div className="font-medium">{formatPeriodLabel(p.period)}</div>
                  <div className="text-xs text-slate-500">
                    {p.item_count} itens
                    {p.generated_by_name && ` - gerada por ${p.generated_by_name}`}
                    {p.approved_at && ` - aprovada por ${p.approved_by_name || 'desconhecido'}`}
                    {p.applied_at && ` - aplicada em ${new Date(p.applied_at).toLocaleDateString('pt-BR')}`}
                  </div>
                </div>
                <ProposalStatusBadge status={p.status} />
                <button
                  onClick={() => onLoadProposal(p.id)}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Ver
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// COMPONENTES
// ============================================================================
function KPICard({ label, value, sub, icon: Icon, color }: { label: string; value: string | number; sub?: string; icon: typeof Activity; color: string }) {
  return (
    <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-500 uppercase tracking-wider">{label}</span>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      <div className="text-2xl font-bold text-slate-900 font-mono">{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}

function StatusBadge({ status }: { status: BalanceStatus }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

function ProposalTypeCard({ t }: { t: ProposalTotalsByType }) {
  const overflow = t.overflowApproved;
  const pct = t.poolUsagePctApproved;
  const barColor = overflow ? 'bg-red-500' : pct >= 95 ? 'bg-orange-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500';
  const pctColor = overflow ? 'text-red-600' : pct >= 95 ? 'text-orange-600' : pct >= 80 ? 'text-amber-600' : 'text-emerald-600';
  return (
    <div className={`rounded-lg border p-3 ${overflow ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-semibold text-slate-700">{t.type_name}</div>
          <div className="text-[10px] text-slate-500">{t.printer_count} impressoras</div>
        </div>
        <div className={`text-sm font-semibold tabular-nums ${pctColor}`}>{pct}%</div>
      </div>
      <div className="font-mono text-base font-bold text-slate-900 mt-2">
        {formatNumber(t.totalApproved)} <span className="text-xs text-slate-500 font-normal">/ {formatNumber(t.pool_total)}</span>
      </div>
      <div className="w-full bg-slate-200 rounded-full h-1.5 mt-1.5">
        <div className={`h-1.5 rounded-full ${barColor}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <div className="grid grid-cols-2 gap-2 mt-2 text-[10px]">
        <div>
          <span className="text-slate-500">Atual: </span>
          <span className="font-mono text-slate-700">{formatNumber(t.totalCurrent)}</span>
        </div>
        <div>
          <span className="text-slate-500">Delta: </span>
          <span className={`font-mono font-semibold ${t.deltaApproved >= 0 ? 'text-orange-600' : 'text-emerald-600'}`}>
            {t.deltaApproved >= 0 ? '+' : ''}{formatNumber(t.deltaApproved)}
          </span>
        </div>
      </div>
    </div>
  );
}

function TypePoolCard({ pool }: { pool: BalanceTypePool }) {
  const consumed = pool.usage_total + pool.releases_total;
  const pct = pool.usage_pct;
  const overflow = pct > 100;
  const critical = pct >= 90 && pct <= 100;
  const isColor = pool.color_only === 1;
  const Icon = isColor ? Palette : (pool.code === 'MULTIFUNCIONAL_MONO' ? Layers : PrinterIcon);
  const iconColor = isColor ? 'text-fuchsia-600' : (pool.code === 'MULTIFUNCIONAL_MONO' ? 'text-indigo-600' : 'text-slate-600');
  const barColor = overflow ? 'bg-red-500' : critical ? 'bg-orange-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500';
  const pctColor = overflow ? 'text-red-600' : critical ? 'text-orange-600' : pct >= 70 ? 'text-amber-600' : 'text-emerald-600';

  return (
    <div className={`rounded-lg border bg-slate-50 p-4 ${overflow ? 'border-red-200' : 'border-slate-200'}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Cota Contratada</div>
          <div className="flex items-center gap-2 mt-0.5">
            <Icon className={`h-4 w-4 ${iconColor}`} />
            <span className="text-sm font-semibold text-slate-900">{pool.name}</span>
          </div>
          <div className="text-xs text-slate-500 mt-0.5">{pool.printer_count} impressoras</div>
        </div>
      </div>
      <div className="flex items-end justify-between mt-3">
        <div className="font-mono text-xl font-bold text-slate-900">
          {formatNumber(consumed)} <span className="text-xs text-slate-500 font-normal">/ {formatNumber(pool.pool_total)}</span>
        </div>
        <div className={`text-sm font-semibold tabular-nums ${pctColor}`}>{pct}%</div>
      </div>
      <div className="w-full bg-slate-200 rounded-full h-2 mt-2">
        <div
          className={`h-2 rounded-full transition-all ${barColor}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3 text-center">
        <div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider">Uso</div>
          <div className="font-mono text-sm font-semibold text-slate-700">{formatNumber(pool.usage_total)}</div>
        </div>
        <div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider">Liberado</div>
          <div className={`font-mono text-sm font-semibold ${pool.releases_total > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
            {pool.releases_total > 0 ? `+${formatNumber(pool.releases_total)}` : '0'}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider">Saldo</div>
          <div className={`font-mono text-sm font-semibold ${pool.remaining < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
            {formatNumber(pool.remaining)}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProposalStatusBadge({ status }: { status: QuotaProposal['status'] }) {
  const map: Record<QuotaProposal['status'], { label: string; cls: string }> = {
    draft: { label: 'Rascunho', cls: 'bg-slate-100 text-slate-700 border-slate-200' },
    pending: { label: 'Pendente', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
    approved: { label: 'Aprovada', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    rejected: { label: 'Rejeitada', cls: 'bg-red-100 text-red-700 border-red-200' },
    applied: { label: 'Aplicada', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  };
  const s = map[status];
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${s.cls}`}>
      {s.label}
    </span>
  );
}

function QuickList<T extends { id: number }>({ title, icon: Icon, color, rows, renderRow, emptyMessage }: {
  title: string;
  icon: typeof Activity;
  color: string;
  rows: T[];
  renderRow: (row: T) => React.ReactNode;
  emptyMessage: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-200 flex items-center gap-2">
        <Icon className={`h-5 w-5 ${color}`} />
        <h3 className="font-semibold text-slate-900">{title}</h3>
      </div>
      {rows.length === 0 ? (
        <div className="p-6 text-center text-sm text-slate-500">{emptyMessage}</div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map(r => (
            <li key={r.id} className="px-4 py-2.5 text-sm flex items-center hover:bg-slate-50">
              {renderRow(r)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RebalanceModal({
  printers, fromId, toId, amount, reason, saving,
  setFromId, setToId, setAmount, setReason, onClose, onSubmit,
}: {
  printers: BalancePrinter[];
  fromId: number | '';
  toId: number | '';
  amount: string;
  reason: string;
  saving: boolean;
  setFromId: (id: number | '') => void;
  setToId: (id: number | '') => void;
  setAmount: (a: string) => void;
  setReason: (r: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const fromPrinter = printers.find(p => p.id === fromId);
  const toPrinter = printers.find(p => p.id === toId);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ArrowRight className="h-5 w-5 text-blue-600" /> Remanejar cota entre impressoras
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <XCircle className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-600">
            Tira X paginas do limite mensal de uma impressora e adiciona na outra.
            Nao altera a cota total da empresa nem o uso atual.
          </p>
          <div className="flex items-start gap-2 p-3 rounded-lg border border-violet-200 bg-violet-50">
            <Layers className="h-4 w-4 text-violet-600 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-violet-700">
              Remanejamento e permitido <strong>somente entre impressoras do mesmo tipo</strong>
              (Mono, Mono MFP ou Color), pois cada tipo tem custo de pagina diferente e pool contratado proprio.
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-700 mb-1 block">De (origem)</label>
              <select
                value={fromId}
                onChange={e => {
                  const newFrom = e.target.value ? parseInt(e.target.value, 10) : '';
                  setFromId(newFrom);
                  // Se mudar a origem e o destino atual nao for do mesmo tipo, limpa
                  if (newFrom && toId) {
                    const fromP = printers.find(p => p.id === newFrom);
                    const toP = printers.find(p => p.id === toId);
                    if (fromP && toP && fromP.type_code !== toP.type_code) {
                      setToId('');
                    }
                  }
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              >
                <option value="">Selecione...</option>
                {printers
                  .filter(p => (p.monthly_limit || 0) > 0)
                  .sort((a, b) => (b.monthly_limit || 0) - (a.monthly_limit || 0))
                  .map(p => (
                    <option key={p.id} value={p.id}>
                      [{p.type_code || 'SEM'}] {p.name} ({p.sector_name || '-'}) - {formatNumber(p.monthly_limit)}p
                    </option>
                  ))}
              </select>
              {fromPrinter && (
                <div className="text-xs text-slate-500 mt-1">
                  Tipo: <span className="font-semibold">{fromPrinter.type_name || 'sem tipo'}</span> &middot; Uso: {formatNumber(fromPrinter.current_usage)} / {formatNumber(fromPrinter.monthly_limit)}
                </div>
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700 mb-1 block">
                Para (destino) {fromPrinter?.type_code && <span className="text-violet-600">- somente {fromPrinter.type_code}</span>}
              </label>
              <select
                value={toId}
                onChange={e => setToId(e.target.value ? parseInt(e.target.value, 10) : '')}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                disabled={!fromId}
              >
                <option value="">{fromId ? 'Selecione...' : 'Escolha a origem primeiro'}</option>
                {printers
                  .filter(p => p.id !== fromId)
                  .filter(p => !fromPrinter?.type_code || p.type_code === fromPrinter.type_code)
                  .sort((a, b) => (a.sector_name || '').localeCompare(b.sector_name || ''))
                  .map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sector_name || '-'}) - {formatNumber(p.monthly_limit)}p
                    </option>
                  ))}
              </select>
              {toPrinter && (
                <div className="text-xs text-slate-500 mt-1">
                  Tipo: <span className="font-semibold">{toPrinter.type_name || 'sem tipo'}</span> &middot; Uso: {formatNumber(toPrinter.current_usage)} / {formatNumber(toPrinter.monthly_limit)}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-700 mb-1 block">Quantidade (paginas)</label>
            <input
              type="number"
              min={1}
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="Ex: 1000"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
            {fromPrinter && amount && parseInt(amount, 10) > (fromPrinter.monthly_limit || 0) && (
              <div className="text-xs text-red-600 mt-1">
                Limite insuficiente: origem tem apenas {formatNumber(fromPrinter.monthly_limit)} paginas.
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-slate-700 mb-1 block">Motivo (opcional)</label>
            <input
              type="text"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Ex: Migrei volume de impressao do setor X para Y"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
        </div>
        <div className="p-4 border-t border-slate-200 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            onClick={onSubmit}
            disabled={saving || !fromId || !toId || !amount}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Aplicando...' : 'Aplicar remanejamento'}
          </button>
        </div>
      </div>
    </div>
  );
}
