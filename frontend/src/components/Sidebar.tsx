'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AlertBell from '@/components/AlertBell';
import {
  LayoutDashboard,
  Printer,
  Building2,
  Gauge,
  KeyRound,
  BarChart3,
  Activity,
  Users,
  LogOut,
  Shield,
  Eye,
  AlertTriangle,
} from 'lucide-react';

const menuItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, adminOnly: false },
  { href: '/impressoras', label: 'Impressoras', icon: Printer, adminOnly: false },
  { href: '/setores', label: 'Setores', icon: Building2, adminOnly: true },
  { href: '/cotas', label: 'Cotas', icon: Gauge, adminOnly: false },
  { href: '/liberacoes', label: 'Liberações', icon: KeyRound, adminOnly: false },
  { href: '/monitoramento', label: 'Monitoramento', icon: Activity, adminOnly: false },
  { href: '/alertas', label: 'Alertas', icon: AlertTriangle, adminOnly: false },
  { href: '/relatorios', label: 'Relatórios', icon: BarChart3, adminOnly: false },
  { href: '/usuarios', label: 'Usuários', icon: Users, adminOnly: true },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, isAdmin, logout } = useAuth();

  const visibleItems = menuItems.filter(item => !item.adminOnly || isAdmin);

  return (
    <aside className="w-64 bg-slate-900 text-white min-h-screen flex flex-col">
      <div className="p-6 border-b border-slate-700 flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold flex items-center gap-2 min-w-0">
          <Printer className="h-6 w-6 text-blue-400 flex-shrink-0" />
          <span className="truncate">Controle de Impressão</span>
        </h1>
        <AlertBell />
      </div>
      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {visibleItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="p-4 border-t border-slate-700">
        {user && (
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-1">
              {isAdmin ? (
                <Shield className="h-3.5 w-3.5 text-amber-400" />
              ) : (
                <Eye className="h-3.5 w-3.5 text-blue-400" />
              )}
              <span className="text-sm font-medium text-slate-200 truncate">{user.name}</span>
            </div>
            <span className="text-xs text-slate-500">{user.username} &middot; {isAdmin ? 'Administrador' : 'Gestor'}</span>
          </div>
        )}
        <button
          onClick={logout}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </div>
    </aside>
  );
}
