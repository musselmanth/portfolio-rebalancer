// Number parsing and display helpers shared by the planner and the UI.

export const num = v => { if (v == null) return null; const s = String(v).replace(/[$,\s+]/g, '').replace(/^\((.*)\)$/, '-$1'); if (s === '' || s === '--' || s === '-') return null; const x = parseFloat(s); return isNaN(x) ? null : x; };
export const usd = c => (c / 100).toLocaleString('en-US', {style: 'currency', currency: 'USD'});
export const pct = x => (x * 100).toFixed(2) + '%';
export const esc = s => String(s ?? '').replace(/[&<>"]/g, ch => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[ch]));
