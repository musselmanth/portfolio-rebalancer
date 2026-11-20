// App state. M is the active tab ('mf' or 'etf'); importers see updates live.
import { store } from '../lib/store.js';

export let M = store.get('rebal.tab', 'mf') === 'etf' ? 'etf' : 'mf';

export const setMode = m => { M = m; };

export const K = k => (M === 'etf' ? 'rebal.etf.' : 'rebal.') + k;
export const S = {holdings: [], targets: store.get(K('lastTargets'), []), prices: {}, csvAccounts: null, lastPlan: null};
if (!S.targets.length) S.targets = [{sym: '', pct: null}];
if (!S.holdings.length) S.holdings = [{sym: '', shares: null, value: null}];
export const priceOf = sym => { const p = S.prices[(sym || '').trim().toUpperCase()]; return p ? p.price : null; };

export function currentHoldings(){ return S.holdings.map(h => ({sym: h.sym, shares: h.shares, price: priceOf(h.sym), value: h.value})); }
