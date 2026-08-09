import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";
import { Phone, Search, Loader2, Trash2, Check, ChevronsUpDown, AlertCircle } from "lucide-react";
import { Thinking } from "@/components/ui/thinking";
import { callVoiceAdmin } from "./voiceApi";
import { COUNTRIES, POPULAR_CODES, countryName } from "./countries";

interface NumberRow {
  id: string;
  e164: string;
  friendly_name: string | null;
  country: string | null;
  provisioned_by: string;
  status: string;
  inbound_enabled: boolean;
}

interface Available {
  e164: string;
  friendly_name: string;
  locality: string | null;
  region: string | null;
  monthly_cost_cents?: number | null;
  upfront_cost_cents?: number | null;
  currency?: string | null;
  number_type?: string | null;
}

const POPULAR = POPULAR_CODES
  .map((code) => COUNTRIES.find((c) => c.code === code))
  .filter(Boolean) as typeof COUNTRIES;

/**
 * The only places Telnyx activates a number without paperwork. Everywhere else
 * the order goes through and is billed, but inbound calls do not connect until
 * documents are uploaded and approved, and the number is taken back if that
 * does not happen within ten days. Buying one without knowing that means paying
 * for a phone that never rings, so the warning belongs before the purchase and
 * not in a help article.
 */
const NO_PAPERWORK = new Set(["US", "CA", "PR", "VI"]);

/** Telnyx's own words for what it is selling, in plainer ones. */
const TYPE_LABELS: Record<string, string> = {
  local: "Local",
  national: "National",
  toll_free: "Toll free",
  mobile: "Mobile",
  shared_cost: "Shared cost",
};

