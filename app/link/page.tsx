import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dashboard Hub — Pilih Tampilan',
  description: 'Pintasan ke semua dashboard performa',
};

type Link = {
  href: string;
  icon: string;
  title: string;
  desc: string;
  url: string;
  bg: string;     // inline gradient (TV-safe rgba/hex, bukan oklab)
  ring: string;
};

const LINKS: Link[] = [
  {
    href: '/',
    icon: '🏆',
    title: 'RM',
    desc: 'Relationship Manager — Top 5, Coaching, Regional Battle, Leaderboard',
    url: '/',
    bg: 'linear-gradient(135deg, rgba(245,158,11,0.22), rgba(245,158,11,0.04))',
    ring: '#f59e0b',
  },
  {
    href: '/ps',
    icon: '🔎',
    title: 'Sourcing',
    desc: 'People Search + Central Sourcing Manager',
    url: '/ps',
    bg: 'linear-gradient(135deg, rgba(56,189,248,0.22), rgba(56,189,248,0.04))',
    ring: '#38bdf8',
  },
  {
    href: '/bs',
    icon: '🏢',
    title: 'BSO & APM',
    desc: 'Branch Sales Officer + Area Performance Manager',
    url: '/bs',
    bg: 'linear-gradient(135deg, rgba(16,185,129,0.22), rgba(16,185,129,0.04))',
    ring: '#10b981',
  },
];

export default function LinkHub() {
  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-8">
      <div className="text-center mb-10">
        <h1 className="text-5xl md:text-6xl font-black tracking-tight">📺 Dashboard Hub</h1>
        <p className="text-zinc-400 mt-3 text-xl md:text-2xl">Pilih tampilan yang mau ditayangkan</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-6xl">
        {LINKS.map((l) => (
          <a
            key={l.href}
            href={l.href}
            className="group rounded-3xl p-8 flex flex-col transition-transform duration-200 hover:scale-[1.03] focus:scale-[1.03] outline-none"
            style={{
              background: l.bg,
              border: `2px solid ${l.ring}`,
              boxShadow: `0 0 0 1px rgba(255,255,255,0.04), 0 18px 40px -20px ${l.ring}`,
            }}
          >
            <div className="text-6xl md:text-7xl mb-4">{l.icon}</div>
            <div className="text-3xl md:text-4xl font-black tracking-tight">{l.title}</div>
            <div className="text-zinc-300 mt-3 text-base md:text-lg leading-snug flex-1">{l.desc}</div>
            <div
              className="mt-6 inline-flex items-center gap-2 self-start rounded-full px-4 py-2 text-lg md:text-xl font-mono font-bold"
              style={{ background: 'rgba(255,255,255,0.06)', color: l.ring }}
            >
              {l.url} <span className="opacity-70">→</span>
            </div>
          </a>
        ))}
      </div>

      <a
        href="/admin"
        className="mt-10 text-zinc-400 hover:text-amber-400 text-lg underline underline-offset-4"
      >
        ⚙️ Admin (upload data) →
      </a>
    </main>
  );
}
