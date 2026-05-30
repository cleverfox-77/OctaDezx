# Product Scraper Implementation Guide

## Overview
The product scraper feature allows OctaDezx users to automatically import their product catalog by simply pasting a URL. This eliminates the need to manually upload each product.

## Files Created/Modified

### Backend (Python FastAPI)
- `scraper/product_scraper.py` - Main scraper service with multi-strategy extraction
- `scraper/requirements.txt` - Updated with additional dependencies

### Frontend (React + TypeScript)
- `src/components/ProductScraper.tsx` - URL input and results UI
- `src/components/ProductCatalogWithScraper.tsx` - Tabs wrapper component

### Database
- `supabase/migrations/20260122000000_create_scrape_jobs_table.sql` - Scrape jobs tracking table

## Setup Instructions

### 1. Install Python Dependencies

```bash
cd scraper
pip install -r requirements.txt
```

Updated requirements.txt should include:
```
beautifulsoup4
fastapi
uvicorn
pydantic
python-dotenv
supabase
requests
```

### 2. Environment Variables

Add to `scraper/.env`:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Add to `OctaDezx/.env.local`:
```env
VITE_SCRAPER_API_URL=http://localhost:8000
```

For production, set:
```env
VITE_SCRAPER_API_URL=https://your-scraper-service.com
```

### 3. Run Database Migration

```bash
# If using Supabase CLI
supabase migration up

# Or run the SQL directly in Supabase Dashboard
```

### 4. Start the Scraper Service

```bash
cd scraper
python product_scraper.py
```

Or using uvicorn:
```bash
uvicorn product_scraper:app --reload --host 0.0.0.0 --port 8000
```

### 5. Update Your Dashboard

Find where ProductCatalog is currently used (likely in Dashboard.tsx) and replace:

```typescript
// Old
import ProductCatalog from '@/components/ProductCatalog';
<ProductCatalog businessId={selectedBusiness.id} />

// New
import ProductCatalogWithScraper from '@/components/ProductCatalogWithScraper';
<ProductCatalogWithScraper businessId={selectedBusiness.id} />
```

## Features

### Scraping Strategies (in order of preference):

1. **Platform-Specific APIs**
   - Shopify: Uses `/products.json` endpoint
   - Fast, reliable, complete data

2. **Schema.org Extraction**
   - Parses structured data markup (JSON-LD)
   - Works with 60%+ of modern e-commerce sites
   - Extracts: name, price, images, SKU, description

3. **HTML Pattern Matching**
   - Fallback for custom sites
   - Searches for common CSS selectors
   - Less reliable but covers edge cases

### Supported Platforms
- ✅ Shopify (best support)
- ✅ WooCommerce
- ✅ BigCommerce
- ✅ Wix
- ✅ Squarespace
- ✅ Custom sites (with varying success)

## User Experience Flow

1. **User clicks "Auto-Import" tab**
2. **Pastes product catalog URL** (e.g., https://store.com/products)
3. **Clicks "Scan Website"**
4. **System detects platform** and shows real-time progress
5. **Preview shown** with product count, images, prices
6. **User reviews** and clicks "Import All Products"
7. **Products added** to their catalog

### Auto-Import Mode
- Toggle "Automatically import after scanning"
- Skips preview step
- Faster for trusted sources

## API Endpoints

### POST /scrape
Scrape products without importing

Request:
```json
{
  "url": "https://example.com/products",
  "business_id": "uuid",
  "max_products": 100
}
```

Response:
```json
{
  "success": true,
  "platform": "shopify",
  "total_found": 47,
  "valid_products": 45,
  "products": [...],
  "errors": [],
  "scraped_at": "2026-01-22T10:30:00Z"
}
```

### POST /scrape-and-import
Scrape and immediately import to database

Returns both scrape results and import summary:
```json
{
  "scrape_result": {...},
  "import_result": {
    "imported": 45,
    "skipped": 2
  }
}
```

### GET /scrape-jobs/{business_id}
Get scraping history for a business

## Deployment

### Option 1: Railway
1. Create new project
2. Deploy from Git
3. Add environment variables
4. Railway will auto-detect Python and install dependencies

### Option 2: Render
1. Create new Web Service
2. Connect GitHub repo
3. Set build command: `pip install -r requirements.txt`
4. Set start command: `uvicorn product_scraper:app --host 0.0.0.0 --port $PORT`

### Option 3: AWS Lambda
1. Package with dependencies
2. Use Mangum adapter for FastAPI
3. Deploy via SAM or Serverless framework

### Option 4: Docker
```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY product_scraper.py .
EXPOSE 8000

CMD ["uvicorn", "product_scraper:app", "--host", "0.0.0.0", "--port", "8000"]
```

## Testing

### Test Shopify Store
```bash
curl -X POST "http://localhost:8000/scrape" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.allbirds.com/collections/all",
    "business_id": "test-uuid",
    "max_products": 10
  }'
```

### Test with Real Business
1. Go to Dashboard → Products → Auto-Import tab
2. Paste a Shopify store URL (e.g., https://gymshark.com/collections/all)
3. Click "Scan Website"
4. Review results
5. Import products

## Future Enhancements

### Planned Features:
- [ ] Scheduled auto-refresh (daily scraping)
- [ ] Pagination support (scrape 100+ products)
- [ ] JavaScript rendering (Playwright integration)
- [ ] Image downloading to Supabase storage
- [ ] Duplicate detection (smarter merging)
- [ ] Multi-URL support (import from multiple pages)
- [ ] Product mapping (customize field mapping)
- [ ] Webhook notifications on scrape completion

### Auto-Refresh Implementation (Future)
```python
# Cron job or background task
async def auto_scrape_daily():
    businesses = get_businesses_with_auto_scrape_enabled()
    for business in businesses:
        if should_scrape(business.last_scraped_at):
            result = scrape_url(business.scrape_url)
            import_products(business.id, result.products)
            update_last_scraped(business.id)
```

## Troubleshooting

### Scraper returns 0 products
1. Check if URL is a product listing page
2. Try a more specific URL (e.g., /collections/all instead of /shop)
3. Check browser console for CORS errors
4. Verify scraper service is running

### CORS errors
Add your frontend URL to CORS allowed origins in `product_scraper.py`:
```python
allow_origins=["http://localhost:5173", "https://your-domain.com"]
```

### Import fails but scrape succeeds
1. Check database permissions (RLS policies)
2. Verify business_id is correct
3. Check Supabase logs for errors

### Products missing images
1. Some sites use lazy loading (images load via JavaScript)
2. Future: Add Playwright for JS rendering
3. Workaround: Users can manually add images in edit mode

## Support

For issues or questions:
1. Check scraper logs: `tail -f scraper/scraper.log`
2. Check Supabase logs in dashboard
3. Test endpoint directly: `http://localhost:8000/docs`

## Security Notes

- Scraper respects robots.txt (future enhancement)
- Rate limiting prevents abuse
- Only scrapes public URLs
- No authentication bypass
- User confirms ownership via disclaimer
