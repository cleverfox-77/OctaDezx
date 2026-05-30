import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

  const handleSave = async () => {
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
        toast({ title: 'Success', description: 'AI logic updated successfully.' });
      }
    } catch (error: any) {
      toast({ title: 'Error updating settings', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle>AI Personality & Logic</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {isEditing ? (
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">About the Store</h4>
              <Textarea value={description ?? ''} onChange={(e) => setDescription(e.target.value)} rows={3} />
            </div>
            <div>
              <h4 className="font-semibold mb-2">Policies (Shipping/Returns)</h4>
              <Textarea value={policies ?? ''} onChange={(e) => setPolicies(e.target.value)} rows={4} />
            </div>
            <div>
              <h4 className="font-semibold mb-2">System Instructions</h4>
              <Textarea value={aiInstructions ?? ''} onChange={(e) => setAiInstructions(e.target.value)} rows={10} className="font-mono text-xs" />
            </div>
            <div className="flex space-x-2">
              <Button onClick={handleSave}>Save Changes</Button>
              <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 text-sm">
            <div><h4 className="font-semibold">Description</h4><p className="text-muted-foreground">{business.description || 'Not set'}</p></div>
            <div><h4 className="font-semibold">Policies</h4><p className="text-muted-foreground">{business.policies || 'Not set'}</p></div>
            <Button onClick={() => setIsEditing(true)}>Edit Configuration</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BusinessSettings;