// Saved target presets, plus JSON/CSV import and export.
import { $, download } from './dom.js';
import { S, K } from './state.js';
import { store } from '../lib/store.js';
import { num, esc } from '../lib/format.js';
import { parseCSV } from '../lib/csv.js';
import { getReserve, setReserve } from './settings.js';
import { renderTgt } from './tables.js';
import { recompute } from './results.js';

export function renderPresets(){
  const p = store.get(K('presets'), {});
  const names = Object.keys(p).sort();
  $('presetSel').innerHTML = names.length ? names.map(n => `<option>${esc(n)}</option>`).join('') : '<option value="">None saved</option>';
  $('presetCount').textContent = names.length ? `${names.length} saved` : 'None saved yet';
  $('loadPreset').disabled = $('delPreset').disabled = !names.length;
  if ($('delConfirm')) $('delConfirm').classList.add('hidden');
}

export const cleanTargets = () => S.targets.filter(t => t.sym && t.pct).map(t => ({symbol: t.sym, percent: t.pct}));
export const presetMsg = t => { $('presetMsg').textContent = t; clearTimeout(presetMsg.t); presetMsg.t = setTimeout(() => $('presetMsg').textContent = '', 3500); };

export function initPresets(){
  $('savePreset').onclick = () => {
    const name = $('presetName').value.trim();
    if (!name){ presetMsg(''); $('presetName').focus(); $('presetName').placeholder = 'Type a name first'; return; }
    if (!cleanTargets().length){ presetMsg('Add target percentages before saving.'); return; }
    const p = store.get(K('presets'), {}), existed = !!p[name];
    p[name] = {targets: cleanTargets(), reserve: getReserve()}; store.set(K('presets'), p); renderPresets(); $('presetSel').value = name;
    presetMsg(existed ? `Updated "${name}".` : `Saved "${name}".`);
  };
  $('loadPreset').onclick = () => {
    const p = store.get(K('presets'), {}), name = $('presetSel').value; if (!p[name]) return;
    const pr = Array.isArray(p[name]) ? {targets: p[name]} : p[name];
    S.targets = pr.targets.map(t => ({sym: t.symbol, pct: t.percent})); setReserve(pr.reserve); $('presetName').value = name;
    store.set(K('lastTargets'), S.targets); renderTgt(); recompute(); presetMsg(`Loaded "${name}".`);
  };
  $('delPreset').onclick = () => { const n = $('presetSel').value; if (!n) return; $('delName').textContent = `"${n}"`; $('delConfirm').classList.remove('hidden'); };
  $('delNo').onclick = () => $('delConfirm').classList.add('hidden');
  $('delYes').onclick = () => {
    const n = $('presetSel').value, p = store.get(K('presets'), {}); delete p[n]; store.set(K('presets'), p);
    $('delConfirm').classList.add('hidden'); renderPresets(); presetMsg(`Deleted "${n}".`);
  };
  $('presetSel').addEventListener('change', () => $('delConfirm').classList.add('hidden'));
  $('presetBox').addEventListener('toggle', () => store.set('rebal.presetsOpen', $('presetBox').open));
  $('presetBox').open = store.get('rebal.presetsOpen', false);
  $('exportTgt').onclick = () => {
    const name = $('presetName').value.trim() || 'target-portfolio';
    download(name.replace(/[^\w-]+/g, '_') + '.json', JSON.stringify({name, targets: cleanTargets(), cashReserve: getReserve()}, null, 2), 'application/json');
  };
  $('importTgt').onchange = async e => {
    const f = e.target.files[0]; if (!f) return; const text = await f.text(); let list;
    try {
      const j = JSON.parse(text); const arr = Array.isArray(j) ? j : j.targets || [];
      list = arr.map(t => ({sym: String(t.symbol || t.sym || '').toUpperCase(), pct: num(t.percent ?? t.pct)}));
      if (j.name) $('presetName').value = j.name;
      if (j.cashReserve) setReserve(j.cashReserve);
    } catch(_){
      list = parseCSV(text).map(r => ({sym: (r[0] || '').trim().toUpperCase(), pct: num(r[1])})).filter(t => t.sym && t.pct != null);
    }
    if (list.length){ S.targets = list; store.set(K('lastTargets'), S.targets); renderTgt(); recompute(); }
    e.target.value = '';
  };
}
