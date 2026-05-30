# ✅ Implementation Checklist

Use this checklist to implement the product scraper feature step-by-step.

## Prerequisites
- [ ] Python 3.8+ installed
- [ ] Node.js installed (for frontend)
- [ ] Supabase project set up
- [ ] Access to Supabase database

---

## Phase 1: Backend Setup (15 minutes)

### Step 1.1: Install Python Dependencies
```bash
cd D:\Octadezx\OctaDezx\OctaDezx\scraper
pip install -r requirements.txt
```
- [ ] Dependencies installed successfully
- [ ] No error messages

### Step 1.2: Configure Environment Variables
Create/edit `scraper/.env`:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```
- [ ] Created `.env` file in scraper directory
- [ ] Added Supabase URL
- [ ] Added Supabase anon key
- [ ] Values match your Supabase project

### Step 1.3: Test Scraper Service
```bash
python product_scraper.py
```
Expected output:
```
INFO:     Started server process
INFO:     Uvicorn running on http://0.0.0.0:8000
```
- [ ] Server starts without errors
- [ ] Can access http://localhost:8000
- [ ] Can access http://localhost:8000/docs (API documentation)

### Step 1.4: Test Scraper Endpoint
In a new terminal:
```bash
curl -X POST "http://localhost:8000/scrape" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.allbirds.com/collections/all", "business_id": "test", "max_products": 5}'
```
- [ ] Returns JSON response
- [ ] Response contains `"success": true`
- [ ] Response contains `"products"` array
- [ ] Products have names and prices

---

## Phase 2: Database Setup (10 minutes)

### Step 2.1: Run Migration
Option A - Using Supabase CLI:
```bash
cd D:\Octadezx\OctaDezx\OctaDezx
supabase migration up
```

Option B - Manual (Supabase Dashboard):
1. Go to Supabase Dashboard → SQL Editor
2. Open file: `supabase/migrations/20260122000000_create_scrape_jobs_table.sql`
3. Copy all contents
4. Paste into SQL Editor
5. Click "Run"

- [ ] Migration executed successfully
- [ ] No SQL errors
- [ ] `scrape_jobs` table created
- [ ] `businesses` table updated with new columns

### Step 2.2: Verify Tables
In Supabase Dashboard → Table Editor:
- [ ] `scrape_jobs` table exists with columns:
  - [ ] id (uuid)
  - [ ] business_id (uuid)
  - [ ] url (text)
  - [ ] platform (text)
  - [ ] total_found (int)
  - [ ] valid_products (int)
  - [ ] status (text)
  - [ ] errors (jsonb)
  - [ ] scraped_at (timestamp)

- [ ] `businesses` table has new columns:
  - [ ] scrape_url (text)
  - [ ] auto_scrape_enabled (boolean)
  - [ ] last_scraped_at (timestamp)

### Step 2.3: Test Database Connection
Run a simple query in Supabase SQL Editor:
```sql
SELECT COUNT(*) FROM scrape_jobs;
```
- [ ] Query runs successfully (returns 0)

---

## Phase 3: Frontend Setup (10 minutes)

### Step 3.1: Add Environment Variable
Edit `D:\Octadezx\OctaDezx\OctaDezx\.env.local`:
```env
VITE_SCRAPER_API_URL=http://localhost:8000
```
- [ ] Added to `.env.local`
- [ ] Restarted dev server (if running)

### Step 3.2: Verify New Components Exist
Check that these files were created:
- [ ] `src/components/ProductScraper.tsx`
- [ ] `src/components/ProductCatalogWithScraper.tsx`

### Step 3.3: Update Dashboard
Find where ProductCatalog is used (likely `src/pages/Dashboard.tsx`):

**Find this:**
```tsx
import ProductCatalog from '@/components/ProductCatalog';
// ... later in the file:
<ProductCatalog businessId={selectedBusiness.id} />
```

**Replace with:**
```tsx
import ProductCatalogWithScraper from '@/components/ProductCatalogWithScraper';
// ... later in the file:
<ProductCatalogWithScraper businessId={selectedBusiness.id} />
```

- [ ] Updated import statement
- [ ] Updated component usage
- [ ] Saved file

### Step 3.4: Start Frontend
```bash
npm run dev
```
- [ ] No TypeScript errors
- [ ] No build errors
- [ ] Dev server running

---

## Phase 4: Integration Testing (15 minutes)

### Step 4.1: Access Product Page
1. Open browser: http://localhost:5173 (or your dev URL)
2. Log in to OctaDezx
3. Navigate to Dashboard
4. Select a business
5. Go to Products section

- [ ] Can access Products page
- [ ] See two tabs: "Manual Upload" and "Auto-Import"
- [ ] Can click between tabs

### Step 4.2: Test Auto-Import Tab
Click "Auto-Import" tab:
- [ ] See URL input field
- [ ] See "Scan Website" button
- [ ] See auto-import toggle
- [ ] See tips section at bottom

### Step 4.3: Test with Shopify Store
1. Paste URL: `https://www.allbirds.com/collections/all`
2. Ensure "Auto-import" toggle is ON
3. Click "Scan Website"

