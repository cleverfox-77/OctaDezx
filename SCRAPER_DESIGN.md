# OctaDezx Knowledge Base Scraper - Design Document

## 1. Executive Summary
This document outlines the architecture for a production-ready web crawler designed to ingest customer websites and transform them into a high-quality knowledge base for the OctaDezx AI chatbot.

**Goal:** Turn any URL into a structured, noise-free Markdown dataset.
**Stack:** Python, Crawl4AI (or Playwright direct), BeautifulSoup/Lxml (for cleaning), Pydantic (validation).

## 2. Core Architecture

The crawler operates on a **Pipeline Pattern**:
`URL Input` -> `Discovery (Sitemap)` -> `Queue` -> `Extraction Worker` -> `Processing` -> `Vector Storage`

### 2.1 Dependencies
*   **Crawl4AI / Playwright**: For headless browsing and dynamic content rendering.
*   **extruct**: For extracting JSON-LD/Microdata (Structured Data).
*   **html2text**: For converting HTML to clean Markdown.
*   **Supabase-py**: For interacting with the existing Postgres database.

## 3. Implementation Strategy

### 3.1 "The Cheat Code": Structured Data First
Before attempting to parse messy HTML, the scraper will look for `<script type="application/ld+json">`.
*   **Why:** Machine-readable accuracy.
*   **What:** Product Metadata (Price, SKU, Availability), Organization Info, Breadcrumbs.
*   **Action:** If found, store separately as metadata.

### 3.2 Dynamic Rendering & Politeness
*   **Headless Browser**: We will use Playwright to execute JS, waiting for `networkidle` states to ensure SPAs (Single Page Apps) load fully.
*   **Politeness**: Implements a `domain_delay` (standard 1-3s) to avoid 429 errors.
*   **Bot Evasion**: If simple headers fail, the architecture allows plugging in a proxy service (ZenRows/BrightData) as a middleware.

### 3.3 The Markdown Advantage
We convert HTML to Markdown to preserve semantic structure for the LLM.
*   **Tables:** Preserved for pricing/specs.
*   **Lists:** Preserved for features/steps.
*   **Noise Removal:**
    *   Remove `<nav>`, `<footer>`, `.cookie-banner`, `.newsletter-popup`.
    *   Regex to strip "Copyright 2024" type boilerplate.

### 3.4 Chunking Strategy
*   **Target:** 1,000 tokens per chunk.
*   **Overlap:** 10% (100 tokens).
*   **Method:** Recursive character splitting (respecting headers/paragraphs) to avoid cutting sentences in half.

## 4. Incremental Syncing Logic
To avoid re-scraping the entire site every time:
1.  **Hash Check:** Store a `content_hash` (SHA256) of the Markdown body in the DB.
2.  **Head Request:** Check `Last-Modified` header if available (often unreliable).
3.  **Diffing:** On re-crawl, generate new hash. If `new_hash == old_hash`, skip processing/embedding.

## 5. Dashboard Integration Points
*   **/api/crawl/start**: Accepts `{ url: string, exclusions: string[] }`.
*   **/api/crawl/status**: Returns progress (e.g., "Scraping 45/120 pages").
*   **/api/crawl/sync**: Triggers the incremental refresh.

## 6. Python Class Structure
(See accompanying code file `scraper/core.py`)
