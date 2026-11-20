import { test, expect } from 'vitest';
import { parseCSV, parseFidelity } from '../src/lib/csv.js';

test('parseCSV handles quotes, escaped quotes, CRLF and a BOM', () => {
  expect(parseCSV('﻿a,"b,c","d ""e"""\r\n1,2,3')).toEqual([['a', 'b,c', 'd "e"'], ['1', '2', '3']]);
});

const FIDELITY = [
  'Account Number,Account Name,Symbol,Description,Quantity,Last Price,Current Value',
  'Z123,ROTH IRA,SPAXX**,HELD IN MONEY MARKET,,,"$1,234.56"',
  'Z123,ROTH IRA,FXAIX,FIDELITY 500 INDEX,10.5,$180.00,"$1,890.00"',
  'Z123,ROTH IRA,Pending Activity,,,,-$50.00',
  'X999,HSA,FTIHX,FIDELITY TOTAL INTL,20,$15.00,$300.00',
  '',
  '"The data and information in this spreadsheet is provided to you solely for your use..."',
].join('\n');

test('parseFidelity groups positions by account and pulls out cash and pending', () => {
  const accts = parseFidelity(FIDELITY);
  expect([...accts.keys()]).toEqual(['Z123 – ROTH IRA', 'X999 – HSA']);
  const roth = accts.get('Z123 – ROTH IRA');
  expect(roth.cash).toBeCloseTo(1234.56);
  expect(roth.pending).toBeCloseTo(-50);
  expect(roth.positions).toEqual([{sym: 'FXAIX', shares: 10.5, price: 180, value: 1890}]);
});

test('parseFidelity rejects files without a Symbol header', () => {
  expect(() => parseFidelity('foo,bar\n1,2')).toThrow(/Symbol/);
});
