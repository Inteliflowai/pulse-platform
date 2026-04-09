'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  LayoutDashboard,
  School,
  Package,
  Monitor,
  Activity,
  Settings,
  LogOut,
  Menu,
  X,
  Globe,
  Users,
  FileText,
  DoorOpen,
  GraduationCap,
} from 'lucide-react';

interface SidebarProps {
  user: { email: string; full_name: string | null; role: string };
}

const navItems = [
  { label: 'Global Overview', href: '/dashboard/global', icon: Globe, roles: ['super_admin'] },
  { label: 'Schools & Nodes', href: '/dashboard/school', icon: School, roles: ['super_admin', 'tenant_admin', 'site_admin'] },
  { label: 'Classrooms', href: '/dashboard/school/classrooms', icon: DoorOpen, roles: ['super_admin', 'tenant_admin', 'site_admin'] },
  { label: 'Curriculum', href: '/dashboard/school/curriculum', icon: GraduationCap, roles: ['super_admin', 'tenant_admin', 'site_admin', 'teacher'] },
  { label: 'Results', href: '/dashboard/school/results', icon: FileText, roles: ['super_admin', 'tenant_admin', 'site_admin', 'teacher'] },
  { label: 'Progress', href: '/dashboard/school/progress', icon: Activity, roles: ['super_admin', 'tenant_admin', 'site_admin', 'teacher'] },
  { label: 'Content', href: '/dashboard/content', icon: Package, roles: ['super_admin', 'tenant_admin', 'site_admin', 'content_manager'] },
  { label: 'Devices', href: '/dashboard/devices', icon: Monitor, roles: ['super_admin', 'tenant_admin', 'site_admin'] },
  { label: 'Users', href: '/dashboard/school/users', icon: Users, roles: ['super_admin', 'tenant_admin', 'site_admin'] },
  { label: 'Audit Log', href: '/dashboard/school/audit', icon: FileText, roles: ['super_admin', 'tenant_admin', 'site_admin'] },
  { label: 'Monitoring', href: '/dashboard/monitoring', icon: Activity, roles: ['super_admin', 'tenant_admin', 'site_admin'] },
  { label: 'Fleet Monitor', href: '/dashboard/global/monitoring', icon: Activity, roles: ['super_admin'] },
  { label: 'Releases', href: '/dashboard/global/releases', icon: Package, roles: ['super_admin'] },
  { label: 'Settings', href: '/dashboard/settings', icon: Settings, roles: ['super_admin', 'tenant_admin'] },
];

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  const filteredNav = navItems.filter((item) => item.roles.includes(user.role));

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="fixed top-4 left-4 z-50 rounded-md bg-brand-surface p-2 text-gray-300 lg:hidden"
      >
        {collapsed ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      <aside
        className={cn(
          'fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-gray-700 bg-brand-surface transition-all duration-300',
          collapsed ? 'w-64 translate-x-0' : '-translate-x-full w-64',
          'lg:translate-x-0',
          'lg:w-64'
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-gray-700 px-6">
          <div className="h-8 w-8 rounded-lg bg-brand-primary flex items-center justify-center flex-shrink-0">
            <span className="text-lg font-bold text-white">P</span>
          </div>
          <span className="text-lg font-bold text-gray-100">Pulse</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {filteredNav.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-brand-primary/20 text-brand-primary'
                    : 'text-gray-400 hover:bg-brand-bg hover:text-gray-200'
                )}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div className="border-t border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-primary/20 text-brand-primary text-sm font-medium">
              {(user.full_name || user.email).charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-gray-200">
                {user.full_name || user.email}
              </p>
              <Badge variant="secondary" className="mt-0.5 text-[10px]">
                {user.role.replace('_', ' ')}
              </Badge>
            </div>
            <button
              onClick={handleLogout}
              className="rounded-md p-1.5 text-gray-400 hover:bg-brand-bg hover:text-gray-200"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
