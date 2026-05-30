// OctaDezx Super Product Scraper - V2
// Multi-strategy extraction with comprehensive pattern matching
// Supports: Shopify, WooCommerce, BigCommerce, Wix, Squarespace, Magento, PrestaShop, OpenCart, and generic sites

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { assertPublicUrl } from "../_shared/urlGuard.ts";

interface ScrapedProduct {
  name: string;
  description?: string;
  price?: string;
  currency?: string;
  image_url?: string;
  images?: string[];
  product_url?: string;
  category?: string;
  sku?: string;
  availability?: string;
}

interface ScrapeResult {
  success: boolean;
  platform: string;
  total_found: number;
  valid_products: number;
  products: ScrapedProduct[];
  errors: string[];
  scraped_at: string;
}

// ========================================
// ENHANCED PLATFORM DETECTION
// ========================================

function detectPlatform(url: string, html: string): string {
  const urlLower = url.toLowerCase();
  const htmlLower = html.toLowerCase();

  // Shopify detection
  if (
    urlLower.includes("myshopify.com") ||
    htmlLower.includes("shopify") ||
    htmlLower.includes("cdn.shopify.com") ||
    htmlLower.includes("shopify-section") ||
    html.includes("Shopify.theme")
  ) {
    return "shopify";
  }

  // WooCommerce detection
  if (
    htmlLower.includes("woocommerce") ||
    htmlLower.includes("wc-add-to-cart") ||
    htmlLower.includes("wp-content/plugins/woocommerce") ||
    htmlLower.includes("wc-product") ||
    htmlLower.includes('class="product type-product')
  ) {
    return "woocommerce";
  }

  // BigCommerce detection
  if (htmlLower.includes("bigcommerce") || htmlLower.includes("cdn11.bigcommerce.com") || htmlLower.includes("stencil")) {
    return "bigcommerce";
  }

  // Magento detection
  if (htmlLower.includes("magento") || htmlLower.includes("mage-") || htmlLower.includes("catalog-product")) {
    return "magento";
  }

  // PrestaShop detection
  if (htmlLower.includes("prestashop") || htmlLower.includes("product-miniature")) {
    return "prestashop";
  }

  // OpenCart detection
  if (htmlLower.includes("opencart") || htmlLower.includes("product-thumb")) {
    return "opencart";
  }

  // Wix detection
  if (htmlLower.includes("wix.com") || htmlLower.includes("static.wixstatic.com") || htmlLower.includes("_wix")) {
    return "wix";
  }

  // Squarespace detection
  if (htmlLower.includes("squarespace") || htmlLower.includes("sqsp") || htmlLower.includes("sqs-block")) {
    return "squarespace";
  }

  // Etsy detection
  if (urlLower.includes("etsy.com")) {
    return "etsy";
  }

  // Amazon detection
  if (urlLower.includes("amazon.")) {
    return "amazon";
  }

  return "generic";
}

// ========================================
// STRATEGY 1: SHOPIFY API (BEST)
// ========================================

async function scrapeShopify(baseUrl: string): Promise<{ products: ScrapedProduct[]; errors: string[] }> {
  const errors: string[] = [];
  const products: ScrapedProduct[] = [];

  try {
    const urlObj = new URL(baseUrl);

    // Try multiple Shopify endpoints
    const endpoints = [
      `${urlObj.origin}/products.json?limit=250`,
      `${urlObj.origin}/collections/all/products.json?limit=250`,
    ];

    for (const shopifyUrl of endpoints) {
      try {
        console.log(`🛍️ Trying Shopify endpoint: ${shopifyUrl}`);
        const res = await fetch(shopifyUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
            "Accept": "application/json",
          },
        });

        if (!res.ok) continue;

        const data = await res.json();
        if (!data.products || !Array.isArray(data.products)) continue;

        for (const p of data.products) {
          const variant = p.variants?.[0];
          const images = p.images?.map((img: any) => img.src) || [];
          const primaryImage = images[0] || p.image?.src;
          const price = variant?.price;

          if (p.title) {
            products.push({
              name: p.title,
              description: p.body_html ? stripHtml(p.body_html).substring(0, 1000) : undefined,
              price: price || undefined,
              currency: "USD",
              image_url: primaryImage || undefined,
              images: images.length > 0 ? images : undefined,
              product_url: `${urlObj.origin}/products/${p.handle}`,
              category: p.product_type || undefined,
              sku: variant?.sku || undefined,
              availability: variant?.available ? "in_stock" : "out_of_stock",
            });
          }
        }

        if (products.length > 0) {
          console.log(`✅ Shopify API: found ${products.length} products`);
          return { products, errors };
        }
      } catch (e) {
        // Try next endpoint
      }
    }

    errors.push("Shopify API endpoints not accessible");
  } catch (err) {
    errors.push(`Shopify API error: ${err}`);
  }

  return { products, errors };
}

