# 🚀 Product Scraper - Quick Start

## What is this?

The Product Scraper lets your OctaDezx users automatically import their entire product catalog by just pasting a URL. No more manual uploads!

**Time saved: 2 minutes vs 30+ minutes** ⏱️

## Quick Setup (5 minutes)

### Step 1: Start the Scraper Service

**Windows:**
```bash
start-scraper.bat
```

**Mac/Linux:**
```bash
chmod +x start-scraper.sh
./start-scraper.sh
```

**Manual start:**
```bash
cd scraper
pip install -r requirements.txt
python product_scraper.py
```

### Step 2: Add Environment Variable

Add to your `.env.local`:
```env
VITE_SCRAPER_API_URL=http://localhost:8000
```

### Step 3: Run Database Migration

```bash
# Using Supabase CLI
supabase migration up

# Or copy-paste the SQL from:
# supabase/migrations/20260122000000_create_scrape_jobs_table.sql
# into your Supabase SQL Editor
```

### Step 4: Update Your Dashboard

Find where you're using ProductCatalog (probably `src/pages/Dashboard.tsx`):

**Replace this:**
```tsx
import ProductCatalog from '@/components/ProductCatalog';

<ProductCatalog businessId={selectedBusiness.id} />
```

**With this:**
```tsx
import ProductCatalogWithScraper from '@/components/ProductCatalogWithScraper';

<ProductCatalogWithScraper businessId={selectedBusiness.id} />
```

### Step 5: Test It!

1. Start your frontend: `npm run dev`
2. Go to Dashboard → Products
3. Click "Auto-Import" tab
4. Paste a URL: `https://www.allbirds.com/collections/all`
5. Click "Scan Website"
6. Watch the magic happen! ✨

## How It Works

### User Flow:
```
Paste URL → Scan → Preview Products → Import → Done!
         ↓
    2 minutes total
```

### Technical Flow:
```
1. FastAPI receives URL
2. Detects platform (Shopify/WooCommerce/etc)
3. Extracts products using:
   - Platform API (Shopify)
   - Schema.org markup
   - HTML pattern matching
4. Returns structured data
5. Frontend shows preview
6. User imports to database
```

## Supported Platforms

| Platform | Support Level | Method |
|----------|--------------|--------|
| Shopify | ⭐⭐⭐⭐⭐ Excellent | Official API |
| WooCommerce | ⭐⭐⭐⭐ Good | Schema.org |
| BigCommerce | ⭐⭐⭐⭐ Good | Schema.org |
| Wix | ⭐⭐⭐ Fair | HTML patterns |
| Custom | ⭐⭐ Varies | HTML patterns |

## API Endpoints

### Preview Only
```bash
POST /scrape
{
  "url": "https://store.com/products",
  "business_id": "uuid",
  "max_products": 100
}
```

### Scrape + Import
```bash
POST /scrape-and-import
# Same body as above
```

### View History
```bash
GET /scrape-jobs/{business_id}
```

## Testing

### Test with a real Shopify store:
```bash
curl -X POST "http://localhost:8000/scrape" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://gymshark.com/collections/all",
    "business_id": "test-123",
    "max_products": 10
  }'
```

## Deployment

### Production Checklist:
- [ ] Deploy scraper to Railway/Render/AWS
- [ ] Update `VITE_SCRAPER_API_URL` to production URL
- [ ] Run database migration on production Supabase
- [ ] Test with real product URLs
- [ ] Monitor for errors

### Recommended: Railway
1. Push code to GitHub
2. New Project → Deploy from GitHub
3. Select `scraper` directory
4. Add environment variables
5. Railway auto-detects Python
6. Done! 🎉

## Troubleshooting

### "No products found"
- Try a more specific URL (e.g., `/collections/all` instead of `/shop`)
- Ensure URL is publicly accessible
- Check if site requires JavaScript (we'll add Playwright support soon)

### CORS errors
Update `product_scraper.py`:
```python
allow_origins=["http://localhost:5173", "https://your-domain.com"]
```

### Scraper not starting
```bash
cd scraper
pip install --upgrade pip
pip install -r requirements.txt
python product_scraper.py
```

## What's Next?

### Planned Features:
- ✅ Basic scraping (DONE)
- ✅ Multi-platform support (DONE)
- ✅ Import to database (DONE)
- ⏳ Auto-refresh (daily scraping)
- ⏳ JavaScript rendering (Playwright)
- ⏳ Pagination (100+ products)
- ⏳ Image hosting (download to Supabase)

## Need Help?

1. Check logs: View terminal where scraper is running
2. API docs: http://localhost:8000/docs
3. Test endpoint directly in browser

## Files Overview

```
OctaDezx/
├── scraper/
│   ├── product_scraper.py        ← Main scraper service
│   └── requirements.txt          ← Dependencies
├── src/
│   └── components/
│       ├── ProductScraper.tsx    ← UI for scraping
│       └── ProductCatalogWithScraper.tsx  ← Tabs wrapper
├── supabase/
│   └── migrations/
│       └── 20260122000000_create_scrape_jobs_table.sql
├── start-scraper.bat             ← Windows quick start
├── start-scraper.sh              ← Mac/Linux quick start
└── PRODUCT_SCRAPER_GUIDE.md      ← Detailed docs
```

---

**That's it!** You now have a working product scraper that can import entire catalogs in under 2 minutes. 🎉
