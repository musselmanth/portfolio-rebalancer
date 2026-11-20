// Core rebalancing logic. Pure: no DOM, no storage. All money is in integer cents.
import { usd } from './format.js';

export const C = x => Math.round(x * 100);
export const isMFSym = sym => /^[A-Z]{4}X$/.test(sym);

export function maxZeroGroups(vals){
  const n = vals.length;
  if (n === 0) return [];
  if (n > 20) return [vals.map((_, i) => i)];
  const N = 1 << n, sum = new Float64Array(N), dp = new Int8Array(N);
  for (let m = 1; m < N; m++){ const b = m & -m; sum[m] = sum[m ^ b] + vals[31 - Math.clz32(b)]; }
  for (let m = 1; m < N; m++){
    let best = -1;
    for (let k = m; k; k &= k - 1){ const v = dp[m ^ (k & -k)]; if (v > best) best = v; }
    dp[m] = best + (sum[m] === 0 ? 1 : 0);
  }
  const order = []; let m = N - 1;
  while (m){
    const z = sum[m] === 0 ? 1 : 0;
    for (let k = m; k; k &= k - 1){ const b = k & -k; if (dp[m ^ b] === dp[m] - z){ order.push(31 - Math.clz32(b)); m ^= b; break; } }
  }
  order.reverse();
  const groups = []; let cur = [], acc = 0;
  for (const i of order){ cur.push(i); acc += vals[i]; if (acc === 0){ groups.push(cur); cur = []; } }
  if (cur.length) groups.push(cur);
  return groups;
}

export function settle(nodes, idx){
  const src = idx.filter(i => nodes[i].delta < 0).map(i => ({i, a: -nodes[i].delta})).sort((a, b) => b.a - a.a);
  const snk = idx.filter(i => nodes[i].delta > 0).map(i => ({i, a: nodes[i].delta})).sort((a, b) => b.a - a.a);
  const out = []; let s = 0, k = 0;
  while (s < src.length && k < snk.length){
    const amt = Math.min(src[s].a, snk[k].a);
    if (amt > 0) out.push({from: src[s].i, to: snk[k].i, c: amt});
    src[s].a -= amt; snk[k].a -= amt;
    if (src[s].a === 0) s++;
    if (snk[k].a === 0) k++;
  }
  return out;
}

// Current value of each holding in cents, combining duplicate symbols. Same valuation rule as plan():
// shares × price when both are known, otherwise the dollar value. Holdings with neither are skipped.
export function currentValues(holdings){
  const V = new Map();
  for (const h of holdings){
    const sym = (h.sym || '').trim().toUpperCase(); if (!sym) continue;
    const val = h.shares != null && h.price ? h.shares * h.price : h.value;
    if (val == null) continue;
    V.set(sym, (V.get(sym) || 0) + C(val));
  }
  return V;
}

