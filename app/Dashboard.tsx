'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KpiRow } from '@/lib/parse-kpi';

const DEFAULT_TRANSITION_MS = 15000;
const DEFAULT_SCROLL_SPEED  = 40; // px/sec

const pct = (v: number) => (v * 100).toFixed(2) + '%';
const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase();

type KpiDef = { name: string; weight: number };
type Settings = { transitionMs: number; scrollSpeed: number };

export default function Dashboard({ rows, period, fileName, uploadedAt }: {
  rows: KpiRow[]; kpiDefs: KpiDef[]; period: string | null; fileName?: string | null; uploadedAt?: string | null;
}) {
  const [page, setPage]     = useState(0);
  const [dir, setDir]       = useState<'right' | 'left'>('right');
  const [animKey, setAnimKey] = useState(0);
  const [paused, setPaused] = useState(false);
  const [settings, setSettings] = useState<Settings>({ transitionMs: DEFAULT_TRANSITION_MS, scrollSpeed: DEFAULT_SCROLL_SPEED });

  // Load settings from localStorage
  useEffect(() => {
    try {
      const s = localStorage.getItem('rmDashSettings');
      if (s) setSettings(JSON.parse(s));
    } catch {}
    // Listen for changes (e.g. admin opens in same browser)
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'rmDashSettings' && e.newValue) {
        try { setSettings(JSON.parse(e.newValue)); } catch {}
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const navigate = useCallback((delta: 1 | -1) => {
    setDir(delta === 1 ? 'right' : 'left');
    setPage(p => (p + delta + 4) % 4);
    setAnimKey(k => k + 1);
  }, []);

  // Auto-rotate — skip leaderboard page (scroll handles its transition)
  useEffect(() => {
    if (paused || page === 3) return;
    const t = setInterval(() => navigate(1), settings.transitionMs);
    return () => clearInterval(t);
  }, [paused, page, settings.transitionMs, navigate]);

  // Called by leaderboard when scroll finishes
  const onLeaderboardDone = useCallback(() => navigate(1), [navigate]);

  // Auto-refresh once per day
  useEffect(() => {
    const t = setTimeout(() => location.reload(), 24 * 60 * 60 * 1000);
    return () => clearTimeout(t);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') { navigate(1); setPaused(true); }
      if (e.key === 'ArrowLeft')  { navigate(-1); setPaused(true); }
      if (e.key === ' ') { setPaused(v => !v); e.preventDefault(); }
      if (e.key.toLowerCase() === 'f') document.documentElement.requestFullscreen?.();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [navigate]);

  const stats = useMemo(() => {
    const avg = rows.reduce((s, r) => s + r.pencapaian, 0) / rows.length;
    const ok = rows.filter(r => r.pencapaian >= 0.95).length;
    return { total: rows.length, avg, ok, focus: rows.length - ok };
  }, [rows]);

  const regionLabel = useMemo(() => {
    const order: string[] = [];
    rows.forEach(r => { if (r.regional && !order.includes(r.regional)) order.push(r.regional); });
    return (name: string) => name ? `Region ${order.indexOf(name) + 1 || '-'}` : '-';
  }, [rows]);

  const top5    = useMemo(() => [...rows].sort((a, b) => b.pencapaian - a.pencapaian).slice(0, 5), [rows]);
  const worst5  = useMemo(() => [...rows].sort((a, b) => a.pencapaian - b.pencapaian).slice(0, 5), [rows]);
  const sorted  = useMemo(() => [...rows].sort((a, b) => b.pencapaian - a.pencapaian), [rows]);

  const regionGroups = useMemo(() => {
    const m = new Map<string, KpiRow[]>();
    rows.forEach(r => {
      const k = regionLabel(r.regional);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(r);
    });
    return [...m.entries()]
      .map(([region, members]) => ({
        region, members,
        avg: members.reduce((s, r) => s + r.pencapaian, 0) / members.length,
        champ: [...members].sort((a, b) => b.pencapaian - a.pencapaian)[0],
      }))
      .sort((a, b) => b.avg - a.avg);
  }, [rows, regionLabel]);

  const setPageManual = (p: number) => {
    setDir(p > page ? 'right' : 'left');
    setPage(p);
    setAnimKey(k => k + 1);
    setPaused(true);
  };

  return (
    <div className="h-screen bg-[#0a0a0a] text-zinc-100 p-6 md:p-8 flex flex-col gap-6 overflow-hidden">
      <style>{`
        @keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes slideInLeft  { from { transform: translateX(-100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .slide-right { animation: slideInRight 0.55s cubic-bezier(0.4,0,0.2,1) both; }
        .slide-left  { animation: slideInLeft  0.55s cubic-bezier(0.4,0,0.2,1) both; }
      `}</style>

      <Header
        period={period} stats={stats} regionalsCount={regionGroups.length}
        page={page} setPage={setPageManual} paused={paused} setPaused={setPaused}
        fileName={fileName} uploadedAt={uploadedAt}
      />

      <div key={animKey} className={dir === 'right' ? 'slide-right' : 'slide-left'} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {page === 0 && <PageTop top5={top5} regionLabel={regionLabel} />}
        {page === 1 && <PageCoaching worst5={worst5} regionLabel={regionLabel} totalCount={rows.length} />}
        {page === 2 && <PageRegional groups={regionGroups} />}
        {page === 3 && <PageLeaderboard sorted={sorted} regionLabel={regionLabel} scrollSpeed={settings.scrollSpeed} onScrollDone={onLeaderboardDone} />}
      </div>
    </div>
  );
}

/* ─── Header ──────────────────────────────────────────────────────────── */
function Header({ period, stats, regionalsCount, page, setPage, paused, setPaused, fileName, uploadedAt }: {
  period: string | null; stats: { total: number; avg: number; ok: number; focus: number };
  regionalsCount: number; page: number; setPage: (p: number) => void; paused: boolean; setPaused: (v: boolean) => void;
  fileName?: string | null; uploadedAt?: string | null;
}) {
  return (
    <header className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight flex items-center gap-3 flex-wrap">
            <span>🏆</span> RM Performance Dashboard
            {period && (
              <span className="text-base md:text-lg font-bold tracking-wider px-3 py-1 rounded-full bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/40">
                📅 {period}
              </span>
            )}
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Performance scoring &amp; gamification — {stats.total} RM across {regionalsCount} regionals
          </p>
          {(fileName || uploadedAt) && (
            <p className="text-xs text-zinc-600 mt-1">
              {fileName && <>📄 {fileName}</>}
              {uploadedAt && <span className="ml-2">· uploaded {new Date(uploadedAt).toLocaleString('id-ID')}</span>}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {['Top 5 Best', 'Top 5 Worst', 'Regional', 'Leaderboard'].map((t, i) => (
            <button key={t} onClick={() => setPage(i)} className={`px-3 py-1.5 rounded-md text-xs font-medium ${page === i ? 'bg-zinc-100 text-zinc-900' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'}`}>{t}</button>
          ))}
          <button onClick={() => setPaused(!paused)} className="px-3 py-1.5 rounded-md text-xs font-medium bg-zinc-900 text-zinc-400 hover:bg-zinc-800" title="Space">
            {paused ? '▶' : '⏸'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total RM" value={String(stats.total)} />
        <StatCard label="Rata-rata performance" value={pct(stats.avg)} />
        <StatCard label="Performance ≥ 95% (aman)" value={String(stats.ok)} sub={`(${Math.round(stats.ok / stats.total * 100)}%)`} tone="good" />
        <StatCard label="Performance < 95% (perlu perhatian)" value={String(stats.focus)} sub={`(${Math.round(stats.focus / stats.total * 100)}%)`} tone="warn" />
      </div>
    </header>
  );
}

function StatCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'good' | 'warn' }) {
  const cls = tone === 'good' ? 'bg-emerald-950/40 border-emerald-900/60' : tone === 'warn' ? 'bg-amber-950/40 border-amber-900/60' : 'bg-zinc-900/60 border-zinc-800';
  const labelCls = tone === 'good' ? 'text-emerald-400' : tone === 'warn' ? 'text-amber-400' : 'text-zinc-400';
  return (
    <div className={`rounded-xl border p-4 ${cls}`}>
      <div className={`text-xs font-medium ${labelCls}`}>{label}</div>
      <div className="text-2xl md:text-3xl font-bold mt-2 flex items-baseline gap-2">
        {value}
        {sub && <span className="text-sm font-normal text-zinc-500">{sub}</span>}
      </div>
    </div>
  );
}

/* ─── Page 1: Top 5 Best (podium besar) ───────────────────────────────── */
function PageTop({ top5, regionLabel }: { top5: KpiRow[]; regionLabel: (n: string) => string }) {
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex items-baseline gap-3 mb-4 shrink-0">
        <h2 className="text-2xl md:text-3xl font-bold flex items-center gap-2">🏆 Top 5 Best Performers</h2>
      </div>
      <div className="flex-1 min-h-0 flex items-center">
        <Podium top5={top5} regionLabel={regionLabel} />
      </div>
    </div>
  );
}

/* ─── Page 2: Top 5 Coaching (baris besar) ────────────────────────────── */
function PageCoaching({ worst5, regionLabel, totalCount }: { worst5: KpiRow[]; regionLabel: (n: string) => string; totalCount: number }) {
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex items-baseline gap-3 mb-4 shrink-0">
        <h2 className="text-2xl md:text-3xl font-bold flex items-center gap-2 text-red-400">⚠ Top 5 Terbawah <span className="animate-pulse">(warning!!)</span></h2>
        <span className="text-base text-zinc-400">— area improvement spotlight</span>
      </div>
      <div className="flex-1 min-h-0 grid gap-3" style={{ gridTemplateRows: `repeat(${worst5.length}, minmax(0, 1fr))` }}>
        {worst5.map((r, i) => <CoachRow key={r.name} rank={totalCount - i} row={r} regionLabel={regionLabel} severity={r.pencapaian < 0.95 ? 'high' : 'med'} />)}
      </div>
    </div>
  );
}

function Podium({ top5, regionLabel }: { top5: KpiRow[]; regionLabel: (n: string) => string }) {
  const [r1, r2, r3, r4, r5] = top5;
  return (
    <div className="w-full flex flex-col gap-5">
      <div className="grid grid-cols-3 gap-4 md:gap-6 items-end">
        {r2 && <PodiumCard rank={2} row={r2} regionLabel={regionLabel} />}
        {r1 && <PodiumCard rank={1} row={r1} regionLabel={regionLabel} />}
        {r3 && <PodiumCard rank={3} row={r3} regionLabel={regionLabel} />}
      </div>
      {(r4 || r5) && (
        <div className="grid grid-cols-2 gap-4 md:gap-6">
          {r4 && <MinorCard rank={4} row={r4} regionLabel={regionLabel} />}
          {r5 && <MinorCard rank={5} row={r5} regionLabel={regionLabel} />}
        </div>
      )}
    </div>
  );
}

// Nilai gradient eksplisit (rgba/hex) — kompatibel dengan browser TV Samsung/Tizen
// yang tidak mendukung sintaks gradient modern Tailwind v4 ("in oklab").
const PODIUM_STYLE = {
  1: {
    cardBg: 'linear-gradient(135deg, rgba(245,158,11,0.30), rgba(245,158,11,0.12) 50%, rgba(120,53,15,0.40))',
    avatarBg: 'linear-gradient(135deg, #fcd34d, #f59e0b, #b45309)',
    glow: '0 0 60px -10px rgba(245,158,11,0.55)',
    border: 'rgba(251,191,36,0.6)', text: '#fcd34d',
    badgeBg: 'linear-gradient(90deg, #fbbf24, #fde047)', badgeText: '#451a03',
    icon: '🏆', label: 'CHAMPION', height: 'pt-2 -mt-4',
  },
  2: {
    cardBg: 'linear-gradient(135deg, rgba(212,212,216,0.15), rgba(161,161,170,0.10) 50%, rgba(63,63,70,0.40))',
    avatarBg: 'linear-gradient(135deg, #e4e4e7, #a1a1aa, #52525b)',
    glow: '0 0 30px -10px rgba(212,212,216,0.4)',
    border: 'rgba(161,161,170,0.4)', text: '#e4e4e7',
    badgeBg: 'linear-gradient(90deg, #e4e4e7, #a1a1aa)', badgeText: '#18181b',
    icon: '🥈', label: 'RUNNER-UP', height: 'pt-4',
  },
  3: {
    cardBg: 'linear-gradient(135deg, rgba(251,146,60,0.20), rgba(234,88,12,0.10) 50%, rgba(124,45,18,0.40))',
    avatarBg: 'linear-gradient(135deg, #fdba74, #f97316, #c2410c)',
    glow: '0 0 30px -10px rgba(234,88,12,0.4)',
    border: 'rgba(249,115,22,0.4)', text: '#fdba74',
    badgeBg: 'linear-gradient(90deg, #fdba74, #f97316)', badgeText: '#431407',
    icon: '🥉', label: 'THIRD', height: 'pt-4',
  },
} as const;

function PodiumCard({ rank, row, regionLabel }: { rank: 1 | 2 | 3; row: KpiRow; regionLabel: (n: string) => string }) {
  const s = PODIUM_STYLE[rank];
  const isPerfect = row.pencapaian >= 1;
  const big = rank === 1;
  return (
    <div className={`relative rounded-2xl border p-5 md:p-6 flex flex-col items-center text-center gap-2 ${s.height}`}
         style={{ background: s.cardBg, boxShadow: s.glow, borderColor: s.border }}>
      <div className={`absolute -top-5 left-1/2 -translate-x-1/2 ${big ? 'text-5xl' : 'text-4xl'}`}>{s.icon}</div>
      <div className="text-sm md:text-base font-bold tracking-[0.18em] mt-3" style={{ color: s.text }}>{s.label}</div>
      <div className={`${big ? 'w-24 h-24 text-3xl' : 'w-20 h-20 text-2xl'} rounded-full flex items-center justify-center font-black text-white shadow`}
           style={{ background: s.avatarBg }}>
        {initials(row.name)}
      </div>
      <div className={`font-bold ${big ? 'text-2xl md:text-3xl' : 'text-xl md:text-2xl'} leading-tight`}>{row.name}</div>
      <div className="text-sm md:text-base text-zinc-400">{regionLabel(row.regional)}</div>
      <div className={`${big ? 'text-4xl md:text-5xl' : 'text-3xl md:text-4xl'} font-black`} style={{ color: s.text }}>{pct(row.pencapaian)}</div>
      {isPerfect && (
        <div className="px-3 py-1 rounded-full text-xs md:text-sm font-black tracking-widest" style={{ background: s.badgeBg, color: s.badgeText }}>
          ⭐ PERFECT
        </div>
      )}
    </div>
  );
}

function MinorCard({ rank, row, regionLabel }: { rank: number; row: KpiRow; regionLabel: (n: string) => string }) {
  const isPerfect = row.pencapaian >= 1;
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3.5 flex items-center gap-4">
      <div className="text-sm font-bold text-zinc-500 w-10 text-center leading-tight">#<span className="text-2xl text-zinc-200">{rank}</span></div>
      <div className="w-14 h-14 rounded-full bg-zinc-700 flex items-center justify-center text-lg font-bold text-white shrink-0">{initials(row.name)}</div>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-xl md:text-2xl truncate">{row.name}</div>
        <div className="text-sm md:text-base text-zinc-500 truncate">{regionLabel(row.regional)}</div>
      </div>
      <div className="text-right">
        <div className="text-2xl md:text-3xl font-bold">{pct(row.pencapaian)}</div>
        {isPerfect && <div className="text-xs font-black text-amber-400 tracking-wider">⭐ PERFECT</div>}
      </div>
    </div>
  );
}

function CoachRow({ rank, row, regionLabel, severity }: { rank: number; row: KpiRow; regionLabel: (n: string) => string; severity: 'high' | 'med' }) {
  const weak = [...row.kpis].sort((a, b) => a.value - b.value)[0];
  const bar = severity === 'high' ? 'bg-red-500' : 'bg-amber-500';
  const totalText = severity === 'high' ? 'text-red-400' : 'text-amber-400';
  const rankText = severity === 'high' ? 'text-red-400' : 'text-amber-400';
  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl overflow-hidden flex items-stretch h-full">
      <div className={`w-2 ${bar}`} />
      <div className="flex-1 grid grid-cols-12 gap-3 items-center px-5">
        <div className={`col-span-1 text-2xl md:text-3xl font-black ${rankText}`}>#{rank}</div>
        <div className="col-span-5">
          <div className="font-bold text-xl md:text-3xl leading-tight flex items-center gap-3 flex-wrap">
            {row.name}
            <span className="text-xs font-black tracking-widest px-3 py-1 rounded-full bg-red-500 text-white shadow-[0_0_12px_rgba(239,68,68,0.6)] animate-pulse">⚠ WARNING</span>
          </div>
          <div className="text-sm md:text-base text-zinc-500 mt-1">{regionLabel(row.regional)}{row.aom ? ` · ${row.aom}` : ''}</div>
        </div>
        <div className="col-span-4">
          <div className="text-sm md:text-base text-zinc-400 flex items-center gap-1.5">Weak: <b className="text-red-300">{weak.name}</b></div>
          <div className={`text-sm md:text-base mt-1 inline-block px-3 py-1 rounded font-bold ring-1 ${
            weak.value < 0.5 ? 'bg-red-500/20 text-red-300 ring-red-500/50 shadow-[0_0_8px_rgba(239,68,68,0.4)]'
            : weak.value < 0.9 ? 'bg-amber-500/20 text-amber-300 ring-amber-500/50'
            : 'bg-zinc-800 text-zinc-200 ring-zinc-700'
          }`}>🔻 {pct(weak.value)}</div>
        </div>
        <div className={`col-span-2 text-right text-3xl md:text-4xl font-black ${totalText}`}>{pct(row.pencapaian)}</div>
      </div>
    </div>
  );
}

