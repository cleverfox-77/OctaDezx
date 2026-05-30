import { useState, useEffect } from "react";
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
  Truck, ExternalLink, RefreshCw, Loader2, Package, Search, MapPin, Plus,
  CheckCircle2, Clock, XCircle, AlertCircle, Edit2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Shipment {
  id: string;
  business_id: string;
  order_id: string;
  courier_platform: string;
  tracking_number: string | null;
  label_url: string | null;
  status: string;
  status_detail: string | null;
  last_synced_at: string | null;
  cost: number | null;
  currency: string | null;
  created_at: string;
}

interface Order {
  id: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  total_amount: number | null;
  items: any;
  status: string;
  shipping_address: any;
  created_at: string;
}

interface Props { businessId: string; }

const STATUS_META: Record<string, { label: string; bg: string; text: string; icon: React.ElementType }> = {
  pending:          { label: "Pending",         bg: "bg-slate-500/10",  text: "text-slate-700 dark:text-slate-300",  icon: Clock },
  created:          { label: "Created",         bg: "bg-blue-500/10",   text: "text-blue-700 dark:text-blue-300",    icon: Package },
  picked_up:        { label: "Picked Up",       bg: "bg-cyan-500/10",   text: "text-cyan-700 dark:text-cyan-300",    icon: Package },
  in_transit:       { label: "In Transit",      bg: "bg-amber-500/10",  text: "text-amber-700 dark:text-amber-300",  icon: Truck },
  out_for_delivery: { label: "Out for Delivery", bg: "bg-violet-500/10", text: "text-violet-700 dark:text-violet-300", icon: Truck },
  delivered:        { label: "Delivered",       bg: "bg-green-500/10",  text: "text-green-700 dark:text-green-300",  icon: CheckCircle2 },
  failed:           { label: "Failed",          bg: "bg-red-500/10",    text: "text-red-700 dark:text-red-300",      icon: XCircle },
  returned:         { label: "Returned",        bg: "bg-orange-500/10", text: "text-orange-700 dark:text-orange-300", icon: AlertCircle },
  cancelled:        { label: "Cancelled",       bg: "bg-slate-500/10",  text: "text-slate-700 dark:text-slate-300",  icon: XCircle },
  manual:           { label: "Manual Fulfillment", bg: "bg-yellow-500/10", text: "text-yellow-700 dark:text-yellow-400", icon: AlertCircle },
};

