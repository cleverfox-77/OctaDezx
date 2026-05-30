# Product Scraper - Complete System Flow

## High-Level Overview

```
┌─────────────┐
│   USER      │
│  (Business  │
│   Owner)    │
└──────┬──────┘
       │
       │ 1. Pastes product URL
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│              FRONTEND (React + TypeScript)               │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  ProductCatalogWithScraper                         │ │
│  │                                                    │ │
│  │  ┌──────────────┐  ┌──────────────┐              │ │
│  │  │ Manual Upload│  │ Auto-Import  │  ← Active    │ │
│  │  └──────────────┘  └──────────────┘              │ │
│  │                                                    │ │
│  │  ┌────────────────────────────────────────────┐  │ │
│  │  │  ProductScraper Component                  │  │ │
│  │  │                                            │  │ │
│  │  │  [URL Input Field]                         │  │
│  │  │  [Scan Website Button]                     │  │
│  │  │  [Auto-import Toggle]                      │  │
│  │  │                                            │  │ │
│  │  │  Status: Scanning... 67% ████████░░        │  │ │
│  │  └────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
       │
       │ 2. HTTP POST Request
       │    {url, business_id, max_products}
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│           BACKEND (FastAPI - Python Service)             │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  product_scraper.py                                │ │
│  │                                                    │ │
│  │  POST /scrape-and-import                           │ │
│  │       │                                            │ │
│  │       ├─→ 1. Fetch URL (requests)                 │ │
│  │       │                                            │ │
│  │       ├─→ 2. Detect Platform                      │ │
│  │       │      ├─ Check URL patterns                │ │
│  │       │      └─ Analyze HTML content              │ │
│  │       │                                            │ │
│  │       ├─→ 3. Choose Extraction Strategy           │ │
│  │       │      │                                     │ │
│  │       │      ├─ Shopify? → /products.json API     │ │
│  │       │      ├─ Schema.org? → Parse JSON-LD       │ │
│  │       │      └─ Fallback → HTML patterns          │ │
│  │       │                                            │ │
│  │       ├─→ 4. Extract Products                     │ │
│  │       │      • Name, Price, Images                │ │
│  │       │      • Description, SKU                   │ │
│  │       │      • Category, Currency                 │ │
│  │       │                                            │ │
│  │       ├─→ 5. Validate & Filter                    │ │
│  │       │      • Must have name                     │ │
│  │       │      • Must have price OR image           │ │
│  │       │                                            │ │
│  │       └─→ 6. Save to Database                     │ │
│  └────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
       │
       │ 3. Database Operations
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│               DATABASE (Supabase PostgreSQL)             │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Insert Scrape Job                                 │ │
│  │  ────────────────────────────────────────────────  │ │
│  │  Table: scrape_jobs                                │ │
│  │  {                                                 │ │
│  │    business_id, url, platform,                     │ │
│  │    total_found, valid_products,                    │ │
│  │    status: "completed", errors: []                 │ │
│  │  }                                                 │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  For Each Product:                                 │ │
│  │  ────────────────────────────────────────────────  │ │
│  │  1. Check if exists (by name)                      │ │
│  │  2. Skip if duplicate                              │ │
│  │  3. Insert to: products                            │ │
│  │     {                                              │ │
│  │       business_id, name, description,              │ │
│  │       category, price,                             │ │
│  │       metadata: {sku, currency, stock}             │ │
│  │     }                                              │ │
│  │  4. Insert to: product_images                      │ │
│  │     {                                              │ │
│  │       product_id, image_url,                       │ │
│  │       alt_text, is_primary                         │ │
│  │     }                                              │ │
│  └────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
       │
       │ 4. Return Results
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                      │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Success Response                                  │ │
│  │  ────────────────────────────────────────────────  │ │
│  │  {                                                 │ │
│  │    scrape_result: {                                │ │
│  │      success: true,                                │ │
│  │      platform: "shopify",                          │ │
│  │      total_found: 47,                              │ │
│  │      valid_products: 47                            │ │
│  │    },                                              │ │
│  │    import_result: {                                │ │
│  │      imported: 45,                                 │ │
│  │      skipped: 2  (duplicates)                      │ │
│  │    }                                               │ │
│  │  }                                                 │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Display Success Message                           │ │
│  │  ────────────────────────────────────────────────  │ │
│  │  ✅ Successfully imported 45 products!             │ │
│  │     (2 duplicates skipped)                         │ │
│  │                                                    │ │
│  │  [View Products] [Test Chatbot]                   │ │
│  └────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
       │
       │ 5. Trigger refresh
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│  ProductCatalog component reloads                        │
│  Shows newly imported products in grid                   │
└──────────────────────────────────────────────────────────┘
```

