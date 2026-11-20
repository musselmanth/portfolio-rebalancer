// Mutual funds only / Mixed portfolio tabs. Each tab keeps its own inputs.
import { $ } from './dom.js';
import { S, M, K, setMode } from './state.js';
import { store } from '../lib/store.js';
import { syncAdorn, setReserve } from './settings.js';
import { renderHold, renderTgt } from './tables.js';
import { renderPresets } from './presets.js';
import { recompute } from './results.js';

export const TAB_VALS = ['cash', 'addCash', 'pending', 'reserve', 'tol', 'presetName', 'afterSells'];
export const tabState = {};
export function stashTab(){
  tabState[M] = {holdings: S.holdings, targets: S.targets, prices: S.prices, csvAccounts: S.csvAccounts,
    acctOpts: $('acctSel').innerHTML, acct: $('acctSel').value, acctShown: !$('acctRow').classList.contains('hidden'),
    status: $('priceStatus').innerHTML, statusCls: $('priceStatus').className,
    vals: Object.fromEntries(TAB_VALS.map(id => [id, $(id).value])), inc: $('incPending').checked,
    reserveMode: $('reserveMode').value, tolMode: $('tolMode').value};
}
export function applyMode(){
  document.body.dataset.mode = M;
  $('tabName').textContent = M === 'etf' ? 'Mixed portfolio' : 'Mutual funds only';
  document.querySelectorAll('.tabs [data-tab]').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === M));
  store.set('rebal.tab', M);
}
export function switchTab(to){
  if (to === M) return;
  stashTab(); setMode(to); const t = tabState[M];
  if (t){
    Object.assign(S, {holdings: t.holdings, targets: t.targets, prices: t.prices, csvAccounts: t.csvAccounts});
    $('acctSel').innerHTML = t.acctOpts; $('acctSel').value = t.acct; $('acctRow').classList.toggle('hidden', !t.acctShown);
    $('priceStatus').innerHTML = t.status; $('priceStatus').className = t.statusCls;
    TAB_VALS.forEach(id => $(id).value = t.vals[id]); $('incPending').checked = t.inc;
    $('reserveMode').value = t.reserveMode; $('tolMode').value = t.tolMode;
  } else {
    S.holdings = [{sym: '', shares: null, value: null}];
    S.targets = store.get(K('lastTargets'), []); if (!S.targets.length) S.targets = [{sym: '', pct: null}];
    S.prices = {}; S.csvAccounts = null;
    $('acctSel').innerHTML = ''; $('acctRow').classList.add('hidden'); $('priceStatus').textContent = '';
    TAB_VALS.forEach(id => $(id).value = ''); $('incPending').checked = false;
    setReserve(store.get(K('reserve'), null)); $('tolMode').value = store.get(K('tolMode'), 'usd');
  }
  syncAdorn('reserve', $('reserveMode').value); syncAdorn('tol', $('tolMode').value);
  applyMode(); renderHold(); renderTgt(); renderPresets(); recompute();
}

export function initTabs(){
  document.querySelectorAll('.tabs [data-tab]').forEach(b => b.onclick = () => switchTab(b.dataset.tab));
}
