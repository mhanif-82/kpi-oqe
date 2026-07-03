import * as XLSX from 'xlsx';
import type { ValidationReport, ValidationIssue } from './parse-kpi';

/*
 * Format "Fulfillment by Regional" (Report SO & Usulan):
 * - 3 sheet: REG 1 / REG 2 / REG 3.
 * - Baris info di atas (kolom A label, kolom B ": nilai"): Nama Report, Periode,
 *   Tgl Release, Cut Off Closing, REGIONAL HEAD.
 * - Header 2 baris (merged): REGION · AOM · RM · NAMA KLIEN · RECRUITMENT ORDER ·
 *   FULFILL · UNFULFILL · % FULFILL · CLOSE · % CLOSE · FULFILL[ON/OVER SLA] ·
 *   UNFULFILL[ON/OVER SLA] · STATUS SLA[ON/OVER/CLOSE] · % PERFORM SLA.
 * - Baris data per klien; baris "… Total" (subtotal AOM / grand total) diabaikan.
 */

export type FulfillRow = {
  aom: string; rm: string; klien: string;
  ro: number; fulfill: number; unfulfill: number; pctFulfill: number;
  close: number; pctClose: number;
  fOn: number; fOver: number; uOn: number; uOver: number;
  slaOn: number; slaOver: number; slaClose: number; pctSla: number;
};
export type FulfillRegion = { sheet: string; head: string | null; rows: FulfillRow[] };
export type FulfillmentInfo = { periode: string | null; tglRelease: string | null; cutOff: string | null };
export type FulfillmentData = { info: FulfillmentInfo; regions: FulfillRegion[] };

const norm = (s: unknown) => (s ?? '').toString().replace(/\s+/g, ' ').trim();
const upper = (s: unknown) => norm(s).toUpperCase();
const isEmptyCell = (v: unknown) => v == null || String(v).trim() === '';
const isRowBlank = (r: unknown[] | undefined) => !r || r.every(c => isEmptyCell(c));
const stripLabel = (v: unknown) => norm(v).replace(/^:\s*/, '');

