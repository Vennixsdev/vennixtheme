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
      this.CSRF_TOKENS = {};
      document.cookie.split(';').forEach((c) => {
        const [k,v] = c.trim().split('=');
        if (k && v) this.CSRF_TOKENS[k] = decodeURIComponent(v);
      });
    },
    registerModules() {
      // Modules attach themselves to window.[name] when their scripts load.
      // We call their `init()` if it exists.
    },
    startModules() {
      const order = ['MenuEngine','CartEngine','ProductEngine','CollectionEngine','SearchEngine','SupportEngine','RevealEngine','WishlistEngine','RecentlyViewedEngine'];
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
      try {
        return new Intl.NumberFormat(this.AppContext?.settings?.currency ? 'en' : 'en', {
          style: 'currency',
          currency: this.AppContext?.settings?.currency || 'USD'
        }).format((cents || 0)/100);
      } catch (e) { return '$' + (cents/100).toFixed(2); }
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

  /* ---------- Reveal engine ---------- */
  // Placeholder — wishlist & recently viewed mounted via script tags below.
  window.WishlistEngine = { init(app) {
    if (typeof window.VennixWishlist === 'undefined') {
      // ensure script present
    }
  }};
  window.RecentlyViewedEngine = { init(app) {
    const node = document.getElementById('VennixRecentlyViewed');
    if (!node) return;
    try {
      const items = JSON.parse(localStorage.getItem('vxn_recently_v1') || '[]');
      // hydrate any cards we have
    } catch {}
  }};

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
        const sync = () => {
          const lo = parseInt(minIn.value || minR.value, 10) || 0;
          const hi = parseInt(maxIn.value || maxR.value, 10) || max;
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
      $$('.product-card.reveal').forEach((c) => c.classList.add('reveal'));
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
