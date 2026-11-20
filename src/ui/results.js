// Runs the planner on the current inputs and renders orders and the before/after table.
import { $, download, copyText } from './dom.js';
import { S, M, currentHoldings } from './state.js';
import { num, usd, pct, esc } from '../lib/format.js';
import { plan } from '../lib/planner.js';
import { getReserve } from './settings.js';
import { flagSyms } from './tables.js';
import { fitAll } from './fit.js';

export function recompute(){
  const cash = (num($('cash').value) || 0) + (num($('addCash').value) || 0) + ($('incPending').checked ? (num($('pending').value) || 0) : 0);
  const tsum = S.targets.reduce((s, t) => s + (t.pct || 0), 0);
  $('pctTotal').textContent = `${M === 'etf' ? 'Total' : 'Funds total'} ${+tsum.toFixed(3)}%`;
  $('pctTotal').className = 'status ' + (Math.abs(tsum - 100) < 0.001 ? 'good' : 'bad');
  const r = plan({holdings: currentHoldings(), targets: S.targets, cash, units: $('units').value, mode: M, method: $('method').value, sellUnits: $('sellUnits').value, exch: $('exch').checked, mfUnits: $('mfUnits').value, whole: $('sellUnits').value === 'whole', cushion: num($('cushion').value) || 0, afterSells: M === 'etf' ? num($('afterSells').value) : null, tol: num($('tol').value) || 0, tolMode: $('tolMode').value, reserve: getReserve()});
  S.lastPlan = r;
  flagSyms();
  $('mbarText').textContent = r.errors.length ? 'Fix inputs to see orders' : r.orders.length ? `${r.orders.length} order${r.orders.length > 1 ? 's' : ''} · ${usd(r.total)}` : 'Already on target';
  $('sTotal').textContent = r.total > 0 ? usd(r.total) : '—';
  $('sCount').textContent = r.errors.length ? '—' : r.orders.length;
  $('sMoved').textContent = r.errors.length ? '—' : usd(r.orders.reduce((s, o) => s + o.c, 0));
  $('msgs').innerHTML = r.errors.map(m => `<li class="bad">${esc(m)}</li>`).join('') + (r.errors.length ? '' : (r.warns || []).map(m => `<li class="warnline">${esc(m)}</li>`).join(''));
  $('clearCopied').disabled = true;
  $('tapHint').classList.toggle('hidden', !!r.errors.length || !r.orders.length);
  const chip = (label, val) => `<button class="chip" data-copy="${esc(val)}" aria-label="Copy ${label} ${esc(val)}"><small><span>${label}</span><svg class="ci ci-copy" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg><svg class="ci ci-ok" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></small><span class="cv">${esc(val)}</span></button>`;
  const card = o => {
    const cls = o.type === 'Buy' ? 'buy' : o.type === 'Sell' ? 'sell' : '';
    const dollars = (o.c / 100).toFixed(2);
    const amt = o.unit === 'all' ? (o.shares ? chip('All shares', o.shares.toFixed(3)) : `<button class="chip" disabled><small>Shares</small>Sell all</button>`)
      : o.unit === 'wshares' ? chip('Shares', String(o.shares)) + chip('Limit price', o.limit.toFixed(2))
      : o.unit === 'shares' ? chip('Shares', o.whole ? String(o.shares) : o.shares.toFixed(3)) : chip('Dollars', dollars);
    const syms = o.type === 'Buy' ? chip('Buy', o.to) : o.type === 'Sell' ? chip('Sell', o.from) : chip('Sell', o.from) + chip('Buy', o.to);
    return `<li><div class="ohead"><span class="otype ${cls}">${o.type}</span><span>≈ ${usd(o.c)}</span></div><div class="chips">${syms}${amt}</div>${o.note ? `<p class="onote">${esc(o.note)}</p>` : ''}</li>`;
};
  const empty = '<li class="empty" style="display:block">Already on target. No orders needed.</li>';
  const mixed = M === 'etf' && !r.errors.length;
  const sells = mixed ? r.sells : [], mfo = mixed ? r.mfo : [], buys = mixed ? r.buys : [];
  $('orders').innerHTML = r.errors.length ? '' : !r.orders.length ? empty : mixed ? sells.map(card).join('') : r.orders.map(card).join('');
  $('orders2').innerHTML = mfo.map(card).join('');
  $('orders3').innerHTML = buys.map(card).join('');
  let step = 0;
  [['ph1', sells], ['ph2', mfo], ['ph3', buys]].forEach(([id, arr]) => { $(id).classList.toggle('hidden', !arr.length); if (arr.length) $(id).querySelector('span').textContent = ++step; });
  $('ph2note').classList.toggle('hidden', !mfo.length);
  $('ph3note').classList.toggle('hidden', !(mixed && r.nextDay));
  const showLeft = mixed && r.whole && buys.length;
  $('ph3left').classList.toggle('hidden', !showLeft);
  if (showLeft) $('ph3left').innerHTML = `Whole shares with limit orders. Estimated cash left over: <b>${usd(r.leftover || 0)}</b>.` + (r.cushHeld ? ` Even if every buy fills at its limit price (up to ${usd(r.cushHeld)} more than today's prices), the total stays within your cash.` : '');
  $('afterBlock').classList.toggle('hidden', !(M === 'etf' && $('method').value === 'full' && (buys.length && (sells.length || mfo.length) || num($('afterSells').value) != null)));
  $('afterNote').classList.toggle('hidden', !r.scaled);
  $('allocBody').innerHTML = r.errors.length ? '' : r.rows.map(x => `<tr>
    <td>${x.kind === 'cash' ? 'Cash' : esc(x.sym)}</td><td class="num wide">${usd(x.cur)}</td><td class="num">${pct(x.cur / r.total)}</td>
    <td class="num">${pct(x.tgt / r.total)}</td><td class="num wide">${x.skipped ? 'within tolerance' : x.delta ? (x.delta > 0 ? '+' : '') + usd(x.delta) : '—'}</td>
    <td class="num">${pct(x.after / r.total)}</td></tr>`).join('');
  fitAll();
}

