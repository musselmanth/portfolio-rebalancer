// Drives the page the way a user would: typing into fields and clicking buttons.
export function driver(w){
  const d = w.document, $ = id => d.getElementById(id);
  const type = (el, v) => { el.value = v; el.dispatchEvent(new w.Event('input', {bubbles: true})); };
  const pick = (id, v) => { $(id).value = v; $(id).dispatchEvent(new w.Event('change', {bubbles: true})); };
  return {
    $, type, pick,
    tab: t => d.querySelector(`[data-tab=${t}]`).click(),
    setHoldings(list){
      list.forEach(([sym, shares, price], i) => {
        if (i >= $('holdBody').rows.length) $('addHold').click();
        const r = () => $('holdBody').rows[i];
        type(r().querySelector('[data-f=sym]'), sym);
        type(r().querySelector('[data-f=shares]'), shares);
        type(r().querySelector('[data-f=price]'), price);
      });
    },
    setTargets(list){
      list.forEach(([sym, pct], i) => {
        if (i >= $('tgtBody').rows.length) $('addTgt').click();
        const r = () => $('tgtBody').rows[i];
        type(r().querySelector('[data-f=sym]'), sym);
        type(r().querySelector('[data-f=pct]'), pct);
      });
    },
    snapshot: () => Object.fromEntries(['orders', 'orders2', 'orders3', 'allocBody', 'msgs', 'sTotal', 'sCount', 'sMoved', 'pctTotal', 'mbarText', 'ph3left']
      .map(id => [id, $(id).innerHTML])),
  };
}

// Loads index.html's body into the test document and boots the app.
export async function bootApp(){
  const fs = await import('node:fs');
  const html = fs.readFileSync('index.html', 'utf8');
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'));
  await import('../src/main.js');
  return driver(window);
}

// One scripted session covering both tabs and the main options.
export function scenario(D){
  const snaps = [];
  D.$('ackBtn').click();
  D.setHoldings([['FXAIX', '100', '150.25'], ['FTIHX', '200', '15.10'], ['FXNAX', '50', '10.05'], ['FSKAX', '12.345', '130']]);
  D.type(D.$('cash'), '1000');
  D.setTargets([['FXAIX', '60'], ['FTIHX', '30'], ['FXNAX', '10']]);
  snaps.push(D.snapshot());
  D.pick('units', 'dollars'); snaps.push(D.snapshot());
  D.type(D.$('tol'), '200'); snaps.push(D.snapshot());
  D.pick('reserveMode', 'pct'); D.type(D.$('reserve'), '5'); snaps.push(D.snapshot());
  D.$('fromCur').click(); snaps.push(D.snapshot());
  D.tab('etf');
  D.setHoldings([['VTI', '50', '250.5'], ['AAPL', '10', '201.3'], ['FXAIX', '20', '150.25'], ['QQQ', '3', '480'], ['BND', '0', '72.4']]);
  D.type(D.$('cash'), '2500');
  D.setTargets([['VTI', '50'], ['BND', '20'], ['FXAIX', '30']]);
  snaps.push(D.snapshot());
  D.pick('sellUnits', 'shares'); snaps.push(D.snapshot());
  D.pick('sellUnits', 'whole'); snaps.push(D.snapshot());
  D.type(D.$('afterSells'), '9000'); snaps.push(D.snapshot());
  D.pick('exch', 'off'); D.$('exch').checked = false; D.$('exch').dispatchEvent(new window.Event('change')); snaps.push(D.snapshot());
  D.pick('method', 'buyonly'); snaps.push(D.snapshot());
  D.tab('mf'); snaps.push(D.snapshot());
  return snaps;
}
