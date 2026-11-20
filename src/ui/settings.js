// Cash, reserve, tolerance and option controls.
import { $ } from './dom.js';
import { K } from './state.js';
import { store } from '../lib/store.js';
import { num } from '../lib/format.js';
import { recompute } from './results.js';

export const syncAdorn = (id, mode) => { const a = $(id + 'Adorn'); a.dataset.u = mode === 'pct' ? '%' : '$'; a.classList.toggle('suf', mode === 'pct'); };
export const getReserve = () => ({mode: $('reserveMode').value, value: num($('reserve').value) || 0});
export const setReserve = r => { r = r || {mode: 'usd', value: 0}; $('reserveMode').value = r.mode === 'pct' ? 'pct' : 'usd'; $('reserve').value = r.value || ''; syncAdorn('reserve', $('reserveMode').value); store.set(K('reserve'), getReserve()); };

export function initSettings(){
  ['cash', 'addCash', 'pending', 'tol'].forEach(id => $(id).addEventListener('input', recompute));
  setReserve(store.get(K('reserve'), null));
  $('reserve').addEventListener('input', () => { store.set(K('reserve'), getReserve()); recompute(); });
  $('reserveMode').onchange = () => { syncAdorn('reserve', $('reserveMode').value); store.set(K('reserve'), getReserve()); recompute(); };
  $('tolMode').value = store.get(K('tolMode'), 'usd'); syncAdorn('tol', $('tolMode').value);
  $('tolMode').onchange = () => { syncAdorn('tol', $('tolMode').value); store.set(K('tolMode'), $('tolMode').value); recompute(); };
  $('incPending').onchange = recompute;
  $('units').onchange = () => { store.set('rebal.units', $('units').value); recompute(); };
  $('units').value = store.get('rebal.units', 'shares');
  $('method').value = store.get('rebal.etf.method', 'full');
  $('sellUnits').value = store.get('rebal.etf.sellUnits', 'dollars');
  $('exch').checked = store.get('rebal.etf.exch', true);
  if (store.get('rebal.etf.whole', false)){ store.set('rebal.etf.sellUnits', 'whole'); store.set('rebal.etf.whole', false); $('sellUnits').value = 'whole'; }
  $('cushion').value = store.get('rebal.etf.cushion', 1);
  const syncWhole = () => $('cushRow').classList.toggle('hidden', $('sellUnits').value !== 'whole');
  syncWhole();
  $('cushion').addEventListener('input', () => { store.set('rebal.etf.cushion', num($('cushion').value) ?? ''); recompute(); });
  $('exch').onchange = () => { store.set('rebal.etf.exch', $('exch').checked); recompute(); };
  $('mfUnits').value = store.get('rebal.etf.mfUnits', 'shares');
  $('mfUnits').onchange = () => { store.set('rebal.etf.mfUnits', $('mfUnits').value); recompute(); };
  $('method').onchange = () => { store.set('rebal.etf.method', $('method').value); recompute(); };
  $('sellUnits').onchange = () => { store.set('rebal.etf.sellUnits', $('sellUnits').value); syncWhole(); recompute(); };
  $('afterSells').addEventListener('input', recompute);
}
