'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { Alert, AlertCount } from '@/lib/types';
import { playAlertSound } from '@/lib/sound';

const POLL_INTERVAL = 15000;
const MUTE_KEY = 'hse_alerts_muted';
const SEEN_KEY = 'hse_alerts_seen_ids';

function loadSeenIds(): Set<number> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as number[]);
  } catch {
    return new Set();
  }
}

function saveSeenIds(ids: Set<number>) {
  if (typeof window === 'undefined') return;
  // Mantém só os últimos 200 ids para não inflar o storage
  const arr = Array.from(ids).slice(-200);
  localStorage.setItem(SEEN_KEY, JSON.stringify(arr));
}

export function useAlerts(enabled = true) {
  const [count, setCount] = useState<AlertCount>({ total: 0, critical: 0, warning: 0 });
  const [recent, setRecent] = useState<Alert[]>([]);
  const [newAlerts, setNewAlerts] = useState<Alert[]>([]);
  const [muted, setMutedState] = useState(false);
  const seenRef = useRef<Set<number>>(new Set());
  const firstFetch = useRef(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    seenRef.current = loadSeenIds();
    if (typeof window !== 'undefined') {
      setMutedState(localStorage.getItem(MUTE_KEY) === 'true');
    }
    return () => { mountedRef.current = false; };
  }, []);

  const setMuted = useCallback((value: boolean) => {
    setMutedState(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem(MUTE_KEY, value ? 'true' : 'false');
    }
  }, []);

  const consumeNewAlerts = useCallback(() => setNewAlerts([]), []);

  const fetchAlerts = useCallback(async () => {
    try {
      const [countData, recentData] = await Promise.all([
        api.get<AlertCount>('/alerts/count'),
        api.get<Alert[]>('/alerts?unacknowledged=true&limit=20'),
      ]);
      if (!mountedRef.current) return;
      setCount(countData);
      setRecent(recentData);

      // Detectar alertas realmente novos (não vistos antes)
      const freshlyNew: Alert[] = [];
      for (const a of recentData) {
        if (!seenRef.current.has(a.id)) {
          seenRef.current.add(a.id);
          if (!firstFetch.current) freshlyNew.push(a);
        }
      }
      saveSeenIds(seenRef.current);

      if (freshlyNew.length > 0) {
        setNewAlerts(prev => [...freshlyNew, ...prev].slice(0, 10));

        // Som: so se nao estiver mudo. Toca o padrao da gravidade mais alta.
        if (!muted) {
          const hasCritical = freshlyNew.some(a => a.severity === 'critical');
          const hasWarning = freshlyNew.some(a => a.severity === 'warning');
          if (hasCritical) playAlertSound('critical');
          else if (hasWarning) playAlertSound('warning');
          else playAlertSound('info');
        }
      }

      firstFetch.current = false;
    } catch {
      // silencioso - polling tenta de novo
    }
  }, [muted]);

  useEffect(() => {
    if (!enabled) return;
    fetchAlerts();
    const id = window.setInterval(fetchAlerts, POLL_INTERVAL);
    return () => window.clearInterval(id);
  }, [enabled, fetchAlerts]);

  const acknowledge = useCallback(async (id: number) => {
    await api.post(`/alerts/${id}/acknowledge`, {});
    await fetchAlerts();
  }, [fetchAlerts]);

  const acknowledgeAll = useCallback(async () => {
    await api.post('/alerts/acknowledge-all', {});
    await fetchAlerts();
  }, [fetchAlerts]);

  return {
    count,
    recent,
    newAlerts,
    consumeNewAlerts,
    muted,
    setMuted,
    acknowledge,
    acknowledgeAll,
    refresh: fetchAlerts,
  };
}
