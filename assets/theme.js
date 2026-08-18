(function () {
  'use strict';

  const $ = (selector, context = document) => context.querySelector(selector);
  const $$ = (selector, context = document) => Array.from(context.querySelectorAll(selector));
  const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  const VennixUtils = {
    _context: {},
    escapeHtml(value) { return value == null ? '' : String(value).replace(/[&<>"']/g, (character) => entities[character]); },
    escapeAttr(value) { return this.escapeHtml(value); },
    safeUrl(value) {
      const raw = String(value || '').trim();
      if (!raw) return '#';
      try {
        const parsed = new URL(raw, window.location.origin);
        if (!['http:', 'https:'].includes(parsed.protocol)) return '#';
        return this.escapeAttr(raw);
      } catch (_) { return '#'; }
    },
    withParam(value, key, parameter) {
      const raw = String(value || '');
      if (!raw) return '';
      return `${raw}${raw.includes('?') ? '&' : '?'}${encodeURIComponent(key)}=${encodeURIComponent(parameter)}`;
    },
    routes() {
      const contextRoutes = this._context.routes || {};
      const root = contextRoutes.root || window.Shopify?.routes?.root || '/';
      const normalizedRoot = root.endsWith('/') ? root : `${root}/`;
      return {
        root: normalizedRoot,
        cart: contextRoutes.cart || `${normalizedRoot}cart`,
        cartAdd: contextRoutes.cartAdd || `${normalizedRoot}cart/add`,
        cartChange: contextRoutes.cartChange || `${normalizedRoot}cart/change`,
        cartJs: `${normalizedRoot}cart.js`,
        cartAddJs: `${normalizedRoot}cart/add.js`,
        cartChangeJs: `${normalizedRoot}cart/change.js`,
        search: contextRoutes.search || `${normalizedRoot}search`,
        collections: contextRoutes.collections || `${normalizedRoot}collections`,
        recommendations: contextRoutes.recommendations || `${normalizedRoot}recommendations/products`
      };
    },
    t(key, replacements = {}) {
      let string = this._context.strings?.[key] || '';
      Object.entries(replacements).forEach(([name, value]) => {
        string = string.split(`__${name.toUpperCase()}__`).join(value);
        string = string.replace(new RegExp(`{{\\s*${name}\\s*}}`, 'g'), value);
      });
      return string;
    },
    formatMoney(cents) {
      const amount = (Number(cents) || 0) / 100;
      const currency = this._context.settings?.currency || this._context.shop?.currency || 'USD';
      const locale = this._context.settings?.locale || document.documentElement.lang || 'en';
      try { return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount); }
      catch (_) { return `${amount.toFixed(2)} ${currency}`; }
    },
    freeShippingThreshold() {
      if (!this._context.settings?.freeShippingBar) return 0;
      const amount = parseFloat(this._context.settings?.freeShippingThreshold);
      return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) : 0;
    }
  };
  window.VennixUtils = VennixUtils;

  window.VennixA11y = {
    focusable(container) {
      return $$('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), details > summary, [tabindex]:not([tabindex="-1"])', container).filter((node) => !node.hidden && node.offsetParent !== null);
    },
    trap(event, container) {
      if (event.key !== 'Tab') return;
      const nodes = this.focusable(container);
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  };

  const MenuEngine = {
    init() {
      this.bindMegaMenus();
      this.bindMobileMenu();
    },
    bindMegaMenus() {
      $$('[data-mega]').forEach((item) => {
        if (item.dataset.bound) return;
        item.dataset.bound = 'true';
        const toggle = $('[data-mega-toggle]', item);
        const content = $('[data-mega-content]', item);
        if (!toggle || !content) return;
        const setOpen = (open) => {
          item.dataset.open = String(open);
          toggle.setAttribute('aria-expanded', String(open));
          content.setAttribute('aria-hidden', String(!open));
        };
        toggle.addEventListener('click', (event) => {
          event.preventDefault();
          const next = item.dataset.open !== 'true';
          $$('[data-mega][data-open="true"]').forEach((other) => {
            if (other === item) return;
            other.dataset.open = 'false';
            $('[data-mega-toggle]', other)?.setAttribute('aria-expanded', 'false');
            $('[data-mega-content]', other)?.setAttribute('aria-hidden', 'true');
          });
          setOpen(next);
          if (next) requestAnimationFrame(() => $('a', content)?.focus());
        });
        item.addEventListener('mouseenter', () => { if (window.matchMedia('(hover:hover) and (min-width:990px)').matches) setOpen(true); });
        item.addEventListener('mouseleave', () => { if (window.matchMedia('(hover:hover) and (min-width:990px)').matches) setOpen(false); });
        item.addEventListener('keydown', (event) => { if (event.key === 'Escape') { setOpen(false); toggle.focus(); } });
      });
      document.addEventListener('click', (event) => {
        if (event.target.closest('[data-mega]')) return;
        $$('[data-mega][data-open="true"]').forEach((item) => {
          item.dataset.open = 'false';
          $('[data-mega-toggle]', item)?.setAttribute('aria-expanded', 'false');
          $('[data-mega-content]', item)?.setAttribute('aria-hidden', 'true');
        });
      });
    },
    bindMobileMenu() {
      const menu = $('[data-mobile-menu]');
      const panel = $('.mobile-menu-panel', menu || document);
      if (!menu || !panel) return;
      const open = (opener) => {
        this.mobileOpener = opener;
        menu.dataset.open = 'true';
        menu.setAttribute('aria-hidden', 'false');
        opener?.setAttribute('aria-expanded', 'true');
        document.body.classList.add('drawer-open');
        requestAnimationFrame(() => panel.focus());
      };
      const close = () => {
        menu.dataset.open = 'false';
        menu.setAttribute('aria-hidden', 'true');
        $$('[data-mobile-trigger]').forEach((button) => button.setAttribute('aria-expanded', 'false'));
        document.body.classList.remove('drawer-open');
        this.mobileOpener?.focus();
      };
      $$('[data-mobile-trigger]').forEach((button) => button.addEventListener('click', () => open(button)));
      $$('[data-mobile-close]', menu).forEach((button) => button.addEventListener('click', close));
      panel.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') close();
        window.VennixA11y.trap(event, panel);
      });
    }
  };
  window.MenuEngine = MenuEngine;

  const CollectionEngine = {
    init() {
      this.bindFilterDrawer();
      this.bindSort();
      this.bindDesktopFilters();
    },
    bindFilterDrawer() {
      $$('[data-filter-drawer]').forEach((drawer) => {
        if (drawer.dataset.bound) return;
        drawer.dataset.bound = 'true';
        const panel = $('.filter-panel', drawer);
        const opener = document.querySelector(`[data-filter-open][aria-controls="${drawer.id}"]`);
        const setA11y = () => { if (window.innerWidth >= 990) drawer.setAttribute('aria-hidden', 'false'); else if (drawer.dataset.open !== 'true') drawer.setAttribute('aria-hidden', 'true'); };
        const open = () => {
          drawer.dataset.open = 'true';
          drawer.setAttribute('aria-hidden', 'false');
          opener?.setAttribute('aria-expanded', 'true');
          document.body.classList.add('drawer-open');
          requestAnimationFrame(() => panel?.focus());
        };
        const close = () => {
          drawer.dataset.open = 'false';
          if (window.innerWidth < 990) drawer.setAttribute('aria-hidden', 'true');
          opener?.setAttribute('aria-expanded', 'false');
          document.body.classList.remove('drawer-open');
          opener?.focus();
        };
        opener?.addEventListener('click', open);
        $$('[data-filter-close]', drawer).forEach((button) => button.addEventListener('click', close));
        panel?.addEventListener('keydown', (event) => {
          if (event.key === 'Escape') close();
          window.VennixA11y.trap(event, panel);
        });
        window.addEventListener('resize', setA11y, { passive: true });
        setA11y();
      });
    },
    bindSort() {
      $$('[data-sort-select]').forEach((select) => {
        if (select.dataset.bound) return;
        select.dataset.bound = 'true';
        select.addEventListener('change', () => {
          const url = new URL(window.location.href);
          url.searchParams.set('sort_by', select.value);
          url.searchParams.delete('page');
          window.location.assign(url.toString());
        });
      });
    },
    bindDesktopFilters() {
      $$('[data-filter-form]').forEach((form) => {
        if (form.dataset.bound) return;
        form.dataset.bound = 'true';
        form.addEventListener('change', () => {
          if (window.innerWidth >= 990) form.requestSubmit();
        });
      });
    }
  };
  window.CollectionEngine = CollectionEngine;

  const SupportEngine = {
    init() {
      $$('[data-support-pop]').forEach((widget) => {
        const toggle = $('[data-support-toggle]', widget);
        const panel = $('[data-support-card]', widget);
        const close = () => { widget.dataset.open = 'false'; toggle?.setAttribute('aria-expanded', 'false'); };
        toggle?.addEventListener('click', () => {
          const open = widget.dataset.open !== 'true';
          widget.dataset.open = String(open);
          toggle.setAttribute('aria-expanded', String(open));
          if (open) panel?.focus();
        });
        $('[data-support-close]', widget)?.addEventListener('click', close);
        widget.addEventListener('keydown', (event) => { if (event.key === 'Escape') { close(); toggle?.focus(); } });
      });
    }
  };
  window.SupportEngine = SupportEngine;

  const RevealEngine = {
    init() {
      const nodes = $$('.reveal:not(.is-visible)');
      if (!('IntersectionObserver' in window)) { nodes.forEach((node) => node.classList.add('is-visible')); return; }
      const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }), { rootMargin: '0px 0px -40px', threshold: 0.01 });
      nodes.forEach((node) => observer.observe(node));
    }
  };
  window.RevealEngine = RevealEngine;

  const App = {
    AppContext: {},
    started: false,
    init() {
      try { this.AppContext = JSON.parse($('#ShopifyAppContext')?.textContent || '{}'); }
      catch (_) { this.AppContext = {}; }
      VennixUtils._context = this.AppContext;
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => this.start(), { once: true });
      else this.start();
    },
    start() {
      if (this.started) return;
      this.started = true;
      ['MenuEngine', 'CartEngine', 'ProductEngine', 'CollectionEngine', 'SearchEngine', 'SupportEngine', 'RevealEngine'].forEach((name) => {
        try { window[name]?.init?.(this); } catch (error) { console.warn(`[VennixStore] ${name}`, error); }
      });
      this.bindHeader();
      this.bindAnnouncements();
      document.addEventListener('vxn:content:loaded', () => window.RevealEngine?.init());
    },
    bindHeader() {
      const header = $('[data-header]');
      if (!header) return;
      const update = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
      window.addEventListener('scroll', update, { passive: true });
      update();
    },
    bindAnnouncements() {
      $$('[data-announcement]').forEach((announcement) => {
        const key = `vennix-announcement-${announcement.dataset.announcementId}`;
        try { if (window.localStorage.getItem(key) === 'dismissed') announcement.hidden = true; } catch (_) {}
        $('[data-announcement-close]', announcement)?.addEventListener('click', () => {
          announcement.hidden = true;
          try { window.localStorage.setItem(key, 'dismissed'); } catch (_) {}
        });
      });
    }
  };

  window.App = App;
  App.init();
})();
