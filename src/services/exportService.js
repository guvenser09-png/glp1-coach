// exportService.js — Build & share the user's GLP-1 Coach data as CSV or PDF.
//
// Uses expo-print (HTML -> PDF), expo-sharing (system share sheet) and
// expo-file-system (cache writes). Everything is guarded: native / print /
// sharing failures degrade gracefully and the functions resolve to
// { ok: false } instead of throwing. Safe to call on Android / Expo Go.
//
// Public API:
//   exportAsCsv(payload): Promise<{ ok: boolean, reason?: string }>
//   exportAsPdf(payload): Promise<{ ok: boolean, reason?: string }>
//
// payload = {
//   weightLogs: [{ date, weight }],
//   doseChanges: [{ date, doseMg }],
//   doseLogs:    [{ date, dose }],
//   mealLogs:    [{ date, protein, ... }],
//   profile,
//   language,   // 'tr' | 'en'  (used for bilingual section titles)
// }

import * as FileSystem from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const safeArray = (v) => (Array.isArray(v) ? v : []);

function isoDateStamp(d = new Date()) {
  // YYYY-MM-DD for filenames / report header.
  try {
    return new Date(d).toISOString().slice(0, 10);
  } catch (e) {
    return new Date().toISOString().slice(0, 10);
  }
}

function fmtDate(value) {
  if (value == null || value === '') return '';
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toISOString().slice(0, 10);
  } catch (e) {
    return String(value);
  }
}

function fmtNum(value) {
  if (value == null || value === '') return '';
  const n = Number(value);
  return Number.isFinite(n) ? String(n) : String(value);
}

