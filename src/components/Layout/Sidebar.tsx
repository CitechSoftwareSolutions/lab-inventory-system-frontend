'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useState, useEffect } from 'react';
import api from '@/lib/api';
import type { UserRole } from '@/types';

interface NavItem {
  href: string;
  label: string;
  icon: string;
  roles?: UserRole[];
  showPendingBadge?: boolean;
}

interface NavSection {
  heading?: string;
  accentClass?: string;
  items: NavItem[];
}

const MANAGERS: UserRole[] = ['super_admin', 'branch_manager'];
const STOCK_CAPABLE: UserRole[] = ['super_admin', 'branch_manager', 'stock_keeper'];
const SUPER_ONLY: UserRole[] = ['super_admin'];

const navSections: NavSection[] = [
  {
    items: [
      {
        href: '/dashboard',
        label: 'Dashboard',
        icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
      },
    ],
  },
  {
    heading: 'Lab Inventory',
    accentClass: 'text-emerald-400',
    items: [
      {
        href: '/chemicals',
        label: 'Chemicals',
        icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z',
      },
      {
        href: '/glassware',
        label: 'Glassware',
        icon: 'M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z',
      },
      {
        href: '/consumables',
        label: 'Consumables',
        icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
      },
      {
        href: '/equipment',
        label: 'Equipment',
        icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
      },
      {
        href: '/instruments',
        label: 'Instruments',
        icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
      },
    ],
  },
  {
    heading: 'Stock',
    accentClass: 'text-amber-400',
    items: [
      {
        href: '/stock-movements',
        label: 'Stock Movements',
        icon: 'M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4',
      },
      {
        href: '/transactions',
        label: 'Transactions',
        icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4',
        roles: STOCK_CAPABLE,
      },
      {
        href: '/maintenance',
        label: 'Maintenance',
        icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
        roles: MANAGERS,
      },
    ],
  },
  {
    heading: 'Procurement',
    accentClass: 'text-sky-400',
    items: [
      {
        href: '/orders',
        label: 'Orders',
        icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
        roles: STOCK_CAPABLE,
      },
      {
        href: '/invoices',
        label: 'Invoices',
        icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
        roles: STOCK_CAPABLE,
      },
      {
        href: '/suppliers',
        label: 'Suppliers',
        icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
        roles: STOCK_CAPABLE,
      },
    ],
  },
  {
    heading: 'Management',
    accentClass: 'text-violet-400',
    items: [
      {
        href: '/categories',
        label: 'Categories',
        icon: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z',
        roles: STOCK_CAPABLE,
      },
      {
        href: '/approvals',
        label: 'Approvals',
        icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
        roles: MANAGERS,
        showPendingBadge: true,
      },
      {
        href: '/branches',
        label: 'Branches',
        icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
        roles: SUPER_ONLY,
      },
      {
        href: '/users',
        label: 'Users',
        icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
        roles: MANAGERS,
      },
    ],
  },
];

const ROLE_BADGE: Record<string, string> = {
  super_admin:    'bg-rose-500/20 text-rose-300 border border-rose-500/25',
  branch_manager: 'bg-sky-500/20 text-sky-300 border border-sky-500/25',
  lab_technician: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/25',
  stock_keeper:   'bg-amber-500/20 text-amber-300 border border-amber-500/25',
};

