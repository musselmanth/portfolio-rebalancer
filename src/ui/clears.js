// The small × clear buttons inside inputs marked data-clr.

export function addClears(){
  document.querySelectorAll('input[data-clr]:not([data-clr-done])').forEach(inp => {
    inp.dataset.clrDone = '1';
    if (!inp.placeholder) inp.placeholder = ' ';
    const w = document.createElement('span'); w.className = 'cwrap' + (inp.dataset.clr === 'focus' ? ' f' : '');
    inp.parentNode.insertBefore(w, inp); w.appendChild(inp);
    const b = document.createElement('button'); b.type = 'button'; b.className = 'clear'; b.tabIndex = -1; b.setAttribute('aria-label', 'Clear'); b.textContent = '×';
    w.appendChild(b);
    const ad = w.closest('.adorn'); if (ad) ad.classList.add('hasclr');
  });
}

export function initClears(){
  document.addEventListener('pointerdown', e => { if (e.target.closest('.clear')) e.preventDefault(); });
  document.addEventListener('click', e => {
    const b = e.target.closest('.clear'); if (!b) return;
    const inp = b.parentNode.querySelector('input');
    inp.value = ''; inp.dispatchEvent(new Event('input', {bubbles: true})); inp.focus();
  });
}