// ========================================
// STRATEGY 2: WOOCOMMERCE REST API
// ========================================

async function scrapeWooCommerce(baseUrl: string, html: string): Promise<{ products: ScrapedProduct[]; errors: string[] }> {
  const errors: string[] = [];
  const products: ScrapedProduct[] = [];

  try {
    const urlObj = new URL(baseUrl);

    // Try WooCommerce REST API (public endpoints)
    const wooUrl = `${urlObj.origin}/wp-json/wc/store/products?per_page=100`;

    try {
      console.log(`🛒 Trying WooCommerce Store API: ${wooUrl}`);
      const res = await fetch(wooUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "application/json",
        },
      });

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          for (const p of data) {
            const images = p.images?.map((img: any) => img.src) || [];
            products.push({
              name: p.name,
              description: p.short_description ? stripHtml(p.short_description) : undefined,
              price: p.prices?.price ? (parseInt(p.prices.price) / 100).toFixed(2) : undefined,
              currency: p.prices?.currency_code || "USD",
              image_url: images[0] || undefined,
              images: images.length > 0 ? images : undefined,
              product_url: p.permalink || undefined,
              category: p.categories?.[0]?.name || undefined,
              sku: p.sku || undefined,
              availability: p.is_in_stock ? "in_stock" : "out_of_stock",
            });
          }
        }
      }
    } catch (e) {
      // API not available, will use HTML extraction
    }

    if (products.length > 0) {
      console.log(`✅ WooCommerce API: found ${products.length} products`);
    }
  } catch (err) {
    errors.push(`WooCommerce API error: ${err}`);
  }

  return { products, errors };
}

// ========================================
// STRATEGY 3: SCHEMA.ORG JSON-LD (UNIVERSAL)
// ========================================

function extractSchemaProducts(html: string, baseUrl: string): { products: ScrapedProduct[]; errors: string[] } {
  const errors: string[] = [];
  const products: ScrapedProduct[] = [];

  try {
    // Find all JSON-LD blocks
    const jsonLdRegex = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let match;

    while ((match = jsonLdRegex.exec(html)) !== null) {
      try {
        let jsonStr = match[1].trim();
        // Clean up common issues
        jsonStr = jsonStr.replace(/[\x00-\x1F\x7F]/g, '');

        const jsonData = JSON.parse(jsonStr);
        const items = Array.isArray(jsonData) ? jsonData : [jsonData];

        for (const item of items) {
          extractProductsFromSchema(item, baseUrl, products);
        }
      } catch (parseErr) {
        // Skip invalid JSON-LD blocks
      }
    }

    console.log(`📋 Schema.org: found ${products.length} products`);
  } catch (err) {
    errors.push(`Schema.org extraction error: ${err}`);
  }

  return { products, errors };
}

function extractProductsFromSchema(item: any, baseUrl: string, products: ScrapedProduct[]): void {
  if (!item) return;

  // Direct Product type
  if (item["@type"] === "Product" || item["@type"]?.includes?.("Product")) {
    const product = parseSchemaProduct(item, baseUrl);
    if (product) products.push(product);
  }

  // ItemList containing Products
  if (item["@type"] === "ItemList" && item.itemListElement) {
    for (const listItem of item.itemListElement) {
      const nested = listItem.item || listItem;
      if (nested["@type"] === "Product" || nested["@type"]?.includes?.("Product")) {
        const product = parseSchemaProduct(nested, baseUrl);
        if (product) products.push(product);
      }
    }
  }

  // OfferCatalog
  if (item["@type"] === "OfferCatalog" && item.itemListElement) {
    for (const listItem of item.itemListElement) {
      extractProductsFromSchema(listItem, baseUrl, products);
    }
  }

  // Graph containing multiple items
  if (item["@graph"]) {
    for (const graphItem of item["@graph"]) {
      extractProductsFromSchema(graphItem, baseUrl, products);
    }
  }

  // WebPage with mainEntity
  if (item.mainEntity) {
    extractProductsFromSchema(item.mainEntity, baseUrl, products);
  }
}

