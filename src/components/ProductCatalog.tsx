import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Upload, X, Edit, Trash2, Settings2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// --- Types ---
interface ProductOption {
  name: string;
  values: string[];
}

interface ProductMetadata {
  stock?: number;
  sku?: string;
  options?: ProductOption[];
  currency?: string;
}

interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  images: Array<{
    id: string;
    image_url: string;
    alt_text: string;
    is_primary: boolean;
  }>;
  stock: number;
  sku: string;
  options: ProductOption[];
  currency: string;
}

interface ProductCatalogProps {
  businessId: string;
}

// Common Currencies
const CURRENCIES = [
  { code: "USD", symbol: "$", name: "US Dollar ($)" },
  { code: "EUR", symbol: "€", name: "Euro (€)" },
  { code: "GBP", symbol: "£", name: "British Pound (£)" },
  { code: "BDT", symbol: "৳", name: "Bangladeshi Taka (৳)" },
  { code: "INR", symbol: "₹", name: "Indian Rupee (₹)" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen (¥)" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar (C$)" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar (A$)" },
  { code: "AED", symbol: "AED", name: "UAE Dirham (AED)" },
];

// --- Sub-Component: Product Form Fields ---
// Moved OUTSIDE the main component to prevent focus loss bugs
interface ProductFormFieldsProps {
  defaultValues?: any;
  selectedCurrency: string;
  setSelectedCurrency: (val: string) => void;
  currentOptions: ProductOption[];
  newOptionName: string;
  setNewOptionName: (val: string) => void;
  newOptionValues: string;
  setNewOptionValues: (val: string) => void;
  addOption: () => void;
  removeOption: (index: number) => void;
  uploadedImages: File[];
  handleImageUpload: (files: FileList | null) => void;
  removeNewImage: (index: number) => void;
  handleDeleteExistingImage: (id: string, url: string) => void;
}

const ProductFormFields = ({
  defaultValues,
  selectedCurrency,
  setSelectedCurrency,
  currentOptions,
  newOptionName,
  setNewOptionName,
  newOptionValues,
  setNewOptionValues,
  addOption,
  removeOption,
  uploadedImages,
  handleImageUpload,
  removeNewImage,
  handleDeleteExistingImage
}: ProductFormFieldsProps) => {
  const values = defaultValues || {};

  return (
    <div className="space-y-4 px-1">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Product Name *</Label>
          <Input id="name" name="name" required defaultValue={values.name} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Input id="category" name="category" placeholder="e.g., Apparel" defaultValue={values.category} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Currency</Label>
          <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
            <SelectTrigger>
              <SelectValue placeholder="Select Currency" />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((curr) => (
                <SelectItem key={curr.code} value={curr.code}>
                  {curr.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="price">Price *</Label>
          <Input id="price" name="price" type="number" step="0.01" required defaultValue={values.price} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="stock">Stock Qty</Label>
          <Input id="stock" name="stock" type="number" defaultValue={values.stock || 0} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="sku">SKU (Optional)</Label>
        <Input id="sku" name="sku" placeholder="PROD-001" defaultValue={values.sku} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" placeholder="Product details..." rows={3} defaultValue={values.description} />
      </div>

      {/* Options Section */}
      <div className="space-y-2 border rounded-md p-3 bg-muted/20">
        <div className="flex items-center gap-2 mb-2">
          <Settings2 className="h-4 w-4 text-muted-foreground" />
          <Label>Variants & Options</Label>
        </div>
        
        {currentOptions.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {currentOptions.map((opt, idx) => (
              <Badge key={idx} variant="secondary" className="flex gap-2 items-center px-2 py-1">
                <span>{opt.name}: {opt.values.join(", ")}</span>
                <X className="h-3 w-3 cursor-pointer hover:text-destructive" onClick={() => removeOption(idx)} />
              </Badge>
            ))}
          </div>
        )}

        <div className="flex gap-2 items-end">
          <div className="flex-1 space-y-1">
            <Label className="text-xs text-muted-foreground">Option Name</Label>
            <Input 
              value={newOptionName} 
              onChange={(e) => setNewOptionName(e.target.value)} 
              placeholder="e.g. Size" 
              className="h-8"
            />
          </div>
          <div className="flex-[2] space-y-1">
            <Label className="text-xs text-muted-foreground">Values (comma separated)</Label>
            <Input 
              value={newOptionValues} 
              onChange={(e) => setNewOptionValues(e.target.value)} 
              placeholder="e.g. S, M, L" 
              className="h-8"
            />
          </div>
          <Button type="button" size="sm" variant="outline" onClick={addOption}>Add</Button>
        </div>
      </div>

      {/* Image Upload Section */}
      <div className="space-y-2">
        <Label>Images (Max 5)</Label>
        <div className="grid grid-cols-4 gap-2">
          {values.images?.map((image: any) => (
            <div key={image.id} className="relative group">
              <img src={image.image_url} alt={image.alt_text} className="w-full h-20 object-cover rounded border" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded">
                <Button type="button" variant="destructive" size="icon" className="h-6 w-6" onClick={() => handleDeleteExistingImage(image.id, image.image_url)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
          
          {uploadedImages.map((file, index) => (
            <div key={index} className="relative group">
              <img src={URL.createObjectURL(file)} alt="preview" className="w-full h-20 object-cover rounded border" />
              <Button type="button" variant="destructive" size="icon" className="absolute top-1 right-1 h-5 w-5" onClick={() => removeNewImage(index)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}

          {((values.images?.length || 0) + uploadedImages.length) < 5 && (
            <Label htmlFor={values.id ? "edit-image-upload" : "add-image-upload"} className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed rounded cursor-pointer hover:bg-muted/50 transition-colors">
              <Upload className="h-5 w-5 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground mt-1">Upload</span>
              <Input 
                id={values.id ? "edit-image-upload" : "add-image-upload"} 
                type="file" multiple accept="image/*" className="hidden" 
                onChange={(e) => handleImageUpload(e.target.files)} 
              />
            </Label>
          )}
        </div>
      </div>
    </div>
  );
};

// --- Main Component ---

const ProductCatalog = ({ businessId }: ProductCatalogProps) => {
  const { toast } = useToast();
  const addFormRef = useRef<HTMLFormElement>(null);
  const editFormRef = useRef<HTMLFormElement>(null);
  
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [uploadedImages, setUploadedImages] = useState<File[]>([]);

  // --- Dynamic Options State ---
  const [currentOptions, setCurrentOptions] = useState<ProductOption[]>([]);
  const [newOptionName, setNewOptionName] = useState("");
  const [newOptionValues, setNewOptionValues] = useState(""); 
  const [selectedCurrency, setSelectedCurrency] = useState("USD");

  useEffect(() => {
    loadProducts();
  }, [businessId]);

  useEffect(() => {
    if (editingProduct) {
      setCurrentOptions(editingProduct.options || []);
      setSelectedCurrency(editingProduct.currency || "USD");
    } else {
      setCurrentOptions([]);
      setSelectedCurrency("USD");
    }
    setNewOptionName("");
    setNewOptionValues("");
  }, [editingProduct, addDialogOpen]);

  const loadProducts = async () => {
    try {
      const { data, error } = await supabase
        .from("products")
        .select(`*, product_images(*)`)
        .eq("business_id", businessId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setProducts(data?.map(product => {
        const metadata = (product.metadata as unknown as ProductMetadata) || {};
        
        return {
          ...product,
          description: product.description || "",
          category: product.category || "",
          price: product.price || 0,
          stock: metadata.stock || 0,
          sku: metadata.sku || "",
          options: metadata.options || [],
          currency: metadata.currency || "USD",
          images: (product.product_images || []).map((img: any) => ({ ...img, alt_text: img.alt_text || "" }))
        };
      }) || []);
    } catch (error) {
      toast({ title: "Error", description: "Failed to load products", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = (files: FileList | null) => {
    if (files) {
        const currentTotal = (editingProduct?.images.length || 0) + uploadedImages.length;
        const newImages = Array.from(files).slice(0, 5 - currentTotal);
        setUploadedImages(prev => [...prev, ...newImages]);
    }
  };

  const removeNewImage = (index: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index));
  };
  
  const handleDeleteExistingImage = async (imageId: string, imageUrl: string) => {
    if (!editingProduct) return;
    try {
      const filePath = new URL(imageUrl).pathname.split('/product-images/')[1];
      if (!filePath) throw new Error("Could not determine file path.");

      const { error: storageError } = await supabase.storage.from('product-images').remove([filePath]);
      if (storageError && storageError.message !== 'The resource was not found') throw storageError;

      const { error: dbError } = await supabase.from('product_images').delete().eq('id', imageId);
      if (dbError) throw dbError;

      setEditingProduct(prev => {
        if (!prev) return null;
        return { ...prev, images: prev.images.filter(img => img.id !== imageId) };
      });
      setProducts(prev => prev.map(p => p.id === editingProduct.id ? { ...p, images: p.images.filter(img => img.id !== imageId) } : p));
      toast({ title: "Success", description: "Image deleted." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete image", variant: "destructive" });
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!window.confirm("Are you sure you want to delete this product? This action cannot be undone.")) return;

    try {
      const { error } = await supabase.from("products").delete().eq("id", productId);
      if (error) throw error;

      setProducts(products.filter(p => p.id !== productId));
      toast({ title: "Success", description: "Product deleted successfully." });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const uploadImages = async (productId: string) => {
    const imageUrls = [];
    const hasPrimaryImage = editingProduct ? editingProduct.images.some(img => img.is_primary) : false;
    for (let i = 0; i < uploadedImages.length; i++) {
      const file = uploadedImages[i];
      const fileName = `${productId}-${Date.now()}-${i}.${file.name.split('.').pop()}`;
      const { error } = await supabase.storage.from('product-images').upload(fileName, file);
      if (error) throw new Error(`Failed to upload ${file.name}`);
      
      const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(fileName);
      imageUrls.push({ product_id: productId, image_url: publicUrl, alt_text: file.name, is_primary: i === 0 && !hasPrimaryImage });
    }
    if (imageUrls.length > 0) {
      await supabase.from('product_images').insert(imageUrls);
    }
  };

  const addOption = () => {
    if (!newOptionName.trim() || !newOptionValues.trim()) {
      toast({ title: "Incomplete", description: "Please enter option name and values", variant: "destructive" });
      return;
    }
    const valuesArray = newOptionValues.split(',').map(v => v.trim()).filter(v => v !== "");
    setCurrentOptions([...currentOptions, { name: newOptionName, values: valuesArray }]);
    setNewOptionName("");
    setNewOptionValues("");
  };

  const removeOption = (index: number) => {
    setCurrentOptions(currentOptions.filter((_, i) => i !== index));
  };

  const handleAddSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const productData = { 
      business_id: businessId, 
      name: formData.get("name") as string, 
      description: formData.get("description") as string, 
      category: formData.get("category") as string, 
      price: parseFloat(formData.get("price") as string) || 0,
      metadata: {
        stock: parseInt(formData.get("stock") as string) || 0,
        sku: formData.get("sku") as string,
        options: currentOptions,
        currency: selectedCurrency 
      } as any
    };

    try {
      const { data, error } = await supabase.from("products").insert([productData]).select().single();
      if (error) throw error;
      
      if (uploadedImages.length > 0) await uploadImages(data.id);
      
      toast({ title: "Success", description: "Product added!" });
      setAddDialogOpen(false);
      setUploadedImages([]);
      loadProducts();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };
  
  const handleUpdateSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingProduct) return;

    const formData = new FormData(e.currentTarget);
    const productData = { 
      name: formData.get("name") as string, 
      description: formData.get("description") as string, 
      category: formData.get("category") as string, 
      price: parseFloat(formData.get("price") as string) || 0,
      metadata: {
        stock: parseInt(formData.get("stock") as string) || 0,
        sku: formData.get("sku") as string,
        options: currentOptions,
        currency: selectedCurrency 
      } as any
    };

    try {
      const { error } = await supabase.from("products").update(productData).eq("id", editingProduct.id);
      if (error) throw error;
      
      if (uploadedImages.length > 0) await uploadImages(editingProduct.id);
      
      toast({ title: "Success", description: "Product updated!" });
      setEditingProduct(null);
      setUploadedImages([]);
      loadProducts();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const getSymbol = (code: string) => {
    return CURRENCIES.find(c => c.code === code)?.symbol || "$";
  };

  if (loading) return <div className="text-center py-8 text-muted-foreground">Loading products...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-lg font-semibold">Product Catalog</h3>
          <p className="text-sm text-muted-foreground">Manage your inventory and AI knowledge base</p>
        </div>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Add Product</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add New Product</DialogTitle>
              <DialogDescription>Fill in the details below.</DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[70vh] pr-4">
              <form ref={addFormRef} onSubmit={handleAddSubmit} className="pb-4">
                <ProductFormFields 
                  selectedCurrency={selectedCurrency}
                  setSelectedCurrency={setSelectedCurrency}
                  currentOptions={currentOptions}
                  newOptionName={newOptionName}
                  setNewOptionName={setNewOptionName}
                  newOptionValues={newOptionValues}
                  setNewOptionValues={setNewOptionValues}
                  addOption={addOption}
                  removeOption={removeOption}
                  uploadedImages={uploadedImages}
                  handleImageUpload={handleImageUpload}
                  removeNewImage={removeNewImage}
                  handleDeleteExistingImage={() => {}} // Not needed for add mode
                />
                <div className="mt-6">
                  <Button type="submit" className="w-full">Save Product</Button>
                </div>
              </form>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>

      {products.length === 0 ? (
        <Card><CardContent className="text-center py-12"><p className="text-muted-foreground">No products found. Add your first item!</p></CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {products.map((product) => (
            <Card key={product.id} className="flex flex-col">
              <CardHeader className="pb-2 p-4">
                <div className="aspect-square w-full bg-muted rounded-md mb-3 overflow-hidden relative">
                  {product.images.length > 0 ? (
                    <img src={product.images.find(img => img.is_primary)?.image_url || product.images[0].image_url} alt={product.name} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground"><Upload className="h-8 w-8 opacity-20" /></div>
                  )}
                  {product.stock <= 0 && <Badge variant="destructive" className="absolute top-2 right-2">Out of Stock</Badge>}
                </div>
                <CardTitle className="text-base line-clamp-1">{product.name}</CardTitle>
                <div className="flex justify-between items-center mt-1">
                  <span className="font-bold text-primary">
                    {getSymbol(product.currency)}{product.price.toFixed(2)}
                  </span>
                  <Badge variant="outline" className="text-xs">{product.category || "General"}</Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0 flex-grow">
                <div className="text-xs text-muted-foreground line-clamp-2 mb-2">
                  {product.description || <em>No description</em>}
                </div>
                {product.options.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {product.options.map((opt, i) => (
                      <span key={i} className="text-[10px] bg-secondary px-1.5 py-0.5 rounded text-secondary-foreground">
                        {opt.values.length} {opt.name}s
                      </span>
                    ))}
                  </div>
                )}
              </CardContent>
              <CardFooter className="p-4 pt-0 flex gap-2">
                <Button variant="secondary" size="sm" className="flex-1" onClick={() => { setUploadedImages([]); setEditingProduct(product); }}>
                  <Edit className="h-3 w-3 mr-2" /> Edit
                </Button>
                <Button variant="destructive" size="sm" className="flex-1" onClick={() => handleDeleteProduct(product.id)}>
                  <Trash2 className="h-3 w-3 mr-2" /> Delete
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={editingProduct !== null} onOpenChange={(isOpen) => !isOpen && setEditingProduct(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
            <DialogDescription>Modify product details and inventory.</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-4">
            <form ref={editFormRef} onSubmit={handleUpdateSubmit} className="pb-4">
              <ProductFormFields 
                defaultValues={editingProduct} 
                selectedCurrency={selectedCurrency}
                setSelectedCurrency={setSelectedCurrency}
                currentOptions={currentOptions}
                newOptionName={newOptionName}
                setNewOptionName={setNewOptionName}
                newOptionValues={newOptionValues}
                setNewOptionValues={setNewOptionValues}
                addOption={addOption}
                removeOption={removeOption}
                uploadedImages={uploadedImages}
                handleImageUpload={handleImageUpload}
                removeNewImage={removeNewImage}
                handleDeleteExistingImage={handleDeleteExistingImage}
              />
              <div className="mt-6 flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setEditingProduct(null)}>Cancel</Button>
                <Button type="submit" className="flex-1">Update Changes</Button>
              </div>
            </form>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProductCatalog;