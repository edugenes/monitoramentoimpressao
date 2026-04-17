'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Printer,
  Building2,
  Gauge,
  KeyRound,
  BarChart3,
  Activity,
} from 'lucide-react';

const menuItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/impressoras', label: 'Impressoras', icon: Printer },
  { href: '/setores', label: 'Setores', icon: Building2 },
  { href: '/cotas', label: 'Cotas', icon: Gauge },
  { href: '/liberacoes', label: 'Liberações', icon: KeyRound },
  { href: '/monitoramento', label: 'Monitoramento', icon: Activity },
  { href: '/relatorios', label: 'Relatórios', icon: BarChart3 },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-slate-900 text-white min-h-screen flex flex-col">
      <div className="p-6 border-b border-slate-700">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Printer className="h-6 w-6 text-blue-400" />
          Controle de Impressão
        </h1>
      </div>
      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {menuItems.map((item) => {
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
      <div className="p-4 border-t border-slate-700 text-xs text-slate-500">
        Sistema de Controle de Impressão v1.0
      </div>
    </aside>
  );
}
