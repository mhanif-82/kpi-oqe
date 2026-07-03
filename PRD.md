# PRD — Performance Dashboard (RM · Sourcing · BSO · APM)

Dashboard performa gamified untuk ditayangkan di **TV kantor**. Admin upload Excel KPI → dashboard publik menampilkan leaderboard, podium, dan halaman coaching secara auto-rotate. Dibuat untuk Hanif.

- **Repo:** https://github.com/mhanif-82/kpi-oqe (branch `main`)
- **Live:** `kpi-oqe-coral.vercel.app` (auto-redeploy tiap push ke `main`)
- **Lokal:** `~/Documents/rm-kpi/` → `npm run dev` (http://localhost:3000)

---

## 1. Tujuan & Prinsip
- Tampilan **TV-first** (32"): teks besar, kebaca dari jauh, fullscreen (`F`), auto-rotate antar halaman, refresh otomatis 1×/hari.
- Tanpa login untuk dashboard (publik). Login hanya untuk **admin** (upload data).
- Adil & positif: hindari kesan menghakimi performer yang sebenarnya sudah bagus.

## 2. Stack & Arsitektur
- **Next.js 16** (App Router, Turbopack) + TypeScript + Tailwind v4.
- **Supabase**: Auth (email/password) + Postgres (tabel `kpi_snapshots`, RLS: public SELECT, authenticated INSERT/DELETE).
- **Vercel** (free tier) untuk hosting.
- Parsing Excel: **xlsx (SheetJS)** di server (API route), middleware/proxy mengecualikan `/api/upload` agar tidak kena limit body.
- ⚠️ Vercel free body limit 4.5MB — file besar (~14MB) bisa gagal di prod; rencana lanjutan: upload via Supabase Storage.

## 3. Model Data
Tabel `kpi_snapshots`: `id, type, period, file_name, uploaded_at, uploaded_by, data (jsonb)`.
- Kolom **`type`** = `rm | sourcing | bso | apm`. Tiap tipe punya snapshot sendiri.
- **Replace per tipe:** upload satu tipe hanya menghapus+mengganti tipe yang sama; tipe lain tidak terpengaruh.
- Migrasi (sudah dijalankan): `alter table kpi_snapshots add column if not exists type text not null default 'rm';`

## 4. Tipe Data & Dashboard

| Tipe | URL | Sumber Excel | Dashboard |
|---|---|---|---|
| **RM** | `/` | 1 sheet: NO · EMPLOYEE NAME · AOM · REGIONAL · (KPI + BOBOT)… · PENCAPAIAN | Top 5 Best · Coaching · Regional Battle · Leaderboard · [SO Reg 1–3 jika Fulfillment terupload] |
| **Sourcing** | `/ps` | 2 sheet/tabel: People Search + Central Sourcing Manager (NAMA · [POSISI · CENTRAL] · KPI[ACTUAL/BOBOT/TARGET/ACH]… · TOTAL ACHIEVEMENT) | Top 5 Best PS · Worst PS · Best Central Sourcing Mgr · Leaderboard PS |
| **BSO** | `/bs` | 1 sheet: EMPLOYEE NAME · APM · REGIONAL · KPI[ACHIEVEMENT/ACH X BOBOT]… · PERFORMANCE | Top 3 Best BSO · Worst BSO · Best APM · Leaderboard BSO |
| **APM** | `/bs` | sheet sama dgn BSO **+ tabel kedua "RANK"** (APM · REGIONAL · RANK per-KPI 1/2/3 · TOTAL RANK 1) | Tampil di halaman "Best APM" pada `/bs` |
| **Fulfillment** | `/` (slide 5–7, setelah Leaderboard) | 3 sheet **REG 1/2/3**; tiap sheet: blok info (Nama Report · Periode · Tgl Release · Cut Off Closing · REGIONAL HEAD) + header 2 baris (REGION · AOM · RM · NAMA KLIEN · RECRUITMENT ORDER · FULFILL · UNFULFILL · % FULFILL · CLOSE · % CLOSE · FULFILL[ON/OVER SLA] · UNFULFILL[ON/OVER SLA] · STATUS SLA[ON/OVER/CLOSE] · % PERFORM SLA); baris "… Total" diabaikan | Slide **"Report SO & Usulan — Regional N"** per sheet |

Parser otomatis: deteksi sheet/tabel (judul/nama sheet), jumlah KPI bebas, format persen `100.00%`/`95%`/`95,13%` semua terbaca, baris kosong/duplikat/grand-total diabaikan.

### 4.1 Hub navigasi (`/link`)
Halaman pintasan TV-friendly: kartu besar klik-able ke tiap dashboard (RM `/`, Sourcing `/ps`, BSO & APM `/bs`) + tautan Admin. Tujuannya supaya di TV tinggal klik, tidak perlu ngetik URL. Statik (tanpa fetch data), warna per tipe konsisten (amber/sky/emerald), gradient inline rgba (TV Samsung-safe).

## 5. Perilaku Dashboard (umum)
- **Auto-rotate** antar halaman tiap N detik (default 15s, bisa diatur admin).
- **Leaderboard auto-scroll**: halaman leaderboard tidak ikut timer — scroll pelan dari atas ke bawah, lalu lanjut ke halaman berikutnya. Pakai akumulator float (kompatibel browser TV Samsung yang membulatkan `scrollTop`).
- **Keyboard:** `←`/`→` navigasi, `Space` pause, `F` fullscreen.
- **Refresh** otomatis sekali per 24 jam.
- **Kompatibilitas TV (Samsung/Tizen):** semua gradient pakai inline-style standar (rgba/hex), bukan utility Tailwind v4 (`in oklab`) yang tidak didukung TV.

## 6. Aturan Performa (penting)

### 6.1 Coaching threshold (default **97%**, diatur di Admin tanpa deploy)
- Halaman **Coaching/Worst** hanya menampilkan peserta **di bawah threshold**.
- Kalau **semua di atas threshold** → halaman jadi positif: *"🎉 Semua perform di atas target! Tidak ada yang perlu coaching."* (tanpa warna merah).
- Di leaderboard, badge ⚠ WARNING hanya muncul untuk yang di bawah threshold.

### 6.2 Kondisi 100% (PERFECT)
- **100% = tier "PERFECT", di atas ranking** — tidak diberi nomor/juara (setara).
- **Leaderboard:** baris 100% tampil ⭐ tanpa #rank/medali; yang <100% dapat nomor `#N` di bawahnya. Kalau **semua** 100% → urut nama A–Z, semua ⭐, banner *"🏆 Perfect Performance (100%)"*.
- **Best/Podium page:** kalau **≥2 orang** 100% → jadi list *"Best Performance"* (semua nama 100%, tanpa juara). Kalau hanya 1 orang 100% → tetap jadi champion. Nama dibuat besar untuk TV.

### 6.3 Slide Report SO & Usulan (Fulfillment)
- Upload tipe **Fulfillment** menambah slide SO Reg 1–3 di dashboard RM (`/`) **setelah Leaderboard**, satu per sheet REG; tanpa upload, dashboard tetap 4 slide seperti semula.
- Judul header berubah jadi **"📋 Report SO & Usulan — Regional N"** + badge Regional Head; kartu stats diganti info **Periode · Tgl Release · Cut Off Closing** (dibaca dari blok info sheet).
- Isi: tabel penuh (semua kolom sheet), **digrup per RM** dan diurut **% PERFORM SLA terjelek → terbagus** (baris grup = agregat RM: % PERFORM SLA = Σ ON SLA / Σ(ON+OVER)); baris klien di dalam grup ikut diurut terjelek dulu.
- Warna % PERFORM SLA: ≥90% hijau · ≥70% amber · <70% merah (gradient inline rgba, TV-safe).
- Slide auto-scroll seperti leaderboard lalu lanjut sendiri; kalau muat tanpa scroll, pakai durasi slide biasa.

### 6.4 Ranking APM = TOTAL RANK 1
- APM **tidak** diranking dari total/achievement, tapi dari **jumlah peringkat #1** terbanyak di seluruh KPI (kolom TOTAL RANK 1 di tabel RANK file APM).
- Tie-break: performance.
- Tampil: *"N× Rank #1"* + daftar KPI tempat dia #1 (mis. "🥇 Rank #1 di: SPKP, Kontrak, Training Induction").

### 6.5 Foto profil (`person_photos`)
- Tabel `person_photos` (key = nama lowercase, image = data-URL JPEG ±256px — tanpa Storage bucket).
- Admin kelola di **`/admin/photos`**: daftar semua orang dari snapshot terbaru tiap tipe (RM+Fulfillment, PS, CSM, BSO, APM), search, upload (auto-crop persegi & kompres di browser), ganti, hapus.
- Semua dashboard pakai `<Avatar>` (app/Avatar.tsx + PhotosProvider): foto kalau ada, fallback inisial. Termasuk baris grup RM di slide SO & Usulan.

## 7. Admin (`/admin`, perlu login)
- Pemilih tipe: **🏆 RM · 🔎 Sourcing · 🏢 BSO · 🎖️ APM · 📋 Fulfillment**.
- Pilih **bulan (closing) & tahun**.
- **Download template contoh** per tipe (mirror format asli).
- **Validasi sebelum simpan**: kumpulkan semua error/peringatan (bukan berhenti di error pertama), dengan **nomor baris & kolom**; bisa **download log .txt**. File salah → ditolak, data lama aman.
- Status **semua dashboard** ditampilkan (LIVE, jumlah, periode, file, waktu upload).
- **Display Settings** (tersimpan di localStorage browser TV): durasi per slide, kecepatan scroll leaderboard, **coaching threshold**.

## 8. Komponen Halaman
- **Podium**: rank 2–1–3 dengan medali emas/perak/perunggu, badge PERFECT, kartu 4–5 sebagai honorable mention.
- **Coaching/Worst**: baris besar, KPI terlemah di-highlight, badge ⚠ WARNING (sesuai threshold).
- **Regional Battle** (RM): kartu per regional (ranking medali) + bar "Regional comparison".
- **Leaderboard**: tabel besar (Rank · Nama · Region/Central · AOM/APM/Posisi · Total), medali top 3, auto-scroll.

## 9. Status & Rencana Lanjutan
- ✅ Live & dipakai di TV kantor.
- 🔜 (opsional) Upload file besar via Supabase Storage untuk lewati limit body Vercel.
- 🔜 (opsional) Riwayat antar periode / tren.

---
*Catatan operasional:* setiap kali logika parsing berubah, **data perlu di-upload ulang** agar field baru ikut tersimpan (mis. `rank1` untuk APM). Verifikasi perubahan **di lokal dulu** sebelum push ke Vercel.
