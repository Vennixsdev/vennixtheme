/* ============================================================
   VennixStore Elite — Recently viewed products (localStorage)
   Records view on product pages; renders grid on demand.
   ============================================================ */
(function () {
  'use strict';

  const KEY = 'vxn_recently_v1';

  function read() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } }
  function write(items) { localStorage.setItem(KEY, JSON.stringify(items)); }

  function getConfig() {
    try { return JSON.parse(document.getElementById('VennixRecentConfig')?.textContent || '{}'); } catch { return {}; }
  }

  // record current product on product pages
  async function record() {
    const cfg = getConfig();
    if (!cfg.limit) return;
    const productId = window.__VARIANTS__?.[0]?.id;
    const productKey = document.querySelector('.product-info')?.dataset?.productId;
    if (!productKey) return;
    const items = read();
    const idx = items.indexOf(productKey);
    if (idx >= 0) items.splice(idx, 1);
    items.unshift(ProductMeta(productKey));
    write(items.slice(0, cfg.limit * 2));
  }

  function ProductMeta(id) {
    const card = document.querySelector(`[data-product-id="${id}"]`);
    if (card) return extractFromCard(card, id);
    return { id, title: '', image: '', price: '' };
  }
  function extractFromCard(card, id) {
    return {
      id,
      title: card.querySelector('.product-card-title')?.textContent.trim() || '',
      image: card.querySelector('img.primary')?.src || '',
      price: card.querySelector('.price-current')?.textContent.trim() || '',
      url:   card.querySelector('.product-card-title a')?.href || '#'
    };
  }

  async function hydrate() {
    const wrap = document.querySelector('[data-recently-viewed]');
    if (!wrap) return;
    const items = read();
    const grid = wrap.querySelector('[data-rv-grid]');
    const empty = wrap.querySelector('[data-rv-empty]');
    if (items.length === 0) { empty.style.display = ''; return; }
    grid.innerHTML = items.slice(0, 6).map((it) => `
      <a href="${it.url || '#'}" class="product-card" data-product-id="${it.id}">
        <div class="product-card-media" style="aspect-ratio:1/1;overflow:hidden;border-radius:var(--radius-lg);background:var(--color-surface-2);">
          ${it.image ? `<img src="${it.image}&width=400" alt="${it.title}" loading="lazy" style="width:100%;height:100%;object-fit:cover;">` : ''}
        </div>
        <div class="product-card-body">
          <h3 class="product-card-title">${it.title || 'View product'}</h3>
          <div class="product-card-foot">${it.price || ''}</div>
        </div>
      </a>
    `).join('');
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('[data-product-info]')) record();
    hydrate();
  });
})();
