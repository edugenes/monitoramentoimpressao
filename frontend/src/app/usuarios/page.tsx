'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { User, Sector } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { usePolling } from '@/hooks/usePolling';
import Modal from '@/components/Modal';
import SortableTh from '@/components/SortableTh';
import { useTableSort } from '@/hooks/useTableSort';
import { Plus, Pencil, Trash2, Shield, Eye, Search } from 'lucide-react';

export default function Usuarios() {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState({
    username: '',
    name: '',
    password: '',
    role: 'gestor' as 'admin' | 'gestor',
    active: true,
    sector_ids: [] as number[],
  });

  useEffect(() => {
    if (!isAdmin) router.replace('/');
  }, [isAdmin, router]);

  const fetchData = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const [userData, sectorData] = await Promise.all([
        api.get<User[]>('/users'),
        api.get<Sector[]>('/sectors'),
      ]);
      setUsers(userData);
      setSectors(sectorData.filter(s => s.active));
    } catch {
      console.error('Erro ao carregar dados');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(true); }, [fetchData]);
  usePolling(() => fetchData(false), { intervalMs: 30000, enabled: !modalOpen });

  function openCreate() {
    setEditing(null);
    setForm({ username: '', name: '', password: '', role: 'gestor', active: true, sector_ids: [] });
    setModalOpen(true);
  }

  function openEdit(user: User) {
    setEditing(user);
    setForm({
      username: user.username,
      name: user.name,
      password: '',
      role: user.role,
      active: user.active,
      sector_ids: user.sectors.map(s => s.sector_id),
    });
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const payload = {
        username: form.username,
        name: form.name,
        role: form.role,
        active: form.active,
        sector_ids: form.role === 'gestor' ? form.sector_ids : [],
        ...(form.password ? { password: form.password } : {}),
      };
      if (editing) {
        await api.put(`/users/${editing.id}`, payload);
      } else {
        await api.post('/users', payload);
      }
      setModalOpen(false);
      fetchData(false);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erro ao salvar usuário');
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Deseja realmente excluir este usuário?')) return;
    try {
      await api.delete(`/users/${id}`);
      fetchData(false);
    } catch {
      alert('Erro ao excluir usuário');
    }
  }

  function toggleSector(sectorId: number) {
    setForm(prev => ({
      ...prev,
      sector_ids: prev.sector_ids.includes(sectorId)
        ? prev.sector_ids.filter(id => id !== sectorId)
        : [...prev.sector_ids, sectorId],
    }));
  }

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.username.toLowerCase().includes(search.toLowerCase())
  );

  const { sortKey, sortDir, handleSort, sortedData } = useTableSort(filtered, {
    columns: {
      name: { key: 'name', getter: (u) => u.name },
      username: { key: 'username', getter: (u) => u.username },
      role: { key: 'role', getter: (u) => u.role },
      sectors: { key: 'sectors', getter: (u) => u.sectors.length, defaultDir: 'desc' },
      status: { key: 'status', getter: (u) => (u.active ? 1 : 0), defaultDir: 'desc' },
    },
    defaultKey: 'name',
  });

  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Usuários</h1>
          <p className="text-slate-500 mt-1">{users.length} usuários cadastrados</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <Plus className="h-4 w-4" /> Novo Usuário
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-4 border-b border-slate-200">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input type="text" placeholder="Buscar por nome ou usuário..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 text-sm" />
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400">Carregando...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50">
                  <SortableTh label="Nome" sortKey="name" align="left"
                    currentKey={sortKey} currentDir={sortDir} onSortChange={handleSort} className="pl-4" />
                  <SortableTh label="Usuário" sortKey="username" align="left"
                    currentKey={sortKey} currentDir={sortDir} onSortChange={handleSort} />
                  <SortableTh label="Perfil" sortKey="role" align="left"
                    currentKey={sortKey} currentDir={sortDir} onSortChange={handleSort} />
                  <SortableTh label="Setores" sortKey="sectors" align="left"
                    currentKey={sortKey} currentDir={sortDir} onSortChange={handleSort} />
                  <SortableTh label="Status" sortKey="status" align="left"
                    currentKey={sortKey} currentDir={sortDir} onSortChange={handleSort} />
                  <th className="text-right p-3 pr-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedData.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-3 pl-4">
                      <span className="font-medium text-sm text-slate-800">{user.name}</span>
                    </td>
                    <td className="p-3 text-sm text-slate-600 font-mono">{user.username}</td>
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        user.role === 'admin'
                          ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/10'
                          : 'bg-blue-50 text-blue-700 ring-1 ring-blue-600/10'
                      }`}>
                        {user.role === 'admin' ? <Shield className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        {user.role === 'admin' ? 'Administrador' : 'Gestor'}
                      </span>
                    </td>
                    <td className="p-3">
                      {user.role === 'admin' ? (
                        <span className="text-xs text-slate-400">Todos os setores</span>
                      ) : user.sectors.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {user.sectors.map(s => (
                            <span key={s.sector_id} className="inline-flex px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[10px] rounded">
                              {s.sector_name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-300">Nenhum</span>
                      )}
                    </td>
                    <td className="p-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        user.active
                          ? 'bg-green-50 text-green-700 ring-1 ring-green-600/10'
                          : 'bg-red-50 text-red-700 ring-1 ring-red-600/10'
                      }`}>
                        {user.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="p-3 pr-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(user)} className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Editar">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => handleDelete(user.id)} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Excluir">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {sortedData.length === 0 && (
                  <tr><td colSpan={6} className="p-12 text-center text-slate-400">Nenhum usuário encontrado</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Usuário' : 'Novo Usuário'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nome Completo *</label>
            <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
              placeholder="Ex: João da Silva" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Usuário *</label>
            <input type="text" required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
              placeholder="joao.silva" />
            <p className="text-xs text-slate-400 mt-1">Formato: usuario.sobrenome</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Senha {editing ? '(deixe em branco para manter)' : '*'}
            </label>
            <input type="password" required={!editing} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
              placeholder={editing ? '••••••' : 'Mínimo 4 caracteres'} minLength={editing ? 0 : 4} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Perfil *</label>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as 'admin' | 'gestor' })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700">
              <option value="gestor">Gestor (visualização por setor)</option>
              <option value="admin">Administrador (acesso total)</option>
            </select>
          </div>

          {form.role === 'gestor' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Setores *</label>
              <p className="text-xs text-slate-400 mb-2">Selecione os setores que este gestor poderá visualizar</p>
              <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1">
                {sectors.map(s => (
                  <label key={s.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.sector_ids.includes(s.id)}
                      onChange={() => toggleSector(s.id)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-700">{s.name}</span>
                  </label>
                ))}
                {sectors.length === 0 && (
                  <p className="text-sm text-slate-400 p-2">Nenhum setor cadastrado</p>
                )}
              </div>
            </div>
          )}

          {editing && (
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" id="userActive" />
              <label htmlFor="userActive" className="text-sm text-slate-700">Usuário ativo</label>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">Cancelar</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">{editing ? 'Salvar' : 'Cadastrar'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
