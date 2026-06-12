import * as XLSX from 'xlsx';

export type Kpi = { name: string; value: number; weight: number };
export type KpiRow = {
  name: string;
  mrm: string;
  aom: string;
  regional: string;
  pencapaian: number;
  kpis: Kpi[];
};
export type Snapshot = { period: string | null; data: KpiRow[]; kpiDefs: { name: string; weight: number }[] };

/** Hasil validasi terstruktur, dipakai untuk membangun log yang bisa diunduh. */
export type ValidationIssue = {
  severity: 'error' | 'warning';
  row: number | null;   // nomor baris Excel (1-based); null = isu level kolom/file
  column: string | null;
  message: string;
};
export type ValidationReport = {
  ok: boolean;                 // true bila tidak ada fatal & tidak ada error
  fatal: string | null;        // masalah struktur yang menghentikan parsing total
  issues: ValidationIssue[];
  rowsParsed: number;
  sheetName: string | null;
  kpiCount: number;
};

const norm = (s: unknown) => (s ?? '').toString().replace(/\s+/g, ' ').trim();
const upper = (s: unknown) => norm(s).toUpperCase();
const isBobot = (s: string) => /^BOBOT\b/i.test(s);
const bobotWeight = (s: string) => {
  const m = s.match(/(\d+(?:[.,]\d+)?)\s*%/);
  return m ? Number(m[1].replace(',', '.')) / 100 : 0;
};

/** Convert any of: 0.95, 95, "95%", "95,13%", "100,00 %" to a 0..1 number. */
function toRatio(v: unknown): number {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') {
    if (!Number.isFinite(v) || v < 0) return 0;
    return v > 1.0001 ? v / 100 : v; // 95 → 0.95; 0.95 stays
  }
  const s = String(v).replace(/\s/g, '').replace('%', '').replace(',', '.');
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n > 1.0001 ? n / 100 : n;
}

/** Apakah sebuah sel bisa diartikan sebagai angka/persen yang valid. Sel kosong = true (ditangani terpisah). */
function isNumericCell(v: unknown): boolean {
  if (v == null || String(v).trim() === '') return true;
  if (typeof v === 'number') return Number.isFinite(v);
  const s = String(v).replace(/\s/g, '').replace('%', '').replace(',', '.');
  if (s === '') return true;
  return Number.isFinite(Number(s)) && Number(s) >= 0;
}
const isEmptyCell = (v: unknown) => v == null || String(v).trim() === '';

function titleCase(s: string) {
  return s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

/* ─── Layout detection (dipakai bareng oleh parse & validate) ─────────── */

type Layout = {
  hIdx: number;
  idx: { name: number; mrm: number; aom: number; reg: number; penc: number };
  kpiDefs: { name: string; weight: number; col: number }[];
  period: string | null;
};

function loadSheet(buf: ArrayBuffer): { sheetName: string; aoa: unknown[][] } | null {
  const wb = XLSX.read(buf, { type: 'array' });
  let best: { name: string; aoa: unknown[][]; score: number } | null = null;
  for (const name of wb.SheetNames) {
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, defval: null });
    let score = 0;
    for (let i = 0; i < Math.min(10, aoa.length); i++) {
      const row = aoa[i] ?? [];
      if (row.some(c => /EMPLOYEE\s*NAME/i.test(String(c ?? '')))) score += 5;
      if (row.some(c => /PENCAPAIAN/i.test(String(c ?? '')))) score += 3;
      if (row.some(c => /^BOBOT/i.test(String(c ?? '')))) score += 2;
    }
    if (score > 0 && (!best || score > best.score)) best = { name, aoa, score };
  }
  return best ? { sheetName: best.name, aoa: best.aoa } : null;
}