/* ─── Page 2: Regional ────────────────────────────────────────────────── */
function PageRegional({ groups }: { groups: { region: string; members: KpiRow[]; avg: number; champ: KpiRow }[] }) {
  return (
    <section className="flex-1 min-h-0 overflow-auto">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-2xl md:text-3xl font-bold flex items-center gap-2">⚔️ Regional Battle 🛡️</h2>
      </div>
      <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        {groups.map((g, i) => <RegionalCard key={g.region} group={g} rank={i + 1} />)}
      </div>
      <RegionalBarChart groups={groups} />
    </section>
  );
}

function RegionalBarChart({ groups }: { groups: { region: string; members: KpiRow[]; avg: number; champ: KpiRow }[] }) {
  const min = 90, max = 100;
  const colors = ['#10b981', '#3b82f6', '#a78bfa', '#f59e0b'];
  const ordered = [...groups].sort((a, b) => a.region.localeCompare(b.region));
  return (
    <div className="mt-6 bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-base">🚩</span>
        <h3 className="text-base font-bold">Regional comparison</h3>
        <span className="text-[11px] text-zinc-500 ml-auto">scale {min}% – {max}%</span>
      </div>
      <div className="flex flex-col gap-3">
        {ordered.map((g, i) => {
          const v = Math.max(min, Math.min(max, g.avg * 100));
          const w = ((v - min) / (max - min)) * 100;
          return (
            <div key={g.region} className="grid grid-cols-[180px_1fr_70px] gap-3 items-center">
              <div className="text-xs text-zinc-400 truncate" title={g.region}>{g.region}</div>
              <div className="h-7 bg-zinc-800/60 rounded relative overflow-hidden">
                <div className="h-full rounded transition-all" style={{ width: `${w}%`, background: colors[i % colors.length] }} />
              </div>
              <div className="text-xs font-bold text-right">{pct(g.avg)}</div>
            </div>
          );
        })}
        <div className="grid grid-cols-[180px_1fr_70px] gap-3 mt-1">
          <div />
          <div className="flex justify-between text-[10px] text-zinc-600">
            {Array.from({ length: max - min + 1 }, (_, i) => min + i).map(v => <span key={v}>{v}%</span>)}
          </div>
          <div />
        </div>
      </div>
    </div>
  );
}

