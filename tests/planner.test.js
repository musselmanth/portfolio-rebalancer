import { describe, test, expect } from 'vitest';
import { plan, maxZeroGroups, isMFSym } from '../src/lib/planner.js';

const sumCents = orders => orders.reduce((a, o) => a + o.c, 0);

describe('maxZeroGroups', () => {
  test('splits into the most groups that each sum to zero', () => {
    const groups = maxZeroGroups([100, -100, 50, -50]);
    expect(groups).toHaveLength(2);
    for (const g of groups) expect(g.reduce((a, i) => a + [100, -100, 50, -50][i], 0)).toBe(0);
  });
  test('empty input', () => expect(maxZeroGroups([])).toEqual([]));
});

describe('isMFSym', () => {
  test('five letters ending in X', () => {
    expect(isMFSym('FXAIX')).toBe(true);
    expect(isMFSym('VTI')).toBe(false);
    expect(isMFSym('FXAIZ')).toBe(false);
  });
});

describe('plan: mutual funds only', () => {
  const base = {
    holdings: [{sym: 'FXAIX', shares: 100, price: 100}, {sym: 'FTIHX', shares: 100, price: 100}],
    targets: [{sym: 'FXAIX', pct: 70}, {sym: 'FTIHX', pct: 30}],
    cash: 0, units: 'shares',
  };

  test('one exchange moves the overweight fund into the underweight one', () => {
    const r = plan(base);
    expect(r.errors).toEqual([]);
    expect(r.total).toBe(2000000);
    expect(r.orders).toHaveLength(1);
    expect(r.orders[0]).toMatchObject({type: 'Exchange', from: 'FTIHX', to: 'FXAIX', c: 400000, unit: 'shares', shares: 40});
  });

  test('cash is fully invested', () => {
    const r = plan({...base, cash: 1000});
    expect(r.errors).toEqual([]);
    const cash = r.rows.find(x => x.kind === 'cash');
    expect(cash.after).toBe(0);
  });

  test('a fund missing from the target is sold with an all-shares order', () => {
    const r = plan({...base, targets: [{sym: 'FXAIX', pct: 100}]});
    expect(r.orders).toHaveLength(1);
    expect(r.orders[0]).toMatchObject({from: 'FTIHX', to: 'FXAIX', unit: 'all', shares: 100});
  });

  test('targets must add to 100%', () => {
    const r = plan({...base, targets: [{sym: 'FXAIX', pct: 70}]});
    expect(r.errors[0]).toMatch(/add up to 70%/);
  });

  test('stock symbols are rejected on this tab', () => {
    const r = plan({...base, targets: [{sym: 'VTI', pct: 100}]});
    expect(r.errors.join(' ')).toMatch(/VTI isn't a mutual fund symbol/);
  });

  test('tolerance skips small moves', () => {
    const r = plan({...base, targets: [{sym: 'FXAIX', pct: 50.5}, {sym: 'FTIHX', pct: 49.5}], tol: 200});
    expect(r.orders).toHaveLength(0);
    expect(r.rows.every(x => x.skipped)).toBe(true);
  });
});

describe('plan: mixed portfolio', () => {
  const base = {
    mode: 'etf', method: 'full', sellUnits: 'dollars', exch: true, mfUnits: 'shares',
    holdings: [{sym: 'VTI', shares: 10, price: 200}, {sym: 'BND', shares: 0, price: 70}],
    targets: [{sym: 'VTI', pct: 50}, {sym: 'BND', pct: 50}],
    cash: 0,
  };

  test('sells above-target positions and buys the rest in dollars', () => {
    const r = plan(base);
    expect(r.errors).toEqual([]);
    expect(r.sells).toHaveLength(1);
    expect(r.buys).toHaveLength(1);
    expect(r.sells[0]).toMatchObject({from: 'VTI', c: 100000});
    expect(sumCents(r.buys)).toBe(100000);
  });

  test('whole-share buys never spend more than the cash at their limit prices', () => {
    const r = plan({...base, whole: true, cushion: 1});
    expect(r.errors).toEqual([]);
    const spendAtLimit = r.buys.reduce((a, o) => a + o.shares * Math.round(o.limit * 100), 0);
    expect(spendAtLimit).toBeLessThanOrEqual(r.sells.reduce((a, o) => a + o.c, 0));
    expect(Number.isInteger(r.buys[0].shares)).toBe(true);
  });

  test('buy only never sells', () => {
    const r = plan({...base, method: 'buyonly', cash: 500});
    expect(r.sells).toHaveLength(0);
    expect(sumCents(r.buys)).toBe(50000);
  });
});
