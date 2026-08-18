(function () {
  'use strict';

  async function loadRecommendations(container) {
    if (!container || container.dataset.loaded === 'true') return;
    container.dataset.loaded = 'true';
    try {
      const response = await fetch(container.dataset.url, { credentials: 'same-origin' });
      if (!response.ok) throw new Error(String(response.status));
      const documentFragment = new DOMParser().parseFromString(await response.text(), 'text/html');
      const incoming = documentFragment.querySelector('[data-product-recommendations]');
      if (!incoming || !incoming.innerHTML.trim()) {
        container.remove();
        return;
      }
      container.innerHTML = incoming.innerHTML;
      container.hidden = false;
      document.dispatchEvent(new CustomEvent('vxn:content:loaded', { detail: { container } }));
    } catch (error) {
      container.remove();
    }
  }

  function init() {
    document.querySelectorAll('[data-product-recommendations]').forEach(loadRecommendations);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