/** Deteksi posisi header & kolom. Mengembalikan { layout } atau { fatal }. */
function detectLayout(aoa: unknown[][]): { layout: Layout } | { fatal: string } {
  let period: string | null = null;
  for (let i = 0; i < Math.min(5, aoa.length); i++) {
    const found = (aoa[i] ?? []).find(c => typeof c === 'string' && /januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember/i.test(c));
    if (found) { period = String(found).trim(); break; }
  }

  const hIdx = aoa.findIndex(r => Array.isArray(r) && r.some(c => /EMPLOYEE\s*NAME/i.test(String(c ?? ''))));
  if (hIdx < 0) return { fatal: 'Baris header (yang memuat "EMPLOYEE NAME") tidak ditemukan. Pastikan file mengikuti template.' };

  const headers = (aoa[hIdx] as unknown[]).map(upper);
  const colWhere = (pred: (h: string) => boolean) => headers.findIndex(pred);
  const idx = {
    name: colWhere(h => h === 'EMPLOYEE NAME' || h === 'NAMA' || h === 'NAME'),
    mrm: colWhere(h => h === 'MRM'),
    aom: colWhere(h => h === 'AOM'),
    reg: colWhere(h => h === 'REGIONAL' || h === 'REGION'),
    penc: colWhere(h => h === 'PENCAPAIAN' || h === 'TOTAL' || h === 'TOTAL PENCAPAIAN'),
  };
  if (idx.name < 0) return { fatal: 'Kolom "EMPLOYEE NAME" tidak ditemukan di baris header.' };
  if (idx.penc < 0) return { fatal: 'Kolom "PENCAPAIAN" tidak ditemukan di baris header.' };

  const startCol = Math.max(idx.reg, idx.aom, idx.mrm, idx.name) + 1;
  const kpiDefs: { name: string; weight: number; col: number }[] = [];
  for (let c = startCol; c < idx.penc; c++) {
    const h = headers[c];
    if (!h || isBobot(h)) continue;
    const next = headers[c + 1] ?? '';
    const weight = isBobot(next) ? bobotWeight(next) : 0;
    kpiDefs.push({ name: titleCase(h), weight, col: c });
  }
  if (!kpiDefs.length) return { fatal: 'Tidak ada kolom KPI terdeteksi antara kolom identitas dan PENCAPAIAN.' };

  return { layout: { hIdx, idx, kpiDefs, period } };
}

/** Baris yang bukan data sungguhan (legend/total) — dilewati diam-diam. */
function isLegendName(nameStr: string) {
  return /vacant|grand\s*total|average|rata-rata/i.test(nameStr) || /EMPLOYEE\s*NAME/i.test(nameStr);
}

/* ─── parseExcel: hasil akhir untuk disimpan ─────────────────────────── */

export function parseExcel(buf: ArrayBuffer): Snapshot {
  const sheet = loadSheet(buf);
  if (!sheet) throw new Error('Tidak ada sheet dengan kolom EMPLOYEE NAME + PENCAPAIAN');
  const det = detectLayout(sheet.aoa);
  if ('fatal' in det) throw new Error(det.fatal);
  const { hIdx, idx, kpiDefs, period } = det.layout;
  const aoa = sheet.aoa;

  const seen = new Set<string>();
  const data: KpiRow[] = [];
  let blankStreak = 0;
  for (let i = hIdx + 1; i < aoa.length; i++) {
    const row = aoa[i];
    const isBlank = !row || row.every(c => c == null || String(c).trim() === '');
    if (isBlank) {
      blankStreak++;
      if (blankStreak >= 2 && data.length > 0) break;
      continue;
    }
    blankStreak = 0;
    const rawName = row[idx.name];
    if (!rawName || typeof rawName !== 'string') continue;
    const nameStr = rawName.trim();
    if (!nameStr || isLegendName(nameStr)) continue;
    const key = nameStr.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const kpis: Kpi[] = kpiDefs.map(k => ({ name: k.name, weight: k.weight, value: toRatio(row[k.col]) }));
    const computed = kpis.reduce((s, k) => s + k.value * k.weight, 0);
    const fromCell = toRatio(row[idx.penc]);
    const pencapaian = fromCell > 0 ? fromCell : computed;
    if (pencapaian === 0 && kpis.every(k => k.value === 0)) continue;

    data.push({
      name: nameStr,
      mrm: idx.mrm >= 0 ? String(row[idx.mrm] ?? '').trim() : '',
      aom: idx.aom >= 0 ? String(row[idx.aom] ?? '').trim() : '',
      regional: idx.reg >= 0 ? String(row[idx.reg] ?? '').trim() : '',
      pencapaian,
      kpis,
    });
  }
  if (!data.length) throw new Error('Tidak ada baris data terbaca');
  return { period, data, kpiDefs: kpiDefs.map(k => ({ name: k.name, weight: k.weight })) };
}

/* ─── validateExcel: kumpulkan semua isu untuk log ───────────────────── */