function parseSchemaProduct(item: any, baseUrl: string): ScrapedProduct | null {
  const name = item.name;
  if (!name) return null;

  // Extract offer/price info
  let offer = item.offers;
  if (Array.isArray(offer)) offer = offer[0];
  offer = offer || {};

  const price = offer.price || offer.lowPrice || offer.highPrice;
  const currency = offer.priceCurrency || "USD";
  const availability = offer.availability?.includes?.("InStock") ? "in_stock" :
                       offer.availability?.includes?.("OutOfStock") ? "out_of_stock" : undefined;

  // Extract images
  let images: string[] = [];
  if (item.image) {
    if (Array.isArray(item.image)) {
      images = item.image.map((img: any) => typeof img === 'string' ? img : img.url || img.contentUrl).filter(Boolean);
    } else if (typeof item.image === 'string') {
      images = [item.image];
    } else if (item.image.url || item.image.contentUrl) {
      images = [item.image.url || item.image.contentUrl];
    }
  }

  const url = item.url || item["@id"];

  return {
    name,
    description: item.description ? stripHtml(String(item.description)).substring(0, 1000) : undefined,
    price: price ? String(price) : undefined,
    currency,
    image_url: images[0] ? resolveUrl(images[0], baseUrl) : undefined,
    images: images.length > 0 ? images.map(img => resolveUrl(img, baseUrl)) : undefined,
    product_url: url ? resolveUrl(url, baseUrl) : undefined,
    category: item.category || item.productCategory || undefined,
    sku: item.sku || item.productID || item.mpn || undefined,
    availability,
  };
}

// ========================================
// STRATEGY 4: ADVANCED HTML EXTRACTION
// ========================================

function extractHtmlProducts(html: string, baseUrl: string, platform: string): { products: ScrapedProduct[]; errors: string[] } {
  const errors: string[] = [];
  const products: ScrapedProduct[] = [];
  const seenNames = new Set<string>();

  try {
    // Platform-specific extraction
    switch (platform) {
      case "woocommerce":
        extractWooCommerceHtml(html, baseUrl, products, seenNames);
        break;
      case "magento":
        extractMagentoHtml(html, baseUrl, products, seenNames);
        break;
      case "prestashop":
        extractPrestaShopHtml(html, baseUrl, products, seenNames);
        break;
      case "squarespace":
        extractSquarespaceHtml(html, baseUrl, products, seenNames);
        break;
      default:
        extractGenericHtml(html, baseUrl, products, seenNames);
    }

    // If platform-specific didn't work, try generic
    if (products.length === 0) {
      extractGenericHtml(html, baseUrl, products, seenNames);
    }

    console.log(`🔍 HTML extraction: found ${products.length} products`);
  } catch (err) {
    errors.push(`HTML extraction error: ${err}`);
  }

  return { products, errors };
}

function extractWooCommerceHtml(html: string, baseUrl: string, products: ScrapedProduct[], seenNames: Set<string>): void {
  // WooCommerce product patterns
  const productPattern = /<li[^>]*class="[^"]*product[^"]*type-product[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
  let match;

  while ((match = productPattern.exec(html)) !== null) {
    const block = match[1];

    // Extract name
    const nameMatch = block.match(/<(?:h[1-6]|a)[^>]*class="[^"]*woocommerce-loop-product__title[^"]*"[^>]*>([^<]+)/i) ||
                      block.match(/<h[1-6][^>]*>[\s\S]*?<a[^>]*>([^<]+)/i) ||
                      block.match(/title="([^"]+)"/i);
    const name = nameMatch ? stripHtml(nameMatch[1]).trim() : null;
    if (!name || seenNames.has(name.toLowerCase())) continue;

    // Extract price
    const priceMatch = block.match(/<(?:span|ins)[^>]*class="[^"]*woocommerce-Price-amount[^"]*"[^>]*>[\s\S]*?([\d,]+\.?\d*)/i) ||
                       block.match(/[\$£€₹][\s]?([\d,]+\.?\d*)/);
    const price = priceMatch ? priceMatch[1].replace(/,/g, '') : undefined;

    // Extract currency
    const currencyMatch = block.match(/<span[^>]*class="[^"]*woocommerce-Price-currencySymbol[^"]*"[^>]*>([^<]+)/i) ||
                          block.match(/([\$£€₹])/);
    const currency = currencyMatch ? currencyMatch[1] : "$";

    // Extract image - check multiple attributes for lazy loading
    const imgMatch = block.match(/<img[^>]*(?:data-src|data-lazy-src|src)="([^"]+)"/i);
    let imageUrl = imgMatch ? resolveUrl(imgMatch[1], baseUrl) : undefined;
    // Skip placeholder images
    if (imageUrl?.includes('placeholder') || imageUrl?.includes('data:image')) imageUrl = undefined;

    // Also check srcset for better quality
    const srcsetMatch = block.match(/data-srcset="([^"]+)"/i) || block.match(/srcset="([^"]+)"/i);
    if (srcsetMatch && !imageUrl) {
      const srcsetUrls = srcsetMatch[1].split(',').map(s => s.trim().split(' ')[0]);
      imageUrl = srcsetUrls[srcsetUrls.length - 1]; // Get largest
      imageUrl = resolveUrl(imageUrl, baseUrl);
    }

    // Extract product URL
    const linkMatch = block.match(/<a[^>]*href="([^"]+)"[^>]*class="[^"]*woocommerce-LoopProduct-link/i) ||
                      block.match(/<a[^>]*href="([^"]+)"/i);
    const productUrl = linkMatch ? resolveUrl(linkMatch[1], baseUrl) : undefined;

    seenNames.add(name.toLowerCase());
    products.push({
      name,
      price,
      currency,
      image_url: imageUrl,
      product_url: productUrl,
    });
  }
}

