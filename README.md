# RM Avengers — KPI Battle Dashboard

Dashboard gamification untuk KPI RM. Admin upload Excel → TV menampilkan leaderboard otomatis (auto-rotate 3 halaman: Top/Bottom 5, Regional Battle, Full Leaderboard).

- **Public**: `/` — dashboard TV (tanpa login)
- **Admin**: `/admin` — upload Excel (perlu login)

## Setup Supabase (sekali)

1. Buka https://supabase.com → **New Project** → catat URL & anon key.
2. **SQL Editor** → paste isi `supabase-schema.sql` → Run.
3. **Authentication → Providers**: pastikan Email enabled.
4. **Authentication → Users → Add user** → buat akun admin (centang "Auto Confirm").

## Setup lokal

```bash
cp .env.local.example .env.local
# isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY
npm install
npm run dev
```

Buka http://localhost:3000

## Deploy Vercel

```bash
git init && git add -A && git commit -m "init"
# push ke GitHub, lalu import di vercel.com
```

Di Vercel, tambahkan dua env vars yang sama (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) untuk Production + Preview + Development.

## Cara pakai

1. Buka `/admin` → login pakai akun yang dibuat di Supabase.
2. Upload `Template_RM.xlsx`. Sistem otomatis baca sheet `KPI RM`.
3. Buka URL utama di TV → fullscreen (tekan **F**). Auto-rotate setiap 12 detik.

## Keyboard di TV

- `←` / `→` — pindah halaman manual (pause auto)
- `Space` — pause / resume
- `F` — fullscreen

## Skema scoring

| KPI | Bobot |
|---|---|
| Visiting Klien | 15% |
| Raport SLA | 15% |
| Validasi Database | 25% |
| Kontrak TAD | 20% |
| Toolkit | 15% |
| Ratio Offering | 10% |

- Hijau jika ≥ 95%, kuning jika < 95%.
- Bottom 5 menampilkan KPI terlemah masing-masing.
