import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  FileText, RefreshCw, Loader2, Search, Plus, Download,
} from "lucide-react";

interface Invoice {
  id: string;
  business_id: string;
  order_id: string;
  invoice_number: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  items: any;
  subtotal: number;
  total: number;
  currency: string;
  pdf_url: string | null;
  status: string;
  created_at: string;
}

interface Order {
  id: string;
  customer_name: string | null;
  customer_email: string | null;
  total_amount: number | null;
  items: any;
  status: string;
  created_at: string;
}

interface Props { businessId: string; }

const CURRENCY_SYMBOL: Record<string, string> = {
  USD: "$", EUR: "€", GBP: "£", BDT: "৳", INR: "₹",
  PKR: "₨", JPY: "¥", CNY: "¥", AUD: "A$", CAD: "C$",
};

const fmt = (currency: string, n: number) =>
  `${CURRENCY_SYMBOL[currency] ?? currency + " "}${(Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function Invoices({ businessId }: Props) {
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [eligibleOrders, setEligibleOrders] = useState<Order[]>([]);
  const [regenerating, setRegenerating] = useState<Record<string, boolean>>({});

  useEffect(() => { load(); }, [businessId]);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("invoices" as any)
        .select("*")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false });
      setInvoices((data as unknown as Invoice[]) ?? []);

      const invoicedIds = new Set(((data as any[]) ?? []).map(i => i.order_id));
      const { data: ords } = await supabase
        .from("orders")
        .select("*")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(50);
      setEligibleOrders(((ords as any[]) ?? []).filter(o => !invoicedIds.has(o.id)));
    } catch (e: any) {
      toast({ title: "Failed to load invoices", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const generateInvoice = async (orderId: string, force = false) => {
    if (force) setRegenerating(prev => ({ ...prev, [orderId]: true }));
    else setCreating(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const fnUrl = (import.meta as any).env?.VITE_SUPABASE_URL?.replace(/\/$/, "") ?? "";
      const res = await fetch(`${fnUrl}/functions/v1/generate-invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ businessId, orderId, force }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "Generation failed");
      toast({ title: "Invoice ready", description: `${result.invoice.invoice_number} created.` });
      if (!force) setCreateOpen(false);
      await load();
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setCreating(false);
      setRegenerating(prev => ({ ...prev, [orderId]: false }));
    }
  };

  const filtered = invoices.filter(i => {
    const q = search.toLowerCase();
    return !q
      || i.invoice_number.toLowerCase().includes(q)
      || i.customer_name?.toLowerCase().includes(q)
      || i.customer_email?.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4 flex-col sm:flex-row">
            <div>
              <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Invoices</CardTitle>
              <CardDescription>All invoices generated for your orders. PDF downloads are public via signed URL.</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={load} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Reload
              </Button>
              <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-2" />Generate invoice</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by number, customer name, or email..." className="pl-9" />
          </div>

          {loading ? (
            <div className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3 opacity-40" />
              <p className="text-sm text-muted-foreground">
                {search ? "No invoices match your search." : "No invoices yet. Enable invoices in Settings and the AI will generate them when customers order."}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(inv => (
                <div key={inv.id} className="border rounded-xl p-4 hover:bg-muted/30 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <code className="font-mono font-semibold text-sm bg-muted px-2 py-0.5 rounded">{inv.invoice_number}</code>
                        <Badge variant={inv.status === "paid" ? "default" : inv.status === "cancelled" ? "destructive" : "secondary"}>
                          {inv.status}
                        </Badge>
                        <span className="font-semibold text-base">{fmt(inv.currency, inv.total)}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">{inv.customer_name ?? "Customer"}</span>
                        {inv.customer_email && ` · ${inv.customer_email}`}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {Array.isArray(inv.items) ? `${inv.items.length} item${inv.items.length !== 1 ? "s" : ""}` : ""}
                        {" · "}{new Date(inv.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      {inv.pdf_url && (
                        <a href={inv.pdf_url} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm"><Download className="h-3.5 w-3.5 mr-1.5" />PDF</Button>
                        </a>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => generateInvoice(inv.order_id, true)} disabled={regenerating[inv.order_id]} title="Regenerate PDF">
                        {regenerating[inv.order_id] ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate invoice</DialogTitle>
            <DialogDescription>Pick an order to generate a PDF invoice.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto space-y-2 -mx-2 px-2">
            {eligibleOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No eligible orders. All orders already have invoices.</p>
            ) : eligibleOrders.map(o => (
              <div key={o.id} className="border rounded-lg p-3 hover:bg-muted/30 transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{o.customer_name ?? "Customer"}</div>
                    <div className="text-xs text-muted-foreground truncate">{o.customer_email ?? "—"}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Total: {o.total_amount ?? 0} · {new Date(o.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <Button size="sm" onClick={() => generateInvoice(o.id)} disabled={creating}>
                    {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><FileText className="h-3.5 w-3.5 mr-1.5" />Generate</>}
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
