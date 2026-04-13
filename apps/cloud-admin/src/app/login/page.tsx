'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const supabase = createSupabaseBrowserClient();
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    // Fetch user role to determine redirect
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', data.user.id)
      .single();

    const role = profile?.role;
    if (role === 'super_admin') {
      router.push('/dashboard/global');
    } else if (role === 'content_manager') {
      router.push('/dashboard/content');
    } else {
      router.push('/dashboard/school');
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-bg p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mb-4 flex justify-center">
            <img src="/pulse-logo.png" alt="Pulse" className="h-14 w-auto" />
          </div>
          <CardTitle className="text-xl">Sign in</CardTitle>
          <CardDescription>Learning, Delivery Infrastructure</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@school.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <div className="rounded-md bg-red-500/10 border border-red-500/30 px-3 py-2 text-sm text-red-400">
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
            </Button>
            <div className="text-center">
              <a href="/reset-password" className="text-sm text-gray-400 hover:text-gray-200">Forgot password?</a>
            </div>
          </form>
          <div className="mt-4 flex justify-center gap-4 text-xs text-gray-600">
            <a href="/terms" className="hover:text-gray-400">Terms of Service</a>
            <a href="/privacy" className="hover:text-gray-400">Privacy Policy</a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
