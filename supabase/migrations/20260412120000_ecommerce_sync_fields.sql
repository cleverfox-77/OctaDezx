-- Add external_id and source_platform to products for deduplication during e-commerce sync
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS external_id      TEXT,
  ADD COLUMN IF NOT EXISTS source_platform  TEXT,
  ADD COLUMN IF NOT EXISTS stock_quantity   INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active        BOOLEAN DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_external
  ON public.products (business_id, external_id)
  WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_source_platform
  ON public.products (business_id, source_platform);

-- Add external_id and source_platform to orders for deduplication
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS external_id       TEXT,
  ADD COLUMN IF NOT EXISTS source_platform   TEXT,
  ADD COLUMN IF NOT EXISTS customer_phone    TEXT,
  ADD COLUMN IF NOT EXISTS shipping_address  TEXT,
  ADD COLUMN IF NOT EXISTS external_url      TEXT;

-- Allow 'delivered' as a valid order status (maps from e-commerce "fulfilled")
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check
    CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_external
  ON public.orders (business_id, external_id)
  WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_source_platform
  ON public.orders (business_id, source_platform);

-- Service-role bypass so the sync-ecommerce edge function can write to products
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'products' AND policyname = 'service_all'
  ) THEN
    CREATE POLICY "service_all" ON public.products
      FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

-- Service-role bypass for platform_integrations (already exists but ensure it's there)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'platform_integrations' AND policyname = 'service_all'
  ) THEN
    CREATE POLICY "service_all" ON public.platform_integrations
      FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

COMMENT ON COLUMN public.products.external_id     IS 'Platform-assigned ID used to deduplicate synced products (e.g. shopify_123456)';
COMMENT ON COLUMN public.products.source_platform IS 'Which platform this product was imported from: shopify | woocommerce | etc.';
COMMENT ON COLUMN public.orders.external_id       IS 'Platform-assigned order ID for deduplication';
COMMENT ON COLUMN public.orders.source_platform   IS 'Which platform this order came from: shopify | woocommerce | stripe | etc.';
