import * as XLSX from 'xlsx';
import type { ValidationReport, ValidationIssue } from './parse-kpi';

export type BsoKpi = { name: string; value: number };
export type BsoPerson = { name: string; total: number; regional?: string; apm?: string; kpis: BsoKpi[]; rank1?: number; rankDetail?: { name: string; rank: number }[] };
export type BsoSnapshot = { period: string | null; people: BsoPerson[]; kpiDefs: { name: string }[] };

const norm = (s: unknown) => (s ?? '').toString().replace(/\s+/g, ' ').trim();
const upper = (s: unknown) => norm(s).toUpperCase();
const titleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

function toRatio(v: unknown): number {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') { if (!Number.isFinite(v) || v < 0) return 0; return v > 1.0001 ? v / 100 : v; }
  const s = String(v).replace(/\s/g, '').replace('%', '').replace(',', '.');
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n > 1.0001 ? n / 100 : n;
}
function isNumericCell(v: unknown): boolean {
  if (v == null || String(v).trim() === '') return true;
  if (typeof v === 'number') return Number.isFinite(v);
  const s = String(v).replace(/\s/g, '').replace('%', '').replace(',', '.');
  if (s === '') return true;
  return Number.isFinite(Number(s));
}
const isEmptyCell = (v: unknown) => v == null || String(v).trim() === '';
const isRowBlank = (r: unknown[] | undefined) => !r || r.every(c => isEmptyCell(c));
const isLegendName = (n: string) => /grand\s*total|average|rata-rata|^total$|^employee name$/i.test(n);
const isSummaryHeader = (g: string) => /^(achievement|ach\s*x\s*bobot|performance)$/i.test(g);

type Layout = {
  hIdx: number; nameCol: number; regCol: number; apmCol: number; scoreCol: number;
  kpis: { name: string; col: number }[];
};

function detect(aoa: unknown[][]): Layout | { fatal: string } {
  const hIdx = aoa.findIndex(r => Array.isArray(r) && r.some(c => /EMPLOYEE\s*NAME/i.test(String(c ?? ''))));
  if (hIdx < 0) return { fatal: 'Baris header (memuat "EMPLOYEE NAME") tidak ditemukan.' };
  const grp = (aoa[hIdx] ?? []).map(c => norm(c));
  const sub = (aoa[hIdx + 1] ?? []).map(c => upper(c));
  const nameCol = grp.findIndex(c => /EMPLOYEE\s*NAME/i.test(c));
  const regCol = grp.findIndex(c => /^REGIONAL$|^REGION$/i.test(c));
  const apmCol = grp.findIndex(c => upper(c) === 'APM');

  let scoreCol = grp.findIndex(c => /^PERFORMANCE$/i.test(c));
  if (scoreCol < 0) { // fallback: kolom "ACH X BOBOT" ringkasan (sub-header kosong) paling kanan
    for (let c = grp.length - 1; c >= 0; c--) { if (/ach\s*x\s*bobot/i.test(grp[c]) && !sub[c]) { scoreCol = c; break; } }
  }
  if (scoreCol < 0) return { fatal: 'Kolom "PERFORMANCE" tidak ditemukan.' };

  // KPI = blok yang sub-header kolomnya "ACHIEVEMENT" dan nama grup bukan ringkasan
  const startCol = Math.max(nameCol, regCol, apmCol) + 1;
  const kpis: { name: string; col: number }[] = [];
  for (let c = startCol; c < scoreCol; c++) {
    const g = grp[c];
    if (!g || isSummaryHeader(g)) continue;
    if (sub[c] === 'ACHIEVEMENT') kpis.push({ name: titleCase(g), col: c });
  }
  if (nameCol < 0) return { fatal: 'Kolom EMPLOYEE NAME tidak terbaca.' };
  return { hIdx, nameCol, regCol, apmCol, scoreCol, kpis };
}

function detectPeriod(aoa: unknown[][]): string | null {
  for (let i = 0; i < Math.min(3, aoa.length); i++) {
    const c = (aoa[i] ?? []).find(x => typeof x === 'string' && /januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|[A-Za-z]{3}-\d{2}/i.test(x));
    if (c) return String(c).trim();
  }
  return null;
}

function pickSheet(wb: XLSX.WorkBook): unknown[][] | null {
  let best: { aoa: unknown[][]; score: number } | null = null;
  for (const sn of wb.SheetNames) {
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sn], { header: 1, defval: null });
    let score = 0;
    for (let i = 0; i < Math.min(6, aoa.length); i++) {
      const row = aoa[i] ?? [];
      if (row.some(c => /EMPLOYEE\s*NAME/i.test(String(c ?? '')))) score += 5;
      if (row.some(c => /PERFORMANCE/i.test(String(c ?? '')))) score += 3;
    }
    if (score > 0 && (!best || score > best.score)) best = { aoa, score };
  }
  return best?.aoa ?? null;
}

