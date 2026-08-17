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
    const url = `${cfg.baseUrl}?id=${cfg.productId}&limit=${cfg.limit || 4}&section_id=product-recommendations`;
    try {
      const r = await fetch(url, { credentials: 'same-origin' });
      const html = await r.text();
      const tmp  = new DOMParser().parseFromString(html, 'text/html');
      const incoming = tmp.querySelector('[data-product-recommendations]');
      const local = document.querySelector('[data-product-recommendations]');
      if (incoming && local) {
        // extract product grid from incoming
        const grid = incoming.querySelector('.product-recommendations-grid');
        if (grid) {
          local.querySelector('.product-recommendations-grid').innerHTML = grid.innerHTML;
          // bind quick-add
          local.querySelectorAll('[data-quick-add]').forEach((b) => {
            b.closest('form')?.addEventListener('submit', (e) => e);
          });
        }
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
      fetch(window.Shopify?.routes?.root + 'cart/add.js', {
        method:'POST', body: new FormData(form), credentials:'same-origin'
      }).then(() => {
        if (window.CartEngine) CartEngine.openDrawer();
        if (window.CartEngine) CartEngine.refreshCart('flash','Added');
      });
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