function extractMagentoHtml(html: string, baseUrl: string, products: ScrapedProduct[], seenNames: Set<string>): void {
  const productPattern = /<(?:li|div)[^>]*class="[^"]*product-item[^"]*"[^>]*>([\s\S]*?)<\/(?:li|div)>/gi;
  let match;

  while ((match = productPattern.exec(html)) !== null) {
    const block = match[1];

    const nameMatch = block.match(/<a[^>]*class="[^"]*product-item-link[^"]*"[^>]*>([^<]+)/i) ||
                      block.match(/<strong[^>]*class="[^"]*product-item-name[^"]*"[^>]*>[\s\S]*?<a[^>]*>([^<]+)/i);
    const name = nameMatch ? stripHtml(nameMatch[1]).trim() : null;
    if (!name || seenNames.has(name.toLowerCase())) continue;

    const priceMatch = block.match(/data-price-amount="([\d.]+)"/i) ||
                       block.match(/<span[^>]*class="[^"]*price[^"]*"[^>]*>\s*[\$£€]?([\d,]+\.?\d*)/i);
    const price = priceMatch ? priceMatch[1].replace(/,/g, '') : undefined;

    const imgMatch = block.match(/<img[^>]*(?:data-src|src)="([^"]+)"/i);
    const imageUrl = imgMatch ? resolveUrl(imgMatch[1], baseUrl) : undefined;

    const linkMatch = block.match(/<a[^>]*class="[^"]*product-item-link[^"]*"[^>]*href="([^"]+)"/i);
    const productUrl = linkMatch ? resolveUrl(linkMatch[1], baseUrl) : undefined;

    seenNames.add(name.toLowerCase());
    products.push({ name, price, currency: "$", image_url: imageUrl, product_url: productUrl });
  }
}

function extractPrestaShopHtml(html: string, baseUrl: string, products: ScrapedProduct[], seenNames: Set<string>): void {
  const productPattern = /<article[^>]*class="[^"]*product-miniature[^"]*"[^>]*>([\s\S]*?)<\/article>/gi;
  let match;

  while ((match = productPattern.exec(html)) !== null) {
    const block = match[1];

    const nameMatch = block.match(/<(?:h[1-6]|a)[^>]*class="[^"]*product-title[^"]*"[^>]*>[\s\S]*?(?:<a[^>]*>)?([^<]+)/i);
    const name = nameMatch ? stripHtml(nameMatch[1]).trim() : null;
    if (!name || seenNames.has(name.toLowerCase())) continue;

    const priceMatch = block.match(/<span[^>]*class="[^"]*price[^"]*"[^>]*>[\s\S]*?([\d,]+\.?\d*)/i);
    const price = priceMatch ? priceMatch[1].replace(/,/g, '') : undefined;

    const imgMatch = block.match(/<img[^>]*(?:data-full-size-image-url|data-src|src)="([^"]+)"/i);
    const imageUrl = imgMatch ? resolveUrl(imgMatch[1], baseUrl) : undefined;

    const linkMatch = block.match(/<a[^>]*href="([^"]+)"[^>]*class="[^"]*thumbnail/i) ||
                      block.match(/<a[^>]*href="([^"]+)"/i);
    const productUrl = linkMatch ? resolveUrl(linkMatch[1], baseUrl) : undefined;

    seenNames.add(name.toLowerCase());
    products.push({ name, price, currency: "$", image_url: imageUrl, product_url: productUrl });
  }
}

function extractSquarespaceHtml(html: string, baseUrl: string, products: ScrapedProduct[], seenNames: Set<string>): void {
  const productPattern = /<div[^>]*class="[^"]*ProductItem[^"]*"[^>]*data-item-id[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi;
  let match;

  while ((match = productPattern.exec(html)) !== null) {
    const block = match[1];

    const nameMatch = block.match(/<h1[^>]*class="[^"]*ProductItem-details-title[^"]*"[^>]*>([^<]+)/i) ||
                      block.match(/data-title="([^"]+)"/i);
    const name = nameMatch ? stripHtml(nameMatch[1]).trim() : null;
    if (!name || seenNames.has(name.toLowerCase())) continue;

    const priceMatch = block.match(/<span[^>]*class="[^"]*product-price[^"]*"[^>]*>[\s\S]*?([\d,]+\.?\d*)/i) ||
                       block.match(/data-price="([\d.]+)"/i);
    const price = priceMatch ? priceMatch[1].replace(/,/g, '') : undefined;

    const imgMatch = block.match(/data-src="([^"]+)"/i) || block.match(/<img[^>]*src="([^"]+)"/i);
    const imageUrl = imgMatch ? resolveUrl(imgMatch[1], baseUrl) : undefined;

    seenNames.add(name.toLowerCase());
    products.push({ name, price, currency: "$", image_url: imageUrl });
  }
}

