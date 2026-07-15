'use client';
import { useEffect, useRef, useState } from 'react';

type Item = { href: string; icon: string; label: string; external?: boolean };

const SECTIONS: { title: string; items: Item[] }[] = [
  {
    title: 'Kelola Data',
    items: [
      { href: '/admin', icon: '⚙️', label: 'Upload Data' },
      { href: '/admin/photos', icon: '📸', label: 'Foto Profil' },
      { href: '/history-upload', icon: '🕘', label: 'History Upload' },
    ],
  },
  {
    title: 'Buka Dashboard',
    items: [
      { href: '/', icon: '🏆', label: 'RM', external: true },
      { href: '/ps', icon: '🔎', label: 'Sourcing', external: true },
      { href: '/bs', icon: '🏢', label: 'BSO & APM', external: true },
      { href: '/link', icon: '📺', label: 'Hub Link', external: true },
    ],
  },
];

export default function AdminMenu({ email, current }: { email?: string | null; current?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey); };
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="flex items-center gap-2 text-sm font-semibold bg-zinc-900 border border-zinc-800 hover:border-amber-400/40 px-3.5 py-2 rounded-lg"
      >
        <span className="text-base leading-none">{open ? '✕' : '☰'}</span>
        <span className="hidden sm:inline">Menu</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/60 z-50 p-2">
          {email && (
            <div className="px-3 py-2 text-xs text-zinc-500 border-b border-zinc-800 mb-1 truncate" title={email}>
              👤 {email}
            </div>
          )}
          {SECTIONS.map(s => (
            <div key={s.title} className="mb-1">
              <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-zinc-600 font-bold">{s.title}</div>
              {s.items.map(it => {
                const active = current === it.href;
                return (
                  <a
                    key={it.href}
                    href={it.href}
                    target={it.external ? '_blank' : undefined}
                    rel={it.external ? 'noreferrer' : undefined}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm ${active ? 'bg-amber-400/10 text-amber-200' : 'text-zinc-200 hover:bg-zinc-800/70'}`}
                  >
                    <span className="text-base leading-none">{it.icon}</span>
                    <span>{it.label}</span>
                    {it.external && <span className="ml-auto text-zinc-600 text-xs">↗</span>}
                    {active && <span className="ml-auto text-amber-300 text-xs">•</span>}
                  </a>
                );
              })}
            </div>
          ))}
          <form action="/api/logout" method="post" className="border-t border-zinc-800 mt-1 pt-1">
            <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red-300 hover:bg-red-500/10">
              <span className="text-base leading-none">🚪</span> Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
