import { requireRole } from '@/lib/auth-guard';

export default async function GlobalLayout({ children }: { children: React.ReactNode }) {
  await requireRole('super_admin');
  return <>{children}</>;
}
