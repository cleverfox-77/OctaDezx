import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, ArrowLeft, Brain, Check } from "lucide-react";
import { BUSINESS_TYPES, buildAiInstructions, type BusinessType } from "@/lib/businessTypes";

// ─────────────────────────────────────────────────────────────────────────────
// Onboarding is intentionally tiny: pick a business type, name it, done. Every
// detail that "trains" the AI (services, hours, policies, menu, …) is filled in
// later from the dashboard's Train AI hub, on a layout that matches the chosen
// type. This gets owners to a working assistant in seconds instead of a long form.
// ─────────────────────────────────────────────────────────────────────────────

interface BusinessSetupProps {
  onBusinessCreated: () => void;
}

const STEPS = ["Business type", "Name it"];

const StepHeader = ({ step }: { step: number }) => (
  <div className="flex flex-col items-center gap-4 mb-8">
    <div className="flex items-center gap-0">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center">
          <div className="flex flex-col items-center gap-1.5">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
              i < step ? "bg-emerald-500 text-white"
              : i === step ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground"
            }`}>
              {i < step ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span className={`text-[10px] font-semibold uppercase tracking-wider ${i === step ? "text-foreground" : "text-muted-foreground"}`}>
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`w-16 sm:w-24 h-0.5 mx-2 mb-5 rounded-full transition-colors ${i < step ? "bg-emerald-500" : "bg-muted"}`} />
          )}
        </div>
      ))}
    </div>
  </div>
);

const BusinessSetup = ({ onBusinessCreated }: BusinessSetupProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0); // 0 = pick type, 1 = name it
  const [selectedType, setSelectedType] = useState<BusinessType | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const chooseType = (t: BusinessType) => {
    setSelectedType(t);
    setStep(1);
  };

  const handleSubmit = async () => {
    if (!user?.id || !selectedType || !name.trim()) {
      toast({ title: "Almost there", description: "Give your business a name to continue.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from("businesses").insert([{
        owner_id: user.id,
        name: name.trim(),
        description: description.trim(),
        ai_instructions: buildAiInstructions(selectedType.id),
        business_type: selectedType.id,
        type_config: {},
      }]);
      if (error) throw error;

      // Keep the profile's business_type in sync (used for account-level context).
      await supabase.from("profiles")
        .update({ business_type: selectedType.id, business_name: name.trim() })
        .eq("user_id", user.id);

      toast({ title: "You're all set! 🎉", description: `Next: head to Train AI to teach ${name.trim()} about your business.` });
      onBusinessCreated();
    } catch {
      toast({ title: "Error", description: "Failed to create business configuration", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // ── STEP 0: pick business type ─────────────────────────────────
  if (step === 0) {
    return (
      <div className="section-enter max-w-4xl mx-auto px-1">
        <StepHeader step={0} />
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">What kind of business are you?</h1>
          <p className="text-muted-foreground max-w-lg mx-auto text-sm sm:text-base">
            Your dashboard and AI assistant are built around how your business actually
            works — a restaurant never sees "Shipments", a store never sees "Menus".
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {BUSINESS_TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => chooseType(t)}
              className="press group relative flex flex-col items-start gap-3 rounded-2xl border bg-card p-5 text-left transition-all hover:border-primary/50 hover:shadow-lg hover:-translate-y-0.5"
            >
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center transition-colors group-hover:bg-primary/15">
                <t.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <span className="font-semibold text-sm block mb-1">{t.label}</span>
                <span className="text-xs text-muted-foreground leading-relaxed block">{t.tagline}</span>
              </div>
              <span className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity text-primary">
                <Check className="h-4 w-4" />
              </span>
            </button>
          ))}
        </div>
        <p className="text-center text-xs text-muted-foreground mt-8">
          You can change everything later — nothing here is permanent.
        </p>
      </div>
    );
  }

  if (!selectedType) return null;

  // ── STEP 1: name it & create ───────────────────────────────────
  return (
    <div className="section-enter max-w-xl mx-auto px-1">
      <StepHeader step={1} />
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        {/* selected type ribbon */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b bg-muted/40">
          <div className="flex items-center gap-2.5 text-sm font-medium">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <selectedType.icon className="h-3.5 w-3.5 text-primary" />
            </div>
            {selectedType.label}
          </div>
          <button type="button" onClick={() => setStep(0)}
            className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
            Change
          </button>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight mb-1.5">Name your business</h1>
            <p className="text-sm text-muted-foreground">That's all we need to get started — you'll train the AI next.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="biz-name">Business name <span className="text-destructive">*</span></Label>
            <Input
              id="biz-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
              placeholder="e.g. Merrell Leather Goods"
              className="h-11"
              autoFocus
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="biz-desc">One-line description <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea
              id="biz-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={selectedType.descriptionPlaceholder}
              rows={2}
            />
          </div>

          <div className="flex items-start gap-3 rounded-xl border bg-primary/[0.04] border-primary/15 p-4 text-sm">
            <Brain className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
            <p className="text-muted-foreground leading-relaxed">
              After this, your dashboard opens on <strong className="text-foreground">Train AI</strong> — add your services,
              hours, prices and policies there so the assistant only ever answers from real information.
            </p>
          </div>

          <div className="flex items-center justify-between pt-1">
            <Button type="button" variant="ghost" onClick={() => setStep(0)} disabled={loading} className="press">
              <ArrowLeft className="h-4 w-4 mr-2" />Back
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={loading || !name.trim()} className="press px-6 h-11">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? "Creating your assistant…" : "Create AI assistant"}
            </Button>
          </div>
        </div>
      </div>
      <p className="text-center text-xs text-muted-foreground mt-6">
        Free for 24 hours · No credit card · Cancel anytime
      </p>
    </div>
  );
};

export default BusinessSetup;
