/* =====================================================
   VennixStore Elite — theme.js core orchestrator
   Hands control to subsystem modules:
     - CartEngine (cart.js)
     - ProductEngine (product.js)
     - CollectionEngine
     - SearchEngine (search.js)
     - MenuEngine (header / mega-menu)
     - SupportEngine
   ===================================================== */
(function () {
  'use strict';

  const $  = (sel, el) => (el || document).querySelector(sel);
  const $$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));

  /* ---------- Shared utilities (escaping, money, i18n, routes) ----------
     Loaded before every other module so they can rely on window.VennixUtils.
     ---------------------------------------------------------------------- */
  const HTML_ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  function ctx() {
    try { return window.App?.AppContext || VennixUtils._ctx || {}; } catch (e) { return {}; }
  }

  const VennixUtils = {
    _ctx: {},
    /* Escape text destined for an HTML template literal. */
    escapeHtml(value) {
      if (value == null) return '';
      return String(value).replace(/[&<>"']/g, (c) => HTML_ENTITIES[c]);
    },
    /* Escape a value used inside a double-quoted HTML attribute. */
    escapeAttr(value) {
      return VennixUtils.escapeHtml(value);
    },
    /* Only allow same-origin / relative URLs into href="" — blocks javascript: URIs. */
    safeUrl(value) {
      const raw = String(value == null ? '' : value).trim();
      if (!raw) return '#';
      if (/^(?:https?:|\/(?!\/)|#|\?)/i.test(raw)) return VennixUtils.escapeAttr(raw);
      return '#';
    },
    /* Append a query param to a URL that may or may not already have one. */
    withParam(url, key, value) {
      if (!url) return '';
      const sep = url.indexOf('?') === -1 ? '?' : '&';
      return `${url}${sep}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
    },
    routes() {
      const fromCtx = ctx().routes || {};
      const fromShopify = (window.Shopify && window.Shopify.routes) || {};
      const root = fromCtx.root || fromShopify.root || '/';
      return {
        root,
        cart:        fromCtx.cart        || fromShopify.cart_url            || `${root}cart`,
        cartAdd:     fromCtx.cartAdd     || fromShopify.cart_add_url        || `${root}cart/add`,
        cartChange:  fromCtx.cartChange  || fromShopify.cart_change_url     || `${root}cart/change`,
        cartJs:      `${root}cart.js`,
        cartAddJs:   `${root}cart/add.js`,
        cartChangeJs:`${root}cart/change.js`,
        search:      fromCtx.search      || fromShopify.search_url          || `${root}search`,
        collections: fromCtx.collections || fromShopify.collections_url     || `${root}collections/all`,
        checkout:    `${root}checkout`
      };
    },
    /* Translated string with {{ placeholder }} / __TOKEN__ substitution. */
    t(key, replacements) {
      const strings = ctx().strings || {};
      let out = strings[key];
      if (out == null) return '';
      Object.keys(replacements || {}).forEach((k) => {
        out = out.split(`__${k.toUpperCase()}__`).join(replacements[k]);
        out = out.replace(new RegExp(`{{\\s*${k}\\s*}}`, 'g'), replacements[k]);
      });
      return out;
    },
    formatMoney(cents) {
      const settings = ctx().settings || {};
      const currency = settings.currency || ctx().shop?.currency || 'USD';
      const locale   = settings.locale || document.documentElement.lang || 'en';
      const amount   = (Number(cents) || 0) / 100;
      try {
        return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
      } catch (e) {
        try {
          return new Intl.NumberFormat('en', { style: 'currency', currency: 'USD' }).format(amount);
        } catch (e2) { return '$' + amount.toFixed(2); }
      }
    },
    /* Free-shipping threshold in cents, sourced from theme settings. */
    freeShippingThreshold() {
      const raw = (ctx().settings || {}).freeShippingThreshold;
      const num = parseFloat(raw);
      return Number.isFinite(num) && num > 0 ? Math.round(num * 100) : 0;
    }
  };
  window.VennixUtils = VennixUtils;

  const App = {
    AppContext: {},
    modules: {},
    init() {
      this.readContext();
      this.registerModules();
      this.bindGlobalUI();
      document.addEventListener('DOMContentLoaded', () => this.startModules());
      // In case DOM is already ready
      if (document.readyState !== 'loading') this.startModules();
    },
    readContext() {
      const node = document.getElementById('ShopifyAppContext');
      try { this.AppContext = node ? JSON.parse(node.textContent) : {}; }
      catch (e) { this.AppContext = {}; }
      // Mirror onto the util module so helpers work before/independently of App.
      window.VennixUtils._ctx = this.AppContext;
    },
    registerModules() {
      // Modules attach themselves to window.[name] when their scripts load.
      // We call their `init()` if it exists.
    },
    startModules() {
      if (this._started) return;
      this._started = true;
      const order = ['MenuEngine','CartEngine','ProductEngine','CollectionEngine','SearchEngine','SupportEngine','RevealEngine'];
      order.forEach((name) => {
        const mod = window[name];
        if (mod && typeof mod.init === 'function') {
          try { mod.init(this); } catch (err) { console.warn(`[Vennix] ${name} failed`, err); }
        }
      });
      this.bindStickyHeader();
      this.bindMobileMenu();
    },
    bindStickyHeader() {
      const header = $('[data-header]');
      if (!header) return;
      const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 12);
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    },
    bindGlobalUI() { /* delegated click handlers */
      document.addEventListener('click', (e) => {
        const closeTarget = e.target.closest('[data-overlay-close]');
        if (closeTarget) {
          const overlay = closeTarget.closest('[data-overlay]');
          if (overlay) overlay.setAttribute('aria-hidden','true');
          document.body.style.overflow = '';
          return;
        }
        // generic outside-click handler for dropdowns
        const openDrop = document.querySelector('[data-dropdown][data-open="true"]');
        if (openDrop && !e.target.closest('[data-dropdown]')) {
          openDrop.setAttribute('data-open','false');
        }
      });
      // sort dropdown
      $$('.sort-dropdown').forEach((drop) => {
        const btn = drop.querySelector('.sort-dropdown-button');
        if (!btn) return;
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const isOpen = drop.getAttribute('data-open') === 'true';
          drop.setAttribute('data-open', isOpen ? 'false' : 'true');
          btn.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
        });
      });
    },
    bindMobileMenu() {
      $$('[data-mobile-trigger]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const menu = document.querySelector('[data-mobile-menu]');
          const isOpen = menu?.getAttribute('data-open') === 'true';
          menu?.setAttribute('data-open', isOpen ? 'false' : 'true');
          btn.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
          document.body.style.overflow = isOpen ? '' : 'hidden';
        });
      });
      $$('[data-mobile-close]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const menu = document.querySelector('[data-mobile-menu]');
          menu?.setAttribute('data-open','false');
          document.body.style.overflow = '';
        });
      });
    },
    formatMoney(cents) {
      return window.VennixUtils.formatMoney(cents);
    },
    safeJSON(input) {
      try { return typeof input === 'string' ? JSON.parse(input) : input; } catch{ return {}; }
    },
    publish(name, detail, target) {
      target = target || document;
      target.dispatchEvent(new CustomEvent(`vxn:${name}`, { detail, bubbles: true }));
    },
    subscribe(name, cb, target) {
      target = target || document;
      target.addEventListener(`vxn:${name}`, (e) => cb(e.detail));
    },
  };

  /* ---------- Dead placeholder engines removed ----------
     WishlistEngine / RecentlyViewedEngine previously registered empty init()
     stubs that shadowed nothing and did no work. wishlist.js and
     recently-viewed.js self-initialise on DOMContentLoaded instead.
     ------------------------------------------------------ */

  /* ---------- Reveal engine ---------- */
  window.RevealEngine = {
    init(app) {
      if (!('IntersectionObserver' in window)) return;
      const io = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add('in');
            io.unobserve(en.target);
          }
        });
      }, { rootMargin: '0px 0px -10% 0px', threshold: 0.05 });
      $$('.reveal').forEach((el) => io.observe(el));
    }
  };

  /* ---------- Support engine ---------- */
  window.SupportEngine = {
    init() {
      const pop = $('[data-support-pop]');
      if (!pop) return;
      const toggle = $('[data-support-toggle]');
      const close  = $('[data-support-close]');
      toggle?.addEventListener('click', () => {
        const open = pop.getAttribute('data-open') === 'true';
        pop.setAttribute('data-open', open ? 'false' : 'true');
        toggle.setAttribute('aria-expanded', open ? 'false' : 'true');
      });
      close?.addEventListener('click', () => pop.setAttribute('data-open','false'));
    }
  };

  /* ---------- Collection engine (filter / sort) ---------- */
  window.CollectionEngine = {
    init() {
      this.bindFilterToggles();
      this.bindFilterSubmit();
      this.bindSort();
      this.bindPriceRange();
      this.bindMerchTabs();
      this.bindInViewAnimations();
    },
    bindFilterToggles() {
      $$('[data-filter-toggle]').forEach((head) => {
        head.addEventListener('click', () => {
          const expanded = head.getAttribute('aria-expanded') !== 'false';
          head.setAttribute('aria-expanded', (!expanded).toString());
          const body = head.nextElementSibling;
          if (body?.dataset.filterBody !== undefined) {
            body.classList.toggle('collapsed');
          }
        });
      });
    },
    bindFilterSubmit() {
      // Auto-submit on filter change
      $$('[data-filter-form]').forEach((form) => {
        let submitTimer;
        const submit = () => {
          clearTimeout(submitTimer);
          submitTimer = setTimeout(() => form.submit(), 320);
        };
        form.addEventListener('change', submit);
        // make label-style options act like radios
        form.querySelectorAll('.filter-option, .filter-swatch').forEach((opt) => {
          opt.addEventListener('click', (e) => {
            e.preventDefault();
            const inp = opt.querySelector('input[type="checkbox"]');
            if (!inp) return;
            inp.checked = !inp.checked;
            opt.setAttribute('aria-pressed', inp.checked.toString());
            submit();
          });
        });
      });
    },
    bindSort() {
      $$('.sort-dropdown .sort-option').forEach((opt) => {
        opt.addEventListener('click', () => {
          const v = opt.dataset.sortValue;
          const url = new URL(window.location.href);
          url.searchParams.set('sort_by', v);
          window.location.href = url.toString();
        });
      });
    },
    bindPriceRange() {
      $$('.filter-price[data-price-range]').forEach((wrap) => {
        const min = parseInt(wrap.dataset.min, 10) || 0;
        const max = parseInt(wrap.dataset.max, 10) || 1000;
        const minIn = wrap.querySelector('[name="filter.v.price.gte"]');
        const maxIn = wrap.querySelector('[name="filter.v.price.lte"]');
        const fill = wrap.querySelector('[data-track-fill]');
        const minR  = wrap.querySelector('[data-range-min]');
        const maxR  = wrap.querySelector('[data-range-max]');
        if (!minIn && !maxIn && !minR && !maxR) return;
        const sync = () => {
          const lo = parseInt((minIn && minIn.value) || (minR && minR.value), 10) || min;
          const hi = parseInt((maxIn && maxIn.value) || (maxR && maxR.value), 10) || max;
          if (minR) minR.value = lo;
          if (maxR) maxR.value = hi;
          if (fill) {
            const lp = ((lo - min) / (max - min) * 100);
            const hp = ((hi - min) / (max - min) * 100);
            fill.style.left  = lp + '%';
            fill.style.right = (100 - hp) + '%';
          }
        };
        [minR, maxR, minIn, maxIn].forEach((el) => el && el.addEventListener('input', sync));
        sync();
      });
    },
    bindMerchTabs() {
      // home page tabs swap collections
      $$('[data-merch-tabs]').forEach((tabs) => {
        tabs.addEventListener('click', (e) => {
          const btn = e.target.closest('[data-merch-trigger]');
          if (!btn) return;
          tabs.querySelectorAll('[data-merch-trigger]').forEach((b) => b.setAttribute('aria-current','false'));
          btn.setAttribute('aria-current','true');
          window.location.hash = '#' + btn.dataset.merchTrigger;
        });
      });
    },
    bindInViewAnimations() {
      if (!('IntersectionObserver' in window)) return;
      const io = new IntersectionObserver((entries) => {
        entries.forEach((en, i) => {
          if (en.isIntersecting) {
            setTimeout(() => en.target.classList.add('in'), i * 50);
            io.unobserve(en.target);
          }
        });
      }, { rootMargin: '0px 0px -10% 0px', threshold: 0.05 });
      $$('.product-card.reveal, .collection-toolbar, .heading-row').forEach((el) => io.observe(el));
    }
  };

  window.App = App;
  App.init();

  // ----- Boot signal so lazy modules can register -----
  window.dispatchEvent(new CustomEvent('vxn:boot'));
})();