const ROLE_LABELS: Record<string, string> = {
  super_admin:    'Super Admin',
  branch_manager: 'Branch Manager',
  lab_technician: 'Lab Technician',
  stock_keeper:   'Stock Keeper',
};

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);

  const isManager = user?.role === 'super_admin' || user?.role === 'branch_manager';

  useEffect(() => {
    if (!isManager) return;
    api.get<{ total: number }>('/approvals/pending')
      .then((r) => setPendingCount(r.data?.total ?? 0))
      .catch(() => {});
    const interval = setInterval(() => {
      api.get<{ total: number }>('/approvals/pending')
        .then((r) => setPendingCount(r.data?.total ?? 0))
        .catch(() => {});
    }, 60_000);
    return () => clearInterval(interval);
  }, [isManager]);

  const name = user?.full_name ?? user?.username ?? 'User';
  const initials = name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase();

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-20 lg:hidden" onClick={onClose} />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-64 flex flex-col transform transition-transform duration-200 lg:translate-x-0 lg:static lg:z-auto ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ background: 'linear-gradient(180deg, #0d1424 0%, #0f172a 100%)', borderRight: '1px solid rgba(255,255,255,0.05)' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 pt-6 pb-5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg"
            style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)' }}
          >
            <svg className="w-[18px] h-[18px] text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </div>
          <div>
            <h1 className="text-white font-bold text-[14.5px] leading-tight tracking-tight">Lab Inventory</h1>
            <p className="text-slate-500 text-[11px] font-medium tracking-wide">
              {user?.branch_name ?? 'Management System'}
            </p>
          </div>
        </div>

        <div className="mx-5 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto scrollbar-hide space-y-1">
          {navSections.map((section, si) => {
            const visibleItems = section.items.filter(
              (item) => !item.roles || (user?.role && item.roles.includes(user.role as UserRole))
            );
            if (visibleItems.length === 0) return null;

            return (
              <div key={si} className={si > 0 ? 'pt-4' : ''}>
                {section.heading && (
                  <div className="flex items-center gap-2 px-2 mb-2">
                    <span className={`text-[10px] font-bold uppercase tracking-[0.14em] ${section.accentClass ?? 'text-slate-500'}`}>
                      {section.heading}
                    </span>
                    <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
                  </div>
                )}
                <div className="space-y-0.5">
                  {visibleItems.map(({ href, label, icon, showPendingBadge }) => {
                    const active = pathname.startsWith(href);
                    return (
                      <Link
                        key={href}
                        href={href}
                        onClick={onClose}
                        className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13.5px] font-medium transition-all duration-150 ${
                          active ? 'text-white' : 'text-slate-400 hover:text-slate-100'
                        }`}
                        style={active ? { background: 'rgba(99,102,241,0.15)' } : undefined}
                        onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; }}
                        onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = ''; }}
                      >
                        {active && (
                          <span
                            className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
                            style={{ background: 'linear-gradient(180deg, #6366f1, #3b82f6)' }}
                          />
                        )}
                        <svg
                          className={`w-[17px] h-[17px] flex-shrink-0 transition-colors ${active ? 'text-indigo-300' : 'text-slate-500 group-hover:text-slate-300'}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 2 : 1.6} d={icon} />
                        </svg>
                        <span>{label}</span>
                        {showPendingBadge && pendingCount > 0 && (
                          <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center shadow-sm">
                            {pendingCount > 99 ? '99+' : pendingCount}
                          </span>
                        )}
                        {!showPendingBadge && active && (
                          <span className="ml-auto w-[6px] h-[6px] rounded-full bg-indigo-400 shadow-[0_0_6px_#6366f1]" />
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="px-3 pb-4 pt-2">
          <div className="mx-px h-px mb-3" style={{ background: 'rgba(255,255,255,0.06)' }} />
          <div className="flex items-center gap-3 px-3 py-3 rounded-xl mb-1" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[12px] font-bold text-white flex-shrink-0 shadow"
              style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)' }}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-white truncate leading-tight">{name}</p>
              <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full mt-0.5 ${ROLE_BADGE[user?.role ?? ''] ?? 'bg-slate-800 text-slate-400'}`}>
                {ROLE_LABELS[user?.role ?? ''] ?? user?.role}
              </span>
            </div>
          </div>
          <button
            onClick={logout}
            className="group flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-[13px] text-slate-500 transition-all duration-150"
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLElement).style.color = '#f1f5f9'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.color = ''; }}
          >
            <svg className="w-4 h-4 flex-shrink-0 group-hover:text-rose-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