export default function PhoneNumbers({
  businessId,
  canUseVoice,
  onChanged,
}: {
  businessId: string;
  canUseVoice: boolean;
  onChanged?: () => void;
}) {
  const db = supabase as any;
  const { toast } = useToast();
  const [mine, setMine] = useState<NumberRow[]>([]);
  const [country, setCountry] = useState("US");
  const [areaCode, setAreaCode] = useState("");
  const [available, setAvailable] = useState<Available[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [releasing, setReleasing] = useState<NumberRow | null>(null);
  const [countryOpen, setCountryOpen] = useState(false);
  const [countryQuery, setCountryQuery] = useState("");
  // A toast is gone in five seconds and easy to miss on a phone. A carrier
  // refusal is the whole answer to "why is nothing happening", so it stays on
  // screen until the next attempt replaces it.
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const { data } = await db.from("voice_phone_numbers").select("*")
      .eq("business_id", businessId).neq("status", "released").order("created_at");
    setMine((data ?? []) as NumberRow[]);
  };
  useEffect(() => { if (businessId) load(); /* eslint-disable-next-line */ }, [businessId]);

  const search = async () => {
    setSearching(true);
    setAvailable([]);
    setSearched(false);
    setError(null);
    try {
      const res = await callVoiceAdmin("numbers/search", {
        business_id: businessId, country, area_code: areaCode,
      });
      setAvailable(res.numbers ?? []);
      setSearched(true);
    } catch (e: any) {
      setError(e.message);
      toast({ title: "Search failed", description: e.message, variant: "destructive" });
    } finally {
      setSearching(false);
    }
  };

  const buy = async (e164: string) => {
    setBusy(e164);
    setError(null);
    try {
      await callVoiceAdmin("numbers/buy", { business_id: businessId, e164, country });
      toast({
        title: "Number connected",
        description: `${e164} now rings your AI assistant. Try calling it.`,
      });
      setAvailable((list) => list.filter((n) => n.e164 !== e164));
      await load();
      onChanged?.();
    } catch (e: any) {
      setError(e.message);
      toast({ title: "Could not get that number", description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const release = async (row: NumberRow) => {
    setReleasing(null);
    setBusy(row.id);
    try {
      await callVoiceAdmin("numbers/release", { business_id: businessId, id: row.id });
      toast({ title: "Number released" });
      await load();
      onChanged?.();
    } catch (e: any) {
      toast({ title: "Could not release", description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  // Telnyx quotes in the account's currency and it is not always dollars, so
  // the code it returns is what gets formatted rather than a hardcoded sign.
  const money = (cents: number, currency?: string | null) => {
    const amount = cents / 100;
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency", currency: currency || "USD",
      }).format(amount);
    } catch {
      return `${amount.toFixed(2)} ${currency || "USD"}`;
    }
  };

  const price = (n: Available) => {
    const parts: string[] = [];
    if (typeof n.monthly_cost_cents === "number") {
      parts.push(`${money(n.monthly_cost_cents, n.currency)} a month`);
    }
    // Shown separately rather than folded into a total: it is charged once, and
    // adding it to a monthly figure would overstate the ongoing cost.
    if (typeof n.upfront_cost_cents === "number" && n.upfront_cost_cents > 0) {
      parts.push(`${money(n.upfront_cost_cents, n.currency)} once`);
    }
    return parts.join(" plus ");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your numbers</CardTitle>
          <CardDescription>Numbers that ring your AI assistant.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {mine.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No numbers yet. Pick one below and your assistant starts answering.
            </p>
          )}
          {mine.map((n) => (
            <div key={n.id} className="flex flex-wrap items-center gap-3 rounded-md border p-3">
              <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="break-all font-medium">{n.e164}</div>
                <div className="text-xs text-muted-foreground">
                  {n.friendly_name || n.country || ""}
                  {n.provisioned_by === "byo" && " • your own carrier account"}
                </div>
              </div>
              <Badge variant={n.status === "active" ? "secondary" : "outline"}>{n.status}</Badge>
              <Button size="sm" variant="ghost" disabled={busy === n.id}
                      aria-label={`Release ${n.e164}`} onClick={() => setReleasing(n)}>
                {busy === n.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add a number</CardTitle>
          <CardDescription>
            {canUseVoice
              ? "Choose the country your customers call from. The number starts working straight away."
              : "Voice calling is available on Pro and above. Upgrade to add a number."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="voice-country" className="text-xs">Country</Label>
              {/* A plain dropdown of every country is unusable, so this is a
                  searchable picker. CommandItem values are country NAMES so
                  typing "united" finds the right one; the code is what we send. */}
              <Popover open={countryOpen}
                       onOpenChange={(o) => { setCountryOpen(o); if (!o) setCountryQuery(""); }}>
                <PopoverTrigger asChild>
                  <Button id="voice-country" variant="outline" role="combobox"
                          aria-expanded={countryOpen}
                          className="w-full justify-between font-normal">
                    <span className="truncate">{countryName(country)}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[--radix-popover-trigger-width] p-0">
                  <Command>
                    <CommandInput placeholder="Search countries" value={countryQuery}
                                  onValueChange={setCountryQuery} />
                    <CommandList>
                      <CommandEmpty>No country with that name.</CommandEmpty>
                      {/* The shortlist is only useful before you start typing.
                          Once there is a query it would also mean two items with
                          the same value, which the list widget keys on. */}
                      {countryQuery === "" && (
                        <CommandGroup heading="Commonly available">
                          {POPULAR.map((c) => (
                            <CommandItem key={`p-${c.code}`} value={c.name}
                                         onSelect={() => { setCountry(c.code); setCountryOpen(false); }}>
                              <Check className={`mr-2 h-4 w-4 ${country === c.code ? "opacity-100" : "opacity-0"}`} />
                              {c.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      )}
                      <CommandGroup heading={countryQuery === "" ? "All countries" : "Countries"}>
                        {COUNTRIES.map((c) => (
                          <CommandItem key={c.code} value={c.name} keywords={[c.code]}
                                       onSelect={() => { setCountry(c.code); setCountryOpen(false); }}>
                            <Check className={`mr-2 h-4 w-4 ${country === c.code ? "opacity-100" : "opacity-0"}`} />
                            {c.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="voice-area" className="text-xs">Area code (optional)</Label>
              <Input id="voice-area" inputMode="numeric" value={areaCode}
                     onChange={(e) => setAreaCode(e.target.value.replace(/\D/g, ""))}
                     placeholder="e.g. 415 for San Francisco" />
            </div>

            <Button className="w-full sm:w-auto" onClick={search} disabled={searching || !canUseVoice}>
              {searching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
              Search
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Leave the area code blank to see any number in that country. Prices come straight from
            the carrier and vary a lot: a local number is usually the cheapest, while national and
            mobile numbers in the same country can cost far more.
          </p>

          {!NO_PAPERWORK.has(country) && (
            <div className="flex gap-3 rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div className="min-w-0 space-y-1 text-sm">
                <p className="font-medium">{countryName(country)} needs paperwork first</p>
                <p className="text-muted-foreground">
                  The carrier takes payment straight away, but calls will not reach a number here
                  until you upload proof of a local address and it is approved. If that does not
                  happen within ten days the number is taken back. Only the United States, Canada,
                  Puerto Rico and the US Virgin Islands skip this step.
                </p>
              </div>
            </div>
          )}

          {/* The button spinner is easy to miss, and an international search can
              take a couple of seconds against a blank panel, which reads as
              nothing having happened. */}
          {searching && (
            <Thinking state="searching" label={`Asking the carrier what is free in ${countryName(country)}`} center />
          )}

          {error && (
            <div className="flex gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-medium">The carrier turned that request down</p>
                <p className="break-words text-sm text-muted-foreground">{error}</p>
              </div>
            </div>
          )}

          {searched && available.length === 0 && (
            <div className="space-y-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">
                No numbers on offer in {countryName(country)}
              </p>
              {/* The country list is every country that exists, not every
                  country the carrier sells in. Saying so is better than a
                  shorter list that silently tells people outside it that the
                  product does not serve them. */}
              <p>
                The list covers every country, but the carrier does not sell numbers in all of
                them. India, for one, is not offered at all. If you expected numbers here, try
                clearing the area code first, since that narrows the search a lot.
              </p>
            </div>
          )}

          {available.map((n) => (
            <div key={n.e164} className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="break-all font-medium">{n.friendly_name || n.e164}</span>
                  {n.number_type && (
                    <Badge variant="outline" className="font-normal">
                      {TYPE_LABELS[n.number_type] ?? n.number_type}
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {[
                    [n.locality, n.region].filter(Boolean).join(", "),
                    price(n),
                  ].filter(Boolean).join(" • ")}
                </div>
              </div>
              <Button size="sm" className="w-full sm:w-auto"
                      disabled={busy === n.e164 || !canUseVoice} onClick={() => buy(n.e164)}>
                {busy === n.e164 && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Use this number
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* A browser confirm() is unreadable on a phone and easy to dismiss by
          accident. Releasing a number cannot be undone, so it gets a real dialog. */}
      <AlertDialog open={!!releasing} onOpenChange={(open) => !open && setReleasing(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Release {releasing?.e164}?</AlertDialogTitle>
            <AlertDialogDescription>
              Customers calling this number will no longer reach you, and the number cannot be
              recovered once it goes back to the carrier. Your call history and voicemails are kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={() => releasing && release(releasing)}>
              Release the number
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
