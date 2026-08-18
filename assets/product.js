(function () {
  'use strict';

  const $ = (selector, context = document) => context.querySelector(selector);
  const $$ = (selector, context = document) => Array.from(context.querySelectorAll(selector));

  function utils() { return window.VennixUtils; }

  const ProductEngine = {
    init() {
      $$('[data-product-root]').forEach((root) => this.initProduct(root));
    },

    initProduct(root) {
      if (root.dataset.productBound === 'true') return;
      root.dataset.productBound = 'true';
      const variantsNode = document.getElementById(root.dataset.variantsId);
      try { root._variants = JSON.parse(variantsNode?.textContent || '[]'); }
      catch (_) { root._variants = []; }

      this.bindGallery(root);
      this.bindVariants(root);
      this.bindQuantity(root);
      this.bindSticky(root);
      this.bindZoom(root);
      this.bindShare(root);
      const idControl = $('[data-variant-id]', root);
      if (idControl && idControl.tagName === 'SELECT') {
        idControl.setAttribute('aria-hidden', 'true');
        idControl.tabIndex = -1;
      }
      this.syncVariant(root, false);
    },

    bindGallery(root) {
      $$('[data-media-trigger]', root).forEach((trigger) => {
        trigger.addEventListener('click', () => this.showMedia(root, trigger.dataset.mediaTrigger));
      });
    },

    showMedia(root, mediaId) {
      $$('[data-media-item]', root).forEach((item) => {
        const active = String(item.dataset.mediaItem) === String(mediaId);
        item.hidden = !active;
        if (!active) {
          $('video', item)?.pause();
          const model = $('model-viewer', item);
          if (model?.pause) model.pause();
        }
      });
      $$('[data-media-trigger]', root).forEach((trigger) => {
        if (String(trigger.dataset.mediaTrigger) === String(mediaId)) trigger.setAttribute('aria-current', 'true');
        else trigger.removeAttribute('aria-current');
      });
      const activeThumb = $(`[data-media-trigger="${CSS.escape(String(mediaId))}"]`, root);
      activeThumb?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    },

    bindVariants(root) {
      $$('[data-option-input]', root).forEach((input) => {
        input.addEventListener('change', () => {
          const fieldset = input.closest('[data-option-index]');
          const selected = $('[data-selected-option]', fieldset);
          if (selected) selected.textContent = input.value;
          this.syncVariant(root, true);
        });
      });
    },

    syncVariant(root, updateUrl) {
      const selections = $$('[data-option-index]', root).map((group) => $('[data-option-input]:checked', group)?.value);
      const variants = root._variants || [];
      let variant = variants.find((item) => item.options.every((option, index) => option === selections[index]));
      if (!selections.length) variant = variants[0];

      const idInput = $('[data-variant-id]', root);
      const submit = $('[data-add-to-cart]', root);
      const availability = $('[data-product-availability]', root);
      const price = $('[data-product-price]', root);
      const sku = $('[data-product-sku]', root);
      const stickyButton = $('[data-sticky-add]');
      const stickyPrice = $('[data-sticky-price]');
      const dynamicCheckout = $('.dynamic-checkout', root);

      if (!variant) {
        if (submit) { submit.disabled = true; submit.textContent = utils().t('unavailable') || 'Unavailable'; }
        if (availability) { availability.textContent = utils().t('unavailable') || 'Unavailable'; availability.classList.add('is-unavailable'); }
        if (stickyButton) stickyButton.disabled = true;
        return;
      }

      if (idInput) {
        idInput.value = variant.id;
        idInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (price) price.innerHTML = this.priceMarkup(variant);
      if (stickyPrice) stickyPrice.textContent = utils().formatMoney(variant.price);
      if (submit) {
        submit.disabled = !variant.available;
        submit.textContent = variant.available ? (utils().t('addToCart') || 'Add to cart') : (utils().t('soldOut') || 'Sold out');
      }
      if (stickyButton) {
        stickyButton.disabled = !variant.available;
        stickyButton.textContent = variant.available ? (utils().t('addToCart') || 'Add to cart') : (utils().t('soldOut') || 'Sold out');
      }
      if (availability) {
        availability.textContent = variant.available ? 'In stock' : (utils().t('soldOut') || 'Sold out');
        availability.classList.toggle('is-unavailable', !variant.available);
      }
      if (dynamicCheckout) dynamicCheckout.hidden = !variant.available;
      if (sku) {
        sku.hidden = !variant.sku;
        const value = $('span', sku);
        if (value) value.textContent = variant.sku || '';
      }
      if (variant.featured_media_id) this.showMedia(root, variant.featured_media_id);
      if (updateUrl && window.history?.replaceState) {
        const url = new URL(window.location.href);
        url.searchParams.set('variant', variant.id);
        window.history.replaceState({}, '', url.toString());
      }
    },

    priceMarkup(variant) {
      const onSale = variant.compare_at_price && variant.compare_at_price > variant.price;
      let unit = '';
      if (variant.unit_price_measurement && variant.unit_price != null) {
        const measurement = variant.unit_price_measurement;
        const referenceValue = measurement.reference_value != null && measurement.reference_value != 1
          ? `${utils().escapeHtml(String(measurement.reference_value))} ` : '';
        const referenceUnit = measurement.reference_unit ? utils().escapeHtml(String(measurement.reference_unit)) : '';
        unit = `<small class="unit-price">${utils().escapeHtml(utils().formatMoney(variant.unit_price))} / ${referenceValue}${referenceUnit}</small>`;
      }
      return `<div class="price" data-price><div class="price-main"><span class="price-current${onSale ? ' price-current--sale' : ''}">${utils().escapeHtml(utils().formatMoney(variant.price))}</span>${onSale ? `<s class="price-compare">${utils().escapeHtml(utils().formatMoney(variant.compare_at_price))}</s>` : ''}</div>${unit}</div>`;
    },

    bindQuantity(root) {
      $$('[data-qty]', root).forEach((button) => {
        button.addEventListener('click', () => {
          const picker = button.closest('.quantity-picker');
          const input = $('[data-qty-input]', picker);
          if (!input) return;
          const minimum = parseInt(input.min, 10) || 1;
          input.value = Math.max(minimum, (parseInt(input.value, 10) || minimum) + parseInt(button.dataset.qty, 10));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        });
      });
    },

    bindSticky(root) {
      const sticky = $('[data-sticky-atc]');
      const submit = $('[data-add-to-cart]', root);
      if (!sticky || !submit) return;
      if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver(([entry]) => {
          const visible = !entry.isIntersecting && entry.boundingClientRect.top < 0;
          sticky.classList.toggle('is-visible', visible);
          sticky.setAttribute('aria-hidden', String(!visible));
        }, { rootMargin: '-80px 0px 0px', threshold: 0 });
        observer.observe(submit);
      }
      $('[data-sticky-add]', sticky)?.addEventListener('click', () => {
        const form = $('[data-product-form]', root);
        if (form?.requestSubmit) form.requestSubmit(submit);
        else submit.click();
      });
    },

    bindZoom(root) {
      const dialog = $('[data-media-zoom]');
      const image = $('[data-zoom-image]', dialog || document);
      $$('[data-zoom-open]', root).forEach((button) => button.addEventListener('click', () => {
        if (!dialog || !image) return;
        image.src = button.dataset.zoomSrc;
        image.alt = button.dataset.zoomAlt || '';
        if (dialog.showModal) dialog.showModal();
      }));
      $('[data-zoom-close]', dialog || document)?.addEventListener('click', () => dialog.close());
      dialog?.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
    },

    bindShare(root) {
      $('[data-share-trigger]', root)?.addEventListener('click', async (event) => {
        const data = { title: document.title, url: window.location.href };
        try {
          if (navigator.share) await navigator.share(data);
          else {
            await navigator.clipboard.writeText(data.url);
            event.currentTarget.textContent = 'Link copied';
          }
        } catch (_) { /* Sharing was cancelled or unavailable. */ }
      });
    }
  };

  window.ProductEngine = ProductEngine;
})();