function extractGenericHtml(html: string, baseUrl: string, products: ScrapedProduct[], seenNames: Set<string>): void {
  // Comprehensive generic patterns for any e-commerce site
  const productPatterns = [
    // Product cards with various class names
    /<(?:div|article|li)[^>]*class="[^"]*(?:product|item|card)[^"]*"[^>]*data-(?:product|item)[^>]*>([\s\S]*?)<\/(?:div|article|li)>/gi,
    /<(?:div|article|li)[^>]*class="[^"]*product(?:-card|-item|-tile)?[^"]*"[^>]*>([\s\S]*?)<\/(?:div|article|li)>/gi,
    /<(?:div|article|li)[^>]*class="[^"]*(?:grid-item|collection-item|shop-item)[^"]*"[^>]*>([\s\S]*?)<\/(?:div|article|li)>/gi,
    /<(?:div|article|li)[^>]*(?:itemtype="[^"]*Product|itemprop="itemListElement")[^>]*>([\s\S]*?)<\/(?:div|article|li)>/gi,
  ];

  for (const pattern of productPatterns) {
    let match;
    pattern.lastIndex = 0; // Reset regex

    while ((match = pattern.exec(html)) !== null) {
      const block = match[1] || match[0];
      const product = parseGenericProductBlock(block, baseUrl, seenNames);
      if (product) {
        seenNames.add(product.name.toLowerCase());
        products.push(product);
      }
    }

    if (products.length >= 10) break; // Found enough with this pattern
  }

  // Fallback: look for image+price combinations
  if (products.length < 5) {
    extractByImagePriceProximity(html, baseUrl, products, seenNames);
  }
}

function parseGenericProductBlock(block: string, baseUrl: string, seenNames: Set<string>): ScrapedProduct | null {
  // Name extraction - try multiple patterns
  const namePatterns = [
    /<(?:h[1-6])[^>]*class="[^"]*(?:product|item|card)[^"]*(?:title|name|heading)[^"]*"[^>]*>([^<]+)/i,
    /<(?:h[1-6])[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/i,
    /<a[^>]*class="[^"]*(?:product|item)[^"]*(?:title|name|link)[^"]*"[^>]*>([^<]+)/i,
    /<(?:span|div|p)[^>]*class="[^"]*(?:title|name|heading)[^"]*"[^>]*>([^<]+)/i,
    /<a[^>]*title="([^"]+)"[^>]*>/i,
    /itemprop="name"[^>]*>([^<]+)/i,
    /<(?:h[1-6])[^>]*>([^<]+)<\/(?:h[1-6])>/i,
  ];

  let name = "";
  for (const pattern of namePatterns) {
    const match = block.match(pattern);
    if (match) {
      name = stripHtml(match[1]).trim();
      if (name && name.length > 2 && name.length < 200 && !seenNames.has(name.toLowerCase())) {
        break;
      }
      name = "";
    }
  }
  if (!name) return null;

  // Price extraction - comprehensive patterns
  const pricePatterns = [
    /itemprop="price"[^>]*content="([\d.]+)"/i,
    /data-price="([\d.]+)"/i,
    /<(?:span|div)[^>]*class="[^"]*(?:price|amount|cost)[^"]*"[^>]*>[\s\S]*?[\$£€₹฿₫]?\s*([\d,]+\.?\d*)/i,
    /[\$£€₹฿₫]\s*([\d,]+\.?\d*)/,
    /([\d,]+\.?\d*)\s*[\$£€₹฿₫]/,
  ];

  let price: string | undefined;
  let currency = "$";

  for (const pattern of pricePatterns) {
    const match = block.match(pattern);
    if (match) {
      price = match[1].replace(/,/g, '');
      // Extract currency if present
      const currencyMatch = block.match(/([\$£€₹฿₫])/);
      if (currencyMatch) currency = currencyMatch[1];
      break;
    }
  }

  // Image extraction - handle lazy loading
  const imgPatterns = [
    /<img[^>]*(?:data-src|data-lazy-src|data-original|data-srcset)="([^"]+)"/i,
    /<img[^>]*src="([^"]+)"[^>]*(?!.*placeholder)/i,
    /background-image:\s*url\(['"]?([^'")\s]+)/i,
    /data-bgset="([^"]+)"/i,
  ];

  let imageUrl: string | undefined;
  for (const pattern of imgPatterns) {
    const match = block.match(pattern);
    if (match) {
      let url = match[1];
      // Handle srcset - get the largest image
      if (url.includes(',')) {
        const urls = url.split(',').map(s => s.trim().split(' ')[0]);
        url = urls[urls.length - 1];
      }
      // Skip placeholders and data URIs
      if (!url.includes('placeholder') && !url.includes('data:image') && !url.includes('loading')) {
        imageUrl = resolveUrl(url, baseUrl);
        break;
      }
    }
  }

  // Product URL extraction
  const linkPatterns = [
    /<a[^>]*href="([^"]*(?:product|item|shop)[^"]*)"[^>]*class="[^"]*(?:product|item|card)/i,
    /<a[^>]*class="[^"]*(?:product|item|card)[^"]*"[^>]*href="([^"]+)"/i,
    /<a[^>]*href="([^"]+)"[^>]*>/i,
  ];

  let productUrl: string | undefined;
  for (const pattern of linkPatterns) {
    const match = block.match(pattern);
    if (match && match[1] && !match[1].startsWith('#') && !match[1].includes('javascript:')) {
      productUrl = resolveUrl(match[1], baseUrl);
      break;
    }
  }

  // Must have name + (price OR image)
  if (!price && !imageUrl) return null;

  return {
    name,
    price,
    currency,
    image_url: imageUrl,
    product_url: productUrl,
  };
}

