'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/admin';
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setErr(null);
    const sb = createClient();
    const { error } = await sb.auth.signInWithPassword({ email, password: pw });
    setLoading(false);
    if (error) { setErr(error.message); return; }
    router.replace(next);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="w-full max-w-sm bg-zinc-900/70 backdrop-blur border border-zinc-800 rounded-2xl p-8 shadow-2xl">
      <div className="flex flex-col items-center gap-2 mb-6 text-center">
        <div className="text-5xl">🏆</div>
        <h1 className="text-2xl font-bold tracking-tight">RM Performance Dashboard</h1>
        <p className="text-xs text-zinc-500">Admin login</p>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">Email</label>
          <input className="w-full mt-1 bg-zinc-950/60 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400/50" type="email" placeholder="admin@admin.com" value={email} onChange={e=>setEmail(e.target.value)} required autoFocus />
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">Password</label>
          <input className="w-full mt-1 bg-zinc-950/60 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400/50" type="password" placeholder="••••••••" value={pw} onChange={e=>setPw(e.target.value)} required />
        </div>
        {err && <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{err}</div>}
        <button disabled={loading} className="w-full bg-gradient-to-r from-amber-400 to-yellow-300 text-amber-950 font-black tracking-wider rounded-lg py-2.5 disabled:opacity-50 hover:brightness-110 transition">
          {loading ? 'LOADING...' : '⚡ SIGN IN'}
        </button>
      </div>

      <div className="mt-6 text-center">
        <a href="/" className="text-xs text-zinc-500 hover:text-amber-400">← Back to dashboard</a>
      </div>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-[#0a0a0a] text-zinc-100"
      style={{ background: 'radial-gradient(800px 500px at 20% 0%, rgba(245,158,11,0.12), transparent 60%), radial-gradient(800px 500px at 80% 100%, rgba(59,130,246,0.10), transparent 60%), #0a0a0a' }}>
      <Suspense fallback={<div className="text-zinc-500 text-sm">Loading…</div>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
