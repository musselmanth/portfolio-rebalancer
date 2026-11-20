// CSV parsing, including Fidelity's positions export.
import { num } from './format.js';

export function parseCSV(text){
  text = text.replace(/^\uFEFF/, '');
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++){
    const ch = text[i];
    if (q){ if (ch === '"'){ if (text[i + 1] === '"'){ cell += '"'; i++; } else q = false; } else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === ','){ row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r'){ if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length){ row.push(cell); rows.push(row); }
  return rows;
}
export const CORE_MM = new Set(['SPAXX', 'FDRXX', 'FZFXX', 'SPRXX', 'FCASH', 'CORE']);
export function parseFidelity(text){
  const rows = parseCSV(text);
  const hi = rows.findIndex(r => r.some(c => /^symbol$/i.test(c.trim())) && r.some(c => /quantity|current value/i.test(c)));
  if (hi < 0) throw new Error('Could not find a header row with "Symbol".');
  const head = rows[hi].map(c => c.trim().toLowerCase());
  const col = re => head.findIndex(h => re.test(h));
  const cNum = col(/^account number/), cName = col(/^account name/), cSym = col(/^symbol$/), cDesc = col(/^description/),
        cQty = col(/^quantity/), cPx = col(/^last price$/), cVal = col(/^current value/);
  const accts = new Map();
  for (const r of rows.slice(hi + 1)){
    if (r.length < 4) continue;
    const sym = (r[cSym] || '').trim(), desc = cDesc >= 0 ? r[cDesc] || '' : '';
    if (!sym) continue;
    const key = [cNum >= 0 ? r[cNum] : '', cName >= 0 ? r[cName] : ''].filter(Boolean).join(' – ') || 'Account';
    if (!accts.has(key)) accts.set(key, {cash: 0, pending: 0, positions: []});
    const a = accts.get(key);
    let val = cVal >= 0 ? num(r[cVal]) : null;
    if (/pending activity/i.test(sym + ' ' + desc)){
      if (val == null) for (let k = cSym + 1; k < r.length; k++){ const v = num(r[k]); if (v != null){ val = v; break; } }
      a.pending += val || 0;
    } else if (/\*\*$/.test(sym) || CORE_MM.has(sym.toUpperCase()) || (/money market|cash reserves/i.test(desc) && num(r[cPx]) === 1)) a.cash += val || 0;
    else a.positions.push({sym: sym.replace(/\*+$/, '').toUpperCase(), shares: cQty >= 0 ? num(r[cQty]) : null, price: cPx >= 0 ? num(r[cPx]) : null, value: val});
  }
  if (!accts.size) throw new Error('No positions found.');
  return accts;
}