export default function Shipments({ businessId }: Props) {
  const { toast } = useToast();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [orders, setOrders] = useState<Record<string, Order>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [eligibleOrders, setEligibleOrders] = useState<Order[]>([]);
  const [editTracking, setEditTracking] = useState<Shipment | null>(null);
  const [newTracking, setNewTracking] = useState("");

  useEffect(() => { load(); }, [businessId]);

  const load = async () => {
    setLoading(true);
    try {
      const { data: shipsData } = await supabase
        .from("shipments" as any)
        .select("*")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false });
      const ships = (shipsData as unknown as Shipment[]) ?? [];
      setShipments(ships);

      // Load related orders
      const orderIds = Array.from(new Set(ships.map(s => s.order_id)));
      if (orderIds.length > 0) {
        const { data: ordersData } = await supabase
          .from("orders").select("*").in("id", orderIds);
        const map: Record<string, Order> = {};
        (ordersData ?? []).forEach((o: any) => { map[o.id] = o; });
        setOrders(map);
      }

      // Orders without shipments (for the "Create shipment" dialog)
      const shippedOrderIds = new Set(ships.map(s => s.order_id));
      const { data: allOrders } = await supabase
        .from("orders")
        .select("*")
        .eq("business_id", businessId)
        .in("status", ["pending", "confirmed", "processing"])
        .order("created_at", { ascending: false })
        .limit(50);
      setEligibleOrders(((allOrders as any[]) ?? []).filter(o => !shippedOrderIds.has(o.id)));
    } catch (e: any) {
      toast({ title: "Failed to load shipments", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async (s: Shipment) => {
    if (!s.tracking_number) {
      toast({ title: "No tracking number yet", description: "Add a tracking number before refreshing.", variant: "destructive" });
      return;
    }
    setRefreshing(prev => ({ ...prev, [s.id]: true }));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const fnUrl = (import.meta as any).env?.VITE_SUPABASE_URL?.replace(/\/$/, "") ?? "";
      const res = await fetch(`${fnUrl}/functions/v1/track-shipment`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ businessId, shipmentId: s.id }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "Tracking refresh failed");
      await load();
      toast({ title: "Refreshed", description: `Status: ${result.shipment?.status ?? "unknown"}` });
    } catch (e: any) {
      toast({ title: "Refresh failed", description: e.message, variant: "destructive" });
    } finally {
      setRefreshing(prev => ({ ...prev, [s.id]: false }));
    }
  };

  const handleCreateShipment = async (orderId: string) => {
    setCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const fnUrl = (import.meta as any).env?.VITE_SUPABASE_URL?.replace(/\/$/, "") ?? "";
      const res = await fetch(`${fnUrl}/functions/v1/create-shipment`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ businessId, orderId }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "Failed to create shipment");
      toast({
        title: "Shipment created",
        description: result.tracking_number
          ? `Tracking: ${result.tracking_number}`
          : "Shipment recorded — fulfil manually in courier panel.",
      });
      setCreateOpen(false);
      await load();
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleSaveTracking = async () => {
    if (!editTracking || !newTracking.trim()) return;
    try {
      const { error } = await supabase
        .from("shipments" as any)
        .update({ tracking_number: newTracking.trim(), status: "created" })
        .eq("id", editTracking.id);
      if (error) throw error;
      toast({ title: "Tracking saved", description: "AfterShip (if connected) will start tracking it." });
      setEditTracking(null);
      setNewTracking("");
      await load();
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    }
  };

  const filtered = shipments.filter(s => {
    const o = orders[s.order_id];
    const q = search.toLowerCase();
    return !q
      || s.tracking_number?.toLowerCase().includes(q)
      || s.courier_platform.toLowerCase().includes(q)
      || o?.customer_name?.toLowerCase().includes(q)
      || o?.customer_email?.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4 flex-col sm:flex-row">
            <div>
              <CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5" /> Shipments</CardTitle>
              <CardDescription>Track every parcel and update tracking numbers manually when needed.</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={load} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Reload
              </Button>
              <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-2" />Create shipment</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by tracking, courier, or customer..." className="pl-9" />
          </div>

          {loading ? (
            <div className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-3 opacity-40" />
              <p className="text-sm text-muted-foreground">
                {search ? "No shipments match your search." : "No shipments yet. Once a customer confirms an order, the AI will create a shipment."}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(s => {
                const order = orders[s.order_id];
                const meta = STATUS_META[s.status] ?? STATUS_META.pending;
                const StatusIcon = meta.icon;
                return (
                  <div key={s.id} className="border rounded-xl p-4 hover:bg-muted/30 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={cn("text-xs font-medium", meta.bg, meta.text, "border-0")}>
                            <StatusIcon className="h-3 w-3 mr-1" />{meta.label}
                          </Badge>
                          <span className="font-semibold capitalize">{s.courier_platform.replace(/_/g, " ")}</span>
                          {s.tracking_number && (
                            <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">{s.tracking_number}</code>
                          )}
                        </div>
                        {order && (
                          <div className="text-sm text-muted-foreground">
                            <span className="font-medium text-foreground">{order.customer_name ?? "Customer"}</span>
                            {order.customer_email && ` · ${order.customer_email}`}
                          </div>
                        )}
                        {order?.shipping_address && (
                          <div className="text-xs text-muted-foreground flex items-start gap-1">
                            <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
                            <span className="line-clamp-2">
                              {typeof order.shipping_address === "string"
                                ? order.shipping_address
                                : JSON.stringify(order.shipping_address)}
                            </span>
                          </div>
                        )}
                        {s.status_detail && (
                          <p className="text-xs text-muted-foreground italic">{s.status_detail}</p>
                        )}
                        <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 pt-1">
                          <span>Created {new Date(s.created_at).toLocaleDateString()}</span>
                          {s.last_synced_at && <span>· Synced {new Date(s.last_synced_at).toLocaleTimeString()}</span>}
                          {s.cost && <span>· Cost {s.currency} {s.cost}</span>}
                        </div>
                      </div>

                      <div className="flex flex-row sm:flex-col gap-2 flex-shrink-0">
                        {s.label_url && (
                          <a href={s.label_url} target="_blank" rel="noopener noreferrer">
                            <Button variant="outline" size="sm" className="w-full"><ExternalLink className="h-3.5 w-3.5 mr-1.5" />Label</Button>
                          </a>
                        )}
                        {s.tracking_number ? (
                          <Button variant="outline" size="sm" onClick={() => handleRefresh(s)} disabled={refreshing[s.id]}>
                            {refreshing[s.id] ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
                            Refresh
                          </Button>
                        ) : (
                          <Button variant="default" size="sm" onClick={() => { setEditTracking(s); setNewTracking(""); }}>
                            <Edit2 className="h-3.5 w-3.5 mr-1.5" />Add Tracking
                          </Button>
                        )}
                        {s.tracking_number && (
                          <Button variant="ghost" size="sm" onClick={() => { setEditTracking(s); setNewTracking(s.tracking_number ?? ""); }}>
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create shipment dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create shipment</DialogTitle>
            <DialogDescription>Select an order to ship using your connected courier.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto space-y-2 -mx-2 px-2">
            {eligibleOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No eligible orders. All current orders already have shipments.</p>
            ) : eligibleOrders.map(o => (
              <div key={o.id} className="border rounded-lg p-3 hover:bg-muted/30 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{o.customer_name ?? "Customer"}</div>
                    <div className="text-xs text-muted-foreground truncate">{o.customer_email ?? "—"}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Total: {o.total_amount ?? 0} · {new Date(o.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <Button size="sm" onClick={() => handleCreateShipment(o.id)} disabled={creating}>
                    {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Ship"}
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

      {/* Edit tracking dialog */}
      <Dialog open={!!editTracking} onOpenChange={(o) => !o && setEditTracking(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editTracking?.tracking_number ? "Update tracking number" : "Add tracking number"}</DialogTitle>
            <DialogDescription>
              Enter the tracking number from your courier. If AfterShip is connected, status will auto-sync.
            </DialogDescription>
          </DialogHeader>
          <Input value={newTracking} onChange={(e) => setNewTracking(e.target.value)} placeholder="e.g. 1Z999AA10123456784" autoFocus />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTracking(null)}>Cancel</Button>
            <Button onClick={handleSaveTracking} disabled={!newTracking.trim()}>Save tracking</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
