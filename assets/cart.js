/* ============================================================
   VennixStore Elite — Cart engine
   Talks to Shopify's AJAX Cart API (/cart.js, /cart/add.js, etc).
   Re-renders drawer / page when state changes.
   ============================================================ */
(function () {
  'use strict';

  const $  = (s, c) => (c||document).querySelector(s);
  const $$ = (s, c) => Array.from((c||document).querySelectorAll(s));

  const U = () => window.VennixUtils;
  const R = () => window.VennixUtils.routes();
  const esc = (v) => window.VennixUtils.escapeHtml(v);
  const url = (v) => window.VennixUtils.safeUrl(v);

  async function getCart() {
    try {
      const r = await fetch(R().cartJs, { credentials: 'same-origin', headers: { 'X-Requested-With':'XMLHttpRequest' } });
      return await r.json();
    } catch (e) { console.warn('[Vennix] cart fetch failed', e); return null; }
  }
  async function changeQty(key, qty) {
    try {
      const r = await fetch(R().cartChangeJs, {
        method:'POST',
        credentials:'same-origin',
        headers:{ 'Content-Type':'application/json', 'X-Requested-With':'XMLHttpRequest' },
        body: JSON.stringify({ id: key, quantity: qty })
      });
      return r.ok ? r.json() : null;
    } catch (e) { return null; }
  }
  async function addItem(id, qty, properties) {
    const r = await fetch(R().cartAddJs, {
      method:'POST',
      credentials:'same-origin',
      headers:{ 'Content-Type':'application/json', 'Accept':'application/javascript', 'X-Requested-With':'XMLHttpRequest' },
      body: JSON.stringify({ id, quantity: qty || 1, properties: properties || {} })
    });
    return r.json();
  }
  async function addItemForm(formData) {
    const r = await fetch(R().cartAddJs, {
      method:'POST',
      credentials:'same-origin',
      body: formData
    });
    if (!r.ok) throw new Error('add failed');
    return r.json();
  }

  const formatMoney = (cents) => window.VennixUtils.formatMoney(cents);

  const CartEngine = {
    drawOpen: false,
    init(app) {
      this.app = app;
      this.bindAddToCart();
      this.bindDrawerTriggers();
      this.bindDrawerClose();
      this.bindPage();
      this.bindUpsell();
      window.addEventListener('vxn:cart:add',     () => this.refreshCart('flash', U().t('added') || 'Added'));
      window.addEventListener('vxn:cart:changed', () => this.refreshCart());
      // Listen for cross-component updates
      document.addEventListener('vxn:cart:add',     (e) => this.refreshCart('flash', e.detail?.label || U().t('added') || 'Added'));
      document.addEventListener('vxn:cart:changed', () => this.refreshCart());
      this.refreshCart();
    },
    openDrawer() {
      const mount = document.getElementById('CartDrawerMount');
      if (!mount) return;
      mount.setAttribute('aria-hidden','false');
      document.body.style.overflow = 'hidden';
    },
    closeDrawer() {
      const mount = document.getElementById('CartDrawerMount');
      if (!mount) return;
      mount.setAttribute('aria-hidden','true');
      document.body.style.overflow = '';
    },
    bindAddToCart() {
      // Guard: init() and the DOMContentLoaded hook can both reach this.
      // Without the flag every listener was attached twice (double add-to-cart).
      if (this._addToCartBound) return;
      this._addToCartBound = true;
      // pages with the traditional form submit
      $$('[data-product-form]').forEach((form) => {
        form.addEventListener('submit', async (e) => {
          if (window.App?.AppContext?.settings?.cart_type !== 'drawer' && !form.matches('[data-add-from-anywhere]')) return;
          if (form.dataset.classic === '1') return; // opt-out for direct checkout
          e.preventDefault();
          const fd = new FormData(form);
          try {
            const r = await addItemForm(fd);
            this.openDrawer();
            this.refreshCart('flash', U().t('added') || 'Added');
          } catch (err) {
            console.warn(err);
          }
        });
      });
      // quick add on collection grid
      document.addEventListener('click', async (e) => {
        const quick = e.target.closest('[data-quick-add]');
        if (!quick) return;
        e.preventDefault();
        const form = quick.closest('form');
        if (!form) return;
        try {
          const fd = new FormData(form);
          await addItemForm(fd);
          this.openDrawer();
          this.refreshCart('flash', U().t('added') || 'Added');
        } catch (err) { console.warn(err); }
      });
    },
    bindDrawerTriggers() {
      $$('[data-cart-open]').forEach((b) => b.addEventListener('click', () => this.openDrawer()));
    },
    bindDrawerClose() {
      $$('[data-cart-close]').forEach((b) => b.addEventListener('click', () => this.closeDrawer()));
      const mount = document.getElementById('CartDrawerMount');
      if (!mount) return;
      mount.addEventListener('click', (e) => {
        if (e.target === mount) this.closeDrawer();
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') this.closeDrawer();
      });
    },
    bindPage() {
      // Called again after every drawer re-render — mark nodes so persistent
      // cart-page rows don't accumulate a listener per refresh.
      $$('[data-cart-qty]').forEach((b) => {
        if (b.dataset.vxnBound === '1') return;
        b.dataset.vxnBound = '1';
        b.addEventListener('click', async () => {
          const picker = b.closest('[data-cart-line-id]');
          if (!picker) return;
          const id  = picker.dataset.cartLineId;
          const inp = picker.querySelector('[data-cart-qty-input]');
          if (!id || !inp) return;
          const next = Math.max(0, (parseInt(inp.value, 10) || 0) + (parseInt(b.dataset.cartQty, 10) || 0));
          inp.value = next;
          const updated = await changeQty(id, next);
          if (updated) this.refreshCart();
          else location.reload();
        });
      });
      $$('[data-cart-remove]').forEach((b) => {
        if (b.dataset.vxnBound === '1') return;
        b.dataset.vxnBound = '1';
        b.addEventListener('click', async () => {
          const line = b.closest('[data-line-id]');
          const id   = line?.dataset.lineId;
          if (!id) return;
          const updated = await changeQty(id, 0);
          if (updated) this.refreshCart();
          else location.reload();
        });
      });
    },
    bindUpsell() {
      document.addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-upsell-add]');
        if (!btn) return;
        const card = btn.closest('[data-upsell-card]');
        const vid  = card?.dataset.variantId;
        if (!vid) return;
        await addItem(vid, 1);
        this.refreshCart('flash', U().t('added') || 'Added');
      });
    },
    async refreshCart(flash, flashLabel) {
      const cart = await getCart();
      if (!cart) return;
      this.updateBubbles(cart);
      this.renderDrawer(cart);
      // The cart page used to call location.reload() on EVERY refresh — including
      // the one fired during init() — which reloaded the page in a loop.
      // Only reload when a mutation actually changed the line count.
      const lines = $$('[data-cart-lines]');
      if (lines.length && this._lastCount != null && this._lastCount !== cart.item_count) {
        location.reload();
        return;
      }
      this._lastCount = cart.item_count;
      if (flash && flashLabel) this.toast(flashLabel);
    },
    updateBubbles(cart) {
      $$('[data-cart-count]').forEach((b) => {
        b.textContent = cart.item_count;
        b.setAttribute('data-empty', (cart.item_count === 0).toString());
      });
      $$('[data-cart-count-inline]').forEach((s) => {
        s.textContent = `· ${cart.item_count} ${cart.item_count === 1 ? 'item' : 'items'}`;
      });
      $$('[data-cart-subtotal]').forEach((s) => { s.textContent = formatMoney(cart.items_subtotal_price); });
    },
    renderDrawer(cart) {
      const body = $('[data-cart-body]');
      const foot = $('[data-cart-foot]');
      if (!body) return;
      body.innerHTML = cart.items.length === 0
        ? `<div class="cart-drawer-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
            <strong style="display:block;margin-bottom:.4rem;color:var(--color-fg);">${esc(U().t('cartEmpty') || 'Your cart is empty')}</strong>
            <p style="font-size:.9rem;">Browse our products — your finds await here.</p>
            <a href="${url(R().collections)}" class="btn btn--ghost" style="margin-top:1rem;" data-cart-close>${esc(U().t('continueShopping') || 'Continue shopping')}</a>
          </div>`
        : cart.items.map((item) => `
          <div class="cart-line" data-line-id="${esc(item.key)}">
            <a href="${url(item.url)}" class="cart-line-media">${item.image ? `<img src="${esc(String(item.image).replace(/width=\d+/, 'width=200'))}" alt="" loading="lazy">` : ''}</a>
            <div class="cart-line-info">
              <a href="${url(item.url)}" class="cart-line-title">${esc(item.product_title)}</a>
              ${item.variant_title && item.variant_title !== 'Default Title' ? `<small class="cart-line-variants">${esc(item.variant_title)}</small>` : ''}
              <div class="cart-line-controls">
                <div class="qty-picker" data-cart-line-id="${esc(item.key)}">
                  <button type="button" data-cart-qty="-1" aria-label="Decrease">−</button>
                  <input type="number" min="0" value="${esc(item.quantity)}" data-cart-qty-input aria-label="Quantity">
                  <button type="button" data-cart-qty="1" aria-label="Increase">+</button>
                </div>
                <strong data-line-total>${formatMoney(item.final_line_price)}</strong>
              </div>
              <button type="button" class="cart-line-remove" data-cart-remove>Remove</button>
            </div>
          </div>
        `).join('');
      if (foot) foot.style.display = cart.items.length === 0 ? 'none' : '';
      // Drawer markup is replaced wholesale, so its listeners must be re-bound;
      // bindPage() is delegation-safe and only touches freshly rendered nodes.
      this.bindPage();
      this.updateShippingBar(cart);
    },
    updateShippingBar(cart) {
      const bars = $$('[data-shipping-bar], [data-shipping-bar-drawer]');
      if (!bars.length) return;
      // Previously hardcoded to 75 via `parseInt(money_format)*0 + 75`, ignoring
      // settings.free_shipping_threshold and disagreeing with the Liquid render.
      const t = U().freeShippingThreshold();
      if (!t) return;
      bars.forEach((bar) => {
        const txt  = bar.querySelector('.shipping-progress-text');
        const fill = bar.querySelector('.shipping-progress-bar');
        if (cart.total_price >= t) {
          if (txt) txt.textContent = U().t('freeShippingDone') || 'You get FREE shipping!';
          if (fill) fill.style.width = '100%';
        } else {
          const remaining = formatMoney(t - cart.total_price);
          if (txt) txt.textContent = U().t('freeShippingProgress', { remaining, amount: remaining })
                                     || `Add ${remaining} more for free shipping`;
          if (fill) fill.style.width = Math.max(0, Math.min(100, (cart.total_price / t) * 100)).toFixed(0) + '%';
        }
      });
    },
    toast(label) {
      const el = document.createElement('div');
      el.className = 'vxn-toast';
      el.textContent = label;
      Object.assign(el.style, {
        position:'fixed', bottom:'24px', left:'50%', transform:'translateX(-50%) translateY(20px)',
        background:'var(--color-surface-2)', color:'var(--color-fg)', padding:'.7rem 1.1rem',
        borderRadius:'999px', boxShadow:'var(--shadow-md)', border:'1px solid var(--color-border)',
        zIndex:200, fontWeight:600, fontSize:'.9rem', opacity:'0', transition:'transform .25s ease, opacity .25s ease'
      });
      document.body.appendChild(el);
      requestAnimationFrame(() => { el.style.opacity = '1'; el.style.transform = 'translateX(-50%) translateY(0)'; });
      setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateX(-50%) translateY(20px)'; setTimeout(() => el.remove(), 250); }, 1800);
    },
  };

  // expose for tap-from-anywhere (used by the sticky ATC etc.)
  window.VennixCart = {
    add:    (id, qty, props) => addItem(id, qty, props),
    change: (key, qty) => changeQty(key, qty),
    open:   () => CartEngine.openDrawer(),
    close:  () => CartEngine.closeDrawer(),
    refresh: () => CartEngine.refreshCart(),
  };
  // theme.js startModules() owns initialisation. The old extra
  // DOMContentLoaded -> bindAddToCart() call double-bound every form.
  window.CartEngine = CartEngine;
})();
