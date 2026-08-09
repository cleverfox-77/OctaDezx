import { Check } from "lucide-react";
import { featureOptions, type SectionId } from "@/lib/businessTypes";

// A controlled grid of toggleable feature cards. Shared by onboarding
// (BusinessSetup) and the "Manage features" dialog in the dashboard so the
// two always offer exactly the same optional tools.
interface FeatureSelectorProps {
  typeId: string | null | undefined;
  value: SectionId[];
  onChange: (next: SectionId[]) => void;
  columns?: string;
}

const FeatureSelector = ({ typeId, value, onChange, columns = "grid-cols-1 sm:grid-cols-2" }: FeatureSelectorProps) => {
  const options = featureOptions(typeId);
  const selected = new Set(value);

  const toggle = (id: SectionId) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    // Keep the canonical option order so the dashboard nav is stable.
    onChange(options.map((o) => o.id).filter((oid) => next.has(oid)));
  };

  return (
    <div className={`grid ${columns} gap-3`}>
      {options.map((opt) => {
        const on = selected.has(opt.id);
        const Icon = opt.icon;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => toggle(opt.id)}
            aria-pressed={on}
            className={`press relative flex items-start gap-3 rounded-xl border p-4 text-left transition-all ${
              on
                ? "border-primary bg-primary/[0.05] ring-1 ring-primary/30"
                : "bg-card hover:border-primary/40 hover:bg-muted/40"
            }`}
          >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${on ? "bg-primary/15" : "bg-muted"}`}>
              <Icon className={`h-4 w-4 ${on ? "text-primary" : "text-muted-foreground"}`} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold">{opt.label}</span>
                {opt.isNew && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/25 leading-none">NEW</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed mt-1">{opt.description}</p>
            </div>
            <span className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors mt-0.5 ${
              on ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/30"
            }`}>
              {on && <Check className="h-3 w-3" />}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default FeatureSelector;
