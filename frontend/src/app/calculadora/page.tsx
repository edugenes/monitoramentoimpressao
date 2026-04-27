'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Quota, User } from '@/lib/types';
import { getCurrentPeriod } from '@/lib/dateUtils';
import { useAuth } from '@/contexts/AuthContext';
import { Calculator, ArrowRight, KeyRound, Info } from 'lucide-react';

const DIAS_REFERENCIA = 30;

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dayFromISO(iso: string): number {
  const [, , d] = iso.split('-');
  return parseInt(d, 10) || 1;
}

export default function CalculadoraLiberacao() {
  const router = useRouter();
  const { isAdmin } = useAuth();

  const [quotas, setQuotas] = useState<Quota[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [quotaId, setQuotaId] = useState<string>('');
  const [refDate, setRefDate] = useState<string>(todayISO());
  const [authorizer, setAuthorizer] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [overrideAmount, setOverrideAmount] = useState<string>('');

  const period = getCurrentPeriod();

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [quotaData, userData] = await Promise.all([
        api.get<Quota[]>(`/quotas?period=${period}`),
        api.get<User[]>('/users').catch(() => [] as User[]),
      ]);
      setQuotas(quotaData.filter((q) => q.monthly_limit > 0));
      setUsers(userData.filter((u) => u.active));
    } catch {
      console.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const selectedQuota = useMemo(
    () => quotas.find((q) => String(q.id) === quotaId) || null,
    [quotas, quotaId]
  );

  const day = dayFromISO(refDate);
  const diasRestantes = Math.max(DIAS_REFERENCIA - day, 0);

  const cotaAtual = selectedQuota?.monthly_limit ?? 0;
  const cotaPorDia = Math.floor(cotaAtual / DIAS_REFERENCIA);
  const sugestao = cotaPorDia * diasRestantes;

  const valorFinal = overrideAmount.trim()
    ? parseInt(overrideAmount, 10) || 0
    : sugestao;

  const valorFinalValido = valorFinal > 0;

  const handleApply = async () => {
    if (!selectedQuota || !valorFinalValido) return;
    setSubmitting(true);
    try {
      await api.post('/releases', {
        quota_id: selectedQuota.id,
        amount: valorFinal,
        reason: reason.trim() || `Liberação proporcional (${diasRestantes} dia(s) restante(s) de ${DIAS_REFERENCIA})`,
        released_by: authorizer.trim() || null,
      });
      router.push('/liberacoes');
    } catch {
      alert('Erro ao registrar liberação');
      setSubmitting(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
        <p className="text-slate-500">Acesso restrito a administradores.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Calculator className="h-6 w-6 text-blue-600" />
          Calculadora de Liberação
        </h1>
        <p className="text-slate-500 mt-1">
          Calcula o valor proporcional da liberação com base na cota da impressora e nos dias restantes do mês.
        </p>
      </div>

      {/* Caixa explicativa da formula */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900 space-y-2">
            <p className="font-semibold">Regra de cálculo (mês padrão de 30 dias):</p>
            <ol className="list-decimal list-inside space-y-1 text-blue-800">
              <li>Divida a cota mensal da impressora por <strong>30</strong> e arredonde para baixo (parte inteira) → cota diária equivalente.</li>
              <li>Multiplique pela quantidade de dias que ainda faltam até o dia 30 do mês.</li>
            </ol>
            <p className="text-xs text-blue-700 italic">
              Aproximação intencional para simplificar o cálculo, sem se preocupar com meses de 28/29/31 dias.
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center text-slate-400">
          Carregando dados...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Coluna esquerda: entradas */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
            <h2 className="text-base font-semibold text-slate-800">Parâmetros</h2>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Impressora / Cota <span className="text-red-500">*</span>
              </label>
              <select
                value={quotaId}
                onChange={(e) => setQuotaId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecione uma impressora...</option>
                {[...quotas]
                  .sort((a, b) => (a.printer_name || '').localeCompare(b.printer_name || ''))
                  .map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.printer_name} — {q.sector_name} (cota {q.monthly_limit.toLocaleString('pt-BR')})
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Data de referência
              </label>
              <input
                type="date"
                value={refDate}
                onChange={(e) => setRefDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-slate-500 mt-1">
                Dia <strong>{day}</strong> → faltam <strong>{diasRestantes}</strong> dia(s) para completar 30.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Autorizado por
              </label>
              <select
                value={authorizer}
                onChange={(e) => setAuthorizer(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecione um usuário administrativo...</option>
                {users
                  .filter((u) => u.role === 'admin')
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((u) => (
                    <option key={u.id} value={u.name}>
                      {u.name} (@{u.username})
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Motivo (opcional)
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="Se vazio, será preenchido automaticamente com a regra usada."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Sobrescrever valor (opcional)
              </label>
              <input
                type="number"
                min={1}
                value={overrideAmount}
                onChange={(e) => setOverrideAmount(e.target.value)}
                placeholder={`Padrão: ${sugestao.toLocaleString('pt-BR')}`}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-slate-500 mt-1">
                Use apenas se quiser ignorar a sugestão e gravar um valor manual.
              </p>
            </div>
          </div>

          {/* Coluna direita: resultado */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
            <h2 className="text-base font-semibold text-slate-800">Cálculo</h2>

            {!selectedQuota ? (
              <div className="text-center py-8 text-slate-400 text-sm">
                Selecione uma impressora para ver o cálculo.
              </div>
            ) : (
              <>
                <div className="bg-slate-50 rounded-lg p-4 space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Impressora</span>
                    <span className="font-medium text-slate-800 text-right">{selectedQuota.printer_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Setor</span>
                    <span className="font-medium text-slate-800">{selectedQuota.sector_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Cota mensal contratada</span>
                    <span className="font-semibold text-slate-800">{cotaAtual.toLocaleString('pt-BR')} págs</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Uso atual no período</span>
                    <span className="font-medium text-slate-800">
                      {selectedQuota.current_usage.toLocaleString('pt-BR')} págs
                    </span>
                  </div>
                </div>

                {/* Passo a passo */}
                <div className="border border-slate-200 rounded-lg p-4 space-y-3 text-sm">
                  <p className="font-semibold text-slate-800 flex items-center gap-2">
                    <span className="bg-blue-100 text-blue-700 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">1</span>
                    Cota diária (cota ÷ 30)
                  </p>
                  <div className="flex items-center gap-2 text-slate-700 pl-8">
                    <code className="bg-slate-100 px-2 py-1 rounded">{cotaAtual.toLocaleString('pt-BR')}</code>
                    <span className="text-slate-400">÷</span>
                    <code className="bg-slate-100 px-2 py-1 rounded">{DIAS_REFERENCIA}</code>
                    <ArrowRight className="h-4 w-4 text-slate-400" />
                    <code className="bg-blue-100 text-blue-800 px-2 py-1 rounded font-semibold">
                      {cotaPorDia.toLocaleString('pt-BR')} págs/dia
                    </code>
                  </div>

                  <p className="font-semibold text-slate-800 flex items-center gap-2 pt-2">
                    <span className="bg-blue-100 text-blue-700 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">2</span>
                    Dias restantes × cota diária
                  </p>
                  <div className="flex items-center gap-2 text-slate-700 pl-8">
                    <code className="bg-slate-100 px-2 py-1 rounded">{cotaPorDia.toLocaleString('pt-BR')}</code>
                    <span className="text-slate-400">×</span>
                    <code className="bg-slate-100 px-2 py-1 rounded">{diasRestantes}</code>
                    <ArrowRight className="h-4 w-4 text-slate-400" />
                    <code className="bg-green-100 text-green-800 px-2 py-1 rounded font-semibold">
                      {sugestao.toLocaleString('pt-BR')} págs
                    </code>
                  </div>
                </div>

                {/* Valor final */}
                <div className={`rounded-lg p-5 ${valorFinalValido ? 'bg-green-50 border border-green-200' : 'bg-slate-50 border border-slate-200'}`}>
                  <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                    Valor sugerido para liberação
                  </p>
                  <p className={`text-3xl font-bold ${valorFinalValido ? 'text-green-700' : 'text-slate-400'}`}>
                    {valorFinal.toLocaleString('pt-BR')} <span className="text-base font-medium">páginas</span>
                  </p>
                  {overrideAmount.trim() && (
                    <p className="text-xs text-amber-700 mt-1">
                      Valor manual aplicado (sugestão automática era {sugestao.toLocaleString('pt-BR')}).
                    </p>
                  )}
                  {!valorFinalValido && diasRestantes === 0 && (
                    <p className="text-xs text-slate-500 mt-1">
                      Não há mais dias restantes no período de 30 dias — sugestão = 0.
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleApply}
                  disabled={!valorFinalValido || submitting}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                >
                  <KeyRound className="h-4 w-4" />
                  {submitting ? 'Registrando...' : `Criar liberação de ${valorFinal.toLocaleString('pt-BR')} págs`}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
