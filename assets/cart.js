(function () {
  'use strict';

  const $ = (selector, context = document) => context.querySelector(selector);
  const $$ = (selector, context = document) => Array.from(context.querySelectorAll(selector));
  const U = () => window.VennixUtils;
  let mutationInProgress = false;

  async function request(path, options = {}) {
    const response = await fetch(path, { credentials: 'same-origin', ...options, headers: { 'X-Requested-With': 'XMLHttpRequest', ...(options.headers || {}) } });
    let payload;
    try { payload = await response.json(); } catch (_) { payload = {}; }
    if (!response.ok) throw new Error(payload.description || payload.message || 'Cart request failed');
    return payload;
  }

  function getCart() { return request(U().routes().cartJs); }
  function changeLine(key, quantity) {
    return request(U().routes().cartChangeJs, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: key, quantity })
    });
  }
  function addForm(formData) { return request(U().routes().cartAddJs, { method: 'POST', body: formData }); }
  function addVariant(id, quantity = 1) {
    return request(U().routes().cartAddJs, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: [{ id, quantity }] })
    });
  }

  const CartEngine = {
    init() {
      this.mount = $('#CartDrawerMount');
      this.drawer = $('[data-cart-drawer]', this.mount || document);
      this.bindDelegatedEvents();
      if (this.mount) getCart().then((cart) => this.render(cart)).catch(() => {});
      this.loadAllRecommendations();
    },

    bindDelegatedEvents() {
      if (this.bound) return;
      this.bound = true;

      document.addEventListener('click', async (event) => {
        const openButton = event.target.closest('[data-cart-open]');
        if (openButton) { event.preventDefault(); this.open(openButton); return; }
        const closeButton = event.target.closest('[data-cart-close]');
        if (closeButton && this.mount) { if (closeButton.tagName === 'BUTTON') event.preventDefault(); this.close(); return; }

        const quantityButton = event.target.closest('[data-cart-qty]');
        if (quantityButton) {
          event.preventDefault();
          const picker = quantityButton.closest('[data-cart-line-id]');
          const input = $('[data-cart-qty-input]', picker);
          const quantity = Math.max(0, (parseInt(input?.value, 10) || 0) + parseInt(quantityButton.dataset.cartQty, 10));
          if (input) input.value = quantity;
          await this.change(picker?.dataset.cartLineId, quantity);
          return;
        }

        const removeButton = event.target.closest('[data-cart-remove]');
        if (removeButton) {
          event.preventDefault();
          const line = removeButton.closest('[data-line-id]');
          await this.change(line?.dataset.lineId, 0);
          return;
        }

        const recommendationAdd = event.target.closest('[data-recommendation-add]');
        if (recommendationAdd) {
          event.preventDefault();
          await this.addRecommended(recommendationAdd);
        }
      });

      document.addEventListener('change', async (event) => {
        const input = event.target.closest('[data-cart-qty-input]');
        if (!input) return;
        const picker = input.closest('[data-cart-line-id]');
        await this.change(picker?.dataset.cartLineId, Math.max(0, parseInt(input.value, 10) || 0));
      });

      document.addEventListener('submit', async (event) => {
        const form = event.target;
        const isQuickAdd = form.matches('.quick-add-form');
        const isProductForm = form.matches('[data-product-form]');
        if (!isQuickAdd && !isProductForm) return;
        if ((window.App?.AppContext?.settings?.cartType || 'drawer') !== 'drawer') return;
        event.preventDefault();
        const submit = event.submitter || $('button[type="submit"]', form);
        if (submit?.disabled) return;
        try {
          if (submit) { submit.disabled = true; submit.setAttribute('aria-busy', 'true'); }
          await addForm(new FormData(form));
          const cart = await getCart();
          this.render(cart);
          this.open(submit);
          this.announce(U().t('added') || 'Added to cart');
          const status = $('[data-product-form-status]', form);
          if (status) status.textContent = U().t('added') || 'Added to cart';
        } catch (error) {
          this.showError(error.message);
          const status = $('[data-product-form-status]', form);
          if (status) status.textContent = error.message;
        } finally {
          if (submit) { submit.disabled = false; submit.removeAttribute('aria-busy'); }
        }
      });

      this.mount?.addEventListener('click', (event) => { if (event.target === this.mount) this.close(); });
      this.drawer?.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') this.close();
        window.VennixA11y?.trap(event, this.drawer);
      });
    },

    async change(key, quantity) {
      if (!key || mutationInProgress) return;
      mutationInProgress = true;
      try {
        const cart = await changeLine(key, quantity);
        if ($('[data-cart-lines]') && !this.mount?.contains($('[data-cart-lines]'))) {
          window.location.reload();
          return;
        }
        this.render(cart);
        this.announce('Cart updated');
      } catch (error) {
        this.showError(error.message);
      } finally {
        mutationInProgress = false;
      }
    },

    open(opener) {
      if (!this.mount || !this.drawer) return;
      this.opener = opener || document.activeElement;
      this.mount.setAttribute('aria-hidden', 'false');
      document.body.classList.add('drawer-open');
      requestAnimationFrame(() => this.drawer.focus());
    },

    close() {
      if (!this.mount) return;
      this.mount.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('drawer-open');
      this.opener?.focus();
    },

    render(cart) {
      if (!cart) return;
      $$('[data-cart-count]').forEach((node) => {
        node.textContent = cart.item_count;
        node.dataset.empty = String(cart.item_count === 0);
      });
      $$('[data-cart-count-inline]').forEach((node) => { node.textContent = `${cart.item_count} ${cart.item_count === 1 ? 'item' : 'items'}`; });
      $$('[data-cart-subtotal]').forEach((node) => { node.textContent = U().formatMoney(cart.items_subtotal_price); });

      const body = $('[data-cart-body]');
      if (body) body.innerHTML = cart.items.length ? cart.items.map((item) => this.lineMarkup(item)).join('') : this.emptyMarkup();
      const footer = $('[data-cart-footer]');
      if (footer) footer.hidden = cart.items.length === 0;
      this.updateShipping(cart);
      this.updateRecommendations(cart);
    },

    lineMarkup(item) {
      const image = item.image ? `<img src="${U().escapeAttr(U().withParam(item.image, 'width', 220))}" alt="${U().escapeAttr(item.product_title)}" width="88" height="88" loading="lazy">` : '';
      const variant = item.variant_title && item.variant_title !== 'Default Title' ? `<p class="cart-line-variant">${U().escapeHtml(item.variant_title)}</p>` : '';
      const compare = item.original_line_price > item.final_line_price ? `<s>${U().escapeHtml(U().formatMoney(item.original_line_price))}</s>` : '';
      return `<div class="cart-line" data-line-id="${U().escapeAttr(item.key)}">
        <a class="cart-line-image" href="${U().safeUrl(item.url)}">${image}</a>
        <div class="cart-line-details">
          <a class="cart-line-title" href="${U().safeUrl(item.url)}">${U().escapeHtml(item.product_title)}</a>${variant}
          <div class="cart-line-bottom">
            <div class="quantity-picker quantity-picker--small" data-cart-line-id="${U().escapeAttr(item.key)}">
              <button type="button" data-cart-qty="-1" aria-label="Decrease ${U().escapeAttr(item.product_title)} quantity">−</button>
              <input type="number" min="0" value="${item.quantity}" data-cart-qty-input aria-label="Quantity for ${U().escapeAttr(item.product_title)}">
              <button type="button" data-cart-qty="1" aria-label="Increase ${U().escapeAttr(item.product_title)} quantity">+</button>
            </div>
            <div class="cart-line-price">${compare}<strong>${U().escapeHtml(U().formatMoney(item.final_line_price))}</strong></div>
          </div>
          <button type="button" class="cart-line-remove" data-cart-remove>${U().escapeHtml(U().t('remove') || 'Remove')}</button>
        </div>
      </div>`;
    },

    emptyMarkup() {
      return `<div class="cart-empty"><h3>${U().escapeHtml(U().t('cartEmpty') || 'Your cart is empty')}</h3><a class="button button--secondary" href="${U().safeUrl(U().routes().collections)}">${U().escapeHtml(U().t('continueShopping') || 'Continue shopping')}</a></div>`;
    },

    updateShipping(cart) {
      const threshold = U().freeShippingThreshold();
      if (!threshold) return;
      $$('[data-shipping-bar]').forEach((bar) => {
        const percent = Math.min(100, Math.round((cart.total_price / threshold) * 100));
        const progress = $('.shipping-progress', bar);
        const value = $('.shipping-progress-value', bar);
        const text = $('.shipping-progress-text', bar);
        progress?.setAttribute('aria-valuenow', String(percent));
        if (value) value.style.width = `${percent}%`;
        if (text) text.textContent = cart.total_price >= threshold
          ? (U().t('freeShippingDone') || 'Your order qualifies for free shipping')
          : (U().t('freeShippingProgress', { remaining: U().formatMoney(threshold - cart.total_price) }) || `Add ${U().formatMoney(threshold - cart.total_price)} more for free shipping`);
      });
    },

    updateRecommendations(cart) {
      $$('[data-cart-recommendations]').forEach((section) => {
        if (!cart.items.length) { section.hidden = true; return; }
        const productId = String(cart.items[0].product_id);
        section.hidden = false;
        if (section.dataset.loadedProduct === productId) return;
        section.dataset.productId = productId;
        section.dataset.loadedProduct = productId;
        this.loadRecommendations(section);
      });
    },

    loadAllRecommendations() { $$('[data-cart-recommendations]').forEach((section) => this.loadRecommendations(section)); },

    async loadRecommendations(section) {
      const productId = section.dataset.productId;
      const grid = $('[data-cart-recommendations-grid]', section);
      if (!productId || !grid) { section.hidden = true; return; }
      grid.innerHTML = '';
      try {
        const base = U().routes().recommendations.replace(/\.json$/, '');
        const response = await fetch(`${base}.json?product_id=${encodeURIComponent(productId)}&limit=4&intent=related`, { credentials: 'same-origin' });
        if (!response.ok) throw new Error(String(response.status));
        const payload = await response.json();
        const products = payload.products || [];
        if (!products.length) { section.hidden = true; return; }
        grid.innerHTML = products.map((product) => this.recommendationMarkup(product)).join('');
        section.hidden = false;
      } catch (_) {
        section.hidden = true;
      }
    },

    recommendationMarkup(product) {
      const image = product.featured_image || product.images?.[0] || '';
      const availableVariants = (product.variants || []).filter((variant) => variant.available);
      const canQuickAdd = product.variants?.length === 1 && availableVariants.length === 1;
      const action = canQuickAdd
        ? `<button type="button" class="text-link" data-recommendation-add data-variant-id="${availableVariants[0].id}">Add</button>`
        : `<a class="text-link" href="${U().safeUrl(product.url)}">View</a>`;
      return `<article class="cart-recommendation-card">
        <a href="${U().safeUrl(product.url)}" class="cart-recommendation-image">${image ? `<img src="${U().escapeAttr(U().withParam(image, 'width', 240))}" alt="${U().escapeAttr(product.title)}" width="120" height="120" loading="lazy">` : ''}</a>
        <div><a href="${U().safeUrl(product.url)}"><strong>${U().escapeHtml(product.title)}</strong></a><span>${U().escapeHtml(U().formatMoney(product.price))}</span>${action}</div>
      </article>`;
    },

    async addRecommended(button) {
      try {
        button.disabled = true;
        await addVariant(button.dataset.variantId, 1);
        const cart = await getCart();
        this.render(cart);
        this.announce(U().t('added') || 'Added to cart');
      } catch (error) {
        this.showError(error.message);
      } finally {
        button.disabled = false;
      }
    },

    showError(message) {
      const error = $('[data-cart-error]');
      if (error) { error.textContent = message || U().t('cartError'); error.hidden = false; }
      this.announce(message || U().t('cartError') || 'Cart error');
    },

    announce(message) {
      const status = $('[data-global-status]');
      if (status) { status.textContent = ''; requestAnimationFrame(() => { status.textContent = message; }); }
    }
  };

  window.CartEngine = CartEngine;
  window.VennixCart = { add: addVariant, change: changeLine, open: (opener) => CartEngine.open(opener), close: () => CartEngine.close() };
})();
