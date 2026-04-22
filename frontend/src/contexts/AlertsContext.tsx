'use client';

import { createContext, useContext, ReactNode } from 'react';
import { useAlerts } from '@/hooks/useAlerts';
import { useAuth } from '@/contexts/AuthContext';

type AlertsContextType = ReturnType<typeof useAlerts>;

const AlertsContext = createContext<AlertsContextType | null>(null);

export function AlertsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const alerts = useAlerts(Boolean(user));

  return (
    <AlertsContext.Provider value={alerts}>
      {children}
    </AlertsContext.Provider>
  );
}

export function useAlertsContext() {
  const ctx = useContext(AlertsContext);
  if (!ctx) throw new Error('useAlertsContext deve ser usado dentro de AlertsProvider');
  return ctx;
}
