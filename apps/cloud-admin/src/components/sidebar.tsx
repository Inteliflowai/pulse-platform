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
  Network,
  Terminal,
  Building2,
  ShieldCheck,
} from 'lucide-react';

interface SidebarProps {
  user: { email: string; full_name: string | null; role: string };
}

interface NavItem {
  label: string;
  href: string;
  icon: any;
  roles: string[];
  group: 'company' | 'product' | 'general';
}

const navItems: NavItem[] = [
  // Company Ops (Inteliflow staff only) — customer management and platform operations.
  { label: 'Customers',         href: '/dashboard/global/customers',  icon: Building2,   roles: ['super_admin'], group: 'company' },
  { label: 'Licenses',          href: '/dashboard/global/licenses',   icon: ShieldCheck, roles: ['super_admin'], group: 'company' },
  { label: 'Fleet Dashboard',   href: '/dashboard/global/fleet',      icon: Network,     roles: ['super_admin'], group: 'company' },
  { label: 'Fleet Monitor',     href: '/dashboard/global/monitoring', icon: Activity,    roles: ['super_admin'], group: 'company' },
  { label: 'Releases',          href: '/dashboard/global/releases',   icon: Package,     roles: ['super_admin'], group: 'company' },
  { label: 'Platform API Health', href: '/dashboard/global/api-test', icon: Terminal,    roles: ['super_admin'], group: 'company' },
  { label: 'Global Overview',   href: '/dashboard/global',            icon: Globe,       roles: ['super_admin'], group: 'company' },

  // Product (customer-side) — everything a school admin / teacher actually works in.
  { label: 'Schools & Nodes',   href: '/dashboard/school',             icon: School,          roles: ['super_admin', 'tenant_admin', 'site_admin'], group: 'product' },
  { label: 'Classrooms',        href: '/dashboard/school/classrooms',  icon: DoorOpen,        roles: ['super_admin', 'tenant_admin', 'site_admin'], group: 'product' },
  { label: 'Curriculum',        href: '/dashboard/school/curriculum',  icon: GraduationCap,   roles: ['super_admin', 'tenant_admin', 'site_admin', 'teacher'], group: 'product' },
  { label: 'Results',           href: '/dashboard/school/results',     icon: FileText,        roles: ['super_admin', 'tenant_admin', 'site_admin', 'teacher'], group: 'product' },
  { label: 'Progress',          href: '/dashboard/school/progress',    icon: Activity,        roles: ['super_admin', 'tenant_admin', 'site_admin', 'teacher'], group: 'product' },
  { label: 'Content',           href: '/dashboard/content',            icon: Package,         roles: ['super_admin', 'tenant_admin', 'site_admin', 'content_manager'], group: 'product' },
  { label: 'Devices',           href: '/dashboard/devices',            icon: Monitor,         roles: ['super_admin', 'tenant_admin', 'site_admin'], group: 'product' },
  { label: 'Users',             href: '/dashboard/school/users',       icon: Users,           roles: ['super_admin', 'tenant_admin', 'site_admin'], group: 'product' },
  { label: 'Audit Log',         href: '/dashboard/school/audit',       icon: FileText,        roles: ['super_admin', 'tenant_admin', 'site_admin'], group: 'product' },
  { label: 'Analytics',         href: '/dashboard/analytics',          icon: Activity,        roles: ['super_admin', 'tenant_admin', 'site_admin'], group: 'product' },
  { label: 'Monitoring',        href: '/dashboard/monitoring',         icon: Activity,        roles: ['super_admin', 'tenant_admin', 'site_admin'], group: 'product' },
  { label: 'Search',            href: '/dashboard/search',             icon: Globe,           roles: ['super_admin', 'tenant_admin', 'site_admin', 'content_manager', 'teacher'], group: 'product' },

  // General — available regardless of role context.
  { label: 'Settings',          href: '/dashboard/settings',           icon: Settings,        roles: ['super_admin', 'tenant_admin'], group: 'general' },
  { label: 'API Test',          href: '/dashboard/settings/api-test',  icon: Terminal,        roles: ['super_admin', 'tenant_admin', 'site_admin', 'content_manager', 'teacher', 'student'], group: 'general' },
];

const GROUP_LABELS: Record<string, string> = {
  company: 'Company Ops',
  product: 'Product Access',
  general: '',
};

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  const filteredNav = navItems.filter((item) => item.roles.includes(user.role));
  // Group by section, preserving the declared order within each group.
  const navByGroup: Record<string, NavItem[]> = { company: [], product: [], general: [] };
  for (const item of filteredNav) navByGroup[item.group].push(item);

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
        <div className="flex h-16 items-center border-b border-gray-700 px-4">
          <img src="/pulse-logo.png" alt="Pulse" className="h-10 w-auto" />
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-3 overflow-y-auto px-3 py-4">
          {(['company', 'product', 'general'] as const).map((group) => {
            const items = navByGroup[group];
            if (items.length === 0) return null;
            const label = GROUP_LABELS[group];
            return (
              <div key={group} className="space-y-1">
                {label && (
                  <p className="px-3 pt-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500">{label}</p>
                )}
                {items.map((item) => {
                  const active = pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                        active
                          ? 'bg-brand-primary/20 text-brand-primary-light'
                          : 'text-gray-400 hover:bg-brand-bg hover:text-gray-200'
                      )}
                    >
                      <item.icon className="h-5 w-5 flex-shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* User section */}
        <div className="border-t border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-primary/20 text-brand-primary-light text-sm font-medium">
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
