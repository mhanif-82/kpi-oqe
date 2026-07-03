import { createClient } from '@/lib/supabase/server';
import BsDashboard, { type BPerson } from './BsDashboard';

export const revalidate = 30;

type Payload = { people?: BPerson[] };

export default async function BsPage() {
  const sb = await createClient();
  const latest = async (type: string) => {
    const { data } = await sb
      .from('kpi_snapshots')
      .select('period, uploaded_at, data')
      .eq('type', type)
      .order('uploaded_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data;
  };
  const [bsoSnap, apmSnap, { data: ph }] = await Promise.all([
    latest('bso'), latest('apm'),
    sb.from('person_photos').select('name, image'),
  ]);
  const photos = Object.fromEntries((ph ?? []).map(p => [p.name, p.image]));

  if (!bsoSnap && !apmSnap) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0a] text-center p-6 text-zinc-100">
        <h1 className="text-4xl font-bold tracking-tight">🏢 BSO Performance Dashboard</h1>
        <p className="text-zinc-400 mt-4">Belum ada data BSO/APM. Admin perlu upload file dulu (tipe BSO &amp; APM).</p>
        <a href="/admin" className="mt-6 text-sm text-emerald-400 underline">Admin login →</a>
      </main>
    );
  }

  const bso = (bsoSnap?.data as Payload | undefined)?.people ?? [];
  const apm = (apmSnap?.data as Payload | undefined)?.people ?? [];
  const period = bsoSnap?.period ?? apmSnap?.period ?? null;
  const uploadedAt = bsoSnap?.uploaded_at ?? apmSnap?.uploaded_at ?? null;

  return <BsDashboard bso={bso} apm={apm} period={period} uploadedAt={uploadedAt} photos={photos} />;
}