function extractByImagePriceProximity(html: string, baseUrl: string, products: ScrapedProduct[], seenNames: Set<string>): void {
  // Find product-like links containing images
  const linkPattern = /<a[^>]*href="([^"]*(?:product|item|shop|p\/)[^"]*)"[^>]*>[\s\S]*?<img[^>]*(?:src|data-src)="([^"]+)"[\s\S]*?<\/a>/gi;
  let match;

  while ((match = linkPattern.exec(html)) !== null) {
    const productUrl = resolveUrl(match[1], baseUrl);
    let imageUrl = resolveUrl(match[2], baseUrl);

    if (imageUrl.includes('placeholder') || imageUrl.includes('data:image')) continue;

    // Find name and price near this element
    const start = Math.max(0, match.index - 500);
    const end = Math.min(html.length, match.index + match[0].length + 500);
    const context = html.substring(start, end);

    const nameMatch = context.match(/<(?:h[1-6]|span|div)[^>]*class="[^"]*(?:title|name)[^"]*"[^>]*>([^<]+)/i) ||
                      context.match(/<(?:h[1-6])[^>]*>([^<]{3,100})<\/(?:h[1-6])>/i);

    if (nameMatch) {
      const name = stripHtml(nameMatch[1]).trim();
      if (name && !seenNames.has(name.toLowerCase())) {
        const priceMatch = context.match(/[\$£€₹]\s*([\d,]+\.?\d*)/);

        seenNames.add(name.toLowerCase());
        products.push({
          name,
          price: priceMatch ? priceMatch[1].replace(/,/g, '') : undefined,
          currency: "$",
          image_url: imageUrl,
          product_url: productUrl,
        });
      }
    }
  }
}

// ========================================
// STRATEGY 5: META TAGS & OG DATA
// ========================================

function extractMetaProducts(html: string, baseUrl: string): ScrapedProduct | null {
  // This extracts a single product from meta tags (for single product pages)
  try {
    const ogTitle = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i)?.[1];
    const ogImage = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i)?.[1];
    const ogPrice = html.match(/<meta[^>]*property="product:price:amount"[^>]*content="([^"]+)"/i)?.[1] ||
                    html.match(/<meta[^>]*property="og:price:amount"[^>]*content="([^"]+)"/i)?.[1];
    const ogCurrency = html.match(/<meta[^>]*property="product:price:currency"[^>]*content="([^"]+)"/i)?.[1];
    const ogDescription = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]+)"/i)?.[1];
    const ogUrl = html.match(/<meta[^>]*property="og:url"[^>]*content="([^"]+)"/i)?.[1];

    if (ogTitle && (ogImage || ogPrice)) {
      return {
        name: stripHtml(ogTitle),
        description: ogDescription ? stripHtml(ogDescription) : undefined,
        price: ogPrice,
        currency: ogCurrency || "USD",
        image_url: ogImage ? resolveUrl(ogImage, baseUrl) : undefined,
        product_url: ogUrl ? resolveUrl(ogUrl, baseUrl) : baseUrl,
      };
    }
  } catch (e) {
    // Ignore meta extraction errors
  }
  return null;
}

