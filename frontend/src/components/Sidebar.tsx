import React from 'react';
import type { DashboardTab } from '../types/dashboard';

interface SidebarProps {
  activeTab: DashboardTab;
  setActiveTab: (tab: DashboardTab) => void;
  chatCount?: number;
  isOnline?: boolean;
  isSuperAdmin?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  chatCount = 0,
  isOnline = true,
  isSuperAdmin = false,
}) => {
  const navItems: Array<{
    id: DashboardTab;
    label: string;
    icon: string;
    description: string;
  }> = [
    {
      id: 'inbox',
      label: 'Live chat inbox',
      icon: '💬',
      description: 'Patient conversations',
    },
    {
      id: 'appointments',
      label: 'Appointments',
      icon: '📅',
      description: 'Upcoming visits',
    },
    {
      id: 'patients',
      label: 'Patient records',
      icon: '👥',
      description: 'Patient directory',
    },
    ...(isSuperAdmin
      ? [
          {
            id: 'admin' as DashboardTab,
            label: 'Admin users',
            icon: '🛡️',
            description: 'Manage accounts',
          },
        ]
      : []),
  ];

  return (
    <aside className="flex h-full w-[280px] shrink-0 flex-col overflow-hidden bg-slate-950 text-white shadow-2xl">
      <div className="border-b border-white/10 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500 via-violet-500 to-cyan-400 text-xl font-black shadow-lg">
            P
          </div>

          <div>
            <h1 className="text-lg font-black">
              Phadam Hospital
            </h1>

            <p className="text-xs text-slate-400">
              Staff workspace
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-3">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
            Motto
          </p>

          <p className="mt-1 text-sm font-bold text-cyan-300">
            Your Health, Our Pride
          </p>
        </div>
      </div>

      <nav
        aria-label="Staff dashboard sections"
        className="flex-1 overflow-y-auto p-4"
      >
        <p className="mb-3 px-2 text-[10px] font-black uppercase tracking-wider text-slate-500">
          Workspace
        </p>

        <div className="space-y-2">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`relative flex min-h-[68px] w-full items-center gap-3 rounded-2xl px-3 text-left transition focus:outline-none focus-visible:ring-4 focus-visible:ring-violet-400/40 ${
                  isActive
                    ? 'bg-gradient-to-r from-fuchsia-600 via-violet-600 to-blue-600 text-white shadow-lg'
                    : 'text-slate-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-xl">
                  {item.icon}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-black">
                    {item.label}
                  </span>

                  <span className="mt-1 block truncate text-[11px] text-white/60">
                    {item.description}
                  </span>
                </span>

                {item.id === 'inbox' && chatCount > 0 && (
                  <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-amber-300 px-1.5 text-[10px] font-black text-slate-950">
                    {chatCount > 99 ? '99+' : chatCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
          <span
            className={`h-3 w-3 rounded-full ${
              isOnline
                ? 'animate-pulse bg-emerald-400'
                : 'bg-rose-400'
            }`}
          />

          <div>
            <p className="text-xs font-black">
              {isOnline ? 'System online' : 'System offline'}
            </p>

            <p className="text-[10px] text-slate-500">
              {isOnline
                ? 'Connected to hospital services'
                : 'Check the backend connection'}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
};