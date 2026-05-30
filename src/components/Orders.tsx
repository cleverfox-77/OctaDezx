import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ShoppingBag, Truck, CheckCircle, XCircle, MessageSquare, User } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

interface ChatMessage {
  id: string;
  sender_type: 'customer' | 'ai' | 'human';
  content: string;
  image_url: string | null;
  created_at: string;
}

interface ChatSession {
  id: string;
  customer_name: string | null;
  customer_email: string | null;
  status: string;
  created_at: string;
  messages: ChatMessage[];
}

interface Order {
  id: string;
  customer_name: string;
  customer_email: string;
  session_id: string | null;
  items: OrderItem[];
  total_amount: number;
  status: 'pending' | 'confirmed' | 'shipped' | 'cancelled';
  created_at: string;
}

interface OrdersProps {
  businessId: string;
}

const Orders = ({ businessId }: OrdersProps) => {
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChat, setSelectedChat] = useState<ChatSession | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadOrders();
  }, [businessId]);

  useEffect(() => {
    if (selectedChat) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [selectedChat?.messages]);

  const loadOrders = async () => {
    try {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setOrders(data as any[] || []);
    } catch (error) {
      console.error("Error loading orders:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (orderId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("orders")
        .update({ status: newStatus })
        .eq("id", orderId);

      if (error) throw error;

      setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus as any } : o));
      toast({ title: "Status Updated", description: `Order marked as ${newStatus}` });
    } catch (error) {
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
    }
  };

  const loadChatForOrder = async (order: Order) => {
    setChatLoading(true);
    try {
      let sessionData = null;

      // Strategy 1: Use session_id if available (new orders)
      if (order.session_id) {
        const { data, error } = await supabase
          .from("chat_sessions")
          .select(`
            *,
            chat_messages (
              id,
              sender_type,
              content,
              image_url,
              created_at
            )
          `)
          .eq("id", order.session_id)
          .single();

        if (!error && data) {
          sessionData = data;
        }
      }

      // Strategy 2: Fallback - match by customer_email + business_id (for old orders without session_id)
      if (!sessionData && order.customer_email) {
        const { data, error } = await supabase
          .from("chat_sessions")
          .select(`
            *,
            chat_messages (
              id,
              sender_type,
              content,
              image_url,
              created_at
            )
          `)
          .eq("business_id", businessId)
          .eq("customer_email", order.customer_email)
          .order("created_at", { ascending: false })
          .limit(1);

        if (!error && data && data.length > 0) {
          sessionData = data[0];
        }
      }

      if (sessionData) {
        const session: ChatSession = {
          id: sessionData.id,
          customer_name: sessionData.customer_name,
          customer_email: sessionData.customer_email,
          status: sessionData.status,
          created_at: sessionData.created_at,
          messages: (sessionData.chat_messages || [])
            .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
            .map((msg: any) => ({
              id: msg.id,
              sender_type: msg.sender_type,
              content: msg.content,
              image_url: msg.image_url,
              created_at: msg.created_at,
            }))
        };
        setSelectedChat(session);
      } else {
        toast({
          title: "No Chat Found",
          description: "Could not find a chat session linked to this order.",
          variant: "default",
        });
      }
    } catch (error) {
      console.error("Error loading chat for order:", error);
      toast({ title: "Error", description: "Failed to load chat", variant: "destructive" });
    } finally {
      setChatLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/20 text-yellow-500';
      case 'confirmed': return 'bg-blue-500/20 text-blue-500';
      case 'shipped': return 'bg-green-500/20 text-green-500';
      case 'cancelled': return 'bg-red-500/20 text-red-500';
      default: return 'bg-gray-500/20 text-gray-500';
    }
  };

  if (loading) return <div>Loading orders...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Customer Orders</h3>
        <p className="text-sm text-muted-foreground">Track and manage orders placed via the AI chat. Click "View Chat" to see the full conversation.</p>
      </div>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <ShoppingBag className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No orders yet. When customers confirm a purchase in chat, it will appear here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {orders.map((order) => (
            <Card key={order.id}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-base">Order #{order.id.slice(0, 8)}</CardTitle>
                    <CardDescription>
                      {order.customer_name} ({order.customer_email}) • {formatDistanceToNow(new Date(order.created_at))} ago
                    </CardDescription>
                  </div>
                  <Badge className={getStatusColor(order.status)} variant="outline">
                    {order.status.toUpperCase()}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="bg-muted p-4 rounded-md mb-4">
                  <h4 className="text-sm font-medium mb-2">Items</h4>
                  <ul className="space-y-2">
                    {order.items.map((item, idx) => (
                      <li key={idx} className="flex justify-between text-sm">
                        <span>{item.quantity}x {item.name}</span>
                        <span>${(item.price * item.quantity).toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="border-t border-gray-600 mt-3 pt-2 flex justify-between font-bold">
                    <span>Total</span>
                    <span>${order.total_amount}</span>
                  </div>
                </div>

                <div className="flex gap-2 justify-between flex-wrap">
                  {/* View Chat Button */}
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => loadChatForOrder(order)}
                      >
                        <MessageSquare className="h-4 w-4 mr-2" />
                        View Chat
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
                      <DialogHeader>
                        <DialogTitle>
                          Chat with {selectedChat?.customer_name || order.customer_name || 'Customer'}
                        </DialogTitle>
                        <DialogDescription>
                          {selectedChat?.customer_email || order.customer_email} • Order #{order.id.slice(0, 8)}
                        </DialogDescription>
                      </DialogHeader>

                      {chatLoading ? (
                        <div className="flex items-center justify-center py-12">
                          <div className="text-sm text-muted-foreground">Loading chat...</div>
                        </div>
                      ) : selectedChat ? (
                        <ScrollArea className="h-[60vh] pr-4">
                          <div className="space-y-4 py-4">
                            {selectedChat.messages.map((message) => (
                              <div
                                key={message.id}
                                className={`flex ${
                                  message.sender_type === 'customer' ? 'justify-start' : 'justify-end'
                                }`}
                              >
                                <div
                                  className={`max-w-[70%] rounded-lg p-3 break-words ${
                                    message.sender_type === 'customer'
                                      ? 'bg-muted'
                                      : message.sender_type === 'ai'
                                      ? 'bg-primary text-primary-foreground'
                                      : 'bg-secondary text-secondary-foreground'
                                  }`}
                                >
                                  <div className="text-xs opacity-70 mb-1 capitalize">
                                    {message.sender_type === 'customer'
                                      ? selectedChat.customer_name || 'Customer'
                                      : message.sender_type === 'ai'
                                      ? 'AI Assistant'
                                      : 'Business Owner'}
                                  </div>
                                  <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                                  {message.image_url && (
                                    <img
                                      src={message.image_url}
                                      alt="Message attachment"
                                      className="mt-2 max-w-full rounded border"
                                    />
                                  )}
                                  <div className="text-xs opacity-70 mt-1 text-right">
                                    {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                                  </div>
                                </div>
                              </div>
                            ))}
                            <div ref={messagesEndRef} />
                          </div>
                        </ScrollArea>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-12">
                          <User className="h-10 w-10 text-muted-foreground mb-3" />
                          <p className="text-sm text-muted-foreground text-center">
                            No chat session found for this order.<br />
                            The customer may have placed this order before chat tracking was linked.
                          </p>
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>

                  {/* Status Action Buttons */}
                  <div className="flex gap-2">
                    {order.status === 'pending' && (
                      <Button size="sm" onClick={() => updateStatus(order.id, 'confirmed')}>
                        <CheckCircle className="h-4 w-4 mr-2" /> Confirm
                      </Button>
                    )}
                    {(order.status === 'pending' || order.status === 'confirmed') && (
                      <Button size="sm" variant="secondary" onClick={() => updateStatus(order.id, 'shipped')}>
                        <Truck className="h-4 w-4 mr-2" /> Mark Shipped
                      </Button>
                    )}
                    {order.status !== 'cancelled' && order.status !== 'shipped' && (
                      <Button size="sm" variant="destructive" onClick={() => updateStatus(order.id, 'cancelled')}>
                        <XCircle className="h-4 w-4 mr-2" /> Cancel
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Orders;
