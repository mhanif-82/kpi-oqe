import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import AdminMenu from '../AdminMenu';

export const revalidate = 0; // selalu fresh

type HistRow = {
  id: string; type: string; period: string | null; file_name: string | null;
  rows: number | null; uploaded_by: string | null; uploaded_at: string; storage_path: string | null;
};

const TYPE_BADGE: Record<string, { label: string; icon: string; cls: string }> = {
  rm:          { label: 'RM',          icon: '🏆', cls: 'bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/40' },
  sourcing:    { label: 'Sourcing',    icon: '🔎', cls: 'bg-sky-400/15 text-sky-300 ring-1 ring-sky-400/40' },
  bso:         { label: 'BSO',         icon: '🏢', cls: 'bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/40' },
  apm:         { label: 'APM',         icon: '🎖️', cls: 'bg-violet-400/15 text-violet-300 ring-1 ring-violet-400/40' },
  fulfillment: { label: 'Fulfillment', icon: '📋', cls: 'bg-rose-400/15 text-rose-300 ring-1 ring-rose-400/40' },
};

export default async function HistoryUploadPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/login');

  const { data, error } = await sb
    .from('upload_history')
    .select('id, type, period, file_name, rows, uploaded_by, uploaded_at, storage_path')
    .order('uploaded_at', { ascending: false })
    .limit(500);
  const items = (data ?? []) as HistRow[];

  const counts = items.reduce<Record<string, number>>((m, r) => { m[r.type] = (m[r.type] ?? 0) + 1; return m; }, {});

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-zinc-100"
      style={{ background: 'radial-gradient(800px 500px at 20% 0%, rgba(245,158,11,0.10), transparent 60%), radial-gradient(800px 500px at 80% 100%, rgba(59,130,246,0.08), transparent 60%), #0a0a0a' }}>
      <div className="max-w-5xl mx-auto p-6 md:p-8">
        <header className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
              <span>🕘</span> Riwayat Upload
            </h1>
            <p className="text-xs text-zinc-500 mt-1">Semua file yang pernah di-upload — {items.length} entri.</p>
          </div>
          <AdminMenu email={user.email} current="/history-upload" />
        </header>

        {/* Ringkasan per tipe */}
        <div className="flex items-center gap-2 flex-wrap mb-5">
          {Object.entries(TYPE_BADGE).map(([t, b]) => (
            <span key={t} className={`text-xs font-semibold px-3 py-1.5 rounded-full ${b.cls}`}>
              {b.icon} {b.label}: {counts[t] ?? 0}×
            </span>
          ))}
        </div>

        {error && (
          <div className="mb-4 text-sm rounded-lg px-4 py-3 border bg-red-500/10 border-red-500/30 text-red-300">
            Gagal memuat riwayat: {error.message}. Pastikan tabel <b>upload_history</b> sudah dibuat (lihat supabase-schema.sql).
          </div>
        )}

        <div className="rounded-xl border border-zinc-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900 text-xs uppercase tracking-wider text-zinc-400">
              <tr>
                <th className="p-3 text-left">Tipe</th>
                <th className="p-3 text-left">File</th>
                <th className="p-3 text-left">Periode</th>
                <th className="p-3 text-right">Baris</th>
                <th className="p-3 text-left">Oleh</th>
                <th className="p-3 text-left">Waktu Upload</th>
                <th className="p-3 text-center">File</th>
              </tr>
            </thead>
            <tbody>
              {items.map(r => {
                const b = TYPE_BADGE[r.type] ?? { label: r.type, icon: '📄', cls: 'bg-zinc-700/30 text-zinc-300 ring-1 ring-zinc-600' };
                return (
                  <tr key={r.id} className="border-t border-zinc-800/60 hover:bg-zinc-900/40">
                    <td className="p-3"><span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${b.cls}`}>{b.icon} {b.label}</span></td>
                    <td className="p-3 font-medium break-all">{r.file_name ?? '-'}</td>
                    <td className="p-3 text-zinc-400 whitespace-nowrap">{r.period ?? '-'}</td>
                    <td className="p-3 text-right text-zinc-300">{r.rows ?? '-'}</td>
                    <td className="p-3 text-zinc-400">{r.uploaded_by ?? '-'}</td>
                    <td className="p-3 text-zinc-400 whitespace-nowrap">{new Date(r.uploaded_at).toLocaleString('id-ID')}</td>
                    <td className="p-3 text-center">
                      {r.storage_path ? (
                        <a href={`/api/history-download?path=${encodeURIComponent(r.storage_path)}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 px-2.5 py-1 rounded-md whitespace-nowrap">
                          ⬇ Download
                        </a>
                      ) : (
                        <span className="text-xs text-zinc-600" title="File tidak tersimpan (upload sebelum fitur ini)">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!items.length && !error && (
                <tr><td colSpan={7} className="p-6 text-center text-zinc-500">Belum ada riwayat upload.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
