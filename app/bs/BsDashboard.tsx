'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Avatar, PhotosProvider } from '../Avatar';

const DEFAULT_TRANSITION_MS = 15000;
const DEFAULT_SCROLL_SPEED = 40;
const pct = (v: number) => (v * 100).toFixed(2) + '%';

const DEFAULT_COACHING_THRESHOLD = 97;
export type BKpi = { name: string; value: number };
export type BPerson = { name: string; total: number; regional?: string; apm?: string; kpis: BKpi[]; rank1?: number; rankDetail?: { name: string; rank: number }[] };
type Settings = { transitionMs: number; scrollSpeed: number; coachingThreshold?: number };

export default function BsDashboard({ bso, apm, period, uploadedAt, photos }: {
  bso: BPerson[]; apm: BPerson[]; period: string | null; uploadedAt?: string | null;
  photos?: Record<string, string>;
}) {
  const [page, setPage] = useState(0);
  const [dir, setDir] = useState<'right' | 'left'>('right');
  const [animKey, setAnimKey] = useState(0);
  const [paused, setPaused] = useState(false);
  const [transitionMs, setTransitionMs] = useState(DEFAULT_TRANSITION_MS);
  const [scrollSpeed, setScrollSpeed] = useState(DEFAULT_SCROLL_SPEED);
  const [coachingThreshold, setCoachingThreshold] = useState(DEFAULT_COACHING_THRESHOLD);

  useEffect(() => {
    const apply = (p: Partial<Settings>) => { if (p.transitionMs) setTransitionMs(p.transitionMs); if (p.scrollSpeed) setScrollSpeed(p.scrollSpeed); if (p.coachingThreshold) setCoachingThreshold(p.coachingThreshold); };
    try { const s = localStorage.getItem('rmDashSettings'); if (s) apply(JSON.parse(s) as Settings); } catch {}
    const onStorage = (e: StorageEvent) => { if (e.key === 'rmDashSettings' && e.newValue) { try { apply(JSON.parse(e.newValue) as Settings); } catch {} } };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const navigate = useCallback((delta: 1 | -1) => {
    setDir(delta === 1 ? 'right' : 'left');
    setPage(p => (p + delta + 4) % 4);
    setAnimKey(k => k + 1);
  }, []);

  useEffect(() => {
    if (paused || page === 3) return;
    const t = setInterval(() => navigate(1), transitionMs);
    return () => clearInterval(t);
  }, [paused, page, transitionMs, navigate]);

  const onLeaderboardDone = useCallback(() => navigate(1), [navigate]);

  useEffect(() => { const t = setTimeout(() => location.reload(), 24 * 60 * 60 * 1000); return () => clearTimeout(t); }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') { navigate(1); setPaused(true); }
      if (e.key === 'ArrowLeft') { navigate(-1); setPaused(true); }
      if (e.key === ' ') { setPaused(v => !v); e.preventDefault(); }
      if (e.key.toLowerCase() === 'f') document.documentElement.requestFullscreen?.();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [navigate]);

  const threshold = (coachingThreshold ?? DEFAULT_COACHING_THRESHOLD) / 100;
  const bsoRanked = useMemo(() => [...bso].sort((a, b) => b.total - a.total), [bso]);
  const best3 = useMemo(() => bsoRanked.slice(0, 3), [bsoRanked]);
  const coachingBso = useMemo(() => {
    const below = bsoRanked.map((r, i) => ({ row: r, rank: i + 1 })).filter(x => x.row.total < threshold);
    return below.slice(-3).reverse();
  }, [bsoRanked, threshold]);
  const bsoAllPerfect = useMemo(() => bso.length > 0 && bso.every(p => p.total >= 0.9999), [bso]);
  const bsoPerfect = useMemo(() => bsoRanked.filter(p => p.total >= 0.9999), [bsoRanked]);

  // APM ranking = jumlah Rank #1 terbanyak (TOTAL RANK 1 dari file); tie-break pakai performance.
  const apmRanked = useMemo(() => {
    return [...apm]
      .map(p => ({ ...p, rank1: p.rank1 ?? 0 }))
      .sort((a, b) => (b.rank1 - a.rank1) || (b.total - a.total));
  }, [apm]);

  const stats = useMemo(() => {
    const avg = (arr: BPerson[]) => arr.length ? arr.reduce((s, p) => s + p.total, 0) / arr.length : 0;
    return { bso: bso.length, apm: apm.length, avgBso: avg(bso), avgApm: avg(apm) };
  }, [bso, apm]);

  const setPageManual = (p: number) => { setDir(p > page ? 'right' : 'left'); setPage(p); setAnimKey(k => k + 1); setPaused(true); };

  return (
    <PhotosProvider value={photos ?? {}}>
    <div className="h-screen bg-[#0a0a0a] text-zinc-100 p-6 md:p-8 flex flex-col gap-6 overflow-hidden">
      <style>{`
        @keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes slideInLeft  { from { transform: translateX(-100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .slide-right { animation: slideInRight 0.55s cubic-bezier(0.4,0,0.2,1) both; }
        .slide-left  { animation: slideInLeft  0.55s cubic-bezier(0.4,0,0.2,1) both; }
      `}</style>

      <Header period={period} stats={stats} page={page} setPage={setPageManual} paused={paused} setPaused={setPaused} uploadedAt={uploadedAt} />

      <div key={animKey} className={dir === 'right' ? 'slide-right' : 'slide-left'} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {page === 0 && <PagePodium people={best3} perfect={bsoPerfect} allPerfect={bsoAllPerfect} />}
        {page === 1 && <PageWorst items={coachingBso} thresholdPct={coachingThreshold} />}
        {page === 2 && <PageApm ranked={apmRanked} />}
        {page === 3 && <PageLeaderboard ranked={bsoRanked} scrollSpeed={scrollSpeed} onScrollDone={onLeaderboardDone} allPerfect={bsoAllPerfect} threshold={threshold} />}
      </div>
    </div>
    </PhotosProvider>
  );
}

function Header({ period, stats, page, setPage, paused, setPaused, uploadedAt }: {
  period: string | null; stats: { bso: number; apm: number; avgBso: number; avgApm: number };
  page: number; setPage: (p: number) => void; paused: boolean; setPaused: (v: boolean) => void; uploadedAt?: string | null;
}) {
  return (
    <header className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight flex items-center gap-3 flex-wrap">
            <span>🏢</span> BSO Performance Dashboard
            {period && <span className="text-base md:text-lg font-bold tracking-wider px-3 py-1 rounded-full bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/40">📅 {period}</span>}
          </h1>
          {uploadedAt && <p className="text-sm md:text-base text-zinc-300 mt-1.5">🕒 Last Updated: <span className="font-semibold text-zinc-100">{new Date(uploadedAt).toLocaleString('id-ID')}</span></p>}
        </div>
        <div className="flex items-center gap-2">
          {['Best BSO', 'Worst BSO', 'Best APM', 'Leaderboard'].map((t, i) => (
            <button key={t} onClick={() => setPage(i)} className={`px-3 py-1.5 rounded-md text-xs font-medium ${page === i ? 'bg-zinc-100 text-zinc-900' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'}`}>{t}</button>
          ))}
          <a href="/link" className="px-3 py-1.5 rounded-md text-xs font-medium bg-zinc-900 text-zinc-400 hover:bg-zinc-800">📺 Link</a>
          <button onClick={() => setPaused(!paused)} className="px-3 py-1.5 rounded-md text-xs font-medium bg-zinc-900 text-zinc-400 hover:bg-zinc-800">{paused ? '▶' : '⏸'}</button>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total BSO" value={String(stats.bso)} />
        <StatCard label="Rata-rata BSO" value={pct(stats.avgBso)} tone="emerald" />
        <StatCard label="Total APM" value={String(stats.apm)} />
        <StatCard label="Rata-rata APM" value={pct(stats.avgApm)} tone="violet" />
      </div>
    </header>
  );
}
function StatCard({ label, value, tone }: { label: string; value: string; tone?: 'emerald' | 'violet' }) {
  const cls = tone === 'emerald' ? 'bg-emerald-950/40 border-emerald-900/60' : tone === 'violet' ? 'bg-violet-950/40 border-violet-900/60' : 'bg-zinc-900/60 border-zinc-800';
  const labelCls = tone === 'emerald' ? 'text-emerald-400' : tone === 'violet' ? 'text-violet-400' : 'text-zinc-400';
  return (
    <div className={`rounded-xl border p-4 ${cls}`}>
      <div className={`text-xs font-medium ${labelCls}`}>{label}</div>
      <div className="text-2xl md:text-3xl font-bold mt-2">{value}</div>
    </div>
  );
}

const PODIUM = {
  1: { cardBg: 'linear-gradient(135deg, rgba(245,158,11,0.30), rgba(245,158,11,0.12) 50%, rgba(120,53,15,0.40))', avatarBg: 'linear-gradient(135deg, #fcd34d, #f59e0b, #b45309)', glow: '0 0 60px -10px rgba(245,158,11,0.55)', border: 'rgba(251,191,36,0.6)', text: '#fcd34d', icon: '🏆', label: 'CHAMPION', height: 'pt-2 -mt-4' },
  2: { cardBg: 'linear-gradient(135deg, rgba(212,212,216,0.15), rgba(161,161,170,0.10) 50%, rgba(63,63,70,0.40))', avatarBg: 'linear-gradient(135deg, #e4e4e7, #a1a1aa, #52525b)', glow: '0 0 30px -10px rgba(212,212,216,0.4)', border: 'rgba(161,161,170,0.4)', text: '#e4e4e7', icon: '🥈', label: 'RUNNER-UP', height: 'pt-4' },
  3: { cardBg: 'linear-gradient(135deg, rgba(251,146,60,0.20), rgba(234,88,12,0.10) 50%, rgba(124,45,18,0.40))', avatarBg: 'linear-gradient(135deg, #fdba74, #f97316, #c2410c)', glow: '0 0 30px -10px rgba(234,88,12,0.4)', border: 'rgba(249,115,22,0.4)', text: '#fdba74', icon: '🥉', label: 'THIRD', height: 'pt-4' },
} as const;

function PagePodium({ people, perfect, allPerfect }: { people: BPerson[]; perfect: BPerson[]; allPerfect: boolean }) {
  if (allPerfect || perfect.length >= 2) return <BestPerfectList names={perfect.map(p => ({ name: p.name, sub: [p.regional, p.apm].filter(Boolean).join(' · ') }))} />;
  const [r1, r2, r3] = people;
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <h2 className="text-2xl md:text-3xl font-bold mb-4 flex items-center gap-2 shrink-0">🏆 Top 3 Best BSO</h2>
      <div className="flex-1 min-h-0 flex items-center">
        <div className="w-full grid grid-cols-3 gap-4 md:gap-6 items-end">
          {r2 && <PodiumCard rank={2} p={r2} />}
          {r1 && <PodiumCard rank={1} p={r1} />}
          {r3 && <PodiumCard rank={3} p={r3} />}
        </div>
      </div>
    </div>
  );
}
function PodiumCard({ rank, p }: { rank: 1 | 2 | 3; p: BPerson }) {
  const s = PODIUM[rank];
  const big = rank === 1;
  const sub = [p.regional, p.apm].filter(Boolean).join(' · ');
  return (
    <div className={`relative rounded-2xl border p-5 md:p-7 flex flex-col items-center text-center gap-2 ${s.height}`} style={{ background: s.cardBg, boxShadow: s.glow, borderColor: s.border }}>
      <div className={`absolute -top-5 left-1/2 -translate-x-1/2 ${big ? 'text-6xl' : 'text-4xl'}`}>{s.icon}</div>
      <div className="text-sm md:text-base font-bold tracking-[0.18em] mt-3" style={{ color: s.text }}>{s.label}</div>
      <Avatar name={p.name} className={`${big ? 'w-28 h-28 text-4xl' : 'w-20 h-20 text-2xl'} rounded-full flex items-center justify-center font-black text-white shadow`} style={{ background: s.avatarBg }} />
      <div className={`font-bold ${big ? 'text-2xl md:text-3xl' : 'text-xl md:text-2xl'} leading-tight`}>{p.name}</div>
      {sub && <div className="text-sm md:text-base text-zinc-400">{sub}</div>}
      <div className={`${big ? 'text-4xl md:text-6xl' : 'text-3xl md:text-4xl'} font-black`} style={{ color: s.text }}>{pct(p.total)}</div>
    </div>
  );
}

function PageWorst({ items, thresholdPct }: { items: { row: BPerson; rank: number }[]; thresholdPct: number }) {
  if (!items.length) return <CoachingEmpty />;
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex items-baseline gap-3 mb-4 shrink-0">
        <h2 className="text-2xl md:text-3xl font-bold flex items-center gap-2 text-red-400">⚠ Perlu Coaching — BSO <span className="animate-pulse">(warning!!)</span></h2>
        <span className="text-base text-zinc-400">— di bawah {thresholdPct}%</span>
      </div>
      <div className="flex-1 min-h-0 grid gap-3" style={{ gridTemplateRows: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map(({ row: p, rank }) => {
          const weak = [...p.kpis].sort((a, b) => a.value - b.value)[0];
          const sub = [p.regional, p.apm].filter(Boolean).join(' · ');
          return (
            <div key={p.name} className="bg-zinc-900/60 border border-zinc-800 rounded-xl overflow-hidden flex items-stretch h-full">
              <div className="w-2 bg-red-500" />
              <div className="flex-1 grid grid-cols-12 gap-3 items-center px-5">
                <div className="col-span-1 text-2xl md:text-3xl font-black text-red-400">#{rank}</div>
                <div className="col-span-6">
                  <div className="font-bold text-xl md:text-3xl leading-tight flex items-center gap-3 flex-wrap">
                    {p.name}
                    <span className="text-xs font-black tracking-widest px-3 py-1 rounded-full bg-red-500 text-white shadow-[0_0_12px_rgba(239,68,68,0.6)] animate-pulse">⚠ WARNING</span>
                  </div>
                  <div className="text-sm md:text-base text-zinc-400 mt-1">
                    {sub && <span className="text-zinc-500">{sub} · </span>}
                    {weak && <>Terlemah: <b className="text-red-300">{weak.name}</b> ({pct(weak.value)})</>}
                  </div>
                </div>
                <div className="col-span-5 text-right text-3xl md:text-4xl font-black text-red-400">{pct(p.total)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CoachingEmpty() {
  return (
    <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center gap-4">
      <div className="text-7xl md:text-8xl">🎉</div>
      <h2 className="text-3xl md:text-5xl font-black text-emerald-300">Semua perform di atas target!</h2>
      <p className="text-lg md:text-xl text-zinc-400 max-w-2xl">Tidak ada peserta yang memerlukan coaching periode ini. 🔥</p>
    </div>
  );
}

function BestPerfectList({ names }: { names: { name: string; sub?: string }[] }) {
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <h2 className="text-2xl md:text-3xl font-bold mb-1 flex items-center gap-2 flex-wrap">
        🏆 Best Performance
        <span className="text-sm md:text-base font-black tracking-widest px-3 py-1 rounded-full bg-gradient-to-r from-amber-400 to-yellow-300 text-amber-950">PERFECT 100%</span>
      </h2>
      <p className="text-base md:text-lg text-zinc-300 mb-4">🎉 {names.length} orang mencapai performance 100% periode ini!</p>
      <div className="flex-1 min-h-0 overflow-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {names.map(n => (
            <div key={n.name} className="rounded-xl border p-4 flex items-center gap-4" style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.18), rgba(120,53,15,0.30))', borderColor: 'rgba(251,191,36,0.4)' }}>
              <Avatar name={n.name} className="w-20 h-20 text-2xl rounded-full flex items-center justify-center font-black text-white shrink-0" style={{ background: 'linear-gradient(135deg,#fcd34d,#f59e0b,#b45309)' }} />
              <div className="min-w-0 flex-1">
                <div className="font-bold text-2xl md:text-3xl leading-tight">{n.name}</div>
                {n.sub && <div className="text-base md:text-lg text-zinc-400 truncate">{n.sub}</div>}
              </div>
              <div className="text-3xl md:text-4xl font-black text-amber-300">100%</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PageApm({ ranked }: { ranked: (BPerson & { rank1: number })[] }) {
  const [champ, ...rest] = ranked;
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <h2 className="text-2xl md:text-3xl font-bold mb-4 flex items-center gap-2 shrink-0">🎖️ Best APM <span className="text-base text-zinc-500 font-normal">— ranking dari jumlah Rank #1 terbanyak</span></h2>
      <div className="flex-1 min-h-0 flex flex-col gap-4 overflow-auto">
        {champ && (
          <div className="relative rounded-2xl border p-6 flex items-center gap-6 overflow-hidden" style={{ background: PODIUM[1].cardBg, boxShadow: PODIUM[1].glow, borderColor: PODIUM[1].border }}>
            <div className="absolute -top-6 -right-4 text-8xl opacity-10 select-none">🏆</div>
            <Avatar name={champ.name} className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-black text-white shadow shrink-0" style={{ background: PODIUM[1].avatarBg }} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-black tracking-[0.2em]" style={{ color: PODIUM[1].text }}>🏆 CHAMPION</div>
              <div className="text-3xl md:text-4xl font-black leading-tight mt-1">{champ.name}</div>
              {champ.regional && <div className="text-base text-zinc-400 mt-0.5">{champ.regional}</div>}
              {(() => { const ones = (champ.rankDetail ?? []).filter(d => d.rank === 1).map(d => d.name); return ones.length ? <div className="text-sm md:text-base text-amber-200/80 mt-1">🥇 Rank #1 di: {ones.join(', ')}</div> : null; })()}
            </div>
            <div className="text-right">
              <div className="text-4xl md:text-5xl font-black" style={{ color: PODIUM[1].text }}>{champ.rank1}× <span className="text-2xl md:text-3xl">Rank #1</span></div>
              <div className="text-base text-zinc-400 mt-0.5">Performance {pct(champ.total)}</div>
            </div>
          </div>
        )}
        <div className="flex flex-col gap-2.5">
          {rest.map((p, i) => (
            <div key={p.name} className="bg-zinc-900/60 border border-zinc-800 rounded-xl flex items-center gap-4 px-5 py-3.5">
              <div className="text-xl md:text-2xl font-black text-zinc-400 w-12 text-center">#{i + 2}</div>
              <Avatar name={p.name} className="w-12 h-12 rounded-full bg-zinc-700 flex items-center justify-center text-base font-bold text-white shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-bold text-xl md:text-2xl truncate">{p.name}</div>
                {p.regional && <div className="text-sm text-zinc-500 truncate">{p.regional}</div>}
              </div>
              <div className="text-right">
                <div className="text-2xl md:text-3xl font-black text-zinc-200">{p.rank1}× Rank #1</div>
                <div className="text-sm text-zinc-500">{pct(p.total)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PageLeaderboard({ ranked, scrollSpeed, onScrollDone, allPerfect }: { ranked: BPerson[]; scrollSpeed: number; onScrollDone: () => void; allPerfect: boolean; threshold: number }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const total = ranked.length;
  const list = allPerfect ? [...ranked].sort((a, b) => a.name.localeCompare(b.name)) : ranked;
  const anyPerfect = list.some(p => p.total >= 0.9999);
  const medal = (i: number) => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';
  const totalCls = (v: number) => v < 0.9 ? 'text-red-400' : v >= 0.95 ? 'text-emerald-400' : 'text-amber-400';
  const rowTint = (i: number, score: number) => {
    if (score >= 0.9999) return 'bg-gradient-to-r from-amber-500/15 via-transparent to-transparent border-l-4 border-amber-400';
    if (anyPerfect) return 'border-l-4 border-transparent';
    if (i === 0) return 'bg-gradient-to-r from-amber-500/15 via-transparent to-transparent border-l-4 border-amber-400';
    if (i === 1) return 'bg-gradient-to-r from-zinc-300/10 via-transparent to-transparent border-l-4 border-zinc-400';
    if (i === 2) return 'bg-gradient-to-r from-orange-500/10 via-transparent to-transparent border-l-4 border-orange-400';
    return 'border-l-4 border-transparent';
  };

  const doneRef = useRef(false);
  useEffect(() => {
    doneRef.current = false;
    const el = scrollRef.current;
    if (!el || scrollSpeed <= 0) return;
    el.scrollTop = 0;
    let pos = 0, lastTime: number | null = null, raf: number;
    function step(ts: number) {
      if (doneRef.current) return;
      if (lastTime !== null) {
        pos += (scrollSpeed * (ts - lastTime)) / 1000;
        el!.scrollTop = pos;
        if (pos >= el!.scrollHeight - el!.clientHeight - 2) { doneRef.current = true; setTimeout(onScrollDone, 1200); return; }
      }
      lastTime = ts;
      raf = requestAnimationFrame(step);
    }
    const startTimer = setTimeout(() => { raf = requestAnimationFrame(step); }, 600);
    return () => { doneRef.current = true; clearTimeout(startTimer); cancelAnimationFrame(raf); };
  }, [scrollSpeed, onScrollDone]);

  return (
    <section className="flex-1 flex flex-col min-h-0">
      <h2 className="text-2xl md:text-3xl font-bold mb-4 flex items-center gap-2 flex-wrap">📊 Leaderboard BSO
        {allPerfect
          ? <span className="text-sm md:text-base font-black tracking-widest px-3 py-1 rounded-full bg-gradient-to-r from-amber-400 to-yellow-300 text-amber-950">🏆 PERFECT PERFORMANCE (100%)</span>
          : <span className="text-base text-zinc-500 font-normal">— {total} orang</span>}
      </h2>
      {allPerfect && <div className="mb-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-5 py-3 text-amber-200 text-base md:text-lg font-semibold">🎉 Seluruh peserta mencapai KPI 100% pada periode ini.</div>}
      <div ref={scrollRef} className="flex-1 overflow-auto rounded-xl border border-zinc-800" style={{ scrollBehavior: 'auto' }}>
        <table className="w-full">
          <thead className="sticky top-0 bg-zinc-900 z-10 text-sm md:text-base uppercase tracking-wider text-zinc-400">
            <tr>
              <th className="p-4 text-center w-24">{allPerfect ? '' : 'Rank'}</th>
              <th className="p-4 text-left">Nama</th>
              <th className="p-4 text-left">Regional</th>
              <th className="p-4 text-left">APM</th>
              <th className="p-4 text-right w-40">Performance</th>
            </tr>
          </thead>
          <tbody>
            {list.map((p, i) => (
              <tr key={p.name} className={`border-t border-zinc-800/60 ${rowTint(i, p.total)}`}>
                <td className="p-4 text-center">
                  {p.total >= 0.9999 ? (
                    <span className="text-3xl md:text-4xl leading-none">⭐</span>
                  ) : anyPerfect ? (
                    <span className="text-base md:text-lg font-black text-zinc-300">#{i + 1}</span>
                  ) : (
                    <div className="flex flex-col items-center leading-none">
                      <span className="text-3xl md:text-4xl leading-none">{medal(i)}</span>
                      <span className={`text-base md:text-lg font-black mt-1 ${i < 3 ? 'text-zinc-100' : 'text-zinc-500'}`}>#{i + 1}</span>
                    </div>
                  )}
                </td>
                <td className="p-4 font-bold text-xl md:text-2xl">{p.name}</td>
                <td className="p-4 text-lg md:text-xl text-zinc-400">{p.regional || '-'}</td>
                <td className="p-4 text-lg md:text-xl text-zinc-400">{p.apm || '-'}</td>
                <td className={`p-4 text-right font-black text-3xl md:text-4xl ${totalCls(p.total)}`}>{pct(p.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
