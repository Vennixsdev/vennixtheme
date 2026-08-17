/* ============================================================
   VennixStore Elite — Product engine
   - variant selection  → updates hidden id + visible price
   - quantity stepper   → +/- controls
   - gallery            → thumb switching
   - sticky add-to-cart  → mirrors top form on scroll
   - accordion expand
   - buy now
   ============================================================ */
(function () {
  'use strict';
  const $  = (s, c) => (c||document).querySelector(s);
  const $$ = (s, c) => Array.from((c||document).querySelectorAll(s));

  const formatMoney = (cents) => {
    try { return new Intl.NumberFormat('en', { style:'currency', currency: window.App?.AppContext?.settings?.currency || 'USD' }).format((cents||0)/100); }
    catch (e) { return '$' + (cents/100).toFixed(2); }
  };

  window.ProductEngine = {
    init(app) {
      this.bindGallery();
      this.bindVariants();
      this.bindQty();
      this.bindStickyATC();
      this.bindAccordion();
      this.bindBuyNow();
      this.bindShare();
    },
    currentVariant() {
      const form = $('[data-product-form]');
      if (!form) return null;
      const id = form.querySelector('[data-variant-id]').value;
      return (window.__VARIANTS__ || []).find((v) => String(v.id) === String(id)) || null;
    },
    bindGallery() {
      $$('[data-media-trigger]').forEach((thumb) => {
        thumb.addEventListener('click', () => {
          const id = thumb.dataset.mediaTrigger;
          $$('[data-media-trigger]').forEach((t) => t.setAttribute('aria-current','false'));
          thumb.setAttribute('aria-current','true');
          const comp = document.querySelector(`[data-media-id="${id}"]`);
          const display = $('[data-gallery-main]');
          if (comp && display) {
            display.innerHTML = '';
            const node = comp.cloneNode(true);
            node.removeAttribute('hidden');
            display.appendChild(node);
          }
        });
      });
      const first = document.querySelector('[data-media-trigger]');
      first?.click();
    },
    bindVariants() {
      $$('.variant-option,.variant-swatch').forEach((btn) => {
        btn.addEventListener('click', () => {
          const group = btn.closest('[data-option-index]');
          const groupIndex = parseInt(group.dataset.optionIndex, 10);
          $$('[data-option-value]', group).forEach((b) => {
            b.setAttribute('aria-pressed','false');
            b.setAttribute('aria-checked','false');
          });
          btn.setAttribute('aria-pressed','true');
          btn.setAttribute('aria-checked','true');
          const selectedLabel = group.querySelector('[data-selected-option]');
          if (selectedLabel) selectedLabel.textContent = btn.dataset.optionValue;
          this.syncVariantFromOptions();
        });
      });
    },
    syncVariantFromOptions() {
      const opts = $$('[data-option-index]').map((g) => {
        const pressed = g.querySelector('[data-option-value][aria-pressed="true"]');
        return pressed?.dataset.optionValue;
      });
      const list = window.__VARIANTS__ || [];
      const variant = list.find((v) => v.options.every((o, i) => opts[i] === o)) || list[0];
      const form = $('[data-product-form]');
      if (form && variant) form.querySelector('[data-variant-id]').value = variant.id;

      // update price + button label + image
      if (variant) {
        const priceEl = $('.product-info-price .price');
        if (priceEl) priceEl.outerHTML = this.renderPrice(variant);
        const button = $('[data-add-to-cart]');
        if (button) {
          button.disabled = !variant.available;
          button.textContent = variant.available ? 'Add to cart' : 'Sold out';
        }
        if (variant.featured_media?.preview_image) {
          const main = $('[data-gallery-main] img');
          if (main) main.src = `${variant.featured_media.preview_image}&width=1200`;
        }
      }
    },
    renderPrice(variant) {
      const sale = variant.compare_at_price > variant.price && variant.compare_at_price != null;
      const html = `
        <span class="price" data-price>
          ${sale
            ? `<span class="price-current price-current--sale">${formatMoney(variant.price)}</span>
               <span class="price-compare">${formatMoney(variant.compare_at_price)}</span>
               <span class="badge badge--sale">Save ${formatMoney(variant.compare_at_price - variant.price)}</span>`
            : `<span class="price-current">${formatMoney(variant.price)}</span>`}
        </span>`;
      return html.trim();
    },
    bindQty() {
      $$('.qty-picker [data-qty]').forEach((b) => {
        b.addEventListener('click', () => {
          const input = b.parentElement.querySelector('[data-qty-input]');
          const delta = parseInt(b.dataset.qty, 10);
          const min = parseInt(input.min, 10) || 1;
          const next = Math.max(min, (parseInt(input.value, 10) || min) + delta);
          input.value = next;
        });
      });
    },
    bindStickyATC() {
      const sticky = $('[data-sticky-atc]');
      const top = $('[data-product-form] [data-add-to-cart]');
      if (!sticky || !top) return;
      const io = new IntersectionObserver(([entry]) => {
        sticky.setAttribute('data-sticky-shown', (!entry.isIntersecting).toString());
      }, { rootMargin: '-80px 0px 0px 0px', threshold: 0 });
      io.observe(top);
      sticky.querySelector('[data-sticky-add]')?.addEventListener('click', () => {
        top.click();
      });
    },
    bindAccordion() {
      $$('[data-accordion-toggle]').forEach((head) => {
        head.addEventListener('click', () => {
          const row = head.closest('.accordion-row');
          const open = row.getAttribute('data-open') === 'true';
          row.setAttribute('data-open', (!open).toString());
        });
      });
    },
    bindBuyNow() {
      $$('[data-buy-now]').forEach((b) => {
        b.addEventListener('click', async (e) => {
          e.preventDefault();
          const form = $('[data-product-form]');
          if (!form) return;
          const fd = new FormData(form);
          try {
            b.disabled = true;
            const r = await fetch(window.Shopify?.routes?.root + 'cart/add.js', {
              method: 'POST',
              headers: { 'X-Requested-With':'XMLHttpRequest' },
              body: fd
            });
            if (!r.ok) throw new Error('Add failed');
            window.location.href = '/checkout';
          } catch (err) {
            console.warn(err);
            b.disabled = false;
          }
        });
      });
    },
    bindShare() {
      $$('[data-share-trigger]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const data = { title: document.title, url: location.href };
          if (navigator.share) try { await navigator.share(data); return; } catch{}
          try { await navigator.clipboard.writeText(location.href); btn.classList.add('copied'); } catch{}
        });
      });
    },
  };
})();

// inject product variants for offline use without metafields
(function () {
  const node = document.getElementById('VennixVariants');
  if (!node) return;
  try { window.__VARIANTS__ = JSON.parse(node.textContent); }
  catch (e) { window.__VARIANTS__ = []; }
})();