export function parseBsoApm(buf: ArrayBuffer): BsoSnapshot {
  const wb = XLSX.read(buf, { type: 'array' });
  const aoa = pickSheet(wb);
  if (!aoa) throw new Error('Tidak ada sheet dengan kolom EMPLOYEE NAME + PERFORMANCE.');
  const det = detect(aoa);
  if ('fatal' in det) throw new Error(det.fatal);
  const { hIdx, nameCol, regCol, apmCol, scoreCol, kpis } = det;

  const seen = new Set<string>();
  const people: BsoPerson[] = [];
  let blankStreak = 0;
  for (let i = hIdx + 2; i < aoa.length; i++) {
    const row = aoa[i];
    if (isRowBlank(row)) { blankStreak++; if (blankStreak >= 2 && people.length) break; continue; }
    blankStreak = 0;
    const rawName = row![nameCol];
    const name = rawName == null ? '' : String(rawName).trim();
    if (!name || isLegendName(name)) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const total = toRatio(row![scoreCol]);
    const kpiVals = kpis.map(k => ({ name: k.name, value: toRatio(row![k.col]) }));
    if (total === 0 && kpiVals.every(k => k.value === 0)) continue;
    people.push({
      name, total,
      regional: regCol >= 0 ? String(row![regCol] ?? '').trim() || undefined : undefined,
      apm: apmCol >= 0 ? String(row![apmCol] ?? '').trim() || undefined : undefined,
      kpis: kpiVals,
    });
  }
  if (!people.length) throw new Error('Tidak ada baris data terbaca.');

  // Tabel RANK (khusus APM): baris header memuat "APM" + "TOTAL RANK 1".
  // TOTAL RANK 1 = jumlah peringkat 1 di seluruh KPI → dipakai untuk ranking APM.
  attachRankTable(aoa, people);

  return { period: detectPeriod(aoa), people, kpiDefs: kpis.map(k => ({ name: k.name })) };
}

const toInt = (v: unknown) => { const n = parseInt(String(v ?? '').replace(/[^0-9-]/g, ''), 10); return Number.isFinite(n) ? n : 0; };

/** Cari tabel RANK (APM + TOTAL RANK 1) dan tempelkan rank1 + detail per orang. */
function attachRankTable(aoa: unknown[][], people: BsoPerson[]) {
  const hIdx = aoa.findIndex(r => Array.isArray(r) && r.some(c => upper(c) === 'APM') && r.some(c => /TOTAL\s*RANK\s*1/i.test(String(c ?? ''))));
  if (hIdx < 0) return;
  const gh = (aoa[hIdx] ?? []).map(c => norm(c));
  const sub = (aoa[hIdx + 1] ?? []).map(c => norm(c));
  const nameCol = gh.findIndex(c => upper(c) === 'APM');
  const totalCol = gh.findIndex(c => /TOTAL\s*RANK\s*1/i.test(c));
  if (nameCol < 0 || totalCol < 0) return;
  // Kolom rank per-KPI = antara nama & total yang punya label di sub-header.
  const kpiCols: { name: string; col: number }[] = [];
  for (let c = nameCol + 1; c < totalCol; c++) if (sub[c]) kpiCols.push({ name: titleCase(sub[c]), col: c });

  const byName = new Map(people.map(p => [p.name.toLowerCase(), p]));
  for (let i = hIdx + 2; i < aoa.length; i++) {
    const row = aoa[i];
    if (isRowBlank(row)) continue;
    const nm = String(row![nameCol] ?? '').trim();
    if (!nm || isLegendName(nm)) continue;
    const p = byName.get(nm.toLowerCase());
    if (!p) continue;
    p.rank1 = toInt(row![totalCol]);
    p.rankDetail = kpiCols.map(k => ({ name: k.name, rank: toInt(row![k.col]) }));
  }
}

export function validateBsoApm(buf: ArrayBuffer): ValidationReport {
  const base: ValidationReport = { ok: false, fatal: null, issues: [], rowsParsed: 0, sheetName: null, kpiCount: 0 };
  let wb: XLSX.WorkBook;
  try { wb = XLSX.read(buf, { type: 'array' }); }
  catch { return { ...base, fatal: 'File tidak bisa dibaca sebagai Excel (.xlsx/.xls).' }; }
  const aoa = pickSheet(wb);
  if (!aoa) return { ...base, fatal: 'Tidak ada sheet dengan kolom EMPLOYEE NAME + PERFORMANCE.' };
  const det = detect(aoa);
  if ('fatal' in det) return { ...base, fatal: det.fatal };
  const { hIdx, nameCol, scoreCol, kpis } = det;

  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();
  let rows = 0, blankStreak = 0;
  for (let i = hIdx + 2; i < aoa.length; i++) {
    const row = aoa[i];
    const excelRow = i + 1;
    if (isRowBlank(row)) { blankStreak++; if (blankStreak >= 2 && rows) break; continue; }
    blankStreak = 0;
    const name = row![nameCol] == null ? '' : String(row![nameCol]).trim();
    if (!name || isLegendName(name)) continue;
    if (seen.has(name.toLowerCase())) { issues.push({ severity: 'warning', row: excelRow, column: 'EMPLOYEE NAME', message: `Nama "${name}" duplikat — diabaikan.` }); continue; }
    seen.add(name.toLowerCase());
    rows++;
    const sc = row![scoreCol];
    if (isEmptyCell(sc)) issues.push({ severity: 'warning', row: excelRow, column: 'PERFORMANCE', message: `PERFORMANCE kosong untuk "${name}".` });
    else if (!isNumericCell(sc)) issues.push({ severity: 'error', row: excelRow, column: 'PERFORMANCE', message: `PERFORMANCE = "${String(sc).trim()}" bukan angka/persen.` });
    kpis.forEach(k => { const v = row![k.col]; if (!isEmptyCell(v) && !isNumericCell(v)) issues.push({ severity: 'error', row: excelRow, column: k.name, message: `Nilai "${k.name}" = "${String(v).trim()}" bukan angka/persen.` }); });
  }
  if (!rows) return { ...base, fatal: 'Tidak ada baris data terbaca.', issues };
  const hasError = issues.some(i => i.severity === 'error');
  return { ok: !hasError, fatal: null, issues, rowsParsed: rows, sheetName: wb.SheetNames[0], kpiCount: kpis.length };
}
