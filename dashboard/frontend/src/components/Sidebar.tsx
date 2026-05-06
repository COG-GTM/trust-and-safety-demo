'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/', label: 'Executive Summary', icon: '◆' },
  { href: '/rules', label: 'Rules Performance', icon: '⚖' },
  { href: '/events', label: 'Flagged Events', icon: '⚑' },
  { href: '/labels', label: 'Labels & Entities', icon: '◈' },
  { href: '/health', label: 'Pipeline Health', icon: '⚙' },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden md:flex md:w-64 md:flex-col bg-card border-r border-cardAlt min-h-screen">
      <div className="px-6 py-6 border-b border-cardAlt">
        <h1 className="text-lg font-semibold text-white">Osprey Dashboard</h1>
        <p className="text-xs text-muted mt-1">Trust &amp; Safety Analytics</p>
      </div>
      <nav className="flex-1 py-4">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex items-center gap-3 px-6 py-3 text-sm transition-colors',
                isActive
                  ? 'bg-cardAlt text-white border-l-2 border-accent-primary'
                  : 'text-soft hover:bg-cardAlt hover:text-white border-l-2 border-transparent',
              )}
            >
              <span className="text-base text-accent-primary">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="px-6 py-4 border-t border-cardAlt text-xs text-muted">
        <p>v0.1.0</p>
      </div>
    </aside>
  );
}
