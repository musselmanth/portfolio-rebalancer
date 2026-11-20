// Holdings and target tables: rendering and editing.
import { $ } from './dom.js';
import { S, M, K, priceOf, currentHoldings } from './state.js';
import { store } from '../lib/store.js';
import { num, esc } from '../lib/format.js';
import { plan, isMFSym } from '../lib/planner.js';
import { addClears } from './clears.js';
import { fit } from './fit.js';
import { recompute } from './results.js';

export function renderHold(){
  $('holdBody').innerHTML = S.holdings.map((h, i) => {
    const p = priceOf(h.sym), computed = h.shares != null && p;
    const val = computed ? (h.shares * p).toFixed(2) : (h.value ?? '');
    return `<tr><td data-l="Symbol"><input class="sym" autocapitalize="characters" autocomplete="off" autocorrect="off" spellcheck="false" data-t="h" data-i="${i}" data-f="sym" data-clr value="${esc(h.sym)}" aria-label="Symbol"></td>
      <td data-l="Shares"><input class="n" inputmode="decimal" data-t="h" data-i="${i}" data-f="shares" data-clr="focus" value="${h.shares ?? ''}" aria-label="Shares"></td>
      <td data-l="Price"><span class="adorn" data-u="$"><input class="n" inputmode="decimal" data-t="h" data-i="${i}" data-f="price" data-clr="focus" value="${p ?? ''}" aria-label="Price"></span></td>
      <td data-l="Value"><span class="adorn" data-u="$"><input class="n" inputmode="decimal" data-t="h" data-i="${i}" data-f="value" data-clr="focus" value="${val}" ${computed ? 'disabled' : ''} aria-label="Value"></span></td>
      <td class="del"><button class="x" data-del="h" data-i="${i}" aria-label="Remove row"><svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg></button></td></tr>`;
  }).join('');
  addClears();
}
export function renderTgt(){
  $('tgtBody').innerHTML = S.targets.map((t, i) => `<tr>
    <td><input class="sym" autocapitalize="characters" autocomplete="off" autocorrect="off" spellcheck="false" data-t="t" data-i="${i}" data-f="sym" data-clr value="${esc(t.sym)}" aria-label="Symbol"></td>
    <td><span class="adorn suf" data-u="%"><input class="n" inputmode="decimal" data-t="t" data-i="${i}" data-f="pct" data-clr value="${t.pct ?? ''}" aria-label="Target percent"></span></td>
    <td><button class="x" data-del="t" data-i="${i}" aria-label="Remove row"><svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg></button></td></tr>`).join('');
  addClears();
}

export function onField(e){
  const el = e.target; if (!el.dataset.t) return;
  const arr = el.dataset.t === 'h' ? S.holdings : S.targets, row = arr[+el.dataset.i], f = el.dataset.f;
  if (f === 'sym'){
    const up = el.value.toUpperCase();
    if (up !== el.value){ const a = el.selectionStart, b = el.selectionEnd; el.value = up; try { el.setSelectionRange(a, b); } catch(_){} }
    row.sym = up.trim();
  }
  else if (f === 'price'){ const sym = (row.sym || '').toUpperCase(); if (sym){ const v = num(el.value); if (v) S.prices[sym] = {price: v, src: 'manual'}; else delete S.prices[sym]; } }
  else row[f] = num(el.value);
  if (el.dataset.t === 't') store.set(K('lastTargets'), S.targets);
  recompute();
}

export function syncHoldRow(i){
  const h = S.holdings[i], tr = $('holdBody').rows[i]; if (!h || !tr) return;
  const p = priceOf(h.sym), computed = h.shares != null && p;
  const pe = tr.querySelector('[data-f=price]'), ve = tr.querySelector('[data-f=value]');
  if (document.activeElement !== pe) pe.value = p ?? '';
  if (computed){ ve.value = (h.shares * p).toFixed(2); ve.disabled = true; }
  else if (ve.disabled){ ve.disabled = false; ve.value = h.value ?? ''; }
  fit(ve); fit(pe);
}

export function flagSyms(){
  document.querySelectorAll('input[data-f=sym]').forEach(el => { const v = el.value.trim().toUpperCase(); el.classList.toggle('invalid', M !== 'etf' && !!v && !isMFSym(v) && el !== document.activeElement); });
}

export function initTables(){
  document.addEventListener('input', onField);
  document.addEventListener('input', e => { if (e.target.dataset.t === 'h') syncHoldRow(+e.target.dataset.i); });
  document.addEventListener('click', e => {
    const d = e.target.closest('[data-del]'); if (!d) return;
    const arr = d.dataset.del === 'h' ? S.holdings : S.targets; arr.splice(+d.dataset.i, 1);
    if (d.dataset.del === 't') store.set(K('lastTargets'), S.targets);
    renderHold(); renderTgt(); recompute();
  });
  $('addHold').onclick = () => { S.holdings.push({sym: '', shares: null, value: null}); renderHold(); };
  $('addTgt').onclick = () => { S.targets.push({sym: '', pct: null}); renderTgt(); };
  $('fromCur').onclick = () => {
    const r = plan({holdings: currentHoldings(), targets: [{sym: 'X', pct: 100}], cash: 0, units: 'dollars'});
    const funds = r.rows.filter(x => x.kind === 'fund' && x.cur > 0 && x.sym !== 'X');
    const tot = funds.reduce((s, x) => s + x.cur, 0); if (!tot) return;
    S.targets = funds.map(x => ({sym: x.sym, pct: Math.round(x.cur / tot * 10000) / 100}));
    const diff = Math.round((100 - S.targets.reduce((s, t) => s + t.pct, 0)) * 100) / 100;
    if (S.targets.length) S.targets[0].pct = Math.round((S.targets[0].pct + diff) * 100) / 100;
    store.set(K('lastTargets'), S.targets); renderTgt(); recompute();
  };
  document.addEventListener('focusout', e => { if (e.target.dataset && e.target.dataset.f === 'sym') setTimeout(flagSyms, 0); });
}
