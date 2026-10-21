import * as XLSX from 'xlsx';
import type { MetricRow } from './types';

// LinkedIn's analytics export (Analytics, Post analytics, Export: an .xlsx with a TOP POSTS sheet holding two
// side-by-side tables, one by engagements and one by impressions) or any CSV with a URL column. Parsed in the
// browser; only plain rows go to the agent. The parser scans every sheet for a header cell that says "Post URL"
// and reads the table under it, so a changed layout still works as long as the names do.

const KEYS: [RegExp, keyof MetricRow][] = [
  [/post\s*url|^url$|link/i, 'url'],
  [/publish|date|posted/i, 'date'],
  [/impression|view/i, 'impressions'],
  [/reaction|like/i, 'reactions'],
  [/comment/i, 'comments'],
  [/repost|share/i, 'reposts'],
  [/engagement/i, 'engagements'],
];

const toNumber = (v: unknown) => {
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v) : undefined;
  const n = Number(String(v ?? '').replace(/[,\s]/g, ''));
  return Number.isFinite(n) && String(v).trim() !== '' ? Math.round(n) : undefined;
};
const toDate = (v: unknown) => {
  // A parsed date cell is local midnight; read its local parts so the day never shifts with the timezone.
  if (v instanceof Date) return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
  if (typeof v === 'number') { const d = XLSX.SSF.parse_date_code(v); return d ? `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}` : undefined; }
  const s = String(v ?? '').trim();
  if (!s) return undefined;
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); // LinkedIn exports M/D/YYYY
  if (us) return `${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`;
  const t = Date.parse(s);
  return Number.isNaN(t) ? undefined : new Date(t).toISOString().slice(0, 10);
};

export function parseAnalytics(buffer: ArrayBuffer, filename: string): { rows: MetricRow[]; sheets: string[] } {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true, raw: false });
  const merged = new Map<string, MetricRow>();
  const sheets: string[] = [];
  for (const name of wb.SheetNames) {
    const grid: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: '' });
    let found = false;
    for (let r = 0; r < grid.length; r++) {
      const row = grid[r] ?? [];
      for (let c = 0; c < row.length; c++) {
        if (!/post\s*url|^url$/i.test(String(row[c] ?? '').trim())) continue;
        // A table starts here: headers to the right until a blank cell.
        const cols: { c: number; key: keyof MetricRow }[] = [];
        for (let k = c; k < row.length && String(row[k] ?? '').trim() !== ''; k++) {
          const label = String(row[k]).trim();
          const key = KEYS.find(([re]) => re.test(label))?.[1];
          if (key) cols.push({ c: k, key });
        }
        for (let i = r + 1; i < grid.length; i++) {
          const line = grid[i] ?? [];
          const url = String(line[c] ?? '').trim();
          if (!/^https?:\/\//i.test(url)) break;
          const row2: MetricRow = merged.get(url) ?? { url };
          for (const { c: k, key } of cols) {
            const v = line[k];
            if (key === 'url') continue;
            if (key === 'date') { const d = toDate(v); if (d) row2.date = d; } else { const n = toNumber(v); if (n !== undefined) row2[key] = n; }
          }
          merged.set(url, row2);
          found = true;
        }
      }
    }
    if (found) sheets.push(name);
  }
  if (!merged.size && /\.csv$/i.test(filename)) throw new Error('No "Post URL" column found in the CSV.');
  return { rows: Array.from(merged.values()), sheets };
}

/** Downscale an image file to at most 1600px on the long side, as a JPEG data URL, so the upload stays small. */
export function imageToDataUrl(file: File, max = 1600): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read that image')); };
    img.src = url;
  });
}
