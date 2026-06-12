import { createClient } from '@/lib/supabase/server';
import Dashboard from './Dashboard';
import type { KpiRow } from '@/lib/parse-kpi';

export const revalidate = 30;

type Payload = { rows: KpiRow[]; kpiDefs: { name: string; weight: number }[] };

export default async function Home() {
  const sb = await createClient();
  const { data } = await sb
    .from('kpi_snapshots')
    .select('period, uploaded_at, file_name, data')
    .order('uploaded_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0a] text-center p-6">
        <h1 className="text-4xl font-bold tracking-tight">🏆 Recruitment performance dashboard</h1>
        <p className="text-zinc-400 mt-4">Belum ada data. Admin perlu upload file KPI dulu.</p>
        <a href="/admin" className="mt-6 text-sm text-amber-400 underline">Admin login →</a>
      </main>
    );
  }

  // Backward-compat: snapshot lama menyimpan data sebagai array langsung
  const payload: Payload = Array.isArray(data.data)
    ? { rows: data.data as KpiRow[], kpiDefs: inferDefs(data.data as KpiRow[]) }
    : (data.data as Payload);

  return <Dashboard rows={payload.rows} kpiDefs={payload.kpiDefs} period={data.period} fileName={data.file_name} uploadedAt={data.uploaded_at} />;
}

function inferDefs(rows: KpiRow[]): { name: string; weight: number }[] {
  const first = rows[0];
  return first ? first.kpis.map(k => ({ name: k.name, weight: k.weight })) : [];
}
