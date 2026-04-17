'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { Quota, Printer } from '@/lib/types';
import { getCurrentPeriod } from '@/lib/dateUtils';
import { usePolling } from '@/hooks/usePolling';
import Modal from '@/components/Modal';
import ProgressBar from '@/components/ProgressBar';
import Pagination from '@/components/Pagination';
import { Plus, KeyRound, Search, Filter } from 'lucide-react';

const PAGE_SIZE = 12;

export default function Cotas() {
  const [quotas, setQuotas] = useState<Quota[]>([]);
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [sectorFilter, setSectorFilter] = useState('');
  const [printerFilter, setPrinterFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [modalType, setModalType] = useState<'create' | 'release' | null>(null);
  const [selectedQuota, setSelectedQuota] = useState<Quota | null>(null);

  const [createForm, setCreateForm] = useState({ printer_id: '', monthly_limit: '' });
  const [releaseForm, setReleaseForm] = useState({ amount: '', reason: '', released_by: '' });

  const period = getCurrentPeriod();

  const fetchData = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const [quotaData, printerData] = await Promise.all([
        api.get<Quota[]>(`/quotas?period=${period}`),
        api.get<Printer[]>('/printers'),
      ]);
      setQuotas(quotaData);
      setPrinters(printerData.filter((p) => p.active && p.sector_id));
    } catch { console.error('Erro ao carregar dados'); }
    finally { if (showLoading) setLoading(false); }
  }, [period]);

  const sectorOptions = printers.reduce<{ id: number; name: string }[]>((acc, p) => {
    if (p.sector_id && p.sector_name && !acc.find(s => s.id === p.sector_id)) {
      acc.push({ id: p.sector_id, name: p.sector_name });
    }
    return acc;
  }, []).sort((a, b) => a.name.localeCompare(b.name));

  useEffect(() => { fetchData(true); }, [fetchData]);
  useEffect(() => { setPage(1); }, [search, sectorFilter, printerFilter, statusFilter]);

  usePolling(() => fetchData(false), { intervalMs: 15000, enabled: modalType === null });

  function getEffectiveLimit(q: Quota): number {
    return q.monthly_limit + (q.total_released || 0);
  }

  function getPct(q: Quota): number {
    const limit = getEffectiveLimit(q);
    if (limit === 0) return 0;
    return Math.round((q.current_usage / limit) * 100);
  }

  const filtered = quotas.filter((q) => {
    if (search && !q.printer_name?.toLowerCase().includes(search.toLowerCase()) && !q.sector_name?.toLowerCase().includes(search.toLowerCase())) return false;
    if (sectorFilter && q.sector_id !== parseInt(sectorFilter)) return false;
    if (printerFilter && q.printer_id !== parseInt(printerFilter)) return false;
    if (statusFilter === 'critical' && getPct(q) < 100) return false;
    if (statusFilter === 'warning' && (getPct(q) < 80 || getPct(q) >= 100)) return false;
    if (statusFilter === 'normal' && getPct(q) >= 80) return false;
    return true;
  });

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totalUsage = filtered.reduce((s, q) => s + q.current_usage, 0);
  const totalLimit = filtered.reduce((s, q) => s + getEffectiveLimit(q), 0);
  const critical = filtered.filter(q => getPct(q) >= 100).length;
  const warning = filtered.filter(q => getPct(q) >= 80 && getPct(q) < 100).length;

  function openCreate() { setCreateForm({ printer_id: '', monthly_limit: '' }); setModalType('create'); }
  function openRelease(q: Quota) { setSelectedQuota(q); setReleaseForm({ amount: '', reason: '', released_by: '' }); setModalType('release'); }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.post('/quotas', { printer_id: parseInt(createForm.printer_id), monthly_limit: parseInt(createForm.monthly_limit) });
      setModalType(null); fetchData(false);
    } catch (err: any) { alert(err.message || 'Erro ao criar cota'); }
  }

  async function handleRelease(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedQuota) return;
    try {
      await api.post('/releases', { quota_id: selectedQuota.id, amount: parseInt(releaseForm.amount), reason: releaseForm.reason || null, released_by: releaseForm.released_by || null });
      setModalType(null); fetchData(false);
    } catch { alert('Erro ao registrar liberação'); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Cotas</h1>
          <p className="text-slate-500 mt-1">Gerencie as cotas de impressão por setor</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <Plus className="h-4 w-4" /> Nova Cota
        </button>
      </div>

      {/* Resumo rapido */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border border-slate-200 px-4 py-3">
          <p className="text-xs text-slate-500">Total de Cotas</p>
          <p className="text-xl font-bold text-slate-800">{filtered.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 px-4 py-3">
          <p className="text-xs text-slate-500">Páginas Usadas</p>
          <p className="text-xl font-bold text-slate-800">{totalUsage.toLocaleString('pt-BR')}<span className="text-sm font-normal text-slate-400"> / {totalLimit.toLocaleString('pt-BR')}</span></p>
        </div>
        <div className="bg-white rounded-lg border border-red-200 px-4 py-3">
          <p className="text-xs text-red-500">Excedidas</p>
          <p className="text-xl font-bold text-red-600">{critical}</p>
        </div>
        <div className="bg-white rounded-lg border border-yellow-200 px-4 py-3">
          <p className="text-xs text-yellow-600">Em Alerta</p>
          <p className="text-xl font-bold text-yellow-600">{warning}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-600">Filtros</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input type="text" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700" />
          </div>
          <select value={sectorFilter} onChange={(e) => setSectorFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Todos os setores</option>
            {sectorOptions.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
          </select>
          <select value={printerFilter} onChange={(e) => setPrinterFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Todas as impressoras</option>
            {printers.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Todos os status</option>
            <option value="critical">Excedidas (100%+)</option>
            <option value="warning">Em alerta (80–99%)</option>
            <option value="normal">Normal (&lt;80%)</option>
          </select>
        </div>
      </div>

      {/* Tabela */}
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
                    <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Setor</th>
                    <th className="text-right p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Limite</th>
                    <th className="text-right p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Uso</th>
                    <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider min-w-[160px]">Progresso</th>
                    <th className="text-right p-3 pr-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginated.map((quota) => {
                    const pct = getPct(quota);
                    return (
                      <tr key={quota.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3 pl-4 text-sm font-medium text-slate-800">{quota.printer_name}</td>
                        <td className="p-3 text-sm text-slate-600">{quota.sector_name}</td>
                        <td className="p-3 text-sm text-right tabular-nums">
                          <span className="text-slate-600">{quota.monthly_limit.toLocaleString('pt-BR')}</span>
                          {quota.total_released > 0 && (
                            <span className="text-purple-500 text-xs ml-1" title="Liberação extra (apenas este mês)">+{quota.total_released.toLocaleString('pt-BR')}</span>
                          )}
                        </td>
                        <td className="p-3 text-sm text-slate-600 text-right tabular-nums">{quota.current_usage.toLocaleString('pt-BR')}</td>
                        <td className="p-3"><ProgressBar percentage={pct} /></td>
                        <td className="p-3 pr-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button onClick={() => openRelease(quota)}
                              className="flex items-center gap-1 px-2.5 py-1 text-xs bg-purple-50 text-purple-600 rounded-md hover:bg-purple-100 transition-colors">
                              <KeyRound className="h-3 w-3" /> Liberar
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {paginated.length === 0 && (
                    <tr><td colSpan={6} className="p-12 text-center text-slate-400">Nenhuma cota encontrada</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination currentPage={page} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
          </>
        )}
      </div>

      {/* Modal Nova Cota */}
      <Modal isOpen={modalType === 'create'} onClose={() => setModalType(null)} title="Nova Cota">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Impressora *</label>
            <select required value={createForm.printer_id} onChange={(e) => setCreateForm({ ...createForm, printer_id: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700">
              <option value="">Selecione...</option>
              {printers.map((p) => (<option key={p.id} value={p.id}>{p.name} — {p.sector_name}</option>))}
            </select>
          </div>
          {createForm.printer_id && (() => {
            const sel = printers.find(p => p.id === parseInt(createForm.printer_id));
            return sel?.sector_name ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                <span className="text-blue-500">Setor:</span> <strong>{sel.sector_name}</strong>
                {sel.local_description && <span className="text-blue-400 ml-2">({sel.local_description})</span>}
              </div>
            ) : null;
          })()}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Limite Mensal (páginas) *</label>
            <input type="number" required min="0" value={createForm.monthly_limit} onChange={(e) => setCreateForm({ ...createForm, monthly_limit: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700" placeholder="Ex: 500" />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setModalType(null)} className="px-4 py-2 text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">Cancelar</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">Cadastrar</button>
          </div>
        </form>
      </Modal>

      {/* Modal Liberar Cota */}
      <Modal isOpen={modalType === 'release'} onClose={() => setModalType(null)} title={`Liberar Cota Extra`}>
        <form onSubmit={handleRelease} className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800 space-y-1">
            <p><span className="text-yellow-600">Impressora:</span> <strong>{selectedQuota?.printer_name}</strong></p>
            <p><span className="text-yellow-600">Setor:</span> <strong>{selectedQuota?.sector_name}</strong></p>
            <p><span className="text-yellow-600">Cota mensal:</span> <strong>{selectedQuota?.monthly_limit.toLocaleString('pt-BR')}</strong>
              {(selectedQuota?.total_released ?? 0) > 0 && <span className="text-purple-600"> (+{selectedQuota?.total_released.toLocaleString('pt-BR')} liberado)</span>}
            </p>
            <p><span className="text-yellow-600">Uso:</span> <strong>{selectedQuota?.current_usage.toLocaleString('pt-BR')}</strong></p>
            <p className="text-xs text-yellow-600 mt-1">A liberação vale apenas para este mês. No próximo mês a cota volta ao valor original.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Páginas a Liberar *</label>
            <input type="number" required min="1" value={releaseForm.amount} onChange={(e) => setReleaseForm({ ...releaseForm, amount: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700" placeholder="Ex: 200" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Motivo</label>
            <textarea value={releaseForm.reason} onChange={(e) => setReleaseForm({ ...releaseForm, reason: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700" rows={2} placeholder="Ex: Demanda extra para relatório trimestral" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Liberado por</label>
            <input type="text" value={releaseForm.released_by} onChange={(e) => setReleaseForm({ ...releaseForm, released_by: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700" placeholder="Nome de quem autorizou" />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setModalType(null)} className="px-4 py-2 text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">Cancelar</button>
            <button type="submit" className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">Liberar</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
