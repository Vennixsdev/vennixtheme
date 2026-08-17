# VennixStore Elite — Shopify Theme

> Bold Shopify theme engineered for **commerce → experience → intelligence**.

A premium, dark-first, mobile-first theme designed for creators and store owners who want a polished, fast, conversion-optimized storefront. Built in three composable phases so every release is functional from day one.

---

## 🚀 Phased Architecture

### 🟢 Phase 1 — MVP / Core commerce
- ✅ `theme.liquid` master layout + global tokens
- ✅ Header & footer with `support-email` snippet
- ✅ Product display (gallery, variants, ATC, sticky form)
- ✅ Collection browsing (grid + pagination + sort)
- ✅ Cart system (drawer + page) – AJAX `/cart.js`
- ✅ Basic search + breadcrumbs
- ✅ Shopify content rendering (`content_for_header`)

### 🟡 Phase 2 — Enhanced shopping experience
- ✅ Advanced product card (hover swap, quick-add, badges)
- ✅ Filtering system (price range, swatches, list)
- ✅ Sort dropdown
- ✅ Mega-menu navigation
- ✅ Predictive search (products / collections / pages / articles)
- ✅ Homepage merchandising (hero, featured-collections, featured-products, trust block, newsletter)
- ✅ Product recommendations (Shopify recommendations API)

### 🔴 Phase 3 — Advanced commerce intelligence
- ✅ Smart product discovery layer (related collections)
- ✅ Recently viewed products (local storage)
- ✅ Wishlist (local storage)
- ✅ Cart intelligence (upsell grid, free-shipping progress bar)
- ✅ Product page enhancements (sticky ATC, accordions, share)
- ✅ Advanced merchandising (best-sellers / new-arrivals tabs)
- ✅ Trust system (expanded footer-trust block, social surface)
- ✅ Performance layer (lazy-loaded images, reduced-motion opt-out, skeleton states)
- ✅ Mobile menu + overlay architecture

---

## 🗂 File map

```
layout/
  theme.liquid          Master layout (enqueue CSS/JS, sections groups)
  password.liquid       Pre-launch splash

templates/
  index.json / product.json / collection.json / cart.json / search.json
  page.json / blog.json / article.json / 404.json

sections/
  header / footer / cart-items / cart-drawer / product-main / product-recommendations
  collection-grid / search-results / hero / featured-products / featured-collections
  trust-block / newsletter / discovery-collection / recently-viewed / announcement-bar
  main-404 / page-main / blog-main / article-main

snippets/
  price / badge / product-card / product-info / product-variants
  breadcrumbs / cart-line-list / filter-sidebar / sort-dropdown
  mega-menu / mobile-menu / predictive-search / support-email / seo-meta

assets/
  styles.css   Modern tokens + components + responsive
  theme.js     Core orchestrator (engines boot)
  cart.js      Cart engine (AJAX /cart.js)
  product.js   Product engine (variants, gallery, sticky ATC)
  search.js    Predictive + on-page search
  wishlist.js  localStorage wishlist
  recently-viewed.js  localStorage tracking
  recommendations.js  /recommendations/products fetch & render

config/
  settings_schema.json     Theme editor settings (colors, fonts, layout, social, …)
  settings_data.json       Default values

locales/
  en.default.json          Strings
```

---

## 🎨 Tokens

All theme colors are exposed under **Theme settings → Colors**, plus support for font selection, page width, sticky header, free-shipping threshold, predictive search, social links and trust badges. They are emitted as CSS custom properties into `:root` so every component inherits them.

---

## 🧠 Final principle

> Build VennixStore Elite in layers: **Commerce → Experience → Intelligence**.
>
> Each phase is fully functional before the next begins.

Need help? `support@vennixstore.com`

© {{ 'now' | date: '%Y' }} {{ shop.name }}. All rights reserved.
