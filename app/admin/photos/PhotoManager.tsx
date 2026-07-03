'use client';
import { useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { photoKey } from '@/app/Avatar';

export type PersonGroup = { label: string; people: string[] };

const AVATAR_SIZE = 256; // px — foto dikompres jadi JPEG kecil sebelum disimpan

const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase();

/** Resize + crop tengah ke persegi, hasil data-URL JPEG. */
async function toAvatarDataUrl(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('Gambar tidak bisa dibaca.'));
      i.src = url;
    });
    const side = Math.min(img.width, img.height);
    const sx = (img.width - side) / 2;
    const sy = (img.height - side) / 2;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = AVATAR_SIZE;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
    return canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function PhotoManager({ groups, initialPhotos }: { groups: PersonGroup[]; initialPhotos: Record<string, string> }) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [busy, setBusy] = useState<string | null>(null); // photoKey yang sedang diproses
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [q, setQ] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const targetRef = useRef<string>('');
  const sb = useMemo(() => createClient(), []);

  const total = useMemo(() => new Set(groups.flatMap(g => g.people.map(photoKey))).size, [groups]);
  const withPhoto = useMemo(() => new Set(groups.flatMap(g => g.people.map(photoKey)).filter(k => photos[k])).size, [groups, photos]);

  function pick(name: string) {
    targetRef.current = name;
    fileRef.current?.click();
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    const name = targetRef.current;
    if (!file || !name) return;
    const key = photoKey(name);
    setBusy(key); setMsg(null);
    try {
      const image = await toAvatarDataUrl(file);
      const { error } = await sb.from('person_photos').upsert({ name: key, image, updated_at: new Date().toISOString() });
      if (error) throw new Error(error.message);
      setPhotos(p => ({ ...p, [key]: image }));
      setMsg({ ok: true, text: `✓ Foto ${name} tersimpan.` });
    } catch (err) {
      setMsg({ ok: false, text: `Gagal simpan foto ${name}: ${(err as Error).message}` });
    } finally {
      setBusy(null);
    }
  }

  async function remove(name: string) {
    const key = photoKey(name);
    if (!confirm(`Hapus foto ${name}?`)) return;
    setBusy(key); setMsg(null);
    const { error } = await sb.from('person_photos').delete().eq('name', key);
    if (error) setMsg({ ok: false, text: `Gagal hapus: ${error.message}` });
    else {
      setPhotos(p => { const n = { ...p }; delete n[key]; return n; });
      setMsg({ ok: true, text: `✓ Foto ${name} dihapus.` });
    }
    setBusy(null);
  }

  const match = (n: string) => !q || n.toLowerCase().includes(q.toLowerCase());

  return (
    <div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />

      <div className="flex items-center gap-3 flex-wrap mb-5">
        <input
          value={q} onChange={e => setQ(e.target.value)} placeholder="🔍 Cari nama…"
          className="flex-1 min-w-52 bg-zinc-950/60 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400/50"
        />
        <span className="text-xs text-zinc-500">{withPhoto}/{total} orang sudah punya foto</span>
      </div>

      {msg && (
        <div className={`mb-4 text-sm rounded-lg px-4 py-3 border ${msg.ok ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-red-500/10 border-red-500/30 text-red-300'}`}>
          {msg.text}
        </div>
      )}

      {groups.map(g => {
        const people = g.people.filter(match);
        if (!people.length) return null;
        return (
          <section key={g.label} className="mb-8">
            <h2 className="text-sm font-bold tracking-wider text-zinc-400 uppercase mb-3">{g.label} <span className="text-zinc-600 normal-case">({people.length})</span></h2>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {people.map(name => {
                const key = photoKey(name);
                const photo = photos[key];
                const loading = busy === key;
                return (
                  <div key={name} className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-3 flex items-center gap-3">
                    {photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photo} alt={name} className="w-14 h-14 rounded-full object-cover shrink-0 ring-1 ring-zinc-700" />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-zinc-700 flex items-center justify-center text-lg font-bold text-white shrink-0">{initials(name)}</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate" title={name}>{name}</div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <button type="button" disabled={loading} onClick={() => pick(name)}
                          className="text-[11px] font-semibold bg-zinc-100 text-zinc-900 hover:brightness-90 disabled:opacity-50 px-2.5 py-1 rounded-md">
                          {loading ? '…' : photo ? 'Ganti' : '⬆ Upload'}
                        </button>
                        {photo && (
                          <button type="button" disabled={loading} onClick={() => remove(name)}
                            className="text-[11px] font-semibold bg-red-500/10 text-red-300 border border-red-500/20 hover:bg-red-500/20 disabled:opacity-50 px-2.5 py-1 rounded-md">
                            Hapus
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
