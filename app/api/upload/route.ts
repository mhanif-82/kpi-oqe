import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { parseExcel, validateExcel } from '@/lib/parse-kpi';
import { parseSourcing, validateSourcing } from '@/lib/parse-sourcing';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const form = await req.formData();
  const file = form.get('file');
  const periodFromForm = (form.get('period') ?? '').toString().trim() || null;
  const type = (form.get('type') ?? 'rm').toString() === 'sourcing' ? 'sourcing' : 'rm';
  if (!(file instanceof File)) return NextResponse.json({ error: 'no file' }, { status: 400 });

  const buf = await file.arrayBuffer();

  // 1) Validasi sesuai tipe.
  const report = type === 'sourcing' ? validateSourcing(buf) : validateExcel(buf);
  if (!report.ok) {
    return NextResponse.json(
      { error: 'validation', message: report.fatal ?? 'File tidak sesuai template.', report },
      { status: 422 },
    );
  }

  // 2) Parse + bentuk payload sesuai tipe.
  let data: unknown;
  let rowsCount: number;
  let detectedPeriod: string | null;
  try {
    if (type === 'sourcing') {
      const s = parseSourcing(buf);
      data = { peopleSearch: s.peopleSearch, centralSourcing: s.centralSourcing, psKpiDefs: s.psKpiDefs, csmKpiDefs: s.csmKpiDefs };
      rowsCount = s.peopleSearch.length + s.centralSourcing.length;
      detectedPeriod = s.period;
    } else {
      const s = parseExcel(buf);
      data = { rows: s.data, kpiDefs: s.kpiDefs };
      rowsCount = s.data.length;
      detectedPeriod = s.period;
    }
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  const period = periodFromForm ?? detectedPeriod;

  // 3) Replace HANYA tipe yang sama (rm/sourcing coexist).
  const { error: delErr } = await supabase.from('kpi_snapshots').delete().eq('type', type);
  if (delErr) return NextResponse.json({ error: 'gagal hapus data lama: ' + delErr.message }, { status: 500 });

  const { error } = await supabase.from('kpi_snapshots').insert({
    type,
    period,
    file_name: file.name,
    uploaded_by: user.email,
    data,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const warnings = report.issues.filter(i => i.severity === 'warning');
  return NextResponse.json({ ok: true, type, rows: rowsCount, period, fileName: file.name, warnings });
}
