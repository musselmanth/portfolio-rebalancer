// Entry point: wires up every part of the page in the same order the original single file did.
import { $ } from './ui/dom.js';
import { plan } from './lib/planner.js';
import { initClears, addClears } from './ui/clears.js';
import { initTables, renderHold, renderTgt } from './ui/tables.js';
import { initSettings } from './ui/settings.js';
import { initModal } from './ui/modal.js';
import { initTabs, applyMode } from './ui/tabs.js';
import { initTheme } from './ui/theme.js';
import { initFit } from './ui/fit.js';
import { initResults, recompute } from './ui/results.js';
import { initPresets, renderPresets } from './ui/presets.js';
import { initCsvUpload } from './ui/csv-upload.js';

window.__plan = plan; // handy for poking at the planner from the browser console

initClears();
initTables();
initSettings();
initModal();
initTabs();
initTheme();
initFit();
initResults();
initPresets();
initCsvUpload();

applyMode(); addClears(); renderHold(); renderTgt(); renderPresets(); recompute();
if ('IntersectionObserver' in window){
  const mbarObs = new IntersectionObserver(es => { for (const e of es) $('mbar').classList.toggle('off', e.isIntersecting || e.boundingClientRect.top < 0); });
  mbarObs.observe($('ordersTop').closest('section'));
}