// Inline gradient eksplisit — kompatibel browser TV Samsung/Tizen.
const REGION_THEME = [
  { cardBg: 'linear-gradient(135deg, rgba(245,158,11,0.20), rgba(120,53,15,0.30) 50%, #09090b)', glow: '0 0 50px -10px rgba(245,158,11,0.5)', border: 'rgba(245,158,11,0.5)', accent: '#fcd34d', bar: 'linear-gradient(90deg, #fbbf24, #fde047)', icon: '🏆', label: 'CHAMPION REGION' },
  { cardBg: 'linear-gradient(135deg, rgba(212,212,216,0.10), rgba(63,63,70,0.30) 50%, #09090b)', glow: '0 0 30px -10px rgba(212,212,216,0.3)', border: 'rgba(161,161,170,0.3)', accent: '#e4e4e7', bar: 'linear-gradient(90deg, #d4d4d8, #71717a)', icon: '🛡️', label: 'CONTENDER' },
  { cardBg: 'linear-gradient(135deg, rgba(249,115,22,0.15), rgba(124,45,18,0.25) 50%, #09090b)', glow: '0 0 30px -10px rgba(234,88,12,0.3)', border: 'rgba(249,115,22,0.3)', accent: '#fdba74', bar: 'linear-gradient(90deg, #fb923c, #ea580c)', icon: '⚔️', label: 'CHALLENGER' },
];