Expected behavior:
- [ ] Button shows "Scanning..." with spinner
- [ ] Progress bar appears
- [ ] Platform badge shows "SHOPIFY"
- [ ] Success message appears
- [ ] Toast notification shows "Imported X products"
- [ ] Tab switches to "Manual Upload" showing new products

### Step 4.4: Verify Products in Database
In Supabase Dashboard → Table Editor → products:
- [ ] See newly imported products
- [ ] Products have correct business_id
- [ ] Products have names
- [ ] Products have prices
- [ ] Check product_images table for images

### Step 4.5: Verify Scrape Job Logged
In Supabase Dashboard → Table Editor → scrape_jobs:
- [ ] See entry for the scrape
- [ ] status = "completed"
- [ ] platform = "shopify"
- [ ] total_found > 0
- [ ] valid_products > 0

### Step 4.6: Test Manual Review Mode
1. Clear products from database (optional)
2. Go to Auto-Import tab
3. Turn OFF "Auto-import" toggle
4. Paste URL again
5. Click "Scan Website"

Expected behavior:
- [ ] Products shown in preview
- [ ] Can scroll through list
- [ ] See product images
- [ ] See prices and categories
- [ ] "Import All X Products" button visible
- [ ] Clicking import button adds products

### Step 4.7: Test Error Handling
Try an invalid URL:
1. Paste: `https://invalid-url-that-doesnt-exist.com`
2. Click "Scan Website"

Expected behavior:
- [ ] Error message shown
- [ ] Error is user-friendly
- [ ] No crash

Try a non-product page:
1. Paste: `https://google.com`
2. Click "Scan Website"

Expected behavior:
- [ ] Warning: "No products found"
- [ ] Helpful suggestions shown
- [ ] Can try again

---

## Phase 5: Production Deployment (30 minutes)

### Step 5.1: Deploy Scraper Service

#### Option A: Railway
1. Go to railway.app
2. New Project → Deploy from GitHub
3. Connect your repository
4. Select scraper directory
5. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
6. Deploy

- [ ] Service deployed
- [ ] No build errors
- [ ] Got production URL (e.g., `https://your-app.railway.app`)

#### Option B: Render
1. Go to render.com
2. New → Web Service
3. Connect GitHub
4. Settings:
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `uvicorn product_scraper:app --host 0.0.0.0 --port $PORT`
5. Add environment variables
6. Deploy

- [ ] Service deployed
- [ ] Got production URL

#### Option C: Docker (Advanced)
Create Dockerfile in scraper directory, then deploy to your preferred host.

- [ ] Service deployed
- [ ] Got production URL

### Step 5.2: Update Production Environment Variables
In your frontend production environment (Netlify/Vercel/etc.):
```env
VITE_SCRAPER_API_URL=https://your-scraper-url.com
```
- [ ] Added to production environment
- [ ] Redeployed frontend

