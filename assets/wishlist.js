/* ============================================================
   VennixStore Elite — Wishlist (local storage)
   ============================================================ */
(function () {
  'use strict';
  const KEY = 'vxn_wishlist_v1';
  function read() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
    catch { return []; }
  }
  function write(items) {
    localStorage.setItem(KEY, JSON.stringify(items));
    document.dispatchEvent(new CustomEvent('vxn:wishlist:change', { detail: { items } }));
  }
  const api = {
    all: read,
    has(id) { return read().includes(String(id)); },
    toggle(id) {
      const k = String(id);
      const items = read();
      const idx = items.indexOf(k);
      if (idx >= 0) items.splice(idx, 1); else items.push(k);
      write(items);
      return idx < 0;
    },
    clear() { write([]); },
  };
  window.VennixWishlist = api;

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.product-card-wishlist');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const card = btn.closest('[data-product-id]');
    const id = card?.dataset.productId;
    if (!id) return;
    const added = api.toggle(id);
    btn.setAttribute('aria-pressed', added.toString());
    btn.classList.toggle('is-active', added);
    toast(added ? 'Saved ♥' : 'Removed');
  });

  function toast(label) {
    const el = document.createElement('div');
    el.textContent = label;
    el.setAttribute('role', 'status');
    Object.assign(el.style, {
      position:'fixed', bottom:'24px', left:'50%', transform:'translateX(-50%) translateY(20px)',
      background:'var(--color-surface-2)', color:'var(--color-fg)', padding:'.6rem 1rem',
      borderRadius:'999px', boxShadow:'var(--shadow-md)', border:'1px solid var(--color-border)',
      zIndex:200, fontWeight:600, fontSize:'.85rem', opacity:'0', transition:'all .25s ease'
    });
    document.body.appendChild(el);
    requestAnimationFrame(() => { el.style.opacity = '1'; el.style.transform = 'translateX(-50%) translateY(0)'; });
    setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateX(-50%) translateY(20px)'; setTimeout(() => el.remove(), 250); }, 1400);
  }

  function syncState() {
    document.querySelectorAll('.product-card-wishlist').forEach((b) => {
      const card = b.closest('[data-product-id]');
      const id = card?.dataset.productId;
      if (!id) return;
      const active = api.has(id);
      b.setAttribute('aria-pressed', active.toString());
      b.classList.toggle('is-active', active);
    });
  }
  document.addEventListener('DOMContentLoaded', syncState);
  window.addEventListener('storage', syncState);
})();
