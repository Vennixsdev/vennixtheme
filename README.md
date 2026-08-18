# VennixStore Elite

**Version:** 1.1.0

**Platform:** Shopify Online Store 2.0

**Support:** [support@vennixstore.com](mailto:support@vennixstore.com)

VennixStore Elite is a minimal, product-first Shopify theme for the real VennixStore catalog. Product, collection, navigation, price, availability, policy, media, recommendation, and customer-account data come from Shopify; the theme does not include a hard-coded catalog.

## Storefront architecture

### Layout

- `layout/theme.liquid` defines SEO metadata, theme tokens, font loading, global section groups, and the small shared JavaScript context.
- `sections/header-group.json` and `sections/footer-group.json` provide editor-managed global header and footer areas.
- JSON templates compose Shopify sections without embedding catalog handles.

### Commerce sections

- `sections/collection-grid.liquid` uses Shopify collection products, native storefront filters, collection sort options, and pagination.
- `sections/product-main.liquid` uses Shopify product media, variants, availability, dynamic checkout, descriptions, and configured policies.
- `sections/cart-drawer.liquid` and `sections/cart-items.liquid` share Shopify AJAX cart behavior from `assets/cart.js`.
- `sections/search-results.liquid` and `snippets/predictive-search.liquid` use Shopify search and predictive-search endpoints.
- `sections/product-recommendations.liquid` uses Shopify's Product Recommendations API.

### Reusable components

- `snippets/product-card.liquid` is the single product-card implementation used by home, collection, search, and recommendation sections.
- `snippets/collection-card.liquid` is the single collection-card implementation shared by Shop by category, Collection list, and the collections list page.
- `snippets/quantity-selector.liquid` renders the shared quantity picker for the product form, cart page, and cart drawer.
- `snippets/price.liquid` handles current, compare-at, variable, and unit prices.
- `snippets/badge.liquid` shows Shopify sale/sold-out states and merchant-supported product tags: `best-seller`, `new-arrival`, `new`, and `limited-edition`.
- `snippets/filter-sidebar.liquid` renders only filters and values provided by Shopify for the current collection.
- `snippets/mega-menu.liquid` renders nested Shopify navigation with optional merchant-selected collection, product, and image features.

### JavaScript modules

All scripts are dependency-free and deferred.

- `assets/theme.js`: shared utilities, accessibility focus handling, header, navigation, collection controls, and reveal behavior.
- `assets/cart.js`: add, remove, quantity, drawer rendering, cart status, and cart recommendations.
- `assets/product.js`: product media, variant state, quantity, image zoom, sticky add-to-cart, and sharing.
- `assets/search.js`: debounced predictive search, request cancellation, result rendering, and keyboard navigation.
- `assets/recommendations.js`: Shopify section-based product recommendations.
- `assets/wishlist.js` and `assets/recently-viewed.js`: optional browser-local features, disabled by default.

## Theme Editor setup

1. Assign the real primary menu in **Header → Main menu**. Nested menu levels automatically become mega-menu columns and mobile accordions.
2. Select real collections in **Shop by category** blocks.
3. Select real collections for Featured products, New arrivals, and Best sellers. New-arrival and best-seller sections are disabled by default so those labels are never applied to an unverified catalog group.
4. Add real shipping, refund, privacy, and terms policies in Shopify admin. The footer and product page only link to policies that exist.
5. Assign an optional collection menu under **Theme settings → Search → No-results collection menu**.
6. Configure any announcement, value proposition, shipping threshold, support hours, or promotional copy only when it is accurate for the business.
7. Keep `support@vennixstore.com` or replace it under **Theme settings → Customer support**.
8. If the store sells to multiple markets, enable Shopify Markets countries/currencies. The footer selector appears automatically when more than one country or currency is available, and can be toggled under **Footer → Show country/currency selector**.

The major design controls are intentionally concise: logo, fonts, palette, page width, corners, buttons, header, footer, product cards, cart, search, support, social links, motion, and section-level layout controls.

## Local validation

Run Theme Check without publishing:

```bash
npx -y @shopify/cli@latest theme check --path .
```

Additional syntax checks used by the project:

```bash
node --check assets/theme.js
node --check assets/cart.js
node --check assets/product.js
node --check assets/search.js
node --check assets/recommendations.js
npx -y csstree-validator assets/styles.css
```

A catalog-free layout shell is available at `preview.html`:

```bash
python3 -m http.server 4173 --bind 0.0.0.0
```

The static shell is only for layout inspection. Catalog-dependent behavior must be tested in a Shopify development theme with real store data.

## Development and release process

1. Work from a clean baseline on a feature branch.
2. Build and validate one storefront area at a time.
3. Run Theme Check, JavaScript syntax checks, JSON parsing, CSS validation, and `git diff --check`.
4. Test real catalog paths in an unpublished Shopify development theme.
5. Review responsive layouts at 320, 375, 390, 430, 768, 1024, 1280, 1440, and 1920 pixels.
6. Never publish or merge automatically; release only after merchant approval.

See [CHANGELOG.md](CHANGELOG.md) for release notes.
