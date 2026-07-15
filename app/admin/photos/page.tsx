import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import PhotoManager, { type PersonGroup } from './PhotoManager';
import AdminMenu from '../../AdminMenu';

export default async function PhotosPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/login');

  const latest = async (type: string) => {
    const { data } = await sb
      .from('kpi_snapshots')
      .select('data')
      .eq('type', type)
      .order('uploaded_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data?.data as unknown;
  };
  const [rm, sourcing, bso, apm, ful, { data: ph }] = await Promise.all([
    latest('rm'), latest('sourcing'), latest('bso'), latest('apm'), latest('fulfillment'),
    sb.from('person_photos').select('name, image'),
  ]);

  const names = (arr: unknown, key = 'name'): string[] =>
    Array.isArray(arr) ? [...new Set(arr.map(x => String((x as Record<string, unknown>)[key] ?? '').trim()).filter(Boolean))] : [];
  const obj = (d: unknown) => (d && typeof d === 'object' ? d as Record<string, unknown> : {});

  // RM = baris KPI + nama RM dari file Fulfillment (bisa beda penulisan)
  const rmNames = new Set(names(obj(rm).rows));
  const regions = obj(ful).regions;
  if (Array.isArray(regions)) {
    for (const reg of regions) names(obj(reg).rows, 'rm').forEach(n => rmNames.add(n));
  }

  const groups: PersonGroup[] = [
    { label: '🏆 RM', people: [...rmNames].sort() },
    { label: '🔎 People Search', people: names(obj(sourcing).peopleSearch).sort() },
    { label: '🎯 Central Sourcing Manager', people: names(obj(sourcing).centralSourcing).sort() },
    { label: '🏢 BSO', people: names(obj(bso).people).sort() },
    { label: '🎖️ APM', people: names(obj(apm).people).sort() },
  ].filter(g => g.people.length);

  const photos = Object.fromEntries((ph ?? []).map(p => [p.name, p.image]));

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-zinc-100"
      style={{ background: 'radial-gradient(800px 500px at 20% 0%, rgba(245,158,11,0.10), transparent 60%), radial-gradient(800px 500px at 80% 100%, rgba(59,130,246,0.08), transparent 60%), #0a0a0a' }}>
      <div className="max-w-5xl mx-auto p-6 md:p-8">
        <header className="flex items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
              <span>📸</span> Foto Profil
            </h1>
            <p className="text-xs text-zinc-500 mt-1">Upload foto per orang — dipakai semua dashboard (fallback: inisial nama).</p>
          </div>
          <AdminMenu email={user.email} current="/admin/photos" />
        </header>
        {groups.length
          ? <PhotoManager groups={groups} initialPhotos={photos} />
          : <p className="text-sm text-zinc-500">Belum ada data ter-upload — nama orang diambil dari data dashboard.</p>}
      </div>
    </main>
  );
}