// ========================================
// UTILITIES
// ========================================

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#\d+;/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveUrl(url: string, base: string): string {
  if (!url) return "";
  url = url.trim();
  if (url.startsWith("//")) return "https:" + url;
  if (url.startsWith("http")) return url;
  if (url.startsWith("data:")) return url;
  try {
    return new URL(url, base).href;
  } catch {
    return url;
  }
}

function deduplicateProducts(products: ScrapedProduct[]): ScrapedProduct[] {
  const seen = new Map<string, ScrapedProduct>();
  for (const p of products) {
    const key = p.name.toLowerCase().trim();
    // Keep the one with more data
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, p);
    } else {
      // Merge: prefer non-null values
      seen.set(key, {
        name: p.name,
        description: p.description || existing.description,
        price: p.price || existing.price,
        currency: p.currency || existing.currency,
        image_url: p.image_url || existing.image_url,
        images: p.images || existing.images,
        product_url: p.product_url || existing.product_url,
        category: p.category || existing.category,
        sku: p.sku || existing.sku,
        availability: p.availability || existing.availability,
      });
    }
  }
  return [...seen.values()];
}

// ========================================
// MAIN SCRAPE FUNCTION
// ========================================

async function scrapeProducts(url: string, maxProducts: number = 100): Promise<ScrapeResult> {
  const allErrors: string[] = [];
  let platform = "generic";
  let products: ScrapedProduct[] = [];

  console.log(`\n========== SCRAPING: ${url} ==========`);

  // Normalize URL
  try {
    const urlObj = new URL(url);
    url = urlObj.href;
  } catch {
    allErrors.push("Invalid URL format");
    return {
      success: false,
      platform,
      total_found: 0,
      valid_products: 0,
      products: [],
      errors: allErrors,
      scraped_at: new Date().toISOString(),
    };
  }

  // Step 1: Try Shopify API first (fastest, most reliable)
  const shopifyResult = await scrapeShopify(url);
  if (shopifyResult.products.length > 0) {
    platform = "shopify";
    products = shopifyResult.products;
    console.log(`✅ Shopify API succeeded: ${products.length} products`);
  } else {
    allErrors.push(...shopifyResult.errors);
  }

  // Step 2: Fetch HTML if API didn't work
  if (products.length === 0) {
    try {
      console.log(`🌐 Fetching HTML from: ${url}`);
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Accept-Encoding": "gzip, deflate, br",
          "Connection": "keep-alive",
          "Upgrade-Insecure-Requests": "1",
          "Cache-Control": "max-age=0",
        },
        redirect: "follow",
      });

      if (!res.ok) {
        allErrors.push(`Failed to fetch URL: ${res.status} ${res.statusText}`);
        return {
          success: false,
          platform,
          total_found: 0,
          valid_products: 0,
          products: [],
          errors: allErrors,
          scraped_at: new Date().toISOString(),
        };
      }

      const html = await res.text();
      platform = detectPlatform(url, html);
      console.log(`🔍 Detected platform: ${platform}`);

      // Step 3: Try WooCommerce API if detected
      if (platform === "woocommerce") {
        const wooResult = await scrapeWooCommerce(url, html);
        if (wooResult.products.length > 0) {
          products = wooResult.products;
          console.log(`✅ WooCommerce API succeeded: ${products.length} products`);
        }
      }

      // Step 4: Try Schema.org extraction
      if (products.length === 0) {
        const schemaResult = extractSchemaProducts(html, url);
        if (schemaResult.products.length > 0) {
          products = schemaResult.products;
          console.log(`✅ Schema.org succeeded: ${products.length} products`);
        } else {
          allErrors.push(...schemaResult.errors);
        }
      }

      // Step 5: Try HTML pattern matching
      if (products.length === 0) {
        const htmlResult = extractHtmlProducts(html, url, platform);
        if (htmlResult.products.length > 0) {
          products = htmlResult.products;
          console.log(`✅ HTML patterns succeeded: ${products.length} products`);
        } else {
          allErrors.push(...htmlResult.errors);
        }
      }

      // Step 6: Try meta tags for single product pages
      if (products.length === 0) {
        const metaProduct = extractMetaProducts(html, url);
        if (metaProduct) {
          products = [metaProduct];
          console.log(`✅ Meta tags: found single product`);
        }
      }

      // Still no products?
      if (products.length === 0) {
        allErrors.push("No products could be extracted. Try a different URL (e.g., /products, /shop, /collections/all, or a category page).");
      }
    } catch (err) {
      allErrors.push(`Fetch error: ${err}`);
    }
  }

  // Deduplicate, validate, and limit
  products = deduplicateProducts(products)
    .filter(p => p.name && p.name.length > 1)
    .slice(0, maxProducts);

  return {
    success: products.length > 0,
    platform,
    total_found: products.length,
    valid_products: products.length,
    products,
    errors: allErrors,
    scraped_at: new Date().toISOString(),
  };
}

