import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import UploadForm from './UploadForm';
import DisplaySettings from './DisplaySettings';

type Snap = { period: string | null; file_name: string | null; uploaded_at: string; uploaded_by: string | null; data: unknown } | null;

function rmCount(d: unknown) {
  if (Array.isArray(d)) return d.length;
  if (d && typeof d === 'object' && Array.isArray((d as { rows?: unknown[] }).rows)) return (d as { rows: unknown[] }).rows.length;
  return 0;
}
function sourcingCount(d: unknown) {
  if (d && typeof d === 'object') {
    const o = d as { peopleSearch?: unknown[]; centralSourcing?: unknown[] };
    return (o.peopleSearch?.length ?? 0) + (o.centralSourcing?.length ?? 0);
  }
  return 0;
}

export default async function AdminPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/login');

  const latest = async (type: string): Promise<Snap> => {
    const { data } = await sb
      .from('kpi_snapshots')
      .select('period, file_name, uploaded_at, uploaded_by, data')
      .eq('type', type)
      .order('uploaded_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data as Snap;
  };
  const [rm, sourcing] = await Promise.all([latest('rm'), latest('sourcing')]);

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-zinc-100"
      style={{ background: 'radial-gradient(800px 500px at 20% 0%, rgba(245,158,11,0.10), transparent 60%), radial-gradient(800px 500px at 80% 100%, rgba(59,130,246,0.08), transparent 60%), #0a0a0a' }}>
      <div className="max-w-5xl mx-auto p-6 md:p-8">
        <header className="flex items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
              <span>🏆</span> Performance Dashboard Admin
            </h1>
            <p className="text-xs text-zinc-500 mt-1">Upload &amp; publish data KPI — RM &amp; Sourcing</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 hidden md:inline">{user.email}</span>
            <a href="/" className="text-xs bg-zinc-900 border border-zinc-800 hover:border-amber-400/40 px-3 py-1.5 rounded-md">RM ↗</a>
            <a href="/ps" className="text-xs bg-zinc-900 border border-zinc-800 hover:border-sky-400/40 px-3 py-1.5 rounded-md">Sourcing ↗</a>
            <form action="/api/logout" method="post">
              <button className="text-xs bg-red-500/10 text-red-300 border border-red-500/20 hover:bg-red-500/20 px-3 py-1.5 rounded-md">Sign out</button>
            </form>
          </div>
        </header>

        {/* Status kedua dashboard */}
        <section className="mb-6 grid md:grid-cols-2 gap-3">
          <StatusCard title="🏆 RM" tone="amber" snap={rm} count={rm ? `${rmCount(rm.data)} RM` : null} />
          <StatusCard title="🔎 Sourcing" tone="sky" snap={sourcing} count={sourcing ? `${sourcingCount(sourcing.data)} orang` : null} />
        </section>

        <section className="mb-6">
          <h2 className="text-sm font-bold tracking-wider text-zinc-400 uppercase mb-3">Upload data baru</h2>
          <UploadForm hasRm={!!rm} hasSourcing={!!sourcing} />
        </section>

        <section className="mb-2">
          <h2 className="text-sm font-bold tracking-wider text-zinc-400 uppercase mb-3">Pengaturan tampilan</h2>
          <DisplaySettings />
        </section>
      </div>
    </main>
  );
}

function StatusCard({ title, tone, snap, count }: { title: string; tone: 'amber' | 'sky'; snap: Snap; count: string | null }) {
  const ring = tone === 'amber' ? 'border-amber-900/50' : 'border-sky-900/50';
  return (
    <div className={`bg-zinc-900/60 border ${ring} rounded-2xl p-4`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-bold">{title}</span>
        {snap ? (
          <span className="flex items-center gap-1.5 text-emerald-400 ml-auto">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-bold tracking-wider">LIVE</span>
          </span>
        ) : <span className="text-[10px] text-zinc-600 ml-auto">belum ada data</span>}
      </div>
      {snap ? (
        <div className="text-xs text-zinc-400">
          <div className="text-sm"><span className="font-bold text-zinc-200">{count}</span> · {snap.period ?? 'periode tidak terbaca'}</div>
          <div className="mt-1 text-zinc-500">📄 {snap.file_name ?? '-'} · {new Date(snap.uploaded_at).toLocaleString('id-ID')}</div>
        </div>
      ) : <div className="text-xs text-zinc-600">Upload file untuk menampilkan dashboard.</div>}
    </div>
  );
}
