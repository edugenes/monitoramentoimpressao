'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { Printer, Sector, SnmpReading, SnmpTestResult } from '@/lib/types';
import { formatDateTime } from '@/lib/dateUtils';
import { usePolling } from '@/hooks/usePolling';
import Modal from '@/components/Modal';
import Pagination from '@/components/Pagination';
import { Plus, Pencil, Trash2, Search, Printer as PrinterIcon, Wifi, WifiOff, Droplets } from 'lucide-react';

const PAGE_SIZE = 12;

export default function Impressoras() {
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [latestReadings, setLatestReadings] = useState<Record<number, SnmpReading>>({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Printer | null>(null);
  const [form, setForm] = useState({ name: '', model: '', sector_id: '', local_description: '', ip_address: '', snmp_community: 'public' });
  const [page, setPage] = useState(1);
  const [testModal, setTestModal] = useState<{ open: boolean; loading: boolean; result: SnmpTestResult | null; printerId: number | null }>({
    open: false, loading: false, result: null, printerId: null,
  });

  const fetchData = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const [printerData, sectorData, readingsData] = await Promise.all([
        api.get<Printer[]>('/printers'),
        api.get<Sector[]>('/sectors'),
        api.get<SnmpReading[]>('/snmp/latest').catch(() => [] as SnmpReading[]),
      ]);
      setPrinters(printerData);
      setSectors(sectorData.filter(s => s.active));
      const map: Record<number, SnmpReading> = {};
      for (const r of readingsData) map[r.printer_id] = r;
      setLatestReadings(map);
    } catch { console.error('Erro ao carregar dados'); }
    finally { if (showLoading) setLoading(false); }
  }, []);

  useEffect(() => { fetchData(true); }, [fetchData]);
  useEffect(() => { setPage(1); }, [search]);

  usePolling(() => fetchData(false), { intervalMs: 30000, enabled: !modalOpen && !testModal.open });

  function openCreate() {
    setEditing(null);
    setForm({ name: '', model: '', sector_id: '', local_description: '', ip_address: '', snmp_community: 'public' });
    setModalOpen(true);
  }

  function openEdit(printer: Printer) {
    setEditing(printer);
    setForm({
      name: printer.name,
      model: printer.model || '',
      sector_id: printer.sector_id ? String(printer.sector_id) : '',
      local_description: printer.local_description || '',
      ip_address: printer.ip_address || '',
      snmp_community: printer.snmp_community || 'public',
    });
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const payload = {
        name: form.name,
        model: form.model,
        sector_id: form.sector_id ? parseInt(form.sector_id) : null,
        local_description: form.local_description,
        ip_address: form.ip_address,
        snmp_community: form.snmp_community,
        ...(editing ? { active: editing.active } : {}),
      };
      if (editing) {
        await api.put(`/printers/${editing.id}`, payload);
      } else {
        await api.post('/printers', payload);
      }
      setModalOpen(false);
      fetchData(false);
    } catch { alert('Erro ao salvar impressora'); }
  }

  async function handleDelete(id: number) {
    if (!confirm('Deseja realmente excluir esta impressora? Esta ação não pode ser desfeita.')) return;
    try { await api.delete(`/printers/${id}`); fetchData(false); }
    catch { alert('Erro ao excluir impressora'); }
  }

  async function handleTestSnmp(printerId: number) {
    setTestModal({ open: true, loading: true, result: null, printerId });
    try {
      const result = await api.post<SnmpTestResult>(`/snmp/test/${printerId}`, {});
      setTestModal({ open: true, loading: false, result, printerId });
    } catch {
      setTestModal({ open: true, loading: false, result: { success: false, ip: '', error: 'Falha na conexao' }, printerId });
    }
  }

  function getTonerColor(level: number | null | undefined) {
    if (level == null) return 'text-slate-300';
    if (level < 10) return 'text-red-500';
    if (level < 20) return 'text-yellow-500';
    return 'text-green-500';
  }

  const filtered = printers.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.model && p.model.toLowerCase().includes(search.toLowerCase())) ||
      (p.sector_name && p.sector_name.toLowerCase().includes(search.toLowerCase())) ||
      (p.local_description && p.local_description.toLowerCase().includes(search.toLowerCase()))
  );

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Impressoras</h1>
          <p className="text-slate-500 mt-1">{printers.length} impressoras cadastradas</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <Plus className="h-4 w-4" /> Nova Impressora
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-4 border-b border-slate-200">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input type="text" placeholder="Buscar por nome, modelo ou setor..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 text-sm" />
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400">Carregando...</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50">
                    <th className="text-left p-3 pl-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Nome</th>
                    <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Setor / Local</th>
                    <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">IP</th>
                    <th className="text-center p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Contador</th>
                    <th className="text-center p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Toner</th>
                    <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="text-right p-3 pr-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginated.map((printer) => {
                    const reading = latestReadings[printer.id];
                    return (
                      <tr key={printer.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3 pl-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                              <PrinterIcon className="h-4 w-4 text-blue-500" />
                            </div>
                            <div>
                              <span className="font-medium text-sm text-slate-800 block">{printer.name}</span>
                              <span className="text-xs text-slate-400">{printer.model || ''}</span>
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          {printer.sector_name ? (
                            <div>
                              <span className="text-sm font-medium text-slate-700 block">{printer.sector_name}</span>
                              {printer.local_description && <span className="text-xs text-slate-400">{printer.local_description}</span>}
                            </div>
                          ) : (
                            <span className="text-sm text-slate-300">—</span>
                          )}
                        </td>
                        <td className="p-3 text-sm font-mono">
                          {printer.ip_address ? (
                            <a href={`http://${printer.ip_address}`} target="_blank" rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 hover:underline transition-colors">
                              {printer.ip_address}
                            </a>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {reading ? (
                            <span className="text-sm font-medium text-slate-700 tabular-nums">{reading.page_count.toLocaleString('pt-BR')}</span>
                          ) : (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                        </td>
                        <td className="p-3">
                          {reading?.toner_cyan != null ? (
                            <div className="flex items-center gap-1.5">
                              <div className="flex flex-col items-center" title={`Ciano: ${reading.toner_cyan}%`}>
                                <div className="w-3 h-6 rounded-sm bg-slate-100 relative overflow-hidden">
                                  <div className="absolute bottom-0 w-full bg-cyan-500 transition-all" style={{ height: `${reading.toner_cyan}%` }} />
                                </div>
                                <span className="text-[9px] text-slate-400 mt-0.5">C</span>
                              </div>
                              <div className="flex flex-col items-center" title={`Magenta: ${reading.toner_magenta}%`}>
                                <div className="w-3 h-6 rounded-sm bg-slate-100 relative overflow-hidden">
                                  <div className="absolute bottom-0 w-full bg-pink-500 transition-all" style={{ height: `${reading.toner_magenta ?? 0}%` }} />
                                </div>
                                <span className="text-[9px] text-slate-400 mt-0.5">M</span>
                              </div>
                              <div className="flex flex-col items-center" title={`Amarelo: ${reading.toner_yellow}%`}>
                                <div className="w-3 h-6 rounded-sm bg-slate-100 relative overflow-hidden">
                                  <div className="absolute bottom-0 w-full bg-yellow-400 transition-all" style={{ height: `${reading.toner_yellow ?? 0}%` }} />
                                </div>
                                <span className="text-[9px] text-slate-400 mt-0.5">Y</span>
                              </div>
                              <div className="flex flex-col items-center" title={`Preto: ${reading.toner_black}%`}>
                                <div className="w-3 h-6 rounded-sm bg-slate-100 relative overflow-hidden">
                                  <div className="absolute bottom-0 w-full bg-slate-800 transition-all" style={{ height: `${reading.toner_black ?? 0}%` }} />
                                </div>
                                <span className="text-[9px] text-slate-400 mt-0.5">K</span>
                              </div>
                            </div>
                          ) : reading?.toner_level != null ? (
                            <div className="flex items-center justify-center gap-1">
                              <Droplets className={`h-3.5 w-3.5 ${getTonerColor(reading.toner_level)}`} />
                              <span className={`text-xs font-medium ${getTonerColor(reading.toner_level)}`}>{reading.toner_level}%</span>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                        </td>
                        <td className="p-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            printer.active ? 'bg-green-50 text-green-700 ring-1 ring-green-600/10' : 'bg-red-50 text-red-700 ring-1 ring-red-600/10'
                          }`}>{printer.active ? 'Ativa' : 'Inativa'}</span>
                        </td>
                        <td className="p-3 pr-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {printer.ip_address && (
                              <button onClick={() => handleTestSnmp(printer.id)}
                                className="p-1.5 rounded-md text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 transition-colors" title="Testar SNMP">
                                <Wifi className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <button onClick={() => openEdit(printer)} className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Editar">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => handleDelete(printer.id)} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Excluir">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {paginated.length === 0 && (
                    <tr><td colSpan={7} className="p-12 text-center text-slate-400">Nenhuma impressora encontrada</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination currentPage={page} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
          </>
        )}
      </div>

      {/* Modal Criar/Editar */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Impressora' : 'Nova Impressora'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nome *</label>
            <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700" placeholder="Ex: HP LaserJet Pro" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Modelo</label>
            <input type="text" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700" placeholder="Ex: M404dn" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Setor *</label>
            <select required value={form.sector_id} onChange={(e) => setForm({ ...form, sector_id: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700">
              <option value="">Selecione o setor...</option>
              {sectors.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Local no Setor</label>
            <input type="text" value={form.local_description} onChange={(e) => setForm({ ...form, local_description: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700" placeholder="Ex: Sala 201, ao lado da recepção" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Endereço IP</label>
              <input type="text" value={form.ip_address} onChange={(e) => setForm({ ...form, ip_address: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700" placeholder="192.168.1.100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Comunidade SNMP</label>
              <input type="text" value={form.snmp_community} onChange={(e) => setForm({ ...form, snmp_community: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700" placeholder="public" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">Cancelar</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">{editing ? 'Salvar' : 'Cadastrar'}</button>
          </div>
        </form>
      </Modal>

      {/* Modal Teste SNMP */}
      <Modal isOpen={testModal.open} onClose={() => setTestModal({ ...testModal, open: false })} title="Teste de Conexão SNMP">
        {testModal.loading ? (
          <div className="text-center py-8">
            <div className="animate-pulse text-slate-400">Testando conexão...</div>
          </div>
        ) : testModal.result ? (
          <div className="space-y-4">
            <div className={`flex items-center gap-3 p-4 rounded-lg ${
              testModal.result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
            }`}>
              {testModal.result.success ? (
                <Wifi className="h-6 w-6 text-green-600" />
              ) : (
                <WifiOff className="h-6 w-6 text-red-600" />
              )}
              <div>
                <p className={`font-semibold ${testModal.result.success ? 'text-green-800' : 'text-red-800'}`}>
                  {testModal.result.success ? 'Conexão bem-sucedida' : 'Falha na conexão'}
                </p>
                <p className="text-sm text-slate-500">IP: {testModal.result.ip}</p>
              </div>
            </div>

            {testModal.result.success && (
              <div className="grid grid-cols-2 gap-3">
                {testModal.result.pageCount != null && (
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-500">Contador de Páginas</p>
                    <p className="text-lg font-bold text-slate-800">{testModal.result.pageCount.toLocaleString('pt-BR')}</p>
                  </div>
                )}
                {testModal.result.tonerPercent != null && (
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-500">Nível de Toner</p>
                    <p className={`text-lg font-bold ${getTonerColor(testModal.result.tonerPercent)}`}>{testModal.result.tonerPercent}%</p>
                  </div>
                )}
                {testModal.result.status && (
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-500">Status</p>
                    <p className="text-lg font-bold text-slate-800 capitalize">{testModal.result.status}</p>
                  </div>
                )}
                {testModal.result.colorCount != null && (
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-500">Páginas Coloridas</p>
                    <p className="text-lg font-bold text-slate-800">{testModal.result.colorCount.toLocaleString('pt-BR')}</p>
                  </div>
                )}
                {testModal.result.monoCount != null && (
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-500">Páginas P&B</p>
                    <p className="text-lg font-bold text-slate-800">{testModal.result.monoCount.toLocaleString('pt-BR')}</p>
                  </div>
                )}
              </div>
            )}

            {testModal.result.error && (
              <p className="text-sm text-red-600">{testModal.result.error}</p>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
