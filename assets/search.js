/* ============================================================
   VennixStore Elite — Predictive search + on-page search engine
   ============================================================ */
(function () {
  'use strict';
  const $  = (s, c) => (c||document).querySelector(s);
  const $$ = (s, c) => Array.from((c||document).querySelectorAll(s));
  const SHOP = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';

  const formatMoney = (cents) => {
    try { return new Intl.NumberFormat('en', { style:'currency', currency: window.App?.AppContext?.settings?.currency || 'USD' }).format((cents||0)/100); }
    catch (e) { return '$' + (cents/100).toFixed(2); }
  };

  function debounce(fn, ms) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  const SearchEngine = {
    init(app) {
      this.app = app;
      this.bindHeaders();
      // footer / generic forms — submit as-is
      $$('.search-form').forEach((f) => {
        const i = f.querySelector('input[type="search"]');
        if (!i) return;
      });
      window.addEventListener('vxn:boot', () => this.bindOpeners());
      this.bindOpeners();
    },
    bindOpeners() {
      $$('[data-search-open]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          this.openDrawer();
        });
      });
      $$('[data-search-close]').forEach((btn) => {
        btn.addEventListener('click', () => this.closeDrawer());
      });
    },
    ensurePanel() {
      let mount = $('#PredictiveSearchMount');
      if (!mount) return null;
      if (!mount.firstElementChild) {
        mount.innerHTML = `
          <div class="predictive-search-panel" data-overlay role="dialog" aria-label="Predictive search">
            <div class="predictive-search-input">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input type="search" placeholder="Search products, collections, articles…" data-predictive-input autocomplete="off">
              <button type="button" class="overlay-close" data-search-close aria-label="Close">×</button>
            </div>
            <div class="predictive-search-body" data-predictive-body></div>
            <div class="predictive-search-footer">
              <small>Type to search · press ESC to close</small>
              <a href="${routesAll()['search']}">View all results →</a>
            </div>
          </div>`;
        // bind
        const input = mount.querySelector('[data-predictive-input]');
        input.addEventListener('input', debounce((e) => this.predict(e.target.value), 160));
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            location.href = `${routesAll().search}?q=${encodeURIComponent(input.value)}`;
          }
        });
      }
      return mount;
    },
    openDrawer() {
      const mount = this.ensurePanel();
      if (!mount) return;
      mount.setAttribute('aria-hidden','false');
      const inp = mount.querySelector('[data-predictive-input]');
      requestAnimationFrame(() => inp?.focus());
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', this.escClose = (e) => {
        if (e.key === 'Escape') this.closeDrawer();
      });
    },
    closeDrawer() {
      const mount = $('#PredictiveSearchMount');
      if (!mount) return;
      mount.setAttribute('aria-hidden','true');
      document.body.style.overflow = '';
      if (this.escClose) document.removeEventListener('keydown', this.escClose);
    },
    bindHeaders() { /* placeholder for header search */ },
    async predict(term) {
      const body = $('[data-predictive-body]');
      if (!term || term.length < 2) {
        body.innerHTML = `
          <div class="predictive-search-section">
            <h4>Try searching</h4>
            <div style="padding:0 .8rem;display:flex;gap:.4rem;flex-wrap:wrap;">
              ${['Hoodies','Sneakers','Outerwear','Sale'].map((t) => `<a class="icon-pill" href="${routesAll().search}?q=${encodeURIComponent(t)}">${t}</a>`).join('')}
            </div>
          </div>`;
        return;
      }
      const types = [
        window.App?.AppContext?.settings?.enable_p_type_products !== false ? 'product' : null,
        window.App?.AppContext?.settings?.enable_p_type_collections ? 'collection' : null,
        window.App?.AppContext?.settings?.enable_p_type_pages ? 'page' : null,
        window.App?.AppContext?.settings?.enable_p_type_articles ? 'article' : null,
      ].filter(Boolean).join(',') || 'product';
      const url = `${SHOP}search/suggest.json?q=${encodeURIComponent(term)}&resources[type]=${types}&resources[limit]=6`;
      try {
        const r = await fetch(url, { credentials:'same-origin' });
        const json = await r.json();
        this.renderResults(json.resources?.results || {}, term);
      } catch (e) {
        body.innerHTML = `<div class="predictive-search-empty">Search unavailable</div>`;
      }
    },
    renderResults(resources, term) {
      const body = $('[data-predictive-body]');
      const sections = [];
      if (resources.products?.length) {
        sections.push(`
          <div class="predictive-search-section">
            <h4>Products</h4>
            ${resources.products.slice(0, 5).map((p) => `
              <a class="predictive-search-row" href="${p.url}">
                <div class="predictive-search-thumb">${p.featured_image ? `<img src="${p.featured_image.url}&width=100" alt="">` : ''}</div>
                <div class="predictive-search-meta">
                  <div class="predictive-search-title">${p.title}</div>
                  <div class="predictive-search-sub">${formatMoney(p.price)}</div>
                </div>
              </a>`).join('')}
            <a class="predictive-search-row" href="${routesAll().search}?q=${encodeURIComponent(term)}&type=product" style="color:var(--color-accent);font-weight:600;font-size:.85rem;">View all product matches →</a>
          </div>`);
      }
      if (resources.collections?.length) {
        sections.push(`
          <div class="predictive-search-section">
            <h4>Collections</h4>
            ${resources.collections.slice(0, 4).map((c) => `
              <a class="predictive-search-row" href="${c.url}">
                <div class="predictive-search-meta">
                  <div class="predictive-search-title">${c.title}</div>
                  <div class="predictive-search-sub">${c.products_count} products</div>
                </div>
              </a>`).join('')}
          </div>`);
      }
      if (resources.pages?.length) {
        sections.push(`
          <div class="predictive-search-section">
            <h4>Pages</h4>
            ${resources.pages.slice(0, 4).map((p) => `
              <a class="predictive-search-row" href="${p.url}">
                <div class="predictive-search-meta">
                  <div class="predictive-search-title">${p.title}</div>
                </div>
              </a>`).join('')}
          </div>`);
      }
      if (resources.articles?.length) {
        sections.push(`
          <div class="predictive-search-section">
            <h4>Articles</h4>
            ${resources.articles.slice(0, 4).map((a) => `
              <a class="predictive-search-row" href="${a.url}">
                <div class="predictive-search-meta">
                  <div class="predictive-search-title">${a.title}</div>
                </div>
              </a>`).join('')}
          </div>`);
      }
      if (sections.length === 0) {
        body.innerHTML = `<div class="predictive-search-empty">No matches for “${term}” — but there's a great find waiting.</div>`;
      } else {
        body.innerHTML = sections.join('');
      }
    }
  };

  function routesAll() {
    return {
      search: window.Shopify?.routes?.search_url || '/search',
      collections: window.Shopify?.routes?.collections_url || '/collections'
    };
  }

  window.SearchEngine = SearchEngine;
})();