function RegionalCard({ group: g, rank }: { group: { region: string; members: KpiRow[]; avg: number; champ: KpiRow }; rank: number }) {
  const t = REGION_THEME[Math.min(rank - 1, REGION_THEME.length - 1)] ?? REGION_THEME[2];
  const medal = ['🥇', '🥈', '🥉'][rank - 1] ?? '🏅';
  return (
    <div className="relative rounded-2xl border p-6 overflow-hidden" style={{ background: t.cardBg, boxShadow: t.glow, borderColor: t.border }}>
      <div className="absolute -top-8 -right-8 text-9xl opacity-5 select-none">{t.icon}</div>

      {/* Ranking besar */}
      <div className="flex items-center justify-between relative mb-2">
        <div className="text-xs md:text-sm font-black tracking-[0.25em]" style={{ color: t.accent }}>{t.label}</div>
        <div className="flex items-center gap-2">
          <span className="text-4xl md:text-5xl leading-none">{medal}</span>
          <span className="text-3xl md:text-4xl font-black" style={{ color: t.accent }}>#{rank}</span>
        </div>
      </div>

      <h3 className="text-2xl md:text-3xl font-bold flex items-center gap-2 leading-tight">
        <span className="text-3xl md:text-4xl">{t.icon}</span>{g.region}
      </h3>

      <div className="text-base md:text-lg text-zinc-400 mt-3 flex items-center gap-2 flex-wrap">
        <span>👥 {g.members.length} RM</span><span className="text-zinc-700">·</span>
        <span className="truncate">🏅 <b className="text-zinc-200">{g.champ.name}</b></span>
      </div>

      <div className="text-6xl md:text-7xl font-black mt-4" style={{ color: t.accent }}>{pct(g.avg)}</div>
      <div className="h-3 bg-black/40 rounded-full mt-4 overflow-hidden ring-1 ring-white/5">
        <div className="h-full" style={{ width: `${Math.min(100, g.avg * 100)}%`, background: t.bar }} />
      </div>
    </div>
  );
}

