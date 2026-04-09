import { requireRole } from '@/lib/auth-guard';

export default async function ContentLayout({ children }: { children: React.ReactNode }) {
  await requireRole('super_admin', 'tenant_admin', 'site_admin', 'content_manager');
  return <>{children}</>;
}
