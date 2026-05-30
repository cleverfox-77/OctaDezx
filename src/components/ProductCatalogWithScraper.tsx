import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import ProductCatalog from "./ProductCatalog";
import ProductScraper from "./ProductScraper";

interface Props {
    businessId: string;
}

export default function ProductCatalogWithScraper({ businessId }: Props) {
    const handleProductsImported = () => {
        // Trigger refresh of ProductCatalog
        window.location.reload();
    };

    return (
        <Tabs defaultValue="manual" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="manual">📝 Manual Upload</TabsTrigger>
                <TabsTrigger value="auto-import">🚀 Auto-Import (URL)</TabsTrigger>
            </TabsList>

            <TabsContent value="manual" className="mt-6">
                <ProductCatalog businessId={businessId} />
            </TabsContent>

            <TabsContent value="auto-import" className="mt-6">
                <ProductScraper
                    businessId={businessId}
                    onProductsImported={handleProductsImported}
                />
            </TabsContent>
        </Tabs>
    );
}
