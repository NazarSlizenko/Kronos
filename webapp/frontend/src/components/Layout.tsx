import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

const navigation = [
  { label: 'Панель', to: '/' },
  { label: 'Прогноз', to: '/forecast' },
  { label: 'Аналитика', to: '/analytics' },
];

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex max-w-7xl flex-col">
        <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-violet-400">Kronos</p>
              <h1 className="mt-1 text-xl font-semibold text-white">Личный прогнозный дашборд</h1>
            </div>
            <nav className="flex gap-2 rounded-full border border-slate-800 bg-slate-900 p-1">
              {navigation.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `rounded-full px-4 py-2 text-sm transition ${
                      isActive ? 'bg-violet-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </header>
        <main className="px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
