'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

// ─── 5 CSS art backgrounds — Pulse-branded warm orange/amber motifs ──────────
const SLIDES = [
  {
    // Signal waves radiating outward — connectivity motif
    bg: `
      radial-gradient(ellipse 80% 60% at 20% 30%, rgba(242,101,34,0.7) 0%, transparent 60%),
      radial-gradient(ellipse 60% 80% at 80% 70%, rgba(245,158,11,0.5) 0%, transparent 55%),
      radial-gradient(ellipse 40% 40% at 50% 50%, rgba(232,76,30,0.35) 0%, transparent 50%),
      linear-gradient(135deg, #120800 0%, #1f0e00 40%, #0a0500 100%)
    `,
    caption: 'Delivering education where connectivity ends.',
  },
  {
    // Network constellation — nodes and connections
    bg: `
      radial-gradient(circle at 15% 85%, rgba(59,130,246,0.5) 0%, transparent 40%),
      radial-gradient(circle at 85% 20%, rgba(139,92,246,0.4) 0%, transparent 35%),
      radial-gradient(circle at 50% 50%, rgba(242,101,34,0.3) 0%, transparent 50%),
      conic-gradient(from 180deg at 50% 50%, #120800 0%, #0a0518 25%, #120800 50%, #08001a 75%, #120800 100%)
    `,
    caption: 'Cloud to classroom. One sync at a time.',
  },
  {
    // Warm pulse — heartbeat of school infrastructure
    bg: `
      radial-gradient(ellipse 50% 70% at 30% 20%, rgba(16,185,129,0.45) 0%, transparent 55%),
      radial-gradient(ellipse 70% 50% at 70% 80%, rgba(242,101,34,0.55) 0%, transparent 50%),
      radial-gradient(circle at 90% 10%, rgba(6,182,212,0.35) 0%, transparent 35%),
      linear-gradient(160deg, #0a0500 0%, #120800 30%, #061510 60%, #0a0500 100%)
    `,
    caption: 'Students keep learning. Teachers keep teaching.',
  },
  {
    // Sunrise over horizon — knowledge delivery
    bg: `
      radial-gradient(circle at 50% 0%, rgba(245,158,11,0.75) 0%, transparent 40%),
      radial-gradient(circle at 0% 100%, rgba(232,76,30,0.45) 0%, transparent 45%),
      radial-gradient(circle at 100% 100%, rgba(244,63,94,0.3) 0%, transparent 40%),
      radial-gradient(circle at 50% 50%, rgba(242,101,34,0.12) 0%, transparent 60%),
      linear-gradient(180deg, #1f0e00 0%, #120800 50%, #0a0500 100%)
    `,
    caption: 'Content syncs. Knowledge stays.',
  },
  {
    // Aurora borealis — data flowing across the sky
    bg: `
      radial-gradient(ellipse 90% 40% at 50% 100%, rgba(242,101,34,0.45) 0%, transparent 50%),
      radial-gradient(circle at 20% 30%, rgba(139,92,246,0.35) 0%, transparent 35%),
      radial-gradient(circle at 80% 40%, rgba(59,130,246,0.25) 0%, transparent 35%),
      radial-gradient(circle at 50% 10%, rgba(245,158,11,0.3) 0%, transparent 40%),
      linear-gradient(180deg, #0a0500 0%, #120800 40%, #08001a 70%, #120800 100%)
    `,
    caption: 'Pulse — the delivery layer of Inteliflow.',
  },
];

const INTERVAL = 10000;

