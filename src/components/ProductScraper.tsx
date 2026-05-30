import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";
import { Globe, Loader2, CheckCircle2, XCircle, AlertTriangle, ExternalLink } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";

interface ScrapedProduct {
  name: string;
  description?: string;
  price?: string;
  currency?: string;
  image_url?: string;
  product_url?: string;
  category?: string;
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

interface ProductScraperProps {
  businessId: string;
  onProductsImported: () => void;
}

const ProductScraper = ({ businessId, onProductsImported }: ProductScraperProps) => {
  const { toast } = useToast();

  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [scrapeResult, setScrapeResult] = useState<ScrapeResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [autoImport, setAutoImport] = useState(true);

  const handleScrape = async () => {
    if (!url.trim()) {
      toast({
        title: "URL Required",
        description: "Please enter a valid product page URL",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setScrapeResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('product-scraper', {
        body: {
          url: url.trim(),
          business_id: businessId,
          max_products: 100,
          auto_import: autoImport,
        },
      });

      if (error) throw new Error(error.message || "Failed to scrape URL");

      if (autoImport && data.scrape_result) {
        setScrapeResult(data.scrape_result);
        toast({
          title: "Success!",
          description: `Imported ${data.import_result.imported} products (${data.import_result.skipped} duplicates skipped)`,
        });
        onProductsImported();
      } else {
        setScrapeResult(data);
        if (data.success) {
          toast({
            title: `Found ${data.valid_products} products!`,
            description: `Platform: ${data.platform}`,
          });
        } else {
          toast({
            title: "Scraping completed with issues",
            description: data.errors?.[0] || "Some products couldn't be detected",
            variant: "destructive",
          });
        }
      }
    } catch (error: any) {
      toast({
        title: "Scraping Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleManualImport = async () => {
    if (!scrapeResult || scrapeResult.products.length === 0) return;
    setImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('product-scraper', {
        body: {
          url: url.trim(),
          business_id: businessId,
          max_products: 100,
          auto_import: true,
        },
      });
      if (error) throw new Error("Failed to import products");
      toast({
        title: "Import Complete",
        description: `Imported ${data.import_result.imported} products`,
      });
      onProductsImported();
      setScrapeResult(null);
      setUrl("");
    } catch (error: any) {
      toast({ title: "Import Failed", description: error.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const getPlatformColor = (platform: string) => {
    const colors: Record<string, string> = {
      shopify: "bg-green-500",
      woocommerce: "bg-purple-500",
      bigcommerce: "bg-blue-500",
      wix: "bg-orange-500",
      squarespace: "bg-gray-700",
      generic: "bg-gray-500",
    };
    return colors[platform] || colors.generic;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Auto-Import Products from Website
          </CardTitle>
          <CardDescription>
            Paste your product catalog URL and we'll automatically extract all products
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="scrape-url">Website URL</Label>
            <div className="flex gap-2">
              <Input
                id="scrape-url"
                placeholder="https://yourstore.com/products"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={loading}
                onKeyDown={(e) => { if (e.key === "Enter" && !loading) handleScrape(); }}
              />
              <Button onClick={handleScrape} disabled={loading || !url.trim()}>
                {loading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Scanning...</>
                ) : (
                  <><Globe className="h-4 w-4 mr-2" />Scan Website</>
                )}
              </Button>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch id="auto-import" checked={autoImport} onCheckedChange={setAutoImport} disabled={loading} />
            <Label htmlFor="auto-import" className="text-sm text-muted-foreground cursor-pointer">
              Automatically import products after scanning
            </Label>
          </div>

          {loading && (
            <div className="space-y-2">
              <Progress value={undefined} className="w-full" />
              <p className="text-sm text-muted-foreground text-center">
                Analyzing website structure and extracting products...
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {scrapeResult && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                {scrapeResult.success ? (
                  <><CheckCircle2 className="h-5 w-5 text-green-500" />Successfully Found {scrapeResult.valid_products} Products</>
                ) : (
                  <><XCircle className="h-5 w-5 text-red-500" />Scan Completed with Issues</>
                )}
              </CardTitle>
              <Badge className={getPlatformColor(scrapeResult.platform)}>
                {scrapeResult.platform.toUpperCase()}
              </Badge>
            </div>
            <CardDescription>
              Total found: {scrapeResult.total_found} | Valid: {scrapeResult.valid_products}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {scrapeResult.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <ul className="list-disc list-inside space-y-1">
                    {scrapeResult.errors.map((err, idx) => (
                      <li key={idx} className="text-sm">{err}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {scrapeResult.products.length > 0 && (
              <>
                <div>
                  <h4 className="font-semibold mb-3">Product Preview</h4>
                  <ScrollArea className="h-[400px] border rounded-md">
                    <div className="p-4 space-y-3">
                      {scrapeResult.products.map((product, idx) => (
                        <Card key={idx}>
                          <CardContent className="p-4">
                            <div className="flex gap-4">
                              {product.image_url && (
                                <img
                                  src={product.image_url}
                                  alt={product.name}
                                  className="w-20 h-20 object-cover rounded border"
                                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                                />
                              )}
                              <div className="flex-1 min-w-0">
                                <h5 className="font-medium truncate">{product.name}</h5>
                                <p className="text-sm text-muted-foreground line-clamp-2">
                                  {product.description || "No description"}
                                </p>
                                <div className="flex items-center gap-3 mt-2">
                                  {product.price && <Badge variant="secondary">{product.currency || "$"} {product.price}</Badge>}
                                  {product.category && <Badge variant="outline">{product.category}</Badge>}
                                  {product.product_url && (
                                    <a href={product.product_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                                      View <ExternalLink className="h-3 w-3" />
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
                {!autoImport && (
                  <div className="flex gap-2">
                    <Button onClick={handleManualImport} disabled={importing} className="flex-1">
                      {importing ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Importing...</>) : `Import All ${scrapeResult.valid_products} Products`}
                    </Button>
                    <Button variant="outline" onClick={() => setScrapeResult(null)}>Cancel</Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tips for Best Results</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li>• Use your main product listing page (e.g., /shop, /products, /collections/all)</li>
            <li>• Shopify stores work best - we access their Products API directly</li>
            <li>• WooCommerce, BigCommerce, Wix & Squarespace are also well supported</li>
            <li>• For other platforms, we extract from page structure (Schema.org / HTML)</li>
            <li>• Make sure the URL is publicly accessible (not behind a login)</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProductScraper;
