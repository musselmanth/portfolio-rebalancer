// System / light / dark theme switch.
import { store } from '../lib/store.js';
import { fitAll } from './fit.js';

export function setTheme(t){
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; else { delete document.documentElement.dataset.theme; t = 'system'; }
  document.querySelectorAll('[data-theme-set]').forEach(b => b.setAttribute('aria-pressed', b.dataset.themeSet === t));
  store.set('rebal.theme', t);
  setTimeout(() => fitAll(), 0);
}

export function initTheme(){
  setTheme(store.get('rebal.theme', 'system'));
  document.querySelectorAll('[data-theme-set]').forEach(b => b.onclick = () => setTheme(b.dataset.themeSet));
}