### Step 5.3: Update CORS Settings
Edit `scraper/product_scraper.py`:
```python
allow_origins=["https://your-frontend-domain.com", "http://localhost:5173"]
```
- [ ] Updated CORS origins
- [ ] Redeployed scraper service

### Step 5.4: Run Production Migration
If you haven't already, run the migration on your production Supabase:
- [ ] Migration run on production database

### Step 5.5: Test Production
1. Go to your production OctaDezx URL
2. Navigate to Products → Auto-Import
3. Test with a real URL

- [ ] Scraper works in production
- [ ] Products import successfully
- [ ] No CORS errors
- [ ] No console errors

---

## Phase 6: Monitoring & Optimization (Ongoing)

### Step 6.1: Set Up Monitoring
- [ ] Check scraper service logs regularly
- [ ] Monitor Supabase usage
- [ ] Set up error alerts (optional)

### Step 6.2: Performance Checks
- [ ] Scraping completes in < 10 seconds for most sites
- [ ] Database imports complete in < 5 seconds
- [ ] Frontend remains responsive

### Step 6.3: User Feedback
- [ ] Test with different e-commerce platforms
- [ ] Collect user feedback on scraper
- [ ] Document any common issues

---

## Common Issues & Solutions

### Issue: "Module not found" error
**Solution:**
```bash
cd scraper
pip install --upgrade pip
pip install -r requirements.txt
```

### Issue: CORS error in browser
**Solution:**
Update `product_scraper.py` line 26:
```python
allow_origins=["YOUR_FRONTEND_URL"]
```

### Issue: Scraper returns 0 products
**Solutions:**
- Try more specific URL (e.g., /collections/all)
- Check if site requires login
- Verify site is publicly accessible

### Issue: Database permission error
**Solution:**
Check RLS policies in Supabase:
- Ensure policies allow INSERT for authenticated users
- Verify business_id matches current user

### Issue: Products import but don't show
**Solution:**
- Hard refresh page (Ctrl+Shift+R)
- Check browser console for errors
- Verify business_id in products table

---

## Optional Enhancements (Future)

Once basic scraper is working, consider adding:

- [ ] Auto-refresh scheduling (cron job)
- [ ] Pagination support (100+ products)
- [ ] JavaScript rendering (Playwright)
- [ ] Image downloading to Supabase Storage
- [ ] Advanced duplicate detection
- [ ] Multi-URL import
- [ ] Custom field mapping
- [ ] Webhook notifications

---

## Success Criteria

You'll know the implementation is successful when:

✅ Backend scraper service runs without errors
✅ Database migration completed successfully
✅ Frontend shows Auto-Import tab
✅ Can scrape Shopify stores successfully
✅ Products appear in product catalog
✅ Scrape jobs logged in database
✅ Error handling works gracefully
✅ Production deployment successful
✅ Users can import catalogs in < 2 minutes

---

## Final Verification

Run through this complete user flow:

1. [ ] User logs into OctaDezx
2. [ ] Navigates to Products page
3. [ ] Clicks "Auto-Import" tab
4. [ ] Pastes Shopify store URL
5. [ ] Clicks "Scan Website"
6. [ ] Sees real-time progress
7. [ ] Products preview shown
8. [ ] Clicks import
9. [ ] Products appear in catalog
10. [ ] Can view/edit imported products
11. [ ] Chat link works with product data

If all steps work smoothly, you're done! 🎉

---

## Need Help?

Documentation files:
- `SCRAPER_QUICKSTART.md` - Quick setup guide
- `PRODUCT_SCRAPER_GUIDE.md` - Detailed technical guide
- `SYSTEM_FLOW_DIAGRAM.md` - Visual system architecture
- `IMPLEMENTATION_SUMMARY.md` - Complete overview

API Documentation:
- Local: http://localhost:8000/docs
- Production: https://your-scraper-url.com/docs

---

**Current Status:** □ Not Started | ◐ In Progress | ✅ Complete

Mark each checkbox as you complete it. Good luck! 🚀
