// Loading a Fidelity positions CSV into the holdings table.
import { $ } from './dom.js';
import { S } from './state.js';
import { esc } from '../lib/format.js';
import { parseFidelity } from '../lib/csv.js';
import { renderHold, renderTgt } from './tables.js';
import { recompute } from './results.js';

export function applyAccount(key){
  const a = S.csvAccounts.get(key);
  S.holdings = a.positions.map(p => { if (p.price) S.prices[p.sym] = {price: p.price, src: 'Fidelity CSV'}; return {sym: p.sym, shares: p.price ? p.shares : null, value: p.value}; });
  if (!S.holdings.length) S.holdings = [{sym: '', shares: null, value: null}];
  $('cash').value = a.cash ? a.cash.toFixed(2) : '';
  $('pending').value = a.pending ? a.pending.toFixed(2) : '';
  renderHold(); renderTgt(); recompute();
}
export async function loadCSVFile(f){
  try {
    S.csvAccounts = parseFidelity(await f.text());
    const keys = [...S.csvAccounts.keys()];
    $('acctSel').innerHTML = keys.map(k => `<option>${esc(k)}</option>`).join('');
    $('acctRow').classList.toggle('hidden', keys.length < 2);
    applyAccount(keys[0]);
    $('priceStatus').textContent = `Loaded ${f.name}.`; $('priceStatus').className = 'status good';
  } catch(err){ $('priceStatus').textContent = 'CSV: ' + err.message; $('priceStatus').className = 'status bad'; }
}

export function initCsvUpload(){
  $('csvFile').onchange = e => { if (e.target.files[0]) loadCSVFile(e.target.files[0]); e.target.value = ''; };
  $('acctSel').onchange = () => applyAccount($('acctSel').value);
  const drop = $('drop');
  drop.addEventListener('dragover', e => { e.preventDefault(); });
  drop.addEventListener('drop', e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) loadCSVFile(f); });
}
