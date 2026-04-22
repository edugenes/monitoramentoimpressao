'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { Sector } from '@/lib/types';
import { formatDateTime } from '@/lib/dateUtils';
import { usePolling } from '@/hooks/usePolling';
import Modal from '@/components/Modal';
import Pagination from '@/components/Pagination';
import SortableTh from '@/components/SortableTh';
import { useTableSort } from '@/hooks/useTableSort';
import { Plus, Pencil, Trash2, Search, Building2 } from 'lucide-react';

const PAGE_SIZE = 12;

export default function Setores() {
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Sector | null>(null);
  const [form, setForm] = useState({ name: '', responsible: '' });
  const [page, setPage] = useState(1);

  const fetchData = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try { const data = await api.get<Sector[]>('/sectors'); setSectors(data); }
    catch { console.error('Erro ao carregar setores'); }
    finally { if (showLoading) setLoading(false); }
  }, []);

  useEffect(() => { fetchData(true); }, [fetchData]);
  useEffect(() => { setPage(1); }, [search]);

  usePolling(() => fetchData(false), { intervalMs: 30000, enabled: !modalOpen });

  function openCreate() { setEditing(null); setForm({ name: '', responsible: '' }); setModalOpen(true); }

  function openEdit(sector: Sector) {
    setEditing(sector);
    setForm({ name: sector.name, responsible: sector.responsible || '' });
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editing) { await api.put(`/sectors/${editing.id}`, { ...form, active: editing.active }); }
      else { await api.post('/sectors', form); }
      setModalOpen(false); fetchData(false);
    } catch { alert('Erro ao salvar setor'); }
  }

  async function handleDelete(id: number) {
    if (!confirm('Deseja realmente excluir este setor? Esta ação não pode ser desfeita.')) return;
    try { await api.delete(`/sectors/${id}`); fetchData(false); }
    catch { alert('Erro ao excluir setor'); }
  }

  const filtered = sectors.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.responsible && s.responsible.toLowerCase().includes(search.toLowerCase()))
  );

  const { sortKey, sortDir, handleSort, sortedData } = useTableSort(filtered, {
    columns: {
      name: { key: 'name', getter: (s) => s.name },
      responsible: { key: 'responsible', getter: (s) => s.responsible || '' },
      status: { key: 'status', getter: (s) => (s.active ? 1 : 0), defaultDir: 'desc' },
      created_at: { key: 'created_at', getter: (s) => s.created_at || '', defaultDir: 'desc' },
    },
    defaultKey: 'name',
  });

  const paginated = sortedData.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Setores</h1>
          <p className="text-slate-500 mt-1">{sectors.length} setores cadastrados</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <Plus className="h-4 w-4" /> Novo Setor
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-4 border-b border-slate-200">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input type="text" placeholder="Buscar por nome ou responsável..." value={search} onChange={(e) => setSearch(e.target.value)}
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
                    <SortableTh label="Nome" sortKey="name" align="left"
                      currentKey={sortKey} currentDir={sortDir} onSortChange={handleSort} className="pl-4" />
                    <SortableTh label="Responsável" sortKey="responsible" align="left"
                      currentKey={sortKey} currentDir={sortDir} onSortChange={handleSort} />
                    <SortableTh label="Status" sortKey="status" align="left"
                      currentKey={sortKey} currentDir={sortDir} onSortChange={handleSort} />
                    <SortableTh label="Cadastro" sortKey="created_at" align="left"
                      currentKey={sortKey} currentDir={sortDir} onSortChange={handleSort} />
                    <th className="text-right p-3 pr-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginated.map((sector) => (
                    <tr key={sector.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3 pl-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                            <Building2 className="h-4 w-4 text-green-500" />
                          </div>
                          <span className="font-medium text-sm text-slate-800">{sector.name}</span>
                        </div>
                      </td>
                      <td className="p-3 text-sm text-slate-600">{sector.responsible || '—'}</td>
                      <td className="p-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          sector.active ? 'bg-green-50 text-green-700 ring-1 ring-green-600/10' : 'bg-red-50 text-red-700 ring-1 ring-red-600/10'
                        }`}>{sector.active ? 'Ativo' : 'Inativo'}</span>
                      </td>
                      <td className="p-3 text-xs text-slate-400">{formatDateTime(sector.created_at)}</td>
                      <td className="p-3 pr-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(sector)} className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Editar">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => handleDelete(sector.id)} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Excluir">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {paginated.length === 0 && (
                    <tr><td colSpan={5} className="p-12 text-center text-slate-400">Nenhum setor encontrado</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination currentPage={page} totalItems={sortedData.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
          </>
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Setor' : 'Novo Setor'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nome *</label>
            <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700" placeholder="Ex: Financeiro" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Responsável</label>
            <input type="text" value={form.responsible} onChange={(e) => setForm({ ...form, responsible: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700" placeholder="Ex: João Silva" />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">Cancelar</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">{editing ? 'Salvar' : 'Cadastrar'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
