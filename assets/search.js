/* ============================================================
   VennixStore Elite — Predictive search + on-page search engine
   ============================================================ */
(function () {
  'use strict';
  const $  = (s, c) => (c||document).querySelector(s);
  const $$ = (s, c) => Array.from((c||document).querySelectorAll(s));
  const U   = () => window.VennixUtils;
  const esc = (v) => window.VennixUtils.escapeHtml(v);
  const url = (v) => window.VennixUtils.safeUrl(v);
  const SHOP = () => window.VennixUtils.routes().root;

  const formatMoney = (cents) => window.VennixUtils.formatMoney(cents);

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
      // 'vxn:boot' fired again on top of the direct call, double-binding openers.
      this.bindOpeners();
    },
    bindOpeners() {
      $$('[data-search-open]').forEach((btn) => {
        if (btn.dataset.vxnBound === '1') return;
        btn.dataset.vxnBound = '1';
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          this.openDrawer();
        });
      });
      $$('[data-search-close]').forEach((btn) => {
        if (btn.dataset.vxnBound === '1') return;
        btn.dataset.vxnBound = '1';
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
        if (!input) return mount;
        input.addEventListener('input', debounce((e) => this.predict(e.target.value), 160));
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            location.href = U().withParam(routesAll().search, 'q', input.value);
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
      // Was re-registering a new keydown handler on every open (listener leak).
      if (!this.escClose) {
        this.escClose = (e) => { if (e.key === 'Escape') this.closeDrawer(); };
        document.addEventListener('keydown', this.escClose);
      }
    },
    closeDrawer() {
      const mount = $('#PredictiveSearchMount');
      if (!mount) return;
      mount.setAttribute('aria-hidden','true');
      document.body.style.overflow = '';
    },
    bindHeaders() { /* placeholder for header search */ },
    async predict(term) {
      const body = $('[data-predictive-body]');
      if (!term || term.length < 2) {
        body.innerHTML = `
          <div class="predictive-search-section">
            <h4>Try searching</h4>
            <div style="padding:0 .8rem;display:flex;gap:.4rem;flex-wrap:wrap;">
              ${['Hoodies','Sneakers','Outerwear','Sale'].map((t) => `<a class="icon-pill" href="${esc(U().withParam(routesAll().search, 'q', t))}">${esc(t)}</a>`).join('')}
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
      const endpoint = `${SHOP()}search/suggest.json?q=${encodeURIComponent(term)}&resources[type]=${types}&resources[limit]=6`;
      try {
        const r = await fetch(endpoint, { credentials:'same-origin' });
        const json = await r.json();
        this.renderResults(json.resources?.results || {}, term);
      } catch (e) {
        body.innerHTML = `<div class="predictive-search-empty">${esc(U().t('searchUnavailable') || 'Search unavailable')}</div>`;
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
              <a class="predictive-search-row" href="${url(p.url)}">
                <div class="predictive-search-thumb">${p.featured_image?.url ? `<img src="${esc(U().withParam(p.featured_image.url, 'width', 100))}" alt="" loading="lazy">` : ''}</div>
                <div class="predictive-search-meta">
                  <div class="predictive-search-title">${esc(p.title)}</div>
                  <div class="predictive-search-sub">${esc(formatMoney(p.price))}</div>
                </div>
              </a>`).join('')}
            <a class="predictive-search-row" href="${esc(U().withParam(U().withParam(routesAll().search, 'q', term), 'type', 'product'))}" style="color:var(--color-accent);font-weight:600;font-size:.85rem;">${esc(U().t('viewAll') || 'View all results')} →</a>
          </div>`);
      }
      if (resources.collections?.length) {
        sections.push(`
          <div class="predictive-search-section">
            <h4>Collections</h4>
            ${resources.collections.slice(0, 4).map((c) => `
              <a class="predictive-search-row" href="${url(c.url)}">
                <div class="predictive-search-meta">
                  <div class="predictive-search-title">${esc(c.title)}</div>
                  <div class="predictive-search-sub">${esc(c.products_count)} products</div>
                </div>
              </a>`).join('')}
          </div>`);
      }
      if (resources.pages?.length) {
        sections.push(`
          <div class="predictive-search-section">
            <h4>Pages</h4>
            ${resources.pages.slice(0, 4).map((p) => `
              <a class="predictive-search-row" href="${url(p.url)}">
                <div class="predictive-search-meta">
                  <div class="predictive-search-title">${esc(p.title)}</div>
                </div>
              </a>`).join('')}
          </div>`);
      }
      if (resources.articles?.length) {
        sections.push(`
          <div class="predictive-search-section">
            <h4>Articles</h4>
            ${resources.articles.slice(0, 4).map((a) => `
              <a class="predictive-search-row" href="${url(a.url)}">
                <div class="predictive-search-meta">
                  <div class="predictive-search-title">${esc(a.title)}</div>
                </div>
              </a>`).join('')}
          </div>`);
      }
      if (sections.length === 0) {
        body.innerHTML = `<div class="predictive-search-empty">${esc(U().t('noResults', { terms: term }) || `No matches for “${term}”`)}</div>`;
      } else {
        body.innerHTML = sections.join('');
      }
    }
  };

  function routesAll() {
    return {
      search: U().routes().search,
      collections: U().routes().collections
    };
  }

  window.SearchEngine = SearchEngine;
})();