/* ─── Page 3: Leaderboard ─────────────────────────────────────────────── */
function PageLeaderboard({ sorted, regionLabel, scrollSpeed, onScrollDone }: {
  sorted: KpiRow[]; regionLabel: (n: string) => string;
  scrollSpeed: number; onScrollDone: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const total     = sorted.length;
  const medal     = (i: number) => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';
  const isBottom  = (i: number) => i >= total - 5;
  const rowTint   = (i: number, score: number) => {
    if (i === 0) return 'bg-gradient-to-r from-amber-500/15 via-transparent to-transparent border-l-4 border-amber-400';
    if (i === 1) return 'bg-gradient-to-r from-zinc-300/10 via-transparent to-transparent border-l-4 border-zinc-400';
    if (i === 2) return 'bg-gradient-to-r from-orange-500/10 via-transparent to-transparent border-l-4 border-orange-400';
    if (isBottom(i)) return 'bg-gradient-to-r from-red-500/10 via-transparent to-transparent border-l-4 border-red-500/60';
    return score < 0.95 ? 'border-l-4 border-amber-500/40' : 'border-l-4 border-transparent';
  };
  const totalCls = (v: number) => v < 0.90 ? 'text-red-400' : v >= 0.95 ? 'text-emerald-400' : 'text-amber-400';

  // Smooth auto-scroll via requestAnimationFrame
  const doneRef = useRef(false);
  useEffect(() => {
    doneRef.current = false;
    const el = scrollRef.current;
    if (!el || scrollSpeed <= 0) return;

    // Reset scroll to top when (re)entering this page
    el.scrollTop = 0;

    let lastTime: number | null = null;
    let raf: number;

    function step(ts: number) {
      if (doneRef.current) return;
      if (lastTime !== null) {
        const delta = ts - lastTime;
        el!.scrollTop += (scrollSpeed * delta) / 1000;
        const atBottom = el!.scrollTop + el!.clientHeight >= el!.scrollHeight - 4;
        if (atBottom) {
          doneRef.current = true;
          setTimeout(onScrollDone, 1200); // brief pause at bottom before transitioning
          return;
        }
      }
      lastTime = ts;
      raf = requestAnimationFrame(step);
    }

    // Small delay before starting scroll (let slide animation finish)
    const startTimer = setTimeout(() => { raf = requestAnimationFrame(step); }, 600);

    return () => {
      doneRef.current = true;
      clearTimeout(startTimer);
      cancelAnimationFrame(raf);
    };
  }, [scrollSpeed, onScrollDone]);

  return (
    <section className="flex-1 flex flex-col min-h-0">
      <h2 className="text-2xl md:text-3xl font-bold mb-4 flex items-center gap-2">
        📊 Full Leaderboard <span className="text-base text-zinc-500 font-normal">— Hall of Fame</span>
      </h2>
      <div ref={scrollRef} className="flex-1 overflow-auto rounded-xl border border-zinc-800" style={{ scrollBehavior: 'auto' }}>
        <table className="w-full">
          <thead className="sticky top-0 bg-zinc-900 z-10 text-sm md:text-base uppercase tracking-wider text-zinc-400">
            <tr>
              <th className="p-4 text-center w-24">Rank</th>
              <th className="p-4 text-left">Nama RM</th>
              <th className="p-4 text-left">Region</th>
              <th className="p-4 text-left">AOM</th>
              <th className="p-4 text-right w-40">Total</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => {
              const isPerfect = r.pencapaian >= 1;
              return (
                <tr key={r.name} className={`border-t border-zinc-800/60 ${rowTint(i, r.pencapaian)}`}>
                  <td className="p-4 text-center">
                    <div className="flex flex-col items-center leading-none">
                      <span className="text-3xl md:text-4xl leading-none">{medal(i)}</span>
                      <span className={`text-base md:text-lg font-black mt-1 ${i < 3 ? 'text-zinc-100' : 'text-zinc-500'}`}>#{i + 1}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="font-bold text-xl md:text-2xl flex items-center gap-3 flex-wrap">
                      {r.name}
                      {isPerfect && <span className="text-xs font-black tracking-widest px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 ring-1 ring-amber-400/40">⭐ PERFECT</span>}
                      {isBottom(i) && !isPerfect && <span className="text-xs font-black tracking-widest px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 ring-1 ring-red-500/40">⚠ WARNING</span>}
                    </div>
                  </td>
                  <td className="p-4 text-lg md:text-xl text-zinc-400">{regionLabel(r.regional)}</td>
                  <td className="p-4 text-lg md:text-xl text-zinc-400">{r.aom || r.mrm || '-'}</td>
                  <td className={`p-4 text-right font-black text-3xl md:text-4xl ${totalCls(r.pencapaian)}`}>{pct(r.pencapaian)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
