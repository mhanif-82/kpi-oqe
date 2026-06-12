import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { parseExcel, validateExcel } from '@/lib/parse-kpi';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const form = await req.formData();
  const file = form.get('file');
  const periodFromForm = (form.get('period') ?? '').toString().trim() || null;
  if (!(file instanceof File)) return NextResponse.json({ error: 'no file' }, { status: 400 });

  const buf = await file.arrayBuffer();

  // 1) Validasi dulu — kumpulkan semua isu (tidak berhenti di error pertama).
  const report = validateExcel(buf);
  if (!report.ok) {
    return NextResponse.json(
      { error: 'validation', message: report.fatal ?? 'File tidak sesuai template.', report },
      { status: 422 },
    );
  }

  // 2) Parse untuk disimpan.
  let snapshot;
  try {
    snapshot = parseExcel(buf);
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  // User-selected period mengalahkan auto-detect dari Excel
  const period = periodFromForm ?? snapshot.period;

  // 3) Replace mode: hapus semua snapshot lama, lalu insert yang baru.
  const { error: delErr } = await supabase.from('kpi_snapshots').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (delErr) return NextResponse.json({ error: 'gagal hapus data lama: ' + delErr.message }, { status: 500 });

  const { error } = await supabase.from('kpi_snapshots').insert({
    period,
    file_name: file.name,
    uploaded_by: user.email,
    data: { rows: snapshot.data, kpiDefs: snapshot.kpiDefs },
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Sertakan peringatan (jika ada) agar bisa ditampilkan di UI.
  const warnings = report.issues.filter(i => i.severity === 'warning');
  return NextResponse.json({ ok: true, rows: snapshot.data.length, period, fileName: file.name, warnings });
}
