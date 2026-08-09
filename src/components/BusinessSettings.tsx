import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings2, FileText, ScrollText, TerminalSquare, Pencil } from 'lucide-react';
import { type Database } from '@/integrations/supabase/types';

const defaultAiInstructions = `You are the Official AI Assistant for this store.

### CORE RULES:
1. **Show, Don't Just Tell:** If a user asks to "see", "show", "image", or "photo" of a product, you MUST provide the Image URL provided in the context.
2. **Strict Catalog Usage:** Use ONLY the product data provided. If an item isn't there, say you don't have it.
3. **Handle Selection First:** If a user identifies a product they like, show them the details and the image immediately. Do NOT ask for delivery address or size until they say "I want to buy this" or "Order this".

### FORMATTING:
- Use **bold** for product names and prices.
- If an image URL is provided in the context, paste it on its own line.
- Avoid long blocks of text. Use bullet points.

### ORDERING:
Only when the user confirms they want to purchase, output:
||ORDER_CONFIRMED:{"items": [{"name": "Product Name", "quantity": 1, "price": 100}], "total": 100}||`;

type Business = Database["public"]["Tables"]["businesses"]["Row"];

interface BusinessSettingsProps {
  business: Business;
  onSettingsUpdated: (updatedBusiness: Business) => void;
}

const BusinessSettings: React.FC<BusinessSettingsProps> = ({ business, onSettingsUpdated }) => {
  const { toast } = useToast();
  const [description, setDescription] = useState(business.description || '');
  const [policies, setPolicies] = useState(business.policies || '');
  const [aiInstructions, setAiInstructions] = useState(business.ai_instructions || defaultAiInstructions);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('businesses')
        .update({ description, policies, ai_instructions: aiInstructions })
        .eq('id', business.id)
        .select()
        .single();

      if (error) throw error;
      if (data) {
        onSettingsUpdated(data);
        setIsEditing(false);
        toast({ title: 'Saved', description: 'Your AI configuration is live for the next customer message.' });
      }
    } catch (error: any) {
      toast({ title: 'Error updating settings', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const viewField = (icon: React.ReactNode, label: string, value: string | null, empty: string) => (
    <div className="flex items-start gap-3 rounded-xl border p-4">
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold mb-0.5">{label}</div>
        {value?.trim()
          ? <p className="text-sm text-muted-foreground whitespace-pre-line line-clamp-3">{value}</p>
          : <p className="text-sm text-muted-foreground/60 italic">{empty}</p>}
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings2 className="h-4 w-4 text-primary" />
            AI personality &amp; logic
          </CardTitle>
          <CardDescription className="mt-1">
            What your assistant knows about the business and how it's allowed to behave.
          </CardDescription>
        </div>
        {!isEditing && (
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="press flex-shrink-0">
            <Pencil className="h-3.5 w-3.5 mr-2" />Edit
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="bs-desc">About the business</Label>
              <Textarea id="bs-desc" value={description ?? ''} onChange={(e) => setDescription(e.target.value)} rows={3}
                placeholder="What you sell, who you serve, what makes you different…" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bs-pol">Policies (shipping, returns, refunds)</Label>
              <Textarea id="bs-pol" value={policies ?? ''} onChange={(e) => setPolicies(e.target.value)} rows={4}
                placeholder="e.g. Free shipping over $30. 30-day returns. Refunds to original payment method…" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="bs-sys">System instructions <span className="text-muted-foreground font-normal">(advanced)</span></Label>
                <button type="button" onClick={() => setShowAdvanced(v => !v)}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                  {showAdvanced ? 'Hide' : 'Show'}
                </button>
              </div>
              {showAdvanced && (
                <>
                  <Textarea id="bs-sys" value={aiInstructions ?? ''} onChange={(e) => setAiInstructions(e.target.value)}
                    rows={10} className="font-mono text-xs" />
                  <p className="text-xs text-muted-foreground">
                    Careful, this is the assistant's rulebook. Most owners never need to touch it.
                  </p>
                </>
              )}
            </div>
            <div className="flex gap-2 pt-1">
              <Button onClick={handleSave} disabled={saving} className="press">{saving ? 'Saving…' : 'Save changes'}</Button>
              <Button variant="outline" onClick={() => setIsEditing(false)} disabled={saving} className="press">Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {viewField(<FileText className="h-4 w-4 text-primary" />, 'About the business', business.description, 'Not set yet, tell the AI what you sell.')}
            {viewField(<ScrollText className="h-4 w-4 text-primary" />, 'Policies', business.policies, 'Not set yet, add shipping & returns rules.')}
            <div className="sm:col-span-2 flex items-center gap-2 text-xs text-muted-foreground px-1">
              <TerminalSquare className="h-3.5 w-3.5" />
              System instructions are configured, edit to view or change the assistant's rulebook.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BusinessSettings;
