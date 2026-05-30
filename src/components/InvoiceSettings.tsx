import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { FileText, Upload, Loader2, Save, X, Building2 } from "lucide-react";
import { type Database } from "@/integrations/supabase/types";

type Business = Database["public"]["Tables"]["businesses"]["Row"];

interface Props {
  business: Business;
  onSettingsUpdated: (b: Business) => void;
}

export default function InvoiceSettings({ business, onSettingsUpdated }: Props) {
  const { toast } = useToast();

  // Invoice options
  const [invoiceEnabled, setInvoiceEnabled] = useState<boolean>((business as any).invoice_enabled ?? false);
  const [autoGenerate,   setAutoGenerate]   = useState<boolean>((business as any).invoice_auto_generate ?? false);
  const [numberingMode,  setNumberingMode]  = useState<"uuid" | "sequential">(((business as any).invoice_numbering_mode ?? "uuid") as "uuid" | "sequential");
  const [seqPrefix,      setSeqPrefix]      = useState<string>((business as any).invoice_sequence_prefix ?? "INV");
  const [footerNote,     setFooterNote]     = useState<string>((business as any).invoice_footer_note ?? "");
  const [logoUrl,        setLogoUrl]        = useState<string | null>((business as any).invoice_logo_url ?? null);

  // Contact (used on invoices and shipping labels)
  const [bizAddress, setBizAddress] = useState<string>((business as any).business_address ?? "");
  const [bizPhone,   setBizPhone]   = useState<string>((business as any).business_phone ?? "");
  const [bizEmail,   setBizEmail]   = useState<string>((business as any).business_email ?? "");

  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File too large", description: "Logo must be under 2MB", variant: "destructive" });
      return;
    }
    setUploadingLogo(true);
    try {
      const ext = file.name.split(".").pop() ?? "png";
      const path = `${business.id}/logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("business-logos").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("business-logos").getPublicUrl(path);
      setLogoUrl(data.publicUrl);
      toast({ title: "Logo uploaded", description: "Click Save to apply." });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleRemoveLogo = () => setLogoUrl(null);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates: any = {
        invoice_enabled: invoiceEnabled,
        invoice_auto_generate: autoGenerate,
        invoice_numbering_mode: numberingMode,
        invoice_sequence_prefix: seqPrefix.trim() || "INV",
        invoice_footer_note: footerNote || null,
        invoice_logo_url: logoUrl,
        business_address: bizAddress || null,
        business_phone: bizPhone || null,
        business_email: bizEmail || null,
      };
      const { data, error } = await supabase
        .from("businesses")
        .update(updates)
        .eq("id", business.id)
        .select()
        .single();
      if (error) throw error;
      if (data) {
        onSettingsUpdated(data);
        toast({ title: "Settings saved", description: "Invoice & shipping settings updated." });
      }
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Invoice section ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" /> Invoice Settings
          </CardTitle>
          <CardDescription>
            Configure how invoices are generated and what appears on them. PDF invoices are downloadable by customers from the chat.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* Enable invoices */}
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div className="space-y-0.5">
              <Label className="text-base">Enable invoices</Label>
              <p className="text-sm text-muted-foreground">Allow the AI to generate PDF invoices for confirmed orders.</p>
            </div>
            <Switch checked={invoiceEnabled} onCheckedChange={setInvoiceEnabled} />
          </div>

          {invoiceEnabled && (
            <>
              {/* Auto-generate */}
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div className="space-y-0.5">
                  <Label className="text-base">Auto-generate on every order</Label>
                  <p className="text-sm text-muted-foreground">
                    {autoGenerate
                      ? "Invoice is created automatically when an order is confirmed."
                      : "AI asks the customer first: \"Would you like a PDF invoice?\""}
                  </p>
                </div>
                <Switch checked={autoGenerate} onCheckedChange={setAutoGenerate} />
              </div>

              {/* Numbering mode */}
              <div className="space-y-3">
                <Label className="text-base">Invoice numbering</Label>
                <RadioGroup value={numberingMode} onValueChange={(v) => setNumberingMode(v as "uuid" | "sequential")}>
                  <label className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/40">
                    <RadioGroupItem value="uuid" className="mt-0.5" />
                    <div>
                      <div className="font-medium text-sm">Random unique IDs</div>
                      <p className="text-xs text-muted-foreground">e.g. {seqPrefix}-A1B2C3D4 — non-guessable, no order leakage.</p>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/40">
                    <RadioGroupItem value="sequential" className="mt-0.5" />
                    <div>
                      <div className="font-medium text-sm">Sequential</div>
                      <p className="text-xs text-muted-foreground">e.g. {seqPrefix}-00001, {seqPrefix}-00002 — easy to reference, common for accounting.</p>
                    </div>
                  </label>
                </RadioGroup>
              </div>

              {/* Prefix */}
              <div>
                <Label htmlFor="seq-prefix">Invoice prefix</Label>
                <Input
                  id="seq-prefix" value={seqPrefix} onChange={(e) => setSeqPrefix(e.target.value)}
                  className="mt-1.5 max-w-[200px]" placeholder="INV"
                />
                <p className="text-xs text-muted-foreground mt-1">Prefix shown before every invoice number (e.g. INV, BILL, RCP).</p>
              </div>

              {/* Logo */}
              <div className="space-y-2">
                <Label>Company logo (optional)</Label>
                {logoUrl ? (
                  <div className="flex items-center gap-3 p-3 border rounded-lg">
                    <img src={logoUrl} alt="Logo" className="h-12 w-12 object-contain rounded bg-muted" />
                    <div className="flex-1 text-sm text-muted-foreground truncate">{logoUrl.split("/").pop()}</div>
                    <Button variant="ghost" size="sm" onClick={handleRemoveLogo}><X className="h-4 w-4" /></Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploadingLogo}>
                      {uploadingLogo ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                      Upload logo
                    </Button>
                    <p className="text-xs text-muted-foreground">PNG, JPG or SVG · max 2MB</p>
                  </div>
                )}
                <input
                  ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0])}
                />
              </div>

              {/* Footer note */}
              <div>
                <Label htmlFor="footer-note">Footer note (optional)</Label>
                <Textarea
                  id="footer-note" value={footerNote} onChange={(e) => setFooterNote(e.target.value)}
                  className="mt-1.5" rows={2}
                  placeholder="e.g. Thank you for shopping with us! For support, contact support@example.com"
                />
                <p className="text-xs text-muted-foreground mt-1">Appears at the bottom of every invoice.</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Business contact / shipping address ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" /> Business Contact & Shipping Origin
          </CardTitle>
          <CardDescription>
            Shown on invoices and used as the pickup/origin address when shipping with connected couriers.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="biz-addr">Business address</Label>
            <Textarea
              id="biz-addr" value={bizAddress} onChange={(e) => setBizAddress(e.target.value)}
              className="mt-1.5" rows={2}
              placeholder="123 Main Street, Suite 4B, City, State, ZIP, Country"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="biz-phone">Phone</Label>
              <Input id="biz-phone" value={bizPhone} onChange={(e) => setBizPhone(e.target.value)}
                className="mt-1.5" placeholder="+1 555 123 4567" />
            </div>
            <div>
              <Label htmlFor="biz-email">Email</Label>
              <Input id="biz-email" type="email" value={bizEmail} onChange={(e) => setBizEmail(e.target.value)}
                className="mt-1.5" placeholder="contact@yourstore.com" />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save settings
        </Button>
      </div>
    </div>
  );
}
