// Info popovers and the disclosures dialog.
import { $ } from './dom.js';
import { M } from './state.js';
import { store } from '../lib/store.js';

let modalFrom = null;

export function openInfo(b){
  modalFrom = b;
  $('ackRow').classList.add('hidden'); $('modalClose').classList.remove('hidden'); $('modal').dataset.firstRun = '';
  $('modalTitle').textContent = b.dataset.info === 'i-about' ? `How the ${M === 'etf' ? 'Mixed portfolio' : 'Mutual funds only'} tool works` : (b.getAttribute('aria-label') || '').replace(/^About /, '').replace(/^the /i, '').replace(/^./, c => c.toUpperCase());
  const alt = M === 'etf' ? $(b.dataset.info + '-etf') : null;
  $('modalBody').innerHTML = (alt || $(b.dataset.info)).innerHTML;
  $('modalBody').scrollTop = 0; $('modalBody').previousElementSibling.classList.remove('shadow');
  $('modal').classList.add('open'); $('modal').setAttribute('aria-hidden', 'false');
  b.setAttribute('aria-expanded', 'true');
  document.body.style.overflow = 'hidden';
  $('modalClose').focus();
}
export function closeInfo(){
  if (!$('modal').classList.contains('open') || $('modal').dataset.firstRun) return;
  $('modal').classList.remove('open'); $('modal').setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  if (modalFrom){ modalFrom.setAttribute('aria-expanded', 'false'); modalFrom.focus({preventScroll: true}); modalFrom = null; }
}

export const TERMS_VER = 1;
export function openTerms(firstRun){
  modalFrom = firstRun ? null : $('openTerms');
  $('modalTitle').textContent = firstRun ? 'Before you start' : 'Disclosures';
  $('modalBody').innerHTML = (firstRun ? '<p>Please read these disclosures. You can find them again anytime at the bottom of the page.</p>' : '') + $('i-terms').innerHTML;
  $('modalBody').scrollTop = 0; $('modalBody').previousElementSibling.classList.remove('shadow');
  $('ackRow').classList.toggle('hidden', !firstRun);
  $('modalClose').classList.toggle('hidden', !!firstRun);
  $('modal').dataset.firstRun = firstRun ? '1' : '';
  $('modal').classList.add('open'); $('modal').setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  (firstRun ? $('ackBtn') : $('modalClose')).focus();
}

export function initModal(){
  document.addEventListener('click', e => {
    const b = e.target.closest('.info'); if (!b) return;
    e.preventDefault(); openInfo(b);
  });
  $('modal').addEventListener('click', e => { if (e.target === $('modal')) closeInfo(); });
  $('modalClose').onclick = closeInfo;
  $('modalBody').addEventListener('scroll', e => e.target.previousElementSibling.classList.toggle('shadow', e.target.scrollTop > 2));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeInfo(); });
  $('openTerms').onclick = () => openTerms(false);
  $('ackBtn').onclick = () => { store.set('rebal.termsAck', TERMS_VER); $('modal').dataset.firstRun = ''; $('ackRow').classList.add('hidden'); $('modalClose').classList.remove('hidden'); closeInfo(); };
  if (store.get('rebal.termsAck', 0) !== TERMS_VER) openTerms(true);
}
