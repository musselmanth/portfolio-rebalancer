// Boots the real page in jsdom and checks that typing in holdings and targets produces orders.
import { test, expect } from 'vitest';
import { bootApp, scenario } from './helpers.js';

test('the page plans orders on both tabs', async () => {
  const snaps = scenario(await bootApp());
  const types = s => (s.orders + s.orders2 + s.orders3).match(/otype[^>]*>(\w+)/g)?.map(x => x.split('>')[1]) ?? [];
  expect(snaps[0].sTotal).toBe('$21,152.35');
  expect(types(snaps[0])).toEqual(['Exchange', 'Exchange', 'Buy', 'Exchange']);
  expect(snaps[5].pctTotal).toBe('Total 100%');
  expect(types(snaps[5])).toEqual(['Sell', 'Sell', 'Sell', 'Buy', 'Buy']);
  expect(snaps[7].orders3).toContain('Limit price');
  expect(types(snaps[10])).toEqual(['Buy', 'Buy']);
  for (const s of snaps) expect(s.msgs).not.toContain('class="bad"');
});