// ========================================
// IMPORT PRODUCTS TO SUPABASE
// ========================================

async function importProducts(
  products: ScrapedProduct[],
  businessId: string,
  supabase: any
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const errors: string[] = [];
  let imported = 0;
  let skipped = 0;

  // Get existing product names for dedup
  const { data: existing } = await supabase
    .from("products")
    .select("name")
    .eq("business_id", businessId);

  const existingNames = new Set((existing || []).map((p: any) => p.name.toLowerCase().trim()));

  for (const product of products) {
    if (existingNames.has(product.name.toLowerCase().trim())) {
      skipped++;
      continue;
    }

    try {
      // Insert product
      const { data: newProduct, error: productError } = await supabase
        .from("products")
        .insert({
          business_id: businessId,
          name: product.name,
          description: product.description || null,
          price: product.price ? parseFloat(product.price) : null,
          category: product.category || null,
          metadata: {
            currency: product.currency || "USD",
            source_url: product.product_url || null,
            sku: product.sku || null,
            availability: product.availability || null,
            scraped: true,
            scraped_at: new Date().toISOString(),
          },
        })
        .select("id")
        .single();

      if (productError) {
        errors.push(`Failed to import "${product.name}": ${productError.message}`);
        continue;
      }

      // Insert primary product image
      if (product.image_url && newProduct) {
        await supabase.from("product_images").insert({
          product_id: newProduct.id,
          image_url: product.image_url,
          is_primary: true,
        });

        // Insert additional images if available
        if (product.images && product.images.length > 1) {
          const additionalImages = product.images
            .slice(1, 6) // Max 5 additional images
            .filter(img => img !== product.image_url)
            .map(img => ({
              product_id: newProduct.id,
              image_url: img,
              is_primary: false,
            }));

          if (additionalImages.length > 0) {
            await supabase.from("product_images").insert(additionalImages);
          }
        }
      }

      imported++;
    } catch (err) {
      errors.push(`Error importing "${product.name}": ${err}`);
    }
  }

  return { imported, skipped, errors };
}

// ========================================
// MAIN HANDLER
// ========================================

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log("\n========== PRODUCT SCRAPER V2 REQUEST ==========");

  // ── Auth guard: only authenticated business owners may scrape ──────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ success: false, error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  // Verify the JWT and get the caller's user ID
  const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: { user }, error: authError } = await callerClient.auth.getUser();
  if (authError || !user) {
    return new Response(
      JSON.stringify({ success: false, error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  // ──────────────────────────────────────────────────────────────────────────

  try {
    const { url, business_id, max_products = 50, auto_import = false } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: "URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!business_id) {
      return new Response(
        JSON.stringify({ success: false, error: "business_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate URL + SSRF guard: reject non-public hosts (localhost, private
    // ranges, link-local 169.254.x metadata, *.internal, etc.) so an
    // authenticated user can't make the server probe internal infrastructure.
    try {
      await assertPublicUrl(url);
    } catch (e) {
      return new Response(
        JSON.stringify({ success: false, error: `Invalid or blocked URL: ${e instanceof Error ? e.message : e}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Scrape products
    const scrapeResult = await scrapeProducts(url, max_products);

    // Initialize Supabase admin client
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // Verify the caller owns this business
    const { data: bizRow } = await supabase
      .from("businesses")
      .select("owner_id")
      .eq("id", business_id)
      .single();
    if (!bizRow || bizRow.owner_id !== user.id) {
      return new Response(
        JSON.stringify({ success: false, error: "Forbidden: you do not own this business" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log scrape job
    try {
      await supabase.from("scrape_jobs").insert({
        business_id,
        url,
        platform: scrapeResult.platform,
        total_found: scrapeResult.total_found,
        valid_products: scrapeResult.valid_products,
        status: scrapeResult.success ? "completed" : "failed",
        errors: scrapeResult.errors,
      });
    } catch (e) {
      // Ignore logging errors
    }

    // Auto-import if requested
    if (auto_import && scrapeResult.products.length > 0) {
      const importResult = await importProducts(scrapeResult.products, business_id, supabase);

      console.log(`📦 Import: ${importResult.imported} imported, ${importResult.skipped} skipped`);

      return new Response(
        JSON.stringify({
          scrape_result: scrapeResult,
          import_result: importResult,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify(scrapeResult),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("❌ Scraper error:", err);
    return new Response(
      JSON.stringify({ success: false, error: `Scraper error: ${err}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