export function ordersText(){
  const r = S.lastPlan; if (!r || r.errors.length) return '';
  return r.orders.map((o, i) => {
    const amt = o.unit === 'all' ? 'ALL shares' : o.unit === 'wshares' ? `${o.shares} share${o.shares === 1 ? '' : 's'}, limit $${o.limit.toFixed(2)}` : o.unit === 'shares' ? (o.whole ? `${o.shares} share${o.shares === 1 ? '' : 's'}` : `${o.shares.toFixed(3)} shares`) : usd(o.c);
    const what = o.type === 'Buy' ? `Buy ${o.to} from cash` : o.type === 'Sell' ? `Sell ${o.from} to cash` : `Exchange ${o.from} -> ${o.to}`;
    return `${i + 1}. ${what}: ${amt}${o.unit !== 'dollars' ? ` (~${usd(o.c)})` : ''}`;
  }).join('\n');
}

export function initResults(){
  $('copyOrders').onclick = async () => {
    const t = ordersText(); if (!t) return;
    try { await navigator.clipboard.writeText(t); $('copyMsg').textContent = 'Copied.'; }
    catch(e){ const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); $('copyMsg').textContent = 'Copied.'; } catch(_){ $('copyMsg').textContent = 'Copy failed.'; } ta.remove(); }
  };
  $('dlOrders').onclick = () => {
    const r = S.lastPlan; if (!r || r.errors.length) return;
    const lines = ['Order,Type,From,To,Shares,All shares,Dollars,Limit price,Est. value'];
    r.orders.forEach((o, i) => lines.push([i + 1, o.type, o.from, o.to, o.unit === 'wshares' ? o.shares : o.unit === 'shares' ? (o.whole ? o.shares : o.shares.toFixed(3)) : (o.unit === 'all' && o.shares ? o.shares.toFixed(3) : ''), o.unit === 'all' ? 'yes' : '', o.unit === 'dollars' ? (o.c / 100).toFixed(2) : '', o.limit ? o.limit.toFixed(2) : '', (o.c / 100).toFixed(2)].join(',')));
    download('rebalance-orders.csv', lines.join('\n'), 'text/csv');
  };
  document.addEventListener('click', async e => {
    const c = e.target.closest('.chip[data-copy]'); if (!c) return;
    if (await copyText(c.dataset.copy)){ c.classList.add('used'); $('clearCopied').disabled = false; }
  });
  $('clearCopied').onclick = () => { document.querySelectorAll('.chip.used').forEach(c => c.classList.remove('used')); $('clearCopied').disabled = true; };
}