export function validateExcel(buf: ArrayBuffer): ValidationReport {
  const empty: ValidationReport = { ok: false, fatal: null, issues: [], rowsParsed: 0, sheetName: null, kpiCount: 0 };

  let sheet;
  try {
    sheet = loadSheet(buf);
  } catch {
    return { ...empty, fatal: 'File tidak bisa dibaca sebagai Excel (.xlsx/.xls). Mungkin file rusak atau format salah.' };
  }
  if (!sheet) return { ...empty, fatal: 'Tidak ada sheet yang cocok dengan template (butuh kolom EMPLOYEE NAME + PENCAPAIAN).' };

  const det = detectLayout(sheet.aoa);
  if ('fatal' in det) return { ...empty, sheetName: sheet.sheetName, fatal: det.fatal };

  const { hIdx, idx, kpiDefs } = det.layout;
  const aoa = sheet.aoa;
  const issues: ValidationIssue[] = [];
  const push = (severity: 'error' | 'warning', row: number | null, column: string | null, message: string) =>
    issues.push({ severity, row, column, message });

  // ── Isu level kolom (sekali saja) ──
  kpiDefs.forEach(k => {
    if (k.weight === 0) push('warning', hIdx + 1, k.name, `Kolom KPI "${k.name}" tidak punya kolom "BOBOT (xx%)" di sebelah kanannya — bobot dianggap 0%.`);
  });
  const totalWeight = Math.round(kpiDefs.reduce((s, k) => s + k.weight, 0) * 100);
  if (totalWeight !== 100) {
    push('warning', hIdx + 1, null, `Total bobot semua KPI = ${totalWeight}% (idealnya 100%). Cek kembali kolom BOBOT.`);
  }

  // ── Isu per baris data ──
  const seen = new Set<string>();
  let rowsParsed = 0;
  let blankStreak = 0;
  for (let i = hIdx + 1; i < aoa.length; i++) {
    const excelRow = i + 1; // aoa index → nomor baris Excel
    const row = aoa[i];
    const isBlank = !row || row.every(c => c == null || String(c).trim() === '');
    if (isBlank) {
      blankStreak++;
      if (blankStreak >= 2 && rowsParsed > 0) break;
      continue;
    }
    blankStreak = 0;

    const rawName = row[idx.name];
    const nameStr = rawName == null ? '' : String(rawName).trim();

    // Lewati baris legend/total diam-diam
    if (nameStr && isLegendName(nameStr)) continue;

    // Cek apakah baris ini "berisi sesuatu" di kolom KPI/pencapaian (untuk bedakan baris junk vs salah isi)
    const hasAnyValue = kpiDefs.some(k => !isEmptyCell(row[k.col])) || !isEmptyCell(row[idx.penc]);

    // Nama kosong / bukan teks
    if (!nameStr) {
      if (hasAnyValue) push('error', excelRow, 'EMPLOYEE NAME', 'Kolom EMPLOYEE NAME kosong padahal kolom nilai terisi. Kemungkinan baris/kolom bergeser.');
      continue; // tanpa nama tak bisa divalidasi lebih lanjut
    }
    if (typeof rawName === 'number') {
      push('error', excelRow, 'EMPLOYEE NAME', `Kolom EMPLOYEE NAME berisi angka (${rawName}), seharusnya teks nama. Kemungkinan kolom bergeser.`);
    }

    // Duplikat nama
    const key = nameStr.toLowerCase();
    if (seen.has(key)) {
      push('warning', excelRow, 'EMPLOYEE NAME', `Nama "${nameStr}" duplikat dengan baris sebelumnya — baris ini akan diabaikan.`);
      continue;
    }
    seen.add(key);
    rowsParsed++;

    // Regional kosong (informasional)
    if (idx.reg >= 0 && isEmptyCell(row[idx.reg])) {
      push('warning', excelRow, 'REGIONAL', `Kolom REGIONAL kosong untuk "${nameStr}".`);
    }

    // Cek tiap sel KPI
    kpiDefs.forEach(k => {
      const cell = row[k.col];
      if (isEmptyCell(cell)) {
        push('warning', excelRow, k.name, `Nilai KPI "${k.name}" kosong — dianggap 0%.`);
      } else if (!isNumericCell(cell)) {
        push('error', excelRow, k.name, `Nilai KPI "${k.name}" = "${String(cell).trim()}" bukan angka/persen yang valid.`);
      }
    });

    // Cek PENCAPAIAN
    const pCell = row[idx.penc];
    if (isEmptyCell(pCell)) {
      push('warning', excelRow, 'PENCAPAIAN', `PENCAPAIAN kosong untuk "${nameStr}" — akan dihitung otomatis dari KPI × bobot.`);
    } else if (!isNumericCell(pCell)) {
      push('error', excelRow, 'PENCAPAIAN', `PENCAPAIAN = "${String(pCell).trim()}" bukan angka/persen yang valid.`);
    }
  }

  if (rowsParsed === 0) {
    return { ok: false, fatal: 'Tidak ada baris data RM yang bisa dibaca di bawah header.', issues, rowsParsed: 0, sheetName: sheet.sheetName, kpiCount: kpiDefs.length };
  }

  const hasError = issues.some(i => i.severity === 'error');
  return { ok: !hasError, fatal: null, issues, rowsParsed, sheetName: sheet.sheetName, kpiCount: kpiDefs.length };
}