// ─── Background Rotator ──────────────────────────────────────────────────────
function BackgroundRotator() {
  const [current, setCurrent] = useState(0);
  const [sliding, setSliding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextIdx = (current + 1) % SLIDES.length;

  useEffect(() => {
    timer.current = setTimeout(() => {
      setSliding(true);
      setTimeout(() => {
        setCurrent((p) => (p + 1) % SLIDES.length);
        setSliding(false);
      }, 1000);
    }, INTERVAL);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [current]);

  return (
    <>
      <style>{`
        @keyframes login-slide {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
      `}</style>

      {/* Sliding backgrounds */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden' }}>
        <div style={{
          display: 'flex', width: '200%', height: '100%',
          animation: sliding ? 'login-slide 1s ease-in-out forwards' : 'none',
        }}>
          <div style={{ width: '50%', height: '100%', flexShrink: 0, background: SLIDES[current].bg }} />
          <div style={{ width: '50%', height: '100%', flexShrink: 0, background: SLIDES[nextIdx].bg }} />
        </div>
      </div>

      {/* Grain texture */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none', opacity: 0.03,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'repeat', backgroundSize: '128px',
      }} />

      {/* Caption */}
      <div style={{ position: 'fixed', bottom: 28, left: 32, zIndex: 10, opacity: sliding ? 0 : 1, transition: 'opacity .5s' }}>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontFamily: "'DM Sans',system-ui,sans-serif", letterSpacing: '.02em', margin: 0, textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
          {SLIDES[current].caption}
        </p>
      </div>

      {/* Dots */}
      <div style={{ position: 'fixed', bottom: 28, right: 32, zIndex: 10, display: 'flex', gap: 6, alignItems: 'center' }}>
        {SLIDES.map((_, i) => (
          <button key={i} onClick={() => { if (i !== current && !sliding) setCurrent(i); }} style={{
            width: i === current ? 20 : 6, height: 6, borderRadius: 3, border: 'none', cursor: 'pointer', padding: 0,
            background: i === current ? 'rgba(242,101,34,0.9)' : 'rgba(255,255,255,0.3)', transition: 'all .4s',
          }} />
        ))}
      </div>
    </>
  );
}

// ─── Login Page ──────────────────────────────────────────────────────────────
export default function LoginPage() {
  const router = useRouter();
  const supabaseRef = useRef<ReturnType<typeof createSupabaseBrowserClient> | null>(null);

  const getSupabase = useCallback(() => {
    if (!supabaseRef.current) supabaseRef.current = createSupabaseBrowserClient();
    return supabaseRef.current;
  }, []);

  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = getSupabase();
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) { setError(authError.message); setLoading(false); return; }

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
    router.refresh();
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    const { error: resetError } = await getSupabase().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    if (resetError) setError(resetError.message);
    else setMessage('Check your email for a password reset link.');
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: "'DM Sans',system-ui,sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');`}</style>
      <BackgroundRotator />

      {/* Frosted glass login card */}
      <div style={{
        position: 'relative', zIndex: 20, width: '100%', maxWidth: 420, padding: '44px 36px',
        borderRadius: 24,
        background: 'rgba(18,8,0,0.5)',
        backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)',
        border: '1px solid rgba(255,255,255,0.12)',
        boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img src="/pulse-logo.png" alt="Pulse" style={{ height: 56, width: 'auto', margin: '0 auto 16px', display: 'block' }} />
          <h1 style={{ fontWeight: 800, fontSize: 26, color: '#fff4eb', margin: 0, fontFamily: "'DM Sans',system-ui,sans-serif" }}>
            {mode === 'login' ? 'Sign in to Pulse' : 'Reset Password'}
          </h1>
          <p style={{ fontSize: 14, color: 'rgba(212,165,116,0.8)', marginTop: 6 }}>
            {mode === 'login' ? 'Learning, Delivery Infrastructure' : 'Enter your email to receive a reset link'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={mode === 'login' ? handleLogin : handleForgotPassword} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Email */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'rgba(212,165,116,0.9)', marginBottom: 6 }}>Email</label>
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="you@school.edu"
              style={inputStyle} />
          </div>

          {/* Password */}
          {mode === 'login' && (
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'rgba(212,165,116,0.9)', marginBottom: 6 }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input type={showPassword ? 'text' : 'password'} required autoComplete="current-password" value={password}
                  onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password"
                  style={{ ...inputStyle, paddingRight: 44 }} />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(212,165,116,0.5)', padding: 4 }}>
                  {showPassword ? <EyeOff /> : <Eye />}
                </button>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ padding: '10px 14px', borderRadius: 12, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', fontSize: 13, color: '#fca5a5' }}>
              {error}
            </div>
          )}

          {/* Success */}
          {message && (
            <div style={{ padding: '10px 14px', borderRadius: 12, background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', fontSize: 13, color: '#6ee7b7' }}>
              {message}
            </div>
          )}

          {/* Submit */}
          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '14px 0', borderRadius: 14, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
            background: loading ? 'rgba(242,101,34,0.4)' : 'linear-gradient(135deg,#f26522,#e84c1e)',
            color: '#fff', fontSize: 15, fontWeight: 700, fontFamily: "'DM Sans',system-ui,sans-serif",
            boxShadow: loading ? 'none' : '0 6px 24px rgba(242,101,34,0.4)',
            transition: 'all .2s', opacity: loading ? 0.7 : 1,
          }}>
            {loading ? (mode === 'login' ? 'Signing in...' : 'Sending...') : (mode === 'login' ? 'Sign In' : 'Send Reset Link')}
          </button>
        </form>

        {/* Mode toggle + links */}
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          {mode === 'login' ? (
            <button onClick={() => { setMode('forgot'); setError(null); setMessage(null); }}
              style={{ background: 'none', border: 'none', color: '#f5803e', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans',system-ui,sans-serif" }}>
              Forgot your password?
            </button>
          ) : (
            <button onClick={() => { setMode('login'); setError(null); setMessage(null); }}
              style={{ background: 'none', border: 'none', color: '#f5803e', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans',system-ui,sans-serif" }}>
              Back to sign in
            </button>
          )}
        </div>

        {/* Legal links */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 16 }}>
          <a href="/terms" style={{ fontSize: 11, color: 'rgba(212,165,116,0.4)', textDecoration: 'none' }}>Terms of Service</a>
          <a href="/privacy" style={{ fontSize: 11, color: 'rgba(212,165,116,0.4)', textDecoration: 'none' }}>Privacy Policy</a>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '13px 16px', borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.06)', color: '#fff4eb', fontSize: 15,
  outline: 'none', fontFamily: "'DM Sans',system-ui,sans-serif",
  transition: 'border-color .2s',
};

function Eye() {
  return <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>;
}
function EyeOff() {
  return <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12c1.292 4.338 5.31 7.5 10.066 7.5.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>;
}
