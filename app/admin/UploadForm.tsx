'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

type Issue = { severity: 'error' | 'warning'; row: number | null; column: string | null; message: string };
type Report = { ok: boolean; fatal: string | null; issues: Issue[]; rowsParsed: number; sheetName: string | null; kpiCount: number };

export default function UploadForm({ hasExisting }: { hasExisting?: boolean }) {
  const router = useRouter();
  const now = new Date();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [fatal, setFatal] = useState<string | null>(null);
  const [logName, setLogName] = useState<string>('log-validasi.txt');
  const [drag, setDrag] = useState(false);
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());

  function pickFile(f: File | null | undefined) {
    if (!f) return;
    setFile(f);
    setMsg(null);
    setIssues([]);
    setFatal(null);
  }

  function buildLog(fileName: string, status: string, fatalMsg: string | null, list: Issue[]) {
    const errors = list.filter(i => i.severity === 'error');
    const warns = list.filter(i => i.severity === 'warning');
    const fmt = (i: Issue) =>
      `${i.row != null ? `[Baris ${i.row}]` : '[Umum]'}${i.column ? ` Kolom "${i.column}":` : ''} ${i.message}`;
    const L: string[] = [];
    L.push('LOG VALIDASI UPLOAD — RM Performance Dashboard');
    L.push('='.repeat(52));
    L.push(`Tanggal  : ${new Date().toLocaleString('id-ID')}`);
    L.push(`File     : ${fileName}`);
    L.push(`Status   : ${status}`);
    L.push(`Ringkasan: ${errors.length} error, ${warns.length} peringatan`);
    if (fatalMsg) {
      L.push('');
      L.push('MASALAH UTAMA (FATAL):');
      L.push('  - ' + fatalMsg);
    }
    if (errors.length) {
      L.push('');
      L.push(`ERROR (${errors.length}) - wajib diperbaiki sebelum upload:`);
      errors.forEach((i, n) => L.push(`  ${n + 1}. ${fmt(i)}`));
    }
    if (warns.length) {
      L.push('');
      L.push(`PERINGATAN (${warns.length}) - tidak menghentikan upload:`);
      warns.forEach((i, n) => L.push(`  ${n + 1}. ${fmt(i)}`));
    }
    if (!fatalMsg && !errors.length && !warns.length) {
      L.push('');
      L.push('Tidak ada masalah ditemukan. File sesuai template.');
    }
    L.push('');
    return L.join('\n');
  }

  function downloadLog() {
    const status = fatal || issues.some(i => i.severity === 'error') ? 'GAGAL - file tidak diupload' : 'BERHASIL (dengan peringatan)';
    const text = buildLog(file?.name ?? 'file.xlsx', status, fatal, issues);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = logName;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    if (hasExisting && !confirm('Data lama akan dihapus dan diganti dengan file ini. Lanjutkan?')) return;
    setBusy(true); setMsg(null); setIssues([]); setFatal(null);

    const fd = new FormData();
    fd.append('file', file);
    fd.append('period', `${MONTHS[month]} ${year}`);

    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const text = await res.text();
    let j: { error?: string; message?: string; rows?: number; period?: string; fileName?: string; warnings?: Issue[]; report?: Report } = {};
    try { j = text ? JSON.parse(text) : {}; } catch { j = { error: text || `HTTP ${res.status}` }; }
    setBusy(false);

    const stamp = `${file.name.replace(/\.[^.]+$/, '')}-${new Date().toISOString().slice(0, 10)}`;

    // Gagal validasi → tampilkan isu + siapkan log
    if (res.status === 422 && j.report) {
      setFatal(j.report.fatal ?? null);
      setIssues(j.report.issues ?? []);
      setLogName(`log-error-${stamp}.txt`);
      const nErr = (j.report.issues ?? []).filter(i => i.severity === 'error').length;
      setMsg({ ok: false, text: j.report.fatal ?? `File tidak sesuai template — ${nErr} error ditemukan. Unduh log untuk detail.` });
      return;
    }

    if (!res.ok) {
      setMsg({ ok: false, text: j.error ?? `Upload gagal (HTTP ${res.status})` });
      return;
    }

    // Sukses (mungkin dengan peringatan)
    const warns = j.warnings ?? [];
    setIssues(warns);
    setFatal(null);
    setLogName(`log-peringatan-${stamp}.txt`);
    setMsg({
      ok: true,
      text: `✓ ${j.fileName} — ${j.rows} RM tersimpan${j.period ? ` untuk periode ${j.period}` : ''}${warns.length ? ` (${warns.length} peringatan)` : ''}.`,
    });
    setFile(null);
    router.refresh();
  }

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 1 + i);
  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warnCount = issues.filter(i => i.severity === 'warning').length;
  const hasLog = !!fatal || issues.length > 0;

  return (
    <form onSubmit={submit}>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">Bulan</label>
          <select value={month} onChange={e => setMonth(Number(e.target.value))} className="w-full mt-1 bg-zinc-950/60 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400/50">
            {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">Tahun</label>
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="w-full mt-1 bg-zinc-950/60 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400/50">
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <label
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); pickFile(e.dataTransfer.files?.[0]); }}
        className={`block cursor-pointer rounded-2xl border-2 border-dashed p-8 md:p-10 text-center transition ${
          drag ? 'border-amber-400 bg-amber-400/5'
          : file ? 'border-emerald-500/40 bg-emerald-500/5'
          : 'border-zinc-700 bg-zinc-900/60 hover:border-amber-400/60 hover:bg-zinc-900/80'
        }`}
      >
        <input type="file" accept=".xlsx,.xls" className="hidden" onChange={e => pickFile(e.target.files?.[0])} />
        <div className="text-4xl mb-2">{file ? '📄' : '⬆'}</div>
        <div className="text-base font-bold tracking-wider text-zinc-200 mb-1">
          {file ? 'FILE SIAP DIUPLOAD' : 'PILIH ATAU DRAG FILE EXCEL'}
        </div>
        {file ? (
          <div className="text-sm text-zinc-300 mt-2">
            <div className="font-semibold break-all">{file.name}</div>
            <div className="text-xs text-zinc-500 mt-0.5">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
          </div>
        ) : (
          <div className="text-xs text-zinc-500 mt-1">Format .xlsx (sheet &quot;KPI RM&quot; atau yang sejenis)</div>
        )}
      </label>

      {file && (
        <div className="mt-4 flex items-center gap-2">
          <button disabled={busy} className="flex-1 bg-gradient-to-r from-amber-400 to-yellow-300 text-amber-950 font-black tracking-wider rounded-lg py-3 disabled:opacity-50 hover:brightness-110 transition">
            {busy ? 'MEMVALIDASI & MEMPROSES...' : '⚡ UPLOAD & PUBLISH'}
          </button>
          <button type="button" onClick={() => { setFile(null); setMsg(null); setIssues([]); setFatal(null); }} className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 text-sm px-4 py-3 rounded-lg">
            Batal
          </button>
        </div>
      )}

      {msg && (
        <div className={`mt-4 text-sm rounded-lg px-4 py-3 border ${msg.ok ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-red-500/10 border-red-500/30 text-red-300'}`}>
          {msg.text}
        </div>
      )}

      {/* Panel detail isu + tombol download log */}
      {hasLog && (
        <div className={`mt-3 rounded-xl border overflow-hidden ${errorCount || fatal ? 'border-red-500/30 bg-red-500/5' : 'border-amber-500/30 bg-amber-500/5'}`}>
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/5">
            <div className="text-sm font-semibold flex items-center gap-2 flex-wrap">
              {errorCount || fatal
                ? <span className="text-red-300">⛔ {fatal ? 'Masalah struktur file' : `${errorCount} Error`}</span>
                : <span className="text-amber-300">⚠ {warnCount} Peringatan</span>}
              {(errorCount > 0) && warnCount > 0 && <span className="text-amber-300/80 text-xs">+ {warnCount} peringatan</span>}
            </div>
            <button type="button" onClick={downloadLog} className="shrink-0 text-xs font-semibold bg-zinc-100 text-zinc-900 hover:brightness-90 px-3 py-1.5 rounded-md flex items-center gap-1.5">
              ⬇ Download log (.txt)
            </button>
          </div>

          <div className="max-h-56 overflow-auto px-4 py-3 text-xs space-y-1.5">
            {fatal && (
              <div className="text-red-300 flex gap-2">
                <span className="shrink-0">⛔</span>
                <span>{fatal}</span>
              </div>
            )}
            {issues.slice(0, 60).map((i, n) => (
              <div key={n} className={`flex gap-2 ${i.severity === 'error' ? 'text-red-300' : 'text-amber-300/90'}`}>
                <span className="shrink-0">{i.severity === 'error' ? '⛔' : '⚠'}</span>
                <span>
                  {i.row != null && <b className="text-zinc-400">Baris {i.row} </b>}
                  {i.column && <b className="text-zinc-300">[{i.column}] </b>}
                  {i.message}
                </span>
              </div>
            ))}
            {issues.length > 60 && (
              <div className="text-zinc-500 italic pt-1">…dan {issues.length - 60} lagi. Unduh log untuk daftar lengkap.</div>
            )}
          </div>
        </div>
      )}
    </form>
  );
}