// input: {holdings:[{sym,shares,price,value}], targets:[{sym,pct}], cash, units, tol}
export function plan(inp){
  const errors = [], notes = [];
  const H = new Map();
  for (const h of inp.holdings){
    const sym = (h.sym || '').trim().toUpperCase(); if (!sym) continue;
    let val = null;
    if (h.shares != null && h.price) val = h.shares * h.price;
    else if (h.value != null) val = h.value;
    if (val == null){ errors.push(`${sym}: needs a price or a dollar value.`); continue; }
    const e = H.get(sym) || {sym, cur: 0, shares: 0, sharesKnown: true, price: h.price || null};
    e.cur += C(val);
    if (h.shares != null && h.price) e.shares += h.shares; else e.sharesKnown = false;
    if (h.price) e.price = h.price;
    H.set(sym, e);
  }
  const T = new Map(); let pctSum = 0;
  for (const t of inp.targets){
    const sym = (t.sym || '').trim().toUpperCase(); if (!sym || !t.pct) continue;
    T.set(sym, (T.get(sym) || 0) + t.pct); pctSum += t.pct;
  }
  if (!T.size) errors.push('Add at least one target fund.');
  else if (Math.abs(pctSum - 100) > 0.001) errors.push(`Fund percentages add up to ${+pctSum.toFixed(3)}%, not 100%.`);
  if (inp.mode !== 'etf'){
    const bad = [...new Set([...H.keys(), ...T.keys()].filter(sym => !isMFSym(sym)))];
    if (bad.length) errors.push(`${bad.join(', ')} ${bad.length > 1 ? "aren't mutual fund symbols" : "isn't a mutual fund symbol"}. Mutual fund tickers are five letters ending in X, like FXAIX. For stocks or ETFs, use the Mixed portfolio tab.`);
  }
  const cashC = C(inp.cash || 0);
  let total = cashC; for (const e of H.values()) total += e.cur;
  if (total <= 0) errors.push('Portfolio value must be above zero.');
  const rv = inp.reserve || {mode: 'usd', value: 0};
  const reserveC = Math.max(0, rv.mode === 'pct' ? Math.round(total * (rv.value || 0) / 100) : C(rv.value || 0));
  if (total > 0 && reserveC > total) errors.push('Cash to keep is more than the whole portfolio.');
  if (errors.length) return {errors, notes, orders: [], rows: [], total};
  const investable = total - reserveC;

  // target dollars in cents, rounding remainder to the largest weight
  const tgt = new Map(); let assigned = 0, big = null;
  for (const [sym, p] of T){ const v = Math.floor(investable * p / 100); tgt.set(sym, v); assigned += v; if (!big || p > T.get(big)) big = sym; }
  tgt.set(big, tgt.get(big) + (investable - assigned));

  const nodes = [];
  const syms = new Set([...H.keys(), ...T.keys()]);
  for (const sym of syms){
    const h = H.get(sym), cur = h ? h.cur : 0, t = tgt.get(sym) || 0;
    nodes.push({sym, kind: 'fund', cur, tgt: t, delta: t - cur, shares: h ? h.shares : 0, sharesKnown: h ? h.sharesKnown : false, price: h ? h.price : null});
  }
  if (cashC || reserveC) nodes.push({sym: 'CASH', kind: 'cash', cur: cashC, tgt: reserveC, delta: reserveC - cashC});

  // tolerance: leave near-target funds alone, push residual to the biggest mover
  const tolC = inp.tolMode === 'pct' ? Math.round(total * (inp.tol || 0) / 100) : C(inp.tol || 0);
  const etf = inp.mode === 'etf', buyOnly = etf && inp.method === 'buyonly';
  if (tolC > 0 && !buyOnly){
    let resid = 0;
    for (const n of nodes) if (n.kind === 'fund' && n.cur > 0 && n.tgt > 0 && n.delta && Math.abs(n.delta) < tolC){ resid += n.delta; n.delta = 0; n.skipped = true; }
    if (resid){
      const cand = nodes.filter(n => n.kind === 'fund' && n.tgt > 0).sort((a, b) => (b.delta > 0) - (a.delta > 0) || Math.abs(b.delta) - Math.abs(a.delta) || b.tgt - a.tgt)[0];
      cand.delta += resid; if (cand.skipped && cand.delta) cand.skipped = false;
    }
  }

  if (etf){
    const funds = nodes.filter(n => n.kind === 'fund'), cashN = nodes.find(n => n.kind === 'cash');
    for (const n of funds) n.mf = isMFSym(n.sym);
    if (buyOnly){
      for (const n of funds) n.delta = 0;
      const avail = cashC - reserveC, tf = funds.filter(n => n.tgt > 0);
      if (avail <= 0){ errors.push('There is no cash above the amount to keep. Buy only never sells, so add cash or new money to invest.'); return {errors, notes, warns: [], orders: [], sells: [], buys: [], rows: [], total}; }
      const f = k => tf.reduce((a, n) => a + Math.max(0, k * n.tgt - n.cur), 0);
      let lo = 0, hi = (avail + tf.reduce((a, n) => a + n.cur, 0)) / tf.reduce((a, n) => a + n.tgt, 0) + 1;
      for (let i = 0; i < 100; i++){ const mid = (lo + hi) / 2; if (f(mid) < avail) lo = mid; else hi = mid; }
      for (const n of tf) n.delta = Math.floor(Math.max(0, hi * n.tgt - n.cur));
      const fix = () => { const sum = tf.reduce((a, n) => a + n.delta, 0); const big = tf.reduce((a, n) => n.delta > a.delta ? n : a, tf[0]); big.delta += avail - sum; };
      fix();
      if (tolC > 0){
        const keep = tf.map(n => n.delta);
        for (const n of tf) if (n.delta > 0 && n.delta < tolC){ n.delta = 0; n.skipped = true; }
        if (tf.some(n => n.delta > 0)) fix(); else tf.forEach((n, i) => { n.delta = keep[i]; n.skipped = false; });
      }
      if (cashN) cashN.delta = -avail;
    }
    const sells = [], buys = [], mfo = [], warns = [];
    const whole = !!inp.whole, cush = Math.max(0, inp.cushion || 0) / 100, wants = [];
    for (const n of funds){
      if (n.mf) continue;
      if (whole && n.delta !== 0){
        if (n.delta < 0){
          if (n.tgt === 0){ sells.push({type: 'Sell', from: n.sym, to: 'CASH', c: -n.delta, unit: 'all', shares: n.sharesKnown ? Math.round(n.shares * 1000) / 1000 : null}); continue; }
          if (!n.price || !n.sharesKnown){ errors.push(`${n.sym}: whole-share mode needs a share count and price for this holding.`); continue; }
          let sh = Math.min(Math.round(-n.delta / 100 / n.price), Math.floor(n.shares));
          if (sh <= 0){ warns.push(`${n.sym}: the sale would be less than one share, so it's skipped.`); n.wdelta = 0; continue; }
          const c = Math.round(sh * n.price * 100);
          sells.push({type: 'Sell', from: n.sym, to: 'CASH', c, unit: 'shares', whole: true, shares: sh}); n.wdelta = -c;
        } else {
          if (!n.price){ errors.push(`${n.sym}: whole-share mode needs a price to buy it.`); continue; }
          wants.push(n);
        }
        continue;
      }
      if (n.delta < 0){
        const o = {type: 'Sell', from: n.sym, to: 'CASH', c: -n.delta};
        if (n.tgt === 0){ o.unit = 'all'; o.shares = n.sharesKnown ? Math.round(n.shares * 1000) / 1000 : null; }
        else if (n.price && n.sharesKnown && (inp.sellUnits === 'shares' || o.c >= 0.8 * n.cur)){
          o.unit = 'shares'; o.shares = Math.min(Math.floor(o.c / 100 / n.price * 1000) / 1000, n.shares);
          if (inp.sellUnits !== 'shares') o.note = `Sold in shares: this is ${Math.round(o.c / n.cur * 100)}% of the position, so a dollar amount could exceed what it's worth if the price drops before the order fills.`;
        }
        else {
          o.unit = 'dollars';
          if (o.c >= 0.8 * n.cur) o.note = `This is ${Math.round(o.c / n.cur * 100)}% of the position. Enter shares for this holding so it can be sold in shares instead; a dollar amount could exceed the position's value if the price drops.`;
        }
        sells.push(o);
      } else if (n.delta > 0) buys.push({type: 'Buy', from: 'CASH', to: n.sym, c: n.delta, unit: 'dollars'});
    }
    // mutual funds: exchange among themselves where allowed, otherwise sell to / buy from cash
    const mfn = funds.filter(n => n.mf && n.delta !== 0);
    if (mfn.length){
      let pool, transfers = [];
      if (inp.exch !== false){
        pool = mfn.slice();
        const net = -mfn.reduce((a2, n) => a2 + n.delta, 0);
        if (net) pool.push({sym: 'CASH', kind: 'cash', delta: net});
        for (const g of maxZeroGroups(pool.map(n => n.delta))) transfers = transfers.concat(settle(pool, g));
      } else {
        pool = mfn.concat([{sym: 'CASH', kind: 'cash', delta: 0}]);
        const ci = pool.length - 1;
        mfn.forEach((n, i) => transfers.push(n.delta < 0 ? {from: i, to: ci, c: -n.delta} : {from: ci, to: i, c: n.delta}));
      }
      const bySrc = new Map();
      for (const t of transfers){ if (!bySrc.has(t.from)) bySrc.set(t.from, []); bySrc.get(t.from).push(t); }
      for (const [fi, list] of bySrc){
        const f = pool[fi]; list.sort((x, y) => y.c - x.c);
        const closing = f.kind === 'fund' && f.tgt === 0; let left = f.shares;
        list.forEach((t, k) => {
          const to = pool[t.to];
          const o = {from: f.sym, to: to.sym, c: t.c, type: f.kind === 'cash' ? 'Buy' : to.kind === 'cash' ? 'Sell' : 'Exchange'};
          if (f.kind === 'cash') o.unit = 'dollars';
          else if (closing && k === list.length - 1){ o.unit = 'all'; o.shares = f.sharesKnown ? Math.max(0, Math.round(left * 1000) / 1000) : null; }
          else if (f.price && f.sharesKnown && inp.mfUnits !== 'dollars'){ o.unit = 'shares'; o.shares = Math.round(t.c / 100 / f.price * 1000) / 1000; left -= o.shares; }
          else { o.unit = 'dollars'; if (f.price) left -= t.c / 100 / f.price; }
          mfo.push(o);
        });
      }
      const rank = {Exchange: 0, Sell: 1, Buy: 2};
      mfo.sort((x, y) => (x.unit === 'all') - (y.unit === 'all') || rank[x.type] - rank[y.type]);
    }
    sells.sort((x, y) => y.c - x.c); buys.sort((x, y) => y.c - x.c);
    const sumC = arr => arr.reduce((a2, o) => a2 + o.c, 0);
    const mfSellC = sumC(mfo.filter(o => o.type === 'Sell')), mfBuyC = sumC(mfo.filter(o => o.type === 'Buy'));
    let nextDay = !!buys.length && mfSellC > 0 && sumC(buys) > cashC + sumC(sells) - mfBuyC - reserveC;
    let scaled = false, leftover = null, cushHeld = 0;
    if (whole && wants.length){
      // cash for buys: conservative (sale proceeds assumed to come in lower by the cushion)
      const useActual = inp.afterSells != null && (sells.length || mfo.length);
      const nominal = useActual ? C(inp.afterSells) - reserveC : cashC + sumC(sells) + mfSellC - mfBuyC - reserveC;
      const avail = useActual ? nominal : Math.floor(cashC + sumC(sells) * (1 - cush) + mfSellC * (1 - cush) - mfBuyC - reserveC);
      scaled = useActual;
      const W = wants.map(n => ({n, d: n.delta, P: Math.round(n.price * 100), L: Math.ceil(n.price * 100 * (1 + cush)), k: 0}));
      for (const w of W) w.k = Math.floor(w.d / w.L);
      let spend = W.reduce((a2, w) => a2 + w.k * w.L, 0);
      while (spend > Math.max(0, avail)){
        const w = W.filter(x => x.k > 0).sort((x, y) => (y.k * y.P - y.d) - (x.k * x.P - x.d))[0]; if (!w) break;
        w.k--; spend -= w.L;
      }
      for (;;){
        const room = avail - spend;
        const w = W.filter(x => x.L <= room && (x.d - x.k * x.P) >= x.P / 2).sort((x, y) => (y.d - y.k * y.P) - (x.d - x.k * x.P))[0];
        if (!w) break; w.k++; spend += w.L;
      }
      for (const w of W){
        if (w.k > 0){ const c = w.k * w.P; buys.push({type: 'Buy', from: 'CASH', to: w.n.sym, c, unit: 'wshares', whole: true, shares: w.k, limit: w.L / 100}); w.n.wdelta = c; }
        else { w.n.wdelta = 0; warns.push(w.d < w.P ? `${w.n.sym}: its target needs less than one share (${usd(w.P)}), so it isn't bought.` : `${w.n.sym}: there isn't enough cash to buy a whole share, so it isn't bought.`); }
      }
      buys.sort((x, y) => y.c - x.c);
      leftover = Math.max(0, nominal - W.reduce((a2, w) => a2 + w.k * w.P, 0));
      cushHeld = W.reduce((a2, w) => a2 + w.k * (w.L - w.P), 0);
      if (avail <= 0 && W.length) errors.push('There is no cash left for the stock and ETF buys after the cash you are keeping.');
      nextDay = !!buys.length && mfSellC > 0 && spend > cashC + Math.floor(sumC(sells) * (1 - cush)) - mfBuyC - reserveC;
      if (leftover > 0.02 * total) warns.push(`About ${usd(leftover)} (${(leftover / total * 100).toFixed(1)}% of the portfolio) will stay in cash, because whole shares don't divide evenly${cush ? ' and the price cushion holds some back' : ''}.`);
    }
    if (!whole && inp.afterSells != null && buys.length && (sells.length || mfo.length)){
      const availC = C(inp.afterSells) - reserveC, planned = sumC(buys);
      if (availC <= 0) errors.push('The cash entered is not more than the cash to keep, so there is nothing left for the final buys.');
      else { let used = 0; for (const o of buys){ o.c = Math.floor(o.c * availC / planned); used += o.c; } buys[0].c += availC - used; scaled = true; }
    }
    if (errors.length) return {errors, notes, warns, orders: [], sells: [], mfo: [], buys: [], rows: [], total};
    const buyBy = new Map(buys.map(o => [o.to, o.c]));
    let rows = nodes.map(n => {
      const d = n.kind === 'cash' ? (scaled ? reserveC - n.cur : n.delta) : (whole && !n.mf && n.wdelta != null) ? n.wdelta : (!n.mf && n.delta > 0) ? (buyBy.get(n.sym) || 0) : n.delta;
      return {sym: n.sym, kind: n.kind, cur: n.cur, tgt: n.tgt, delta: d, after: n.cur + d, skipped: !!n.skipped};
    });
    if (whole && !scaled){
      const fundAfter = rows.filter(x => x.kind !== 'cash').reduce((a2, x) => a2 + x.after, 0);
      let cashRow = rows.find(x => x.kind === 'cash');
      if (!cashRow && total - fundAfter){ cashRow = {sym: 'CASH', kind: 'cash', cur: 0, tgt: reserveC, delta: 0, after: 0, skipped: false}; rows.push(cashRow); }
      if (cashRow){ cashRow.after = total - fundAfter; cashRow.delta = cashRow.after - cashRow.cur; }
    }
    rows.sort((x, y) => (x.kind === 'cash') - (y.kind === 'cash') || y.after - x.after || y.cur - x.cur);
    return {errors, notes, warns, orders: sells.concat(mfo, buys), sells, mfo, buys, rows, total, scaled, nextDay, leftover, cushHeld, whole};
  }

  const nz = nodes.map((n, i) => i).filter(i => nodes[i].delta !== 0);
  const groups = maxZeroGroups(nz.map(i => nodes[i].delta));
  let transfers = [];
  for (const g of groups) transfers = transfers.concat(settle(nodes, g.map(j => nz[j])));

  // build orders
  const bySrc = new Map();
  for (const t of transfers){ if (!bySrc.has(t.from)) bySrc.set(t.from, []); bySrc.get(t.from).push(t); }
  const orders = [];
  for (const [fi, list] of bySrc){
    const f = nodes[fi];
    list.sort((a, b) => b.c - a.c);
    const closing = f.kind === 'fund' && f.tgt === 0;
    let sharesLeft = f.shares;
    list.forEach((t, k) => {
      const to = nodes[t.to];
      const o = {from: f.sym, to: to.sym, c: t.c,
        type: f.kind === 'cash' ? 'Buy' : to.kind === 'cash' ? 'Sell' : 'Exchange'};
      if (f.kind === 'cash'){ o.unit = 'dollars'; }
      else if (closing && k === list.length - 1){
        o.unit = 'all'; o.shares = f.sharesKnown ? Math.max(0, Math.round(sharesLeft * 1000) / 1000) : null;
      } else if (inp.units === 'shares' && f.price && f.sharesKnown){
        o.unit = 'shares'; o.shares = Math.round(t.c / 100 / f.price * 1000) / 1000; sharesLeft -= o.shares;
      } else {
        o.unit = 'dollars'; if (f.price) sharesLeft -= t.c / 100 / f.price;
        if (inp.units === 'shares') notes.push(`${f.sym}: no share count or price, so its order is in dollars.`);
      }
      orders.push(o);
    });
  }
  const rank = {Exchange: 0, Buy: 1, Sell: 2};
  orders.sort((a, b) => (a.unit === 'all') - (b.unit === 'all') || rank[a.type] - rank[b.type]);

  for (const n of nodes){
    if (n.kind !== 'fund') continue;
    if (n.tgt === 0 && n.cur > 0) notes.push(`${n.sym} is not in the target and will be sold completely.`);
    if (n.cur === 0 && n.tgt > 0) notes.push(`${n.sym} is a new position. Check its minimum initial investment.`);
  }
  const rows = nodes.map(n => ({sym: n.sym, kind: n.kind, cur: n.cur, tgt: n.tgt, delta: n.delta, after: n.cur + n.delta, skipped: !!n.skipped}))
    .sort((a, b) => (a.kind === 'cash') - (b.kind === 'cash') || b.after - a.after || b.cur - a.cur);
  return {errors, notes: [...new Set(notes)], orders, rows, total, groups: groups.length};
}
