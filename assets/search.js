(function () {
  'use strict';

  const $ = (selector, context = document) => context.querySelector(selector);
  const $$ = (selector, context = document) => Array.from(context.querySelectorAll(selector));
  let abortController;
  let debounceTimer;

  function context() { return window.VennixUtils; }

  const SearchEngine = {
    init() {
      this.mount = $('#PredictiveSearchMount');
      this.dialog = $('[data-predictive-dialog]', this.mount || document);
      this.input = $('[data-predictive-input]', this.mount || document);
      this.results = $('[data-predictive-body]', this.mount || document);
      this.viewAll = $('[data-search-view-all]', this.mount || document);
      if (!this.mount || !this.dialog || !this.input || !this.results) return;
      this.initialResults = this.results.innerHTML;
      this.bind();
    },

    bind() {
      $$('[data-search-open]').forEach((button) => {
        if (button.dataset.bound) return;
        button.dataset.bound = 'true';
        button.addEventListener('click', () => this.open(button));
      });
      $$('[data-search-close]', this.mount).forEach((button) => button.addEventListener('click', () => this.close()));
      this.mount.addEventListener('click', (event) => { if (event.target === this.mount) this.close(); });
      this.input.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        const term = this.input.value.trim();
        debounceTimer = setTimeout(() => this.predict(term), 180);
      });
      this.input.addEventListener('keydown', (event) => this.onInputKeydown(event));
      this.dialog.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') { this.close(); return; }
        const options = $$('[role="option"]', this.results);
        const currentIndex = options.indexOf(document.activeElement);
        if (currentIndex >= 0 && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
          event.preventDefault();
          const direction = event.key === 'ArrowDown' ? 1 : -1;
          const nextIndex = (currentIndex + direction + options.length) % options.length;
          this.activeIndex = nextIndex;
          options[nextIndex].focus();
          return;
        }
        window.VennixA11y?.trap(event, this.dialog);
      });
    },

    open(opener) {
      this.opener = opener || document.activeElement;
      this.mount.setAttribute('aria-hidden', 'false');
      document.body.classList.add('drawer-open');
      requestAnimationFrame(() => this.input.focus());
    },

    close() {
      this.mount.setAttribute('aria-hidden', 'true');
      this.input.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('drawer-open');
      this.opener?.focus();
    },

    async predict(term) {
      this.viewAll.hidden = !term;
      if (term) this.viewAll.href = `${context().routes().search}?q=${encodeURIComponent(term)}`;
      if (term.length < 2) {
        this.results.innerHTML = this.initialResults;
        this.input.setAttribute('aria-expanded', 'false');
        return;
      }

      abortController?.abort();
      abortController = new AbortController();
      this.results.innerHTML = `<p class="predictive-hint">${context().escapeHtml(context().t('loading') || 'Loading…')}</p>`;

      const types = ['product'];
      const settings = window.App?.AppContext?.settings || {};
      if (settings.predictiveCollections) types.push('collection');
      if (settings.predictivePages) types.push('page');
      if (settings.predictiveArticles) types.push('article');
      const root = context().routes().root;
      const endpoint = `${root}search/suggest.json?q=${encodeURIComponent(term)}&resources[type]=${types.join(',')}&resources[limit]=6&resources[options][unavailable_products]=last`;

      try {
        const response = await fetch(endpoint, { credentials: 'same-origin', signal: abortController.signal });
        if (!response.ok) throw new Error(String(response.status));
        const payload = await response.json();
        this.render(payload.resources?.results || {}, term);
      } catch (error) {
        if (error.name === 'AbortError') return;
        this.results.innerHTML = `<p class="predictive-hint">${context().escapeHtml(context().t('searchUnavailable') || 'Search is unavailable right now')}</p>`;
      }
    },

    render(resources, term) {
      const groups = [];
      if (resources.products?.length) groups.push(this.productGroup(resources.products));
      if (resources.collections?.length) groups.push(this.linkGroup('Collections', resources.collections));
      if (resources.pages?.length) groups.push(this.linkGroup('Pages', resources.pages));
      if (resources.articles?.length) groups.push(this.linkGroup('Articles', resources.articles));

      if (!groups.length) {
        this.results.innerHTML = `<div class="predictive-empty"><strong>${context().escapeHtml(context().t('noResults') || 'No results found')}</strong><a href="${context().safeUrl(context().routes().collections)}">Browse collections</a></div>`;
      } else {
        this.results.innerHTML = groups.join('');
      }
      this.input.setAttribute('aria-expanded', groups.length ? 'true' : 'false');
      this.activeIndex = -1;
    },

    productGroup(products) {
      const rows = products.slice(0, 6).map((product) => {
        const image = product.image || product.featured_image?.url || '';
        const price = this.searchPrice(product.price);
        const comparePrice = this.searchPrice(product.compare_at_price_max || product.compare_at_price);
        const compare = comparePrice && comparePrice.cents > price.cents
          ? `<s>${context().escapeHtml(comparePrice.formatted)}</s>` : '';
        return `<a class="predictive-row" role="option" href="${context().safeUrl(product.url)}">
          <span class="predictive-image">${image ? `<img src="${context().escapeAttr(context().withParam(image, 'width', 120))}" alt="" width="60" height="60" loading="lazy">` : ''}</span>
          <span class="predictive-meta"><strong>${context().escapeHtml(product.title)}</strong><span>${context().escapeHtml(price.formatted)} ${compare}</span></span>
        </a>`;
      }).join('');
      return `<section class="predictive-group"><h3>Products</h3>${rows}</section>`;
    },

    linkGroup(title, items) {
      return `<section class="predictive-group"><h3>${title}</h3>${items.slice(0, 5).map((item) => `<a class="predictive-row predictive-row--text" role="option" href="${context().safeUrl(item.url)}"><strong>${context().escapeHtml(item.title)}</strong></a>`).join('')}</section>`;
    },

    searchPrice(value) {
      if (value == null || value === '') return { cents: 0, formatted: '' };
      const normalized = String(value).replace(/[^0-9.-]/g, '');
      const cents = Math.round((parseFloat(normalized) || 0) * 100);
      return { cents, formatted: context().formatMoney(cents) };
    },

    onInputKeydown(event) {
      const options = $$('[role="option"]', this.results);
      if (!options.length) return;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const direction = event.key === 'ArrowDown' ? 1 : -1;
        this.activeIndex = ((this.activeIndex ?? -1) + direction + options.length) % options.length;
        options[this.activeIndex].focus();
      }
    }
  };

  window.SearchEngine = SearchEngine;
})();
