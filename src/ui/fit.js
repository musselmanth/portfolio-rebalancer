// Shrinks text to fit narrow inputs and chips.

export const FIT_SEL = 'input.n, input.sym, input#presetName, .chip .cv, .summary b, .summary span, #mbarText, #orderBtns > button:not(.info), .tt';
export function fit(el){
  el.style.fontSize = '';
  if (!el.getClientRects().length) return;
  let fs = parseFloat(getComputedStyle(el).fontSize);
  while (el.scrollWidth > el.clientWidth + 0.5 && fs > 10){ fs -= 0.5; el.style.fontSize = fs + 'px'; }
}
export const fitAll = () => document.querySelectorAll(FIT_SEL).forEach(fit);

export function initFit(){
  let fitT; window.addEventListener('resize', () => { clearTimeout(fitT); fitT = setTimeout(fitAll, 80); });
  ['focusin', 'focusout'].forEach(ev => document.addEventListener(ev, e => { if (e.target.matches && e.target.matches(FIT_SEL)) setTimeout(() => fit(e.target), 0); }));
  document.addEventListener('input', e => { if (e.target.matches && e.target.matches(FIT_SEL)) fit(e.target); });
}