// RFC-4180 style CSV cell escaping: wrap in quotes when the value contains a
// comma, quote, or newline; double any embedded quotes.
function csvCell(value) {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function csvRow(cells) {
  return cells.map(csvCell).join(',');
}

// Minimal HTML escaping for values injected into the PDF template.
function htmlEscape(value) {
  const s = value == null ? '' : String(value);
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Resolve a writable cache directory uri (legacy API), tolerating absence.
function legacyCacheDir() {
  return (
    FileSystem.cacheDirectory ||
    FileSystem.documentDirectory ||
    ''
  );
}

// Write a text file to the cache and return its uri. Prefers the new
// (expo-file-system v19) File/Paths API and falls back to the legacy
// writeAsStringAsync so it keeps working across SDK shapes.
async function writeCacheFile(filename, contents) {
  // New object-oriented API.
  try {
    if (FileSystem.File && FileSystem.Paths && FileSystem.Paths.cache) {
      const file = new FileSystem.File(FileSystem.Paths.cache, filename);
      try {
        file.create({ overwrite: true, intermediates: true });
      } catch (e) {
        // create may throw if it already exists without idempotent flag —
        // that's fine, we'll still write below.
      }
      file.write(contents);
      return file.uri;
    }
  } catch (e) {
    // Fall through to legacy path.
  }

  // Legacy API.
  const dir = legacyCacheDir();
  if (!dir || !FileSystem.writeAsStringAsync) {
    throw new Error('No writable file-system directory available');
  }
  const uri = dir + filename;
  await FileSystem.writeAsStringAsync(uri, contents, {
    encoding: FileSystem.EncodingType ? FileSystem.EncodingType.UTF8 : 'utf8',
  });
  return uri;
}

// Open the system share sheet for a file uri. Returns a guarded result.
async function shareFile(uri, mimeType, dialogTitle) {
  try {
    const available =
      typeof Sharing.isAvailableAsync === 'function'
        ? await Sharing.isAvailableAsync()
        : false;
    if (!available) {
      return { ok: false, reason: 'sharing-unavailable' };
    }
    await Sharing.shareAsync(uri, { mimeType, dialogTitle, UTI: undefined });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: 'share-failed' };
  }
}

// ---------------------------------------------------------------------------
// Bilingual labels
// ---------------------------------------------------------------------------

function buildLabels(language) {
  const isTr = language === 'tr';
  return {
    isTr,
    reportTitle: 'GLP-1 Coach',
    subtitle: isTr ? 'Veri Dışa Aktarımı' : 'Data Export',
    generated: isTr ? 'Oluşturulma' : 'Generated',
    weight: isTr ? 'Kilo Kayıtları' : 'Weight Logs',
    doseChanges: isTr ? 'Doz Değişiklikleri' : 'Dose Changes',
    doseLogs: isTr ? 'Doz Kayıtları' : 'Dose Logs',
    protein: isTr ? 'Protein / Öğünler' : 'Protein / Meals',
    profile: isTr ? 'Profil' : 'Profile',
    date: isTr ? 'Tarih' : 'Date',
    weightCol: isTr ? 'Kilo' : 'Weight',
    doseMg: isTr ? 'Doz (mg)' : 'Dose (mg)',
    dose: isTr ? 'Doz' : 'Dose',
    proteinCol: isTr ? 'Protein (g)' : 'Protein (g)',
    field: isTr ? 'Alan' : 'Field',
    value: isTr ? 'Değer' : 'Value',
    noData: isTr ? 'Kayıt yok' : 'No data',
    footer: isTr
      ? 'Bu rapor GLP-1 Coach tarafından oluşturuldu. Tıbbi tavsiye değildir.'
      : 'Generated by GLP-1 Coach. Not medical advice.',
  };
}

// ---------------------------------------------------------------------------
// CSV building
// ---------------------------------------------------------------------------

function buildCsv(payload) {
  const L = buildLabels(payload && payload.language);
  const lines = [];

  // BOM so Excel reads UTF-8 (Turkish chars) correctly.
  const push = (s) => lines.push(s);
  const blank = () => lines.push('');

  push(csvRow([L.reportTitle, L.subtitle]));
  push(csvRow([L.generated, isoDateStamp()]));
  blank();

  // Weight section.
  push(csvRow(['#', L.weight]));
  push(csvRow([L.date, L.weightCol]));
  const weights = safeArray(payload && payload.weightLogs);
  if (weights.length === 0) push(csvRow([L.noData, '']));
  weights.forEach((w) => push(csvRow([fmtDate(w && w.date), fmtNum(w && w.weight)])));
  blank();

  // Dose changes section.
  push(csvRow(['#', L.doseChanges]));
  push(csvRow([L.date, L.doseMg]));
  const doseChanges = safeArray(payload && payload.doseChanges);
  if (doseChanges.length === 0) push(csvRow([L.noData, '']));
  doseChanges.forEach((d) =>
    push(csvRow([fmtDate(d && d.date), fmtNum(d && d.doseMg)]))
  );
  blank();

  // Dose logs section.
  push(csvRow(['#', L.doseLogs]));
  push(csvRow([L.date, L.dose]));
  const doseLogs = safeArray(payload && payload.doseLogs);
  if (doseLogs.length === 0) push(csvRow([L.noData, '']));
  doseLogs.forEach((d) =>
    push(csvRow([fmtDate(d && d.date), fmtNum(d && d.dose)]))
  );
  blank();

  // Meals / protein section. Collect the union of keys (besides date) so any
  // extra meal fields are preserved.
  push(csvRow(['#', L.protein]));
  const meals = safeArray(payload && payload.mealLogs);
  const extraKeys = [];
  meals.forEach((m) => {
    if (m && typeof m === 'object') {
      Object.keys(m).forEach((k) => {
        if (k !== 'date' && extraKeys.indexOf(k) === -1) extraKeys.push(k);
      });
    }
  });
  // Make sure protein leads if present.
  const orderedKeys = extraKeys.sort((a, b) => {
    if (a === 'protein') return -1;
    if (b === 'protein') return 1;
    return a.localeCompare(b);
  });
  push(csvRow([L.date, ...orderedKeys]));
  if (meals.length === 0) push(csvRow([L.noData]));
  meals.forEach((m) => {
    const row = [fmtDate(m && m.date)];
    orderedKeys.forEach((k) => row.push(fmtNum(m ? m[k] : '')));
    push(csvRow(row));
  });
  blank();

  // Profile section (flat key/value).
  push(csvRow(['#', L.profile]));
  push(csvRow([L.field, L.value]));
  const profile = (payload && payload.profile) || {};
  const profileKeys = Object.keys(profile || {});
  if (profileKeys.length === 0) push(csvRow([L.noData, '']));
  profileKeys.forEach((k) => {
    const v = profile[k];
    const flat =
      v != null && typeof v === 'object' ? JSON.stringify(v) : fmtNum(v);
    push(csvRow([k, flat]));
  });

  // Prepend UTF-8 BOM.
  return '﻿' + lines.join('\r\n') + '\r\n';
}

// ---------------------------------------------------------------------------
// PDF (HTML) building
// ---------------------------------------------------------------------------

function tableHtml(headers, rows, emptyLabel) {
  const head = headers.map((h) => `<th>${htmlEscape(h)}</th>`).join('');
  let body;
  if (!rows || rows.length === 0) {
    body = `<tr><td class="empty" colspan="${headers.length}">${htmlEscape(
      emptyLabel
    )}</td></tr>`;
  } else {
    body = rows
      .map(
        (r) =>
          '<tr>' +
          r.map((c) => `<td>${htmlEscape(c)}</td>`).join('') +
          '</tr>'
      )
      .join('');
  }
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function buildHtml(payload) {
  const L = buildLabels(payload && payload.language);

  const weightRows = safeArray(payload && payload.weightLogs).map((w) => [
    fmtDate(w && w.date),
    fmtNum(w && w.weight),
  ]);

  const doseChangeRows = safeArray(payload && payload.doseChanges).map((d) => [
    fmtDate(d && d.date),
    fmtNum(d && d.doseMg),
  ]);

  const doseLogRows = safeArray(payload && payload.doseLogs).map((d) => [
    fmtDate(d && d.date),
    fmtNum(d && d.dose),
  ]);

  const proteinRows = safeArray(payload && payload.mealLogs).map((m) => [
    fmtDate(m && m.date),
    fmtNum(m && m.protein),
  ]);

  const profile = (payload && payload.profile) || {};
  const profileRows = Object.keys(profile || {}).map((k) => {
    const v = profile[k];
    const flat = v != null && typeof v === 'object' ? JSON.stringify(v) : fmtNum(v);
    return [k, flat];
  });

  const section = (title, html) =>
    `<section><h2>${htmlEscape(title)}</h2>${html}</section>`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<style>
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, "Helvetica Neue", Arial, sans-serif;
    color: #1F2430;
    margin: 0;
    padding: 32px 28px 48px;
    font-size: 13px;
    line-height: 1.5;
  }
  header {
    border-bottom: 3px solid #4F46E5;
    padding-bottom: 16px;
    margin-bottom: 24px;
  }
  header h1 {
    color: #4F46E5;
    font-size: 26px;
    margin: 0 0 4px;
    letter-spacing: -0.5px;
  }
  header .subtitle { color: #6B7280; font-size: 14px; margin: 0; }
  header .meta { color: #9AA0AB; font-size: 12px; margin-top: 8px; }
  section { margin-bottom: 28px; page-break-inside: avoid; }
  h2 {
    color: #4F46E5;
    font-size: 16px;
    margin: 0 0 10px;
    padding-bottom: 6px;
    border-bottom: 1px solid #E5E7EB;
  }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th {
    text-align: left;
    background: #EEF0FE;
    color: #4338CA;
    font-weight: 600;
    padding: 8px 10px;
    border-bottom: 2px solid #C7CBF5;
  }
  td { padding: 7px 10px; border-bottom: 1px solid #EEF0F3; }
  tr:nth-child(even) td { background: #FAFBFE; }
  td.empty { color: #9AA0AB; font-style: italic; text-align: center; }
  footer {
    margin-top: 36px;
    padding-top: 14px;
    border-top: 1px solid #E5E7EB;
    color: #9AA0AB;
    font-size: 11px;
    text-align: center;
  }
</style>
</head>
<body>
  <header>
    <h1>${htmlEscape(L.reportTitle)}</h1>
    <p class="subtitle">${htmlEscape(L.subtitle)}</p>
    <p class="meta">${htmlEscape(L.generated)}: ${htmlEscape(isoDateStamp())}</p>
  </header>

  ${section(L.weight, tableHtml([L.date, L.weightCol], weightRows, L.noData))}
  ${section(
    L.doseChanges,
    tableHtml([L.date, L.doseMg], doseChangeRows, L.noData)
  )}
  ${section(L.doseLogs, tableHtml([L.date, L.dose], doseLogRows, L.noData))}
  ${section(L.protein, tableHtml([L.date, L.proteinCol], proteinRows, L.noData))}
  ${section(L.profile, tableHtml([L.field, L.value], profileRows, L.noData))}

  <footer>${htmlEscape(L.footer)}</footer>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function exportAsCsv(payload) {
  try {
    const csv = buildCsv(payload || {});
    const filename = `glp1coach-export-${isoDateStamp()}.csv`;
    const uri = await writeCacheFile(filename, csv);
    return await shareFile(uri, 'text/csv', 'GLP-1 Coach');
  } catch (e) {
    return { ok: false, reason: 'csv-failed' };
  }
}

export async function exportAsPdf(payload) {
  try {
    if (!Print || typeof Print.printToFileAsync !== 'function') {
      return { ok: false, reason: 'print-unavailable' };
    }
    const html = buildHtml(payload || {});
    const { uri } = await Print.printToFileAsync({ html, base64: false });
    if (!uri) return { ok: false, reason: 'print-failed' };
    return await shareFile(uri, 'application/pdf', 'GLP-1 Coach');
  } catch (e) {
    return { ok: false, reason: 'pdf-failed' };
  }
}

export default { exportAsCsv, exportAsPdf };
