import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import UploadForm from './UploadForm';
import DisplaySettings from './DisplaySettings';

export default async function AdminPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/login');

  const { data: current } = await sb
    .from('kpi_snapshots')
    .select('period, file_name, uploaded_at, uploaded_by, data')
    .order('uploaded_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const rowCount = (() => {
    if (!current) return 0;
    const d = current.data;
    if (Array.isArray(d)) return d.length;
    if (d && typeof d === 'object' && Array.isArray((d as { rows?: unknown[] }).rows)) return (d as { rows: unknown[] }).rows.length;
    return 0;
  })();

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-zinc-100"
      style={{ background: 'radial-gradient(800px 500px at 20% 0%, rgba(245,158,11,0.10), transparent 60%), radial-gradient(800px 500px at 80% 100%, rgba(59,130,246,0.08), transparent 60%), #0a0a0a' }}>
      <div className="max-w-5xl mx-auto p-6 md:p-8">
        <header className="flex items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
              <span>🏆</span> RM Performance Dashboard
            </h1>
            <p className="text-xs text-zinc-500 mt-1">Admin · upload &amp; publish data KPI</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 hidden md:inline">{user.email}</span>
            <a href="/" className="text-xs bg-zinc-900 border border-zinc-800 hover:border-amber-400/40 px-3 py-1.5 rounded-md">View dashboard ↗</a>
            <form action="/api/logout" method="post">
              <button className="text-xs bg-red-500/10 text-red-300 border border-red-500/20 hover:bg-red-500/20 px-3 py-1.5 rounded-md">Sign out</button>
            </form>
          </div>
        </header>

        {current && (
          <section className="mb-6 bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-bold tracking-wider">LIVE</span>
            </div>
            <div className="text-sm">
              <span className="font-bold">{rowCount} RM</span>
              <span className="text-zinc-500"> · {current.period ?? 'Periode tidak terbaca'}</span>
            </div>
            <div className="text-xs text-zinc-500">
              📄 {current.file_name ?? '-'} · diupload {new Date(current.uploaded_at).toLocaleString('id-ID')} oleh {current.uploaded_by ?? '-'}
            </div>
          </section>
        )}

        <section className="mb-6">
          <h2 className="text-sm font-bold tracking-wider text-zinc-400 uppercase mb-3">Upload data baru</h2>

          <details className="mb-4 bg-zinc-900/60 border border-zinc-800 rounded-2xl overflow-hidden group">
            <summary className="cursor-pointer list-none flex items-center justify-between gap-3 p-4 hover:bg-zinc-900 transition">
              <span className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
                📄 Format file Excel — lihat contoh &amp; panduan
              </span>
              <span className="text-xs text-zinc-500 group-open:rotate-180 transition">▾</span>
            </summary>
            <div className="px-4 pb-4 border-t border-zinc-800/60 pt-4">
              <a
                href="/Template_RM_Contoh.xlsx"
                download
                className="inline-flex items-center gap-2 bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 font-semibold text-sm px-4 py-2.5 rounded-lg transition mb-4"
              >
                ⬇ Download template contoh (.xlsx)
              </a>

              <div className="text-xs text-zinc-400 space-y-3 leading-relaxed">
                <p>Susunan kolom dari kiri ke kanan:</p>
                <div className="overflow-x-auto rounded-lg border border-zinc-800">
                  <table className="text-[11px] w-full">
                    <thead className="bg-zinc-900 text-zinc-400">
                      <tr>
                        <th className="px-2 py-1.5 text-left font-semibold">NO</th>
                        <th className="px-2 py-1.5 text-left font-semibold">EMPLOYEE NAME</th>
                        <th className="px-2 py-1.5 text-left font-semibold">AOM</th>
                        <th className="px-2 py-1.5 text-left font-semibold">REGIONAL</th>
                        <th className="px-2 py-1.5 text-left font-semibold text-amber-400">Nama KPI</th>
                        <th className="px-2 py-1.5 text-left font-semibold text-amber-400">BOBOT (xx%)</th>
                        <th className="px-2 py-1.5 text-left font-semibold">… KPI lain …</th>
                        <th className="px-2 py-1.5 text-left font-semibold text-emerald-400">PENCAPAIAN</th>
                      </tr>
                    </thead>
                    <tbody className="text-zinc-300">
                      <tr className="border-t border-zinc-800/60">
                        <td className="px-2 py-1.5">1</td>
                        <td className="px-2 py-1.5">Budi Santoso</td>
                        <td className="px-2 py-1.5">GUNAWAN</td>
                        <td className="px-2 py-1.5">1. TIMBUL MARULI</td>
                        <td className="px-2 py-1.5">100.00%</td>
                        <td className="px-2 py-1.5">10.00%</td>
                        <td className="px-2 py-1.5 text-zinc-600">…</td>
                        <td className="px-2 py-1.5 text-emerald-300">100.00%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <ul className="space-y-1.5 list-disc pl-4 text-zinc-500">
                  <li><b className="text-zinc-300">Baris 1</b> = header, mulai <b className="text-zinc-300">baris 2</b> = data (1 baris = 1 RM).</li>
                  <li>Tiap <b className="text-amber-400">KPI</b> selalu diikuti kolom <b className="text-amber-400">BOBOT (xx%)</b> di sebelahnya. Jumlah KPI bebas — otomatis terdeteksi.</li>
                  <li>Kolom terakhir wajib bernama <b className="text-emerald-300">PENCAPAIAN</b> (total skor RM).</li>
                  <li>Persen boleh ditulis <code className="text-zinc-300">100.00%</code>, <code className="text-zinc-300">95%</code>, atau <code className="text-zinc-300">95,13%</code> — semua terbaca.</li>
                  <li>Nama duplikat &amp; baris kosong otomatis diabaikan.</li>
                </ul>
              </div>
            </div>
          </details>

          <UploadForm hasExisting={!!current} />
          <p className="text-[11px] text-zinc-500 mt-2">⚠ Upload akan <b>menggantikan</b> data sebelumnya (data lama dihapus).</p>
        </section>

        <section className="mb-2">
          <h2 className="text-sm font-bold tracking-wider text-zinc-400 uppercase mb-3">Pengaturan tampilan</h2>
          <DisplaySettings />
        </section>
      </div>
    </main>
  );
}