function toNum(v: unknown): number {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const n = Number(String(v).replace(/\s/g, '').replace('%', '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}
function toRatio(v: unknown): number {
  const n = toNum(v);
  return n > 1.0001 ? n / 100 : n;
}
function isNumericCell(v: unknown): boolean {
  if (isEmptyCell(v)) return true;
  if (typeof v === 'number') return Number.isFinite(v);
  const s = String(v).replace(/\s/g, '').replace('%', '').replace(',', '.');
  return s === '' || Number.isFinite(Number(s));
}

type Layout = {
  hIdx: number;
  aom: number; rm: number; klien: number; ro: number;
  fulfill: number; unfulfill: number; pctFulfill: number; close: number; pctClose: number;
  fOn: number; fOver: number; uOn: number; uOver: number;
  slaOn: number; slaOver: number; slaClose: number; pctSla: number;
};

function detect(aoa: unknown[][]): Layout | { fatal: string } {
  const hIdx = aoa.findIndex(r => Array.isArray(r) && r.some(c => /RECRUITMENT\s*ORDER/i.test(String(c ?? ''))));
  if (hIdx < 0) return { fatal: 'Baris header (memuat "RECRUITMENT ORDER") tidak ditemukan.' };
  const grp = (aoa[hIdx] ?? []).map(c => upper(c));
  const sub = (aoa[hIdx + 1] ?? []).map(c => upper(c));

  const find = (re: RegExp, cond?: (c: number) => boolean) =>
    grp.findIndex((g, c) => re.test(g) && (!cond || cond(c)));

  const aom   = find(/^AOM$/);
  const rm    = find(/^RM$/);
  const klien = find(/^NAMA\s*KLIEN$/);
  const ro    = find(/^RECRUITMENT\s*ORDER$/);
  const fulfill    = find(/^FULFILL$/, c => !sub[c]);
  const unfulfill  = find(/^UNFULFILL$/, c => !sub[c]);
  const pctFulfill = find(/^%\s*FULFILL$/);
  const close      = find(/^CLOSE$/, c => !sub[c]);
  const pctClose   = find(/^%\s*CLOSE$/);
  const fOn = find(/^FULFILL$/, c => sub[c] === 'ON SLA');
  const uOn = find(/^UNFULFILL$/, c => sub[c] === 'ON SLA');
  const slaOn = find(/^STATUS\s*SLA$/);
  const pctSla = find(/^%\s*PERFORM\s*SLA$/);

  const missing: string[] = [];
  if (aom < 0) missing.push('AOM');
  if (rm < 0) missing.push('RM');
  if (klien < 0) missing.push('NAMA KLIEN');
  if (ro < 0) missing.push('RECRUITMENT ORDER');
  if (fulfill < 0) missing.push('FULFILL');
  if (unfulfill < 0) missing.push('UNFULFILL');
  if (fOn < 0) missing.push('FULFILL (ON/OVER SLA)');
  if (uOn < 0) missing.push('UNFULFILL (ON/OVER SLA)');
  if (slaOn < 0) missing.push('STATUS SLA');
  if (pctSla < 0) missing.push('% PERFORM SLA');
  if (missing.length) return { fatal: `Kolom tidak ditemukan: ${missing.join(', ')}.` };

  return {
    hIdx, aom, rm, klien, ro, fulfill, unfulfill, pctFulfill, close, pctClose,
    fOn, fOver: fOn + 1, uOn, uOver: uOn + 1,
    slaOn, slaOver: slaOn + 1, slaClose: slaOn + 2, pctSla,
  };
}

function readInfo(aoa: unknown[][]): { info: FulfillmentInfo; head: string | null } {
  const info: FulfillmentInfo = { periode: null, tglRelease: null, cutOff: null };
  let head: string | null = null;
  for (let i = 0; i < Math.min(10, aoa.length); i++) {
    const label = upper(aoa[i]?.[0]);
    const value = stripLabel(aoa[i]?.[1]);
    if (!value) continue;
    if (label === 'PERIODE') info.periode = value;
    else if (/^TGL\s*RELEASE$/.test(label)) info.tglRelease = value;
    else if (/^CUT\s*OFF\s*CLOSING$/.test(label)) info.cutOff = value;
    else if (/^REGIONAL\s*HEAD$/.test(label)) head = value;
  }
  return { info, head };
}

const isTotalRow = (row: unknown[], L: Layout) =>
  /total/i.test(norm(row[0])) || /total/i.test(norm(row[L.aom])) || /total/i.test(norm(row[L.rm]));

function regSheets(wb: XLSX.WorkBook): string[] {
  const regs = wb.SheetNames.filter(n => /reg/i.test(n));
  return regs.length ? regs : wb.SheetNames;
}

export function parseFulfillment(buf: ArrayBuffer): FulfillmentData {
  const wb = XLSX.read(buf, { type: 'array' });
  const regions: FulfillRegion[] = [];
  let info: FulfillmentInfo = { periode: null, tglRelease: null, cutOff: null };

  for (const sn of regSheets(wb)) {
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sn], { header: 1, defval: null });
    const det = detect(aoa);
    if ('fatal' in det) continue;
    const meta = readInfo(aoa);
    if (meta.info.periode) info = meta.info;

    const rows: FulfillRow[] = [];
    for (let i = det.hIdx + 2; i < aoa.length; i++) {
      const row = aoa[i];
      if (isRowBlank(row)) continue;
      if (isTotalRow(row!, det)) continue;
      const rm = norm(row![det.rm]);
      const klien = norm(row![det.klien]);
      if (!rm || !klien) continue;
      rows.push({
        aom: norm(row![det.aom]), rm, klien,
        ro: toNum(row![det.ro]), fulfill: toNum(row![det.fulfill]), unfulfill: toNum(row![det.unfulfill]),
        pctFulfill: toRatio(row![det.pctFulfill]),
        close: toNum(row![det.close]), pctClose: toRatio(row![det.pctClose]),
        fOn: toNum(row![det.fOn]), fOver: toNum(row![det.fOver]),
        uOn: toNum(row![det.uOn]), uOver: toNum(row![det.uOver]),
        slaOn: toNum(row![det.slaOn]), slaOver: toNum(row![det.slaOver]), slaClose: toNum(row![det.slaClose]),
        pctSla: toRatio(row![det.pctSla]),
      });
    }
    if (rows.length) regions.push({ sheet: norm(sn), head: meta.head, rows });
  }

  if (!regions.length) throw new Error('Tidak ada sheet REG dengan data terbaca.');
  return { info, regions };
}

export function validateFulfillment(buf: ArrayBuffer): ValidationReport {
  const base: ValidationReport = { ok: false, fatal: null, issues: [], rowsParsed: 0, sheetName: null, kpiCount: 0 };
  let wb: XLSX.WorkBook;
  try { wb = XLSX.read(buf, { type: 'array' }); }
  catch { return { ...base, fatal: 'File tidak bisa dibaca sebagai Excel (.xlsx/.xls).' }; }

  const issues: ValidationIssue[] = [];
  const sheets = regSheets(wb);
  let totalRows = 0, sheetsOk = 0;

  const NUM_COLS: { key: keyof Layout; label: string }[] = [
    { key: 'ro', label: 'RECRUITMENT ORDER' }, { key: 'fulfill', label: 'FULFILL' },
    { key: 'unfulfill', label: 'UNFULFILL' }, { key: 'slaOn', label: 'STATUS SLA ON SLA' },
    { key: 'slaOver', label: 'STATUS SLA OVER SLA' }, { key: 'pctSla', label: '% PERFORM SLA' },
  ];

  for (const sn of sheets) {
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sn], { header: 1, defval: null });
    const det = detect(aoa);
    if ('fatal' in det) {
      issues.push({ severity: 'error', row: null, column: null, message: `Sheet "${sn}": ${det.fatal}` });
      continue;
    }
    sheetsOk++;
    for (let i = det.hIdx + 2; i < aoa.length; i++) {
      const row = aoa[i];
      const excelRow = i + 1;
      if (isRowBlank(row)) continue;
      if (isTotalRow(row!, det)) continue;
      const rm = norm(row![det.rm]);
      const klien = norm(row![det.klien]);
      if (!rm && !klien) continue;
      if (!rm) { issues.push({ severity: 'warning', row: excelRow, column: 'RM', message: `Sheet "${sn}": kolom RM kosong — baris diabaikan.` }); continue; }
      if (!klien) { issues.push({ severity: 'warning', row: excelRow, column: 'NAMA KLIEN', message: `Sheet "${sn}": NAMA KLIEN kosong untuk "${rm}" — baris diabaikan.` }); continue; }
      totalRows++;
      for (const nc of NUM_COLS) {
        const v = row![det[nc.key] as number];
        if (!isNumericCell(v)) issues.push({ severity: 'error', row: excelRow, column: nc.label, message: `Sheet "${sn}": nilai "${String(v).trim()}" bukan angka.` });
      }
    }
  }

  if (!sheetsOk) return { ...base, fatal: 'Tidak ada sheet dengan format Fulfillment (REGION · AOM · RM · NAMA KLIEN · RECRUITMENT ORDER · … · % PERFORM SLA).', issues };
  if (!totalRows) return { ...base, fatal: 'Tidak ada baris data terbaca.', issues };
  const hasError = issues.some(i => i.severity === 'error');
  return { ok: !hasError, fatal: null, issues, rowsParsed: totalRows, sheetName: sheets.join(', '), kpiCount: 0 };
}