---

## Detailed Scraping Strategy Flow

```
URL Received
    │
    ▼
┌─────────────────────────┐
│ STEP 1: Fetch HTML      │
│ ─────────────────────   │
│ • HTTP GET request      │
│ • User-Agent header     │
│ • 15s timeout           │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ STEP 2: Detect Platform │
│ ─────────────────────   │
│ Check URL patterns:     │
│  • myshopify.com?       │
│  • wixsite.com?         │
│                         │
│ Check HTML content:     │
│  • "Shopify" keyword?   │
│  • "woocommerce"?       │
│  • "BigCommerce"?       │
└────────┬────────────────┘
         │
         ▼
    ┌────┴────┐
    │         │
    ▼         ▼
┌─────┐   ┌─────────┐
│Shopify│  │ Other   │
└───┬──┘  └────┬────┘
    │          │
    │          ▼
    │     ┌──────────────────┐
    │     │ STRATEGY 2:      │
    │     │ Schema.org       │
    │     │ ──────────────── │
    │     │ • Find <script>  │
    │     │   type="ld+json" │
    │     │ • Parse JSON     │
    │     │ • Extract @type  │
    │     │   = "Product"    │
    │     └────┬─────────────┘
    │          │
    │          │ No products?
    │          ▼
    │     ┌──────────────────┐
    │     │ STRATEGY 3:      │
    │     │ HTML Patterns    │
    │     │ ──────────────── │
    │     │ • Find .product  │
    │     │ • Find .price    │
    │     │ • Find <img>     │
    │     │ • Best effort    │
    │     └────┬─────────────┘
    │          │
    ▼          ▼
┌──────────────────────────┐
│ STRATEGY 1: Shopify API  │
│ ──────────────────────   │
│ • GET /products.json     │
│ • Official endpoint      │
│ • Complete product data  │
│ • Most reliable          │
└────────┬─────────────────┘
         │
         ▼
┌─────────────────────────┐
│ STEP 3: Validate        │
│ ─────────────────────   │
│ For each product:       │
│  • Has name? ✓          │
│  • Has price OR image? ✓│
│  • Filter invalid       │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ STEP 4: Return Results  │
│ ─────────────────────   │
│ {                       │
│   success: true,        │
│   platform: "shopify",  │
│   products: [...]       │
│ }                       │
└─────────────────────────┘
```

---

## Data Flow Diagram

```
User Action                 Frontend                  Backend                Database
───────────                 ────────                  ───────                ────────

1. Paste URL
   ───────►

2. Click "Scan"
   ───────►  ProductScraper
             setState(loading)
             ───────►  POST /scrape-and-import
                       {url, business_id}
                                                      Fetch HTML
                                                      Detect Platform
                                                      Extract Products
                                                      ───────►  INSERT scrape_job
                                                                business_id: X
                                                                platform: shopify
                                                                total_found: 47
                                                                ◄───────
                                                      ───────►  For each product:
                                                                  Check duplicate
                                                                  INSERT products
                                                                  INSERT product_images
                                                                ◄───────
                       ◄───────  Response:
                       {
                         scrape_result: {...},
                         import_result: {
                           imported: 45,
                           skipped: 2
                         }
                       }
             ◄───────
             Show success toast
             onProductsImported()
   ◄───────

3. View Products
   ───────►  ProductCatalog
             useEffect → loadProducts()
             ───────►  SELECT * FROM products
                       WHERE business_id = X
                                                                ◄───────  products[]
             ◄───────  
             Render product grid
   ◄───────
```

