'use client';

import { Button } from '@/components/ui/button';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <h2 className="text-xl font-bold text-gray-100 mb-2">Something went wrong</h2>
      <p className="text-gray-400 mb-4 text-sm">{error.message}</p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
