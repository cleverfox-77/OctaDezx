-- Expand the allowed platform values in platform_integrations
-- to include e-commerce, CRM, helpdesk and payment platforms.

ALTER TABLE public.platform_integrations
  DROP CONSTRAINT IF EXISTS platform_integrations_platform_check;

ALTER TABLE public.platform_integrations
  ADD CONSTRAINT platform_integrations_platform_check
    CHECK (platform IN (
      -- Messaging
      'whatsapp', 'facebook', 'instagram', 'telegram', 'viber', 'line',
      'twitter', 'wechat', 'discord', 'slack',
      -- E-Commerce
      'shopify', 'woocommerce', 'amazon', 'etsy', 'ebay',
      'bigcommerce', 'magento', 'lazada', 'shopee', 'tokopedia',
      -- CRM & Helpdesk
      'hubspot', 'salesforce', 'zoho', 'zendesk', 'freshdesk', 'intercom',
      -- Payments
      'stripe', 'paypal', 'square'
    ));

COMMENT ON COLUMN public.platform_integrations.platform IS
  'Messaging: whatsapp | facebook | instagram | telegram | viber | line | twitter | wechat | discord | slack
   E-Commerce: shopify | woocommerce | amazon | etsy | ebay | bigcommerce | magento | lazada | shopee | tokopedia
   CRM & Helpdesk: hubspot | salesforce | zoho | zendesk | freshdesk | intercom
   Payments: stripe | paypal | square';