---

## Error Handling Flow

```
┌─────────────────────────┐
│ User submits URL        │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐      NO      ┌────────────────────┐
│ Is URL valid?           │─────────────►│ Show error:        │
└────────┬────────────────┘              │ "Invalid URL"      │
         │ YES                            └────────────────────┘
         ▼
┌─────────────────────────┐      FAIL    ┌────────────────────┐
│ Can fetch URL?          │─────────────►│ Show error:        │
│ (HTTP GET)              │              │ "Cannot access URL"│
└────────┬────────────────┘              └────────────────────┘
         │ SUCCESS
         ▼
┌─────────────────────────┐      FAIL    ┌────────────────────┐
│ Detect platform?        │─────────────►│ Platform: "unknown"│
└────────┬────────────────┘              │ Try Schema.org     │
         │ SUCCESS                        └────────────────────┘
         ▼
┌─────────────────────────┐      0       ┌────────────────────┐
│ Extract products?       │─────────────►│ Show warning:      │
│ (Count > 0)             │              │ "No products found"│
└────────┬────────────────┘              │ Suggestions shown  │
         │ > 0                            └────────────────────┘
         ▼
┌─────────────────────────┐
│ Validate each product   │
│ • Has name?             │
│ • Has price OR image?   │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐      PARTIAL ┌────────────────────┐
│ All valid?              │─────────────►│ Show warning:      │
└────────┬────────────────┘              │ "X invalid, Y valid"│
         │ ALL VALID                      │ [Import Valid Only]│
         ▼                                └────────────────────┘
┌─────────────────────────┐
│ Import to database      │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐      FAIL    ┌────────────────────┐
│ Database insert OK?     │─────────────►│ Show error:        │
└────────┬────────────────┘              │ "Import failed"    │
         │ SUCCESS                        └────────────────────┘
         ▼
┌─────────────────────────┐
│ ✅ SUCCESS!             │
│ Show products imported  │
└─────────────────────────┘
```

---

## Component Hierarchy

```
Dashboard.tsx
    │
    └── ProductCatalogWithScraper.tsx
            │
            ├── <Tabs>
            │     │
            │     ├── <Tab value="catalog">
            │     │     └── ProductCatalog.tsx (existing)
            │     │           │
            │     │           ├── <Dialog> Add Product
            │     │           │     └── ProductFormFields
            │     │           │
            │     │           ├── <Dialog> Edit Product
            │     │           │     └── ProductFormFields
            │     │           │
            │     │           └── Product Grid (cards)
            │     │
            │     └── <Tab value="scraper">
            │           └── ProductScraper.tsx (NEW)
            │                 │
            │                 ├── URL Input
            │                 ├── Scan Button
            │                 ├── Progress Indicator
            │                 ├── Results Preview
            │                 └── Import Button
            │
            └── State Management
                  └── refreshKey (triggers ProductCatalog reload)
```

---

## File Dependencies

```
Frontend:
src/components/ProductCatalogWithScraper.tsx
    ├── import ProductCatalog from './ProductCatalog'
    ├── import ProductScraper from './ProductScraper'
    └── import { Tabs } from '@/components/ui/tabs'

src/components/ProductScraper.tsx
    ├── import { Button, Input, Card, ... } from '@/components/ui/*'
    ├── import { useToast } from '@/components/ui/use-toast'
    └── fetch(`${SCRAPER_API_URL}/scrape-and-import`)

Backend:
scraper/product_scraper.py
    ├── from fastapi import FastAPI
    ├── from supabase import create_client
    ├── from bs4 import BeautifulSoup
    └── import requests

Database:
supabase/migrations/20260122000000_create_scrape_jobs_table.sql
    ├── CREATE TABLE scrape_jobs
    ├── ALTER TABLE businesses (add scraper columns)
    └── RLS policies
```

---

This visual documentation should help you understand exactly how all the pieces fit together!
