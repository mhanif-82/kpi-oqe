'use client';
import { useEffect, useState } from 'react';

const KEY = 'rmDashSettings';
const DEFAULTS = { transitionSec: 15, scrollSpeed: 40 };

export default function DisplaySettings() {
  const [transitionSec, setTransitionSec] = useState(DEFAULTS.transitionSec);
  const [scrollSpeed, setScrollSpeed]     = useState(DEFAULTS.scrollSpeed);
  const [saved, setSaved]                 = useState(false);

  useEffect(() => {
    try {
      const s = localStorage.getItem(KEY);
      if (s) {
        const p = JSON.parse(s);
        if (p.transitionMs) setTransitionSec(Math.round(p.transitionMs / 1000));
        if (p.scrollSpeed)  setScrollSpeed(p.scrollSpeed);
      }
    } catch {}
  }, []);

  function save() {
    const val = { transitionMs: transitionSec * 1000, scrollSpeed };
    localStorage.setItem(KEY, JSON.stringify(val));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function reset() {
    setTransitionSec(DEFAULTS.transitionSec);
    setScrollSpeed(DEFAULTS.scrollSpeed);
    localStorage.removeItem(KEY);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5">
      <h3 className="text-sm font-bold tracking-wider text-zinc-300 mb-4 flex items-center gap-2">
        🎛️ Display Settings
        <span className="text-[10px] text-zinc-600 font-normal">(tersimpan di browser TV)</span>
      </h3>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Transition */}
        <div>
          <label className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold block mb-1">
            Durasi per slide
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range" min={5} max={120} step={5}
              value={transitionSec}
              onChange={e => setTransitionSec(Number(e.target.value))}
              className="flex-1 accent-amber-400"
            />
            <span className="text-amber-300 font-black text-sm w-16 text-right">{transitionSec}s</span>
          </div>
          <p className="text-[10px] text-zinc-600 mt-1">Seberapa lama tiap halaman tampil sebelum pindah (5–120 detik)</p>
        </div>

        {/* Scroll speed */}
        <div>
          <label className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold block mb-1">
            Kecepatan scroll leaderboard
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range" min={5} max={200} step={5}
              value={scrollSpeed}
              onChange={e => setScrollSpeed(Number(e.target.value))}
              className="flex-1 accent-amber-400"
            />
            <span className="text-amber-300 font-black text-sm w-16 text-right">{scrollSpeed} px/s</span>
          </div>
          <p className="text-[10px] text-zinc-600 mt-1">Kecepatan scroll otomatis tabel leaderboard (5–200 px/detik)</p>
        </div>
      </div>

      <div className="flex items-center gap-3 mt-5">
        <button
          onClick={save}
          className="bg-gradient-to-r from-amber-400 to-yellow-300 text-amber-950 font-black tracking-wider rounded-lg px-5 py-2 text-sm hover:brightness-110 transition"
        >
          {saved ? '✓ Tersimpan!' : '💾 Simpan'}
        </button>
        <button
          onClick={reset}
          className="bg-zinc-800 border border-zinc-700 hover:border-zinc-600 text-zinc-400 text-sm px-4 py-2 rounded-lg transition"
        >
          Reset default
        </button>
        <a
          href="/"
          target="_blank"
          className="ml-auto text-xs text-zinc-500 hover:text-amber-400 underline underline-offset-2"
        >
          Preview dashboard ↗
        </a>
      </div>
    </div>
  );
}
