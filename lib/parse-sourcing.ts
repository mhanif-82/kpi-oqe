import * as XLSX from 'xlsx';
import type { ValidationReport, ValidationIssue } from './parse-kpi';

export type SourcingKpi = { name: string; actual: number; ach: number; weight: number };
export type SourcingPerson = { name: string; total: number; kpis: SourcingKpi[]; unit?: string; posisi?: string };
export type SourcingSnapshot = {
  period: string | null;
  peopleSearch: SourcingPerson[];
  centralSourcing: SourcingPerson[];
  psKpiDefs: { name: string; weight: number }[];
  csmKpiDefs: { name: string; weight: number }[];
};

const norm = (s: unknown) => (s ?? '').toString().replace(/\s+/g, ' ').trim();
const upper = (s: unknown) => norm(s).toUpperCase();

function toRatio(v: unknown): number {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') {
    if (!Number.isFinite(v) || v < 0) return 0;
    return v > 1.0001 ? v / 100 : v;
  }
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
  return Number.isFinite(Number(s)) && Number(s) >= 0;
}
const isEmptyCell = (v: unknown) => v == null || String(v).trim() === '';
const isRowBlank = (r: unknown[] | undefined) => !r || r.every(c => isEmptyCell(c));
const titleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
const isLegendName = (n: string) => /grand\s*total|average|rata-rata|^total$|^nama$/i.test(n);

function groupFromText(text: string): 'ps' | 'csm' | null {
  const t = text.toLowerCase();
  if (/people\s*search|\bpso\b/.test(t)) return 'ps';
  if (/central\s*sourcing|\bcsh\b|\bcsm\b|sourcing manager/.test(t)) return 'csm';
  return null;
}

type Table = { group: 'ps' | 'csm' | null; people: SourcingPerson[]; kpiDefs: { name: string; weight: number }[] };

/** Cari semua tabel sourcing (bisa bertumpuk dalam 1 sheet). Tiap tabel diawali baris header ber-"NAMA" + "TOTAL ACHIEVEMENT". */
function findTables(aoa: unknown[][], sheetName: string, collect?: ValidationIssue[]): Table[] {
  // Index semua baris header
  const headerIdxs: number[] = [];
  for (let i = 0; i < aoa.length; i++) {
    const r = aoa[i];
    if (Array.isArray(r) && r.some(c => upper(c) === 'NAMA') && r.some(c => /TOTAL\s*ACHIEVEMENT/i.test(String(c ?? '')))) {
      headerIdxs.push(i);
    }
  }
  if (!headerIdxs.length) return [];

  const tables: Table[] = [];
  for (let hi = 0; hi < headerIdxs.length; hi++) {
    const groupIdx = headerIdxs[hi];
    const subIdx = groupIdx + 1;
    const bodyEnd = hi + 1 < headerIdxs.length ? headerIdxs[hi + 1] : aoa.length;

    // Judul tabel = baris non-kosong terdekat DI ATAS header (berhenti di tabel sebelumnya)
    const prevEnd = hi === 0 ? 0 : headerIdxs[hi - 1] + 2;
    let group: 'ps' | 'csm' | null = null;
    for (let i = groupIdx - 1; i >= prevEnd; i--) {
      const text = (aoa[i] ?? []).map(c => String(c ?? '')).join(' ');
      const g = groupFromText(text);
      if (g) { group = g; break; }
      if (!isRowBlank(aoa[i]) && norm(text)) { /* baris judul tak dikenali, lanjut cek atasnya */ }
    }
    if (!group) group = groupFromText(sheetName);

    const groupHeader = (aoa[groupIdx] ?? []).map(c => norm(c));
    const subHeader = (aoa[subIdx] ?? []).map(c => upper(c));
    const nameCol = groupHeader.findIndex(c => upper(c) === 'NAMA');
    const totalCol = groupHeader.findIndex(c => /TOTAL\s*ACHIEVEMENT/i.test(c));

    // Blok KPI antara nama & total. Kolom info (POSISI/CENTRAL) dilewati (tak punya sub ACTUAL/ACH).
    type Block = { name: string; actualCol: number; bobotCol: number; achCol: number };
    const blocks: Block[] = [];
    let centralCol = -1, posisiCol = -1;
    for (let c = nameCol + 1; c < totalCol; c++) {
      const g = groupHeader[c];
      if (!g) continue;
      let end = c + 1;
      while (end < totalCol && !groupHeader[end]) end++;
      let actualCol = -1, bobotCol = -1, achCol = -1;
      for (let k = c; k < end; k++) {
        if (subHeader[k] === 'ACTUAL') actualCol = k;
        else if (subHeader[k] === 'BOBOT') bobotCol = k;
        else if (subHeader[k] === 'ACH') achCol = k;
      }
      if (actualCol < 0 && achCol < 0) {
        // bukan blok KPI → kolom informasi
        if (/central/i.test(g)) centralCol = c;
        else if (/posisi|position/i.test(g)) posisiCol = c;
        continue;
      }
      blocks.push({ name: titleCase(g), actualCol: actualCol >= 0 ? actualCol : c, bobotCol, achCol: achCol >= 0 ? achCol : -1 });
    }

    // Data
    const seen = new Set<string>();
    const people: SourcingPerson[] = [];
    let blankStreak = 0;
    for (let i = subIdx + 1; i < bodyEnd; i++) {
      const row = aoa[i];
      const excelRow = i + 1;
      if (isRowBlank(row)) { blankStreak++; if (blankStreak >= 2 && people.length) break; continue; }
      blankStreak = 0;
      const rawName = row![nameCol];
      const name = rawName == null ? '' : String(rawName).trim();
      if (!name || isLegendName(name)) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) {
        collect?.push({ severity: 'warning', row: excelRow, column: 'NAMA', message: `Nama "${name}" duplikat — baris diabaikan.` });
        continue;
      }
      seen.add(key);

      const totalRaw = row![totalCol];
      if (collect) {
        if (!isEmptyCell(totalRaw) && !isNumericCell(totalRaw)) collect.push({ severity: 'error', row: excelRow, column: 'TOTAL ACHIEVEMENT', message: `TOTAL ACHIEVEMENT = "${String(totalRaw).trim()}" bukan angka/persen.` });
        blocks.forEach(b => {
          const a = row![b.actualCol];
          if (!isEmptyCell(a) && !isNumericCell(a)) collect.push({ severity: 'error', row: excelRow, column: b.name, message: `Nilai "${b.name}" = "${String(a).trim()}" bukan angka/persen.` });
        });
      }

      const kpis: SourcingKpi[] = blocks.map(b => ({
        name: b.name,
        actual: toRatio(row![b.actualCol]),
        ach: b.achCol >= 0 ? toRatio(row![b.achCol]) : 0,
        weight: b.bobotCol >= 0 ? toRatio(row![b.bobotCol]) : 0,
      }));
      const totalCell = toRatio(totalRaw);
      const total = totalCell > 0 ? totalCell : kpis.reduce((s, k) => s + k.ach, 0);
      if (total === 0 && kpis.every(k => k.actual === 0)) continue;
      people.push({
        name, total, kpis,
        unit: centralCol >= 0 ? String(row![centralCol] ?? '').trim() || undefined : undefined,
        posisi: posisiCol >= 0 ? String(row![posisiCol] ?? '').trim() || undefined : undefined,
      });
    }

    const kpiDefs = blocks.map(b => {
      const found = people.find(p => p.kpis.find(k => k.name === b.name && k.weight > 0));
      return { name: b.name, weight: found?.kpis.find(k => k.name === b.name)?.weight ?? 0 };
    });

    if (people.length) tables.push({ group, people, kpiDefs });
  }
  return tables;
}

