import { createClient } from '@/lib/supabase/server';
import SourcingDashboard, { type SPerson } from './SourcingDashboard';

export const revalidate = 30;

type Payload = {
  peopleSearch: SPerson[];
  centralSourcing: SPerson[];
  psKpiDefs?: { name: string; weight: number }[];
  csmKpiDefs?: { name: string; weight: number }[];
};

export default async function PsPage() {
  const sb = await createClient();
  const { data } = await sb
    .from('kpi_snapshots')
    .select('period, uploaded_at, data')
    .eq('type', 'sourcing')
    .order('uploaded_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0a] text-center p-6 text-zinc-100">
        <h1 className="text-4xl font-bold tracking-tight">🔎 Sourcing Performance Dashboard</h1>
        <p className="text-zinc-400 mt-4">Belum ada data sourcing. Admin perlu upload file dulu (pilih tipe Sourcing).</p>
        <a href="/admin" className="mt-6 text-sm text-sky-400 underline">Admin login →</a>
      </main>
    );
  }

  const payload = data.data as Payload;
  return (
    <SourcingDashboard
      peopleSearch={payload.peopleSearch ?? []}
      centralSourcing={payload.centralSourcing ?? []}
      period={data.period}
      uploadedAt={data.uploaded_at}
    />
  );
}
