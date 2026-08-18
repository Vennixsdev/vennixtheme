/* ============================================================
   VennixStore Elite — Recently viewed products (localStorage)
   Records view on product pages; renders grid on demand.
   ============================================================ */
(function () {
  'use strict';

  const KEY = 'vxn_recently_v1';

  function read() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } }
  function write(items) {
    try { localStorage.setItem(KEY, JSON.stringify(items)); }
    catch (e) { /* quota exceeded or storage disabled — non-fatal */ }
  }

  function getConfig() {
    try { return JSON.parse(document.getElementById('VennixRecentConfig')?.textContent || '{}'); } catch { return {}; }
  }

  // record current product on product pages
  function record() {
    const cfg = getConfig();
    const limit = parseInt(cfg.limit, 10) || 6;
    const info = document.querySelector('[data-product-info]') || document.querySelector('.product-info');
    const productKey = info?.dataset?.productId;
    if (!productKey) return;

    const items = read().filter((it) => it && typeof it === 'object' && it.id != null);
    // BUGFIX: this used items.indexOf(productKey) — comparing a string id against
    // stored objects, so it never matched and duplicates piled up on every view.
    const idx = items.findIndex((it) => String(it.id) === String(productKey));
    if (idx >= 0) items.splice(idx, 1);
    items.unshift(productMeta(productKey, info));
    write(items.slice(0, limit * 2));
  }

  function productMeta(id, info) {
    const card = document.querySelector(`[data-product-card][data-product-id="${CSS.escape(String(id))}"]`);
    if (card) return extractFromCard(card, id);
    return {
      id,
      title: info?.dataset?.productTitle || document.querySelector('.product-info-title')?.textContent.trim() || '',
      image: info?.dataset?.productImage || document.querySelector('[data-gallery-main] img')?.getAttribute('src') || '',
      price: document.querySelector('.product-info-price .price-current')?.textContent.trim() || '',
      url:   info?.dataset?.productUrl || location.pathname
    };
  }

  function extractFromCard(card, id) {
    return {
      id,
      title: card.querySelector('.product-card-title')?.textContent.trim() || '',
      image: card.querySelector('img.primary')?.getAttribute('src') || '',
      price: card.querySelector('.price-current')?.textContent.trim() || '',
      url:   card.querySelector('.product-card-title a')?.getAttribute('href') || '#'
    };
  }

  function hydrate() {
    const wrap = document.querySelector('[data-recently-viewed]');
    if (!wrap) return;
    const grid  = wrap.querySelector('[data-rv-grid]');
    const empty = wrap.querySelector('[data-rv-empty]');
    const items = read().filter((it) => it && typeof it === 'object' && it.id != null);
    if (!grid) return;
    if (items.length === 0) {
      if (empty) empty.style.display = '';
      grid.innerHTML = '';
      return;
    }
    if (empty) empty.style.display = 'none';

    const U = window.VennixUtils;
    // All values below originate from localStorage, which is attacker-writable
    // via XSS elsewhere or a shared device — escape before templating.
    const limit = parseInt(getConfig().limit, 10) || 6;
    grid.innerHTML = items.slice(0, limit).map((it) => {
      // BUGFIX: was `${it.image}&width=400`, producing an invalid URL whenever
      // the source had no existing query string.
      const img = it.image ? U.withParam(it.image, 'width', 400) : '';
      return `
      <a href="${U.safeUrl(it.url)}" class="product-card" data-product-id="${U.escapeAttr(it.id)}">
        <div class="product-card-media" style="aspect-ratio:1/1;overflow:hidden;border-radius:var(--radius-lg);background:var(--color-surface-2);">
          ${img ? `<img src="${U.escapeAttr(img)}" alt="${U.escapeAttr(it.title)}" loading="lazy" style="width:100%;height:100%;object-fit:cover;">` : ''}
        </div>
        <div class="product-card-content">
          <h3 class="product-card-title">${U.escapeHtml(it.title || 'View product')}</h3>
          <div class="price"><span class="price-current">${U.escapeHtml(it.price || '')}</span></div>
        </div>
      </a>`;
    }).join('');
  }

  function boot() {
    if (document.querySelector('[data-product-info]') || document.querySelector('.product-info')) record();
    hydrate();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
