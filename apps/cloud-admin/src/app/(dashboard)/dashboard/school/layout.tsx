import { requireRole } from '@/lib/auth-guard';

export default async function SchoolLayout({ children }: { children: React.ReactNode }) {
  await requireRole('super_admin', 'tenant_admin', 'site_admin', 'content_manager', 'teacher');
  return <>{children}</>;
}
