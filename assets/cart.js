/* ============================================================
   VennixStore Elite — Cart engine
   Talks to Shopify's AJAX Cart API (/cart.js, /cart/add.js, etc).
   Re-renders drawer / page when state changes.
   ============================================================ */
(function () {
  'use strict';

  const $  = (s, c) => (c||document).querySelector(s);
  const $$ = (s, c) => Array.from((c||document).querySelectorAll(s));

  const SHOP_URL = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';

  async function getCart() {
    try {
      const r = await fetch(SHOP_URL + 'cart.js', { credentials: 'same-origin', headers: { 'X-Requested-With':'XMLHttpRequest' } });
      return await r.json();
    } catch (e) { console.warn('[Vennix] cart fetch failed', e); return null; }
  }
  async function changeQty(key, qty) {
    try {
      const r = await fetch(SHOP_URL + 'cart/change.js', {
        method:'POST',
        credentials:'same-origin',
        headers:{ 'Content-Type':'application/json', 'X-Requested-With':'XMLHttpRequest' },
        body: JSON.stringify({ id: key, quantity: qty })
      });
      return r.ok ? r.json() : null;
    } catch (e) { return null; }
  }
  async function addItem(id, qty, properties) {
    const r = await fetch(SHOP_URL + 'cart/add.js', {
      method:'POST',
      credentials:'same-origin',
      headers:{ 'Content-Type':'application/json', 'Accept':'application/javascript', 'X-Requested-With':'XMLHttpRequest' },
      body: JSON.stringify({ id, quantity: qty || 1, properties: properties || {} })
    });
    return r.json();
  }
  async function addItemForm(formData) {
    const r = await fetch(SHOP_URL + 'cart/add.js', {
      method:'POST',
      credentials:'same-origin',
      body: formData
    });
    if (!r.ok) throw new Error('add failed');
    return r.json();
  }

  const formatMoney = (cents) => {
    try { return new Intl.NumberFormat('en', { style:'currency', currency: window.App?.AppContext?.settings?.currency || 'USD' }).format((cents||0)/100); }
    catch (e) { return '$' + (cents/100).toFixed(2); }
  };

  const CartEngine = {
    drawOpen: false,
    init(app) {
      this.app = app;
      this.bindAddToCart();
      this.bindDrawerTriggers();
      this.bindDrawerClose();
      this.bindPage();
      this.bindUpsell();
      window.addEventListener('vxn:cart:add',     () => this.refreshCart('flash','Added — keep browsing'));
      window.addEventListener('vxn:cart:changed', () => this.refreshCart());
      // Listen for cross-component updates
      document.addEventListener('vxn:cart:add',     (e) => this.refreshCart('flash', e.detail?.label || 'Added'));
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
            this.refreshCart('flash', `“${r.product_title}” added`);
          } catch (err) {
            console.warn(err);
          }
        });
      });
      // quick add on collection grid
      $$(document).forEach(); // (no-op placeholder)
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
          this.refreshCart('flash','Added — keep browsing');
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
      // cart page lines
      $$('[data-cart-qty]').forEach((b) => {
        b.addEventListener('click', async () => {
          const picker = b.closest('[data-cart-line-id]');
          const id  = picker.dataset.cartLineId;
          const inp = picker.querySelector('[data-cart-qty-input]');
          const next = Math.max(0, (parseInt(inp.value, 10) || 0) + (parseInt(b.dataset.cartQty, 10) || 0));
          inp.value = next;
          const updated = await changeQty(id, next);
          if (updated) this.refreshCart();
          else location.reload();
        });
      });
      $$('[data-cart-remove]').forEach((b) => {
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
        this.refreshCart('flash','Added — keep browsing');
      });
    },
    async refreshCart(flash, flashLabel) {
      const cart = await getCart();
      if (!cart) return;
      this.updateBubbles(cart);
      this.renderDrawer(cart);
      const lines = $$('[data-cart-lines]');
      if (lines.length) location.reload(); // simple re-render path for the cart page
      if (flash) this.toast(flashLabel);
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
            <strong style="display:block;margin-bottom:.4rem;color:var(--color-fg);">Your cart is empty</strong>
            <p style="font-size:.9rem;">Browse our products — your finds await here.</p>
            <a href="${window.Shopify?.routes?.collections_url || '/collections/all'}" class="btn btn--ghost" style="margin-top:1rem;" data-cart-close>Continue shopping</a>
          </div>`
        : cart.items.map((item) => `
          <div class="cart-line" data-line-id="${item.key}">
            <a href="${item.url}" class="cart-line-media">${item.image ? `<img src="${item.image.replace(/width=\d+/, 'width=200')}" alt="" loading="lazy">` : ''}</a>
            <div class="cart-line-info">
              <a href="${item.url}" class="cart-line-title">${item.product_title}</a>
              ${item.variant_title && item.variant_title !== 'Default Title' ? `<small class="cart-line-variants">${item.variant_title}</small>` : ''}
              <div class="cart-line-controls">
                <div class="qty-picker" data-cart-line-id="${item.key}">
                  <button type="button" data-cart-qty="-1" aria-label="Decrease">−</button>
                  <input type="number" min="0" value="${item.quantity}" data-cart-qty-input aria-label="Quantity">
                  <button type="button" data-cart-qty="1" aria-label="Increase">+</button>
                </div>
                <strong data-line-total>${formatMoney(item.final_line_price)}</strong>
              </div>
              <button type="button" class="cart-line-remove" data-cart-remove>Remove</button>
            </div>
          </div>
        `).join('');
      if (foot) foot.style.display = cart.items.length === 0 ? 'none' : '';
      this.bindPage();
      this.updateShippingBar(cart);
    },
    updateShippingBar(cart) {
      const bars = $$('[data-shipping-bar], [data-shipping-bar-drawer]');
      bars.forEach((bar) => {
        const threshold = (parseInt((window.App?.AppContext?.shop?.money_format) || 0)*0 + 75) * 100;
        const t = threshold;
        if (cart.total_price >= t) {
          bar.outerHTML = bar.outerHTML.replace(/<div class="shipping-progress">[\s\S]*?<\/div>/, `<div class="shipping-progress"><div class="shipping-progress-bar" style="width:100%;"></div></div>`).replace(/Add.*for free shipping/, '🎉 You get <strong>FREE shipping</strong>!');
          // simply patch text
          const txt = bar.querySelector('.shipping-progress-text');
          if (txt) txt.innerHTML = '🎉 You get <strong>FREE shipping</strong>!';
          const fill = bar.querySelector('.shipping-progress-bar');
          if (fill) fill.style.width = '100%';
        } else {
          const txt = bar.querySelector('.shipping-progress-text');
          const fill = bar.querySelector('.shipping-progress-bar');
          if (txt) txt.innerHTML = `Add <strong>${formatMoney(t - cart.total_price)}</strong> more for free shipping`;
          if (fill) fill.style.width = (cart.total_price / t * 100).toFixed(0) + '%';
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
  // Initialise once DOM is ready
  window.CartEngine = CartEngine;
  document.addEventListener('DOMContentLoaded', () => CartEngine.bindAddToCart());
})();
