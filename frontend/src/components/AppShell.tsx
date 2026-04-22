'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { AlertsProvider } from '@/contexts/AlertsContext';
import Sidebar from '@/components/Sidebar';
import AlertToaster from '@/components/AlertToaster';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isLoginPage = pathname === '/login';

  useEffect(() => {
    if (isLoading) return;
    if (!user && !isLoginPage) {
      router.replace('/login');
    }
    if (user && isLoginPage) {
      router.replace('/');
    }
  }, [user, isLoading, isLoginPage, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-pulse text-slate-400 text-lg">Carregando...</div>
      </div>
    );
  }

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-pulse text-slate-400 text-lg">Redirecionando...</div>
      </div>
    );
  }

  return (
    <AlertsProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-8 overflow-auto">
          {children}
        </main>
        <AlertToaster />
      </div>
    </AlertsProvider>
  );
}