function detectPeriod(aoa: unknown[][]): string | null {
  for (let i = 0; i < Math.min(3, aoa.length); i++) {
    const cell = (aoa[i] ?? []).find(c => typeof c === 'string' && /[A-Za-z]{3}-\d{2}|januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember/i.test(c));
    if (cell) return String(cell).trim();
  }
  return null;
}

export function parseSourcing(buf: ArrayBuffer): SourcingSnapshot {
  const wb = XLSX.read(buf, { type: 'array' });
  let period: string | null = null;
  const snap: SourcingSnapshot = { period: null, peopleSearch: [], centralSourcing: [], psKpiDefs: [], csmKpiDefs: [] };
  const unassigned: Table[] = [];

  for (const sn of wb.SheetNames) {
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sn], { header: 1, defval: null });
    if (!period) period = detectPeriod(aoa);
    for (const t of findTables(aoa, sn)) {
      if (t.group === 'ps' && !snap.peopleSearch.length) { snap.peopleSearch = t.people; snap.psKpiDefs = t.kpiDefs; }
      else if (t.group === 'csm' && !snap.centralSourcing.length) { snap.centralSourcing = t.people; snap.csmKpiDefs = t.kpiDefs; }
      else unassigned.push(t);
    }
  }
  for (const t of unassigned) {
    if (!snap.peopleSearch.length) { snap.peopleSearch = t.people; snap.psKpiDefs = t.kpiDefs; }
    else if (!snap.centralSourcing.length) { snap.centralSourcing = t.people; snap.csmKpiDefs = t.kpiDefs; }
  }
  snap.period = period;

  if (!snap.peopleSearch.length && !snap.centralSourcing.length) {
    throw new Error('Tidak ada data sourcing terbaca (butuh tabel dengan kolom NAMA + TOTAL ACHIEVEMENT).');
  }
  return snap;
}

export function validateSourcing(buf: ArrayBuffer): ValidationReport {
  const base: ValidationReport = { ok: false, fatal: null, issues: [], rowsParsed: 0, sheetName: null, kpiCount: 0 };
  let wb: XLSX.WorkBook;
  try { wb = XLSX.read(buf, { type: 'array' }); }
  catch { return { ...base, fatal: 'File tidak bisa dibaca sebagai Excel (.xlsx/.xls).' }; }

  const issues: ValidationIssue[] = [];
  let ps = 0, csm = 0, rowsParsed = 0;
  for (const sn of wb.SheetNames) {
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sn], { header: 1, defval: null });
    for (const t of findTables(aoa, sn, issues)) {
      rowsParsed += t.people.length;
      if (t.group === 'ps') ps++;
      else if (t.group === 'csm') csm++;
      else issues.push({ severity: 'warning', row: null, column: null, message: `Ada tabel yang grupnya tidak terdeteksi (People Search / Central Sourcing Manager) — dipetakan berdasarkan urutan.` });
    }
  }

  if (rowsParsed === 0) return { ...base, fatal: 'Tidak ada tabel sourcing valid (butuh "NAMA" + "TOTAL ACHIEVEMENT").' };
  if (ps === 0) issues.push({ severity: 'warning', row: null, column: null, message: 'Tabel People Search tidak terdeteksi — bagian Top 5 People Search akan kosong.' });
  if (csm === 0) issues.push({ severity: 'warning', row: null, column: null, message: 'Tabel Central Sourcing Manager tidak terdeteksi — bagian ranking CSM akan kosong.' });

  const hasError = issues.some(i => i.severity === 'error');
  return { ok: !hasError, fatal: null, issues, rowsParsed, sheetName: wb.SheetNames.join(', '), kpiCount: 0 };
}
