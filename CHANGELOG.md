# Changelog

All notable changes to VennixStore Elite are documented here. Versions follow [Semantic Versioning](https://semver.org/).

## [1.1.0] — 2026-08-18

### Added

- `snippets/collection-card.liquid` — single shared collection card now used by Shop by category, Collection list, and the collections list page (portrait and landscape styles, optional product count, editor block attributes).
- `snippets/quantity-selector.liquid` — shared quantity picker for the product form, cart page, and cart drawer, preserving all existing accessibility labels and JavaScript hooks.
- Footer country/currency selector using Shopify's native localization form. Renders a market-based country picker (which also sets the market currency) or a currency picker, only when the store actually has multiple countries or currencies; merchant toggle in Footer settings.
- `.gitignore` covering Shopify CLI local config, local tooling artifacts, and environment secrets.

### Changed

- `sections/product-main.liquid` schema now declares `max_blocks` for its information blocks.

## [1.0.0] — 2026-08-18

### Added

- Responsive, sticky, keyboard-accessible header with Shopify navigation, customer account, search, and cart access.
- Nested Shopify mega menu with optional merchant-selected collection, product, and promotional image.
- Predictive search for products, collections, pages, and articles with thumbnails, current and compare-at prices, cancellation, keyboard navigation, and exact no-results state.
- Full search template with grouped products, collections, pages, articles, and pagination.
- Collection experience with title, description, optional image, counts, Shopify sort options, native filters, active-filter chips, pagination, and mobile filter drawer.
- Reusable product card with responsive imagery, optional second image, Shopify prices, sale and availability states, supported tag badges, and safe quick add.
- Product experience with responsive image/media gallery, thumbnails, video/model support, image zoom, variants, quantity, availability, accelerated checkout, Shopify policies, configurable information blocks, and sticky add-to-cart.
- AJAX cart drawer with accessible focus handling, product details, quantity changes, removal, subtotal, checkout, continue-shopping controls, and Shopify product recommendations.
- Modular home sections for hero, collections, product groups, image with text, merchant-configured values, and native Shopify newsletter signup.
- Refined footer using merchant menus, enabled Shopify policies, native account routes, configured social links, enabled payment methods, newsletter signup, and VennixStore support contact.
- List-collections template and improved page, contact, blog, article, cart, and 404 templates.
- Theme Editor controls for brand, palette, typography, layout, buttons, cards, cart, search, support, footer/social links, and motion.
- Product and article structured data generated from Shopify objects.
- Static catalog-free layout preview for local responsive inspection.

### Changed

- Reworked the visual system to a neutral, minimal, product-first storefront with responsive type, spacing, imagery, and touch targets.
- Replaced hard-coded category/search suggestions and unsupported promotional statements with Shopify data or merchant-configured content.
- Set the theme identity and release version to **VennixStore Elite 1.0.0**.

### Performance and accessibility

- Added responsive image widths, below-fold lazy loading, eager LCP imagery, explicit image dimensions, deferred scripts, and optional motion/local-storage features.
- Added semantic landmarks, visible focus states, skip navigation, labels, live regions, keyboard navigation, focus restoration/trapping, reduced-motion support, and touch-friendly mobile drawers.

### Validation

- Shopify Theme Check: clean (54 files inspected, no offenses).
- JavaScript syntax, JSON syntax, CSS syntax, static preview HTML, and Git whitespace checks included in the development workflow.
