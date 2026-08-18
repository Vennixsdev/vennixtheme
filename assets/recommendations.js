/* Recommendations engine — fetches the {shopify-recommendations-api} and re-renders */
(function () {
  'use strict';

  function getConfig() {
    try { return JSON.parse(document.getElementById('VennixRecommendationConfig')?.textContent || '{}'); }
    catch { return {}; }
  }

  async function init() {
    const cfg = getConfig();
    if (!cfg.productId) return;
    const U = window.VennixUtils;
    const base = cfg.baseUrl || `${U.routes().root}recommendations/products`;
    let url = U.withParam(base, 'id', cfg.productId);
    url = U.withParam(url, 'limit', cfg.limit || 4);
    url = U.withParam(url, 'section_id', 'product-recommendations');
    try {
      const r = await fetch(url, { credentials: 'same-origin' });
      if (!r.ok) throw new Error(`Recommendations request failed: ${r.status}`);
      const html = await r.text();
      const tmp  = new DOMParser().parseFromString(html, 'text/html');
      const incoming = tmp.querySelector('[data-product-recommendations]');
      const local = document.querySelector('[data-product-recommendations]');
      if (incoming && local) {
        // extract product grid from incoming
        const grid = incoming.querySelector('.product-recommendations-grid');
        const target = local.querySelector('.product-recommendations-grid');
        // Was dereferenced without a guard — threw when the section markup
        // changed shape, which silently killed bindScroll() below.
        if (grid && target) target.innerHTML = grid.innerHTML;
        // Nothing had to be bound here: cart.js already delegates [data-quick-add]
        // from document, so the old no-op submit listener has been removed.
        if (!grid || !target) local.style.display = 'none';
      }
      bindScroll();
    } catch (e) {
      // hide on failure
      const local = document.querySelector('[data-product-recommendations]');
      if (local) local.style.display = 'none';
    }
  }

  function bindScroll() {
    const grid = document.querySelector('[data-rec-grid]');
    if (!grid) return;
    const prev = document.querySelector('[data-rec-scroll="prev"]');
    const next = document.querySelector('[data-rec-scroll="next"]');
    if (!prev || !next) return;
    prev.addEventListener('click', () => grid.scrollBy({ left: -grid.clientWidth * 0.85, behavior: 'smooth' }));
    next.addEventListener('click', () => grid.scrollBy({ left:  grid.clientWidth * 0.85, behavior: 'smooth' }));
    // bind quick adds inside grid
    grid.addEventListener('click', (e) => {
      const quick = e.target.closest('[data-quick-add]');
      if (!quick) return;
      e.preventDefault();
      const form = quick.closest('form');
      if (!form) return;
      const U = window.VennixUtils;
      fetch(U.routes().cartAddJs, {
        method:'POST',
        body: new FormData(form),
        credentials:'same-origin',
        headers: { 'X-Requested-With':'XMLHttpRequest' }
      }).then((res) => {
        if (!res.ok) throw new Error('Add failed');
        if (window.CartEngine) {
          window.CartEngine.openDrawer();
          window.CartEngine.refreshCart('flash', U.t('added') || 'Added');
        }
      }).catch((err) => console.warn('[Vennix] quick add failed', err));
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
