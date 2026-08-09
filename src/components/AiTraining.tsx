import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Brain, ShieldCheck, BookOpen, ShoppingBag, Save, Sparkles } from "lucide-react";
import { getBusinessType, buildAiInstructions, type SectionId } from "@/lib/businessTypes";
import SelfImprovement from "@/components/learning/SelfImprovement";
import { type Database } from "@/integrations/supabase/types";

type Business = Database["public"]["Tables"]["businesses"]["Row"];

interface AiTrainingProps {
  business: Business;
  onSaved: (b: Business) => void;
  onNavigate: (section: SectionId) => void;
  productsLabel: string;
}

const AiTraining = ({ business, onSaved, onNavigate, productsLabel }: AiTrainingProps) => {
  const { toast } = useToast();
  const type = getBusinessType(business.business_type);

  const initialConfig = (business.type_config && typeof business.type_config === "object"
    ? business.type_config
    : {}) as Record<string, string>;

  const [description, setDescription] = useState(business.description ?? "");
  const [policies, setPolicies] = useState(business.policies ?? "");
  const [aiInstructions, setAiInstructions] = useState(business.ai_instructions ?? buildAiInstructions(type.id));
  const [answers, setAnswers] = useState<Record<string, string>>(initialConfig);
  const [saving, setSaving] = useState(false);

  // How much the owner has taught the AI so far, encourages completeness.
  const totalFields = type.fields.length + 2; // + description + policies
  const filledFields =
    (description.trim() ? 1 : 0) +
    (policies.trim() ? 1 : 0) +
    type.fields.filter((f) => (answers[f.name] ?? "").trim()).length;
  const pct = Math.round((filledFields / totalFields) * 100);

  const save = async () => {
    setSaving(true);
    try {
      const typeConfig: Record<string, string> = {};
      for (const f of type.fields) {
        const v = (answers[f.name] ?? "").trim();
        if (v) typeConfig[f.name] = v;
      }
      const { data, error } = await supabase
        .from("businesses")
        .update({
          description: description.trim(),
          policies: policies.trim(),
          ai_instructions: aiInstructions.trim() || buildAiInstructions(type.id),
          type_config: typeConfig,
        })
        .eq("id", business.id)
        .select()
        .single();
      if (error) throw error;
      if (data) onSaved(data as Business);
      toast({ title: "AI updated 🧠", description: "Your assistant now answers using this information." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message ?? "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header / progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Train your AI
          </CardTitle>
          <CardDescription>
            Everything you add here becomes the assistant's knowledge for your{" "}
            <strong>{type.label.toLowerCase()}</strong>. The more you add, the fewer chats it has to escalate.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-sm font-medium tabular-nums">{pct}%</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">{filledFields} of {totalFields} core fields filled in.</p>
        </CardContent>
      </Card>

      {/* Safety guard explainer */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex items-start gap-3 pt-6">
          <ShieldCheck className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">Built-in safety guard</p>
            <p className="text-muted-foreground mt-1">
              Your assistant <strong>never makes things up</strong>. If a customer asks something not covered by the
              information below (or your Knowledge Base / {productsLabel}), it hands the chat to a human, moves it to{" "}
              <strong>Escalated Chats</strong>, and emails you automatically.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Core business info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">About your business</CardTitle>
          <CardDescription>The basics your assistant introduces and answers with.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="t-desc">Business description</Label>
            <Textarea
              id="t-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={type.descriptionPlaceholder}
              rows={3}
            />
          </div>

          {type.fields.map((f) => (
            <div key={f.name} className="space-y-2">
              <Label htmlFor={`t-${f.name}`}>{f.label}</Label>
              <Textarea
                id={`t-${f.name}`}
                value={answers[f.name] ?? ""}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [f.name]: e.target.value }))}
                placeholder={f.placeholder}
                rows={f.rows ?? 2}
              />
            </div>
          ))}

          <div className="space-y-2">
            <Label htmlFor="t-policies">{type.policiesLabel}</Label>
            <Textarea
              id="t-policies"
              value={policies}
              onChange={(e) => setPolicies(e.target.value)}
              placeholder={type.policiesPlaceholder}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* AI behaviour */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Assistant behaviour
          </CardTitle>
          <CardDescription>
            Pre-tuned for a {type.label.toLowerCase()}. Adjust the tone or rules, the "never make things up" rule stays
            enforced server-side regardless.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={aiInstructions}
            onChange={(e) => setAiInstructions(e.target.value)}
            rows={10}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setAiInstructions(buildAiInstructions(type.id))}
          >
            Reset to recommended
          </Button>
        </CardContent>
      </Card>

      {/* Deeper knowledge */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Go deeper</CardTitle>
          <CardDescription>Add detailed knowledge so the AI rarely needs to escalate.</CardDescription>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onNavigate("knowledge-base")}
            className="flex items-center gap-3 rounded-lg border p-4 text-left hover:border-primary hover:bg-primary/5 transition-all"
          >
            <BookOpen className="h-5 w-5 text-primary" />
            <div>
              <p className="font-medium text-sm">Knowledge Base</p>
              <p className="text-xs text-muted-foreground">FAQs, docs, long-form answers</p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => onNavigate("products")}
            className="flex items-center gap-3 rounded-lg border p-4 text-left hover:border-primary hover:bg-primary/5 transition-all"
          >
            <ShoppingBag className="h-5 w-5 text-primary" />
            <div>
              <p className="font-medium text-sm">{productsLabel}</p>
              <p className="text-xs text-muted-foreground">What you sell or offer, with prices</p>
            </div>
          </button>
        </CardContent>
      </Card>

      {/* What the assistant worked out on its own, pending the owner's approval. */}
      <SelfImprovement businessId={business.id} />

      {/* Sticky save */}
      <div className="sticky bottom-4 flex justify-end">
        <Button onClick={save} disabled={saving} size="lg" className="shadow-lg">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save & train AI
        </Button>
      </div>
    </div>
  );
};

export default AiTraining;
