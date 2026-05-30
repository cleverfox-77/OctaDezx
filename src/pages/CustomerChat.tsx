import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { directSupabaseRequest, isValidUUID } from "@/utils/supabaseProxy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Send, Image as ImageIcon, Loader2, X, Shield, MoreVertical, LifeBuoy, Star, ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { SEO } from "@/components/SEO";

// --- TYPES ---
interface ProductImage { image_url: string; }
interface Product { name: string; description: string | null; price: number | null; category: string | null; metadata: any; product_images: ProductImage[]; }
interface KBArticle { title: string; content: string | null; }
interface Business {
  id: string; name: string; description: string;
  policies?: string; ai_instructions?: string;
  invoice_enabled?: boolean;
  invoice_auto_generate?: boolean;
  has_courier?: boolean; // populated after loading platform_integrations
  products?: Product[]; kb_articles?: KBArticle[];
}
interface Message { id: string; sender_type: 'customer' | 'ai' | 'human'; content: string; image_url?: string; created_at: string; }

// --- SUGGESTIONS ---
const SUGGESTIONS = [
  "What products do you offer?",
  "How can I track my order?",
  "What are your business hours?",
  "Do you have any current deals?",
  "I need help with a return",
];

// --- AUTH HELPER ---
const initializeGuestSession = async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) return session.user.id;
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
    return data.user?.id;
  } catch (error) {
    console.error("Error initializing guest session:", error);
    return null;
  }
};

// --- SOURCE TRACKING HELPER ---
const getSourceInfo = () => {
  const params = new URLSearchParams(window.location.search);
  const referrer = document.referrer;
  const utm_source = params.get('utm_source');
  const utm_medium = params.get('utm_medium');
  const utm_campaign = params.get('utm_campaign');
  let source = 'direct';
  if (utm_source) {
    source = utm_source.toLowerCase();
  } else if (referrer) {
    try {
      const refHost = new URL(referrer).hostname.toLowerCase();
      if (refHost.includes('facebook.com') || refHost.includes('fb.com')) source = 'facebook';
      else if (refHost.includes('instagram.com')) source = 'instagram';
      else if (refHost.includes('twitter.com') || refHost.includes('x.com')) source = 'twitter';
      else if (refHost.includes('linkedin.com')) source = 'linkedin';
      else if (refHost.includes('tiktok.com')) source = 'tiktok';
      else if (refHost.includes('youtube.com')) source = 'youtube';
      else if (refHost.includes('google.com')) source = 'google';
      else if (refHost.includes('bing.com')) source = 'bing';
      else if (refHost.includes('whatsapp.com') || refHost.includes('wa.me')) source = 'whatsapp';
      else source = refHost.replace('www.', '');
    } catch { /* ignore malformed referrer */ }
  }
  return { source, utm_source: utm_source || null, utm_medium: utm_medium || null, utm_campaign: utm_campaign || null, referrer_url: referrer || null };
};

// --- IMAGE + TEXT RENDERER ---
const MessageContent = ({ content }: { content: string }) => {
  // Order of matching matters: images first (![]()), then text links ([](https...)), then bare image URLs, then bold (**text**).
  const parts = content.split(/(!\[[^\]]*\]\([^)]+\))|(\[[^\]]+\]\(https?:\/\/[^)]+\))|(https?:\/\/\S+\.(?:png|jpg|jpeg|gif|webp|svg))|(\*\*[^*]+\*\*)/gi);
  return (
    <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
      {parts.map((part, index) => {
        if (!part) return null;
        // Markdown image
        const imgMatch = part.match(/!\[([^\]]*)\]\(([^)]+)\)/);
        if (imgMatch) return <div key={index} className="my-2"><img src={imgMatch[2]} alt={imgMatch[1]} className="rounded-xl max-w-full max-h-56 object-cover" /></div>;
        // Markdown link → rendered as a chip-style button
        const linkMatch = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
        if (linkMatch) {
          return (
            <a key={index} href={linkMatch[2]} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 my-1 px-3 py-1.5 rounded-full bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/30 text-blue-200 text-xs font-medium transition-colors">
              {linkMatch[1]}
            </a>
          );
        }
        // Bare image URL
        if (/^https?:\/\/\S+\.(?:png|jpg|jpeg|gif|webp|svg)$/i.test(part)) {
          return <div key={index} className="my-2"><img src={part} alt="Product" className="rounded-xl max-w-full max-h-56 object-cover" /></div>;
        }
        // Bold
        const boldMatch = part.match(/^\*\*([^*]+)\*\*$/);
        if (boldMatch) return <strong key={index} className="font-semibold">{boldMatch[1]}</strong>;
        return <span key={index}>{part}</span>;
      })}
    </div>
  );
};

// --- AI EDGE FUNCTION ---
async function getCustomerServiceResponse(
  userText: string,
  messages: Message[],
  businessContext: Business | null = null,
  sessionId: string | null = null,
  imageUrl: string | null = null
) {
  try {
    const { data, error } = await supabase.functions.invoke('ai-chat-response', {
      body: {
        message: userText,
        businessId: businessContext?.id,
        sessionId,
        imageUrl: imageUrl || null,
        history: messages.slice(-10).map(m => ({
          role: m.sender_type === 'customer' ? 'user' : 'assistant',
          content: m.content,
          image_url: m.image_url || null,
        })),
      },
    });
    if (error) return "I'm having trouble connecting to the server.";
    if (data?.rateLimited) return "This business has reached its daily customer limit. Please try again tomorrow or contact the business owner directly.";
    if (!data?.response) return "No response received.";
    return data.response;
  } catch {
    return "Connection error. Please try again.";
  }
}

// --- FORMAT TIME ---
const formatTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// --- BUSINESS AVATAR ---
const BusinessAvatar = ({ name }: { name: string }) => {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center flex-shrink-0 text-white text-xs font-bold shadow-md">
      {initials}
    </div>
  );
};

// ============================================================
// --- MAIN COMPONENT ---
// ============================================================
const CustomerChat = () => {
  const { businessId: maybeBusinessId } = useParams();
  const { toast } = useToast();

  const [business, setBusiness] = useState<Business | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [textareaHeight, setTextareaHeight] = useState(44);
  const [stagedImage, setStagedImage] = useState<File | null>(null);
  const [customerInfo, setCustomerInfo] = useState({ name: "Anonymous", email: "" });
  const [isInitializing, setIsInitializing] = useState(true);
  const [loading, setLoading] = useState(false);
  const [typing, setTyping] = useState(false);
  const [guestUserId, setGuestUserId] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  // Tracks visible height after keyboard opens (iOS workaround)
  const [containerHeight, setContainerHeight] = useState<string>('100dvh');

  const [supportOpen, setSupportOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketMessage, setTicketMessage] = useState("");
  const [rating, setRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isSendingRef = useRef(false);
  const isUserScrollingRef = useRef(false);

  // Validate businessId
  if (!maybeBusinessId || !isValidUUID(maybeBusinessId)) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-950 text-gray-400 text-sm">Invalid chat link.</div>;
  }
  const businessId = maybeBusinessId;

  // ---- KEYBOARD / VIEWPORT FIX (iOS + Android) ----
  // visualViewport fires when the soft keyboard opens, giving us the real visible height.
  // This keeps the input bar visible above the keyboard on all mobile browsers.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      // On iOS the keyboard overlays content; shrink container to visible area
      const height = Math.round(vv.height);
      setContainerHeight(`${height}px`);
    };
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update(); // run once on mount
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  // ---- TEXTAREA AUTO-RESIZE ----
  // Runs after every render caused by newMessage changes so React's
  // re-render doesn't fight with the DOM height we set.
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto'; // collapse first so scrollHeight is accurate
    const scrollH = ta.scrollHeight;
    const capped = Math.min(scrollH, 160); // max ~5 lines
    setTextareaHeight(capped);
    ta.style.height = `${capped}px`;
  }, [newMessage]);

  // ---- INIT ----
  useEffect(() => {
    loadBusinessData();
    checkDailyLimit();
  }, [businessId]);

  useEffect(() => {
    const initAuth = async () => {
      const uid = await initializeGuestSession();
      if (uid) {
        setGuestUserId(uid);
        await checkExistingSession(uid);
      } else {
        setIsInitializing(false);
      }
    };
    initAuth();
  }, [businessId]);

  const checkDailyLimit = async () => {
    try {
      const { data, error } = await supabase.rpc('check_daily_limit' as any, { p_business_id: businessId });
      if (!error && data && (data as any).is_locked) setIsLocked(true);
    } catch { /* ignore */ }
  };

  const checkExistingSession = async (uid: string) => {
    try {
      const { data, error } = await directSupabaseRequest(
        'GET',
        `/rest/v1/chat_sessions?business_id=eq.${businessId}&user_id=eq.${uid}&status=neq.resolved&order=created_at.desc&limit=1`
      );
      if (!error && data && data.length > 0) {
        const session = data[0];
        setSessionId(session.id);
        setCustomerInfo({ name: session.customer_name, email: session.customer_email });
      } else {
        // Auto-start anonymous session immediately
        await startChat(true, uid);
      }
    } catch (error) {
      console.error("Error restoring session:", error);
      await startChat(true, uid);
    } finally {
      setIsInitializing(false);
    }
  };

  // ---- LOAD BUSINESS ----
  const loadBusinessData = async () => {
    const result = await directSupabaseRequest('GET', `/rest/v1/businesses?id=eq.${businessId}&select=id,name,description,policies,ai_instructions,invoice_enabled,invoice_auto_generate`);
    if (result.data?.[0]) {
      const businessData = result.data[0] as Business;
      const prodResult = await directSupabaseRequest('GET', `/rest/v1/products?business_id=eq.${businessId}&select=name,description,price,category,metadata,product_images(image_url)`);
      if (prodResult.data) businessData.products = prodResult.data as Product[];
      const kbResult = await directSupabaseRequest('GET', `/rest/v1/knowledge_base_articles?business_id=eq.${businessId}&select=title,content`);
      if (kbResult.data) businessData.kb_articles = kbResult.data as KBArticle[];

      // Check if a courier is connected (for auto-shipment after orders)
      const courierPlatforms = [
        "easypost","shippo","aftership","shiprocket",
        "pathao","steadfast","redx","paperfly","ecourier","sundarban",
        "delhivery","bluedart","dtdc","ekart","xpressbees",
        "tcs","leopards","mnp","ninjavan","jtexpress","lalamove","lbc","kerry","poslaju",
        "sfexpress","cainiao","zto","yto","yamato","cjlogistics",
        "dhl","fedex","ups","usps","tnt",
        "gls","postnl","dpd","hermes","royalmail","colissimo",
        "bpost","deutschepost","correos","posteitaliane",
        "canadapost","correios","estafeta","ontrac","dhlecommerce",
        "auspost","startrack","aramex_au","nzpost",
        "aramex","naqel","smsa","dpd_africa","postnet",
        "cdek","russianpost",
      ];
      const courierQuery = courierPlatforms.map(p => `"${p}"`).join(",");
      const courResult = await directSupabaseRequest('GET',
        `/rest/v1/platform_integrations?business_id=eq.${businessId}&status=eq.connected&platform=in.(${courierQuery})&select=platform&limit=1`);
      businessData.has_courier = Array.isArray(courResult.data) && courResult.data.length > 0;

      setBusiness(businessData);
    }
  };

  // ---- MESSAGES ----
  useEffect(() => {
    if (!sessionId) return;
    loadMessages();
    const interval = setInterval(loadMessages, 5000);
    return () => clearInterval(interval);
  }, [sessionId]);

  const loadMessages = async () => {
    if (!sessionId) return;
    // Read via a capability-scoped RPC (returns only THIS session's messages).
    // The chat_messages table no longer grants blanket anon SELECT, so a direct
    // `GET /rest/v1/chat_messages` would (correctly) return nothing.
    const result = await directSupabaseRequest('POST', '/rest/v1/rpc/get_session_messages', { p_session_id: sessionId });
    if (result.data) setMessages(result.data as Message[]);
  };

  // ---- SCROLL ----
  const scrollToBottom = (force = false) => {
    if (force || !isUserScrollingRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isUserScrollingRef.current = distanceFromBottom > 120;
    setShowScrollBtn(distanceFromBottom > 200);
  };

  useEffect(() => {
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      scrollToBottom(lastMsg.sender_type === 'customer');
    }
  }, [messages]);

  // ---- START CHAT ----
  const startChat = async (skip = false, uid?: string) => {
    const userId = uid || guestUserId;
    if (!userId) return;

    const newSessionId = crypto.randomUUID();
    const name = skip ? 'Anonymous' : customerInfo.name;
    const email = skip ? `${crypto.randomUUID()}@anon.com` : customerInfo.email;
    const sourceInfo = getSourceInfo();

    await directSupabaseRequest('POST', '/rest/v1/chat_sessions', {
      id: newSessionId,
      business_id: businessId,
      customer_name: name,
      customer_email: email,
      status: 'active',
      user_id: userId,
      source: sourceInfo.source,
      utm_source: sourceInfo.utm_source,
      utm_medium: sourceInfo.utm_medium,
      utm_campaign: sourceInfo.utm_campaign,
      referrer_url: sourceInfo.referrer_url,
    });

    setCustomerInfo({ name, email });
    setSessionId(newSessionId);
    await directSupabaseRequest('POST', '/rest/v1/chat_messages', {
      session_id: newSessionId,
      sender_type: 'ai',
      content: "Hello! 👋 How can I help you today?",
    });
    loadMessages();
  };

  // ---- SEND MESSAGE ----
  const sendMessage = async (text?: string) => {
    const content = (text ?? newMessage).trim();
    if (isSendingRef.current || (!content && !stagedImage) || !sessionId) return;
    isSendingRef.current = true;
    setLoading(true);

    const tempStagedImage = stagedImage;
    if (!text) setNewMessage("");
    setStagedImage(null);
    // Reset textarea — useEffect on newMessage will resize it to min
    setTextareaHeight(44);

    const optimisticId = 'opt-' + Date.now();
    const optimisticMsg: Message = {
      id: optimisticId,
      sender_type: 'customer',
      content: content || 'Sent an image',
      image_url: tempStagedImage ? URL.createObjectURL(tempStagedImage) : undefined,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimisticMsg]);

    try {
      let imageUrl: string | undefined;
      if (tempStagedImage) {
        const fileExt = tempStagedImage.name.split('.').pop();
        const fileName = `${sessionId}-${Date.now()}.${fileExt}`;
        const { error } = await supabase.storage.from('chat-files').upload(fileName, tempStagedImage);
        if (!error) imageUrl = supabase.storage.from('chat-files').getPublicUrl(fileName).data.publicUrl;
      }

      await directSupabaseRequest('POST', '/rest/v1/chat_messages', {
        session_id: sessionId, sender_type: 'customer', content: content || 'Sent an image', image_url: imageUrl,
      });
      await loadMessages();

      const sessionStatusRes = await directSupabaseRequest('GET', `/rest/v1/chat_sessions?id=eq.${sessionId}&select=status`);
      if ((sessionStatusRes.data?.[0]?.status || 'active') !== 'active') {
        setLoading(false); isSendingRef.current = false; return;
      }

      // ─── Special intents (tracking / invoice) handled locally before AI call ───
      if (content) {
        const handled = await handleSpecialIntent(content);
        if (handled) {
          setLoading(false); isSendingRef.current = false; return;
        }
      }

      setTyping(true);
      let aiResponse = await getCustomerServiceResponse(content || "I sent an image.", messages, business, sessionId, imageUrl || null);
      setTyping(false);

      if (aiResponse) {
        const orderMatch = aiResponse.match(/\|\|ORDER_CONFIRMED:(.*?)\|\|/s);
        if (orderMatch) {
          try {
            const rawOrderData = JSON.parse(orderMatch[1]);
            // Only item names + quantities are taken from the AI. Price and total
            // are NEVER trusted from the model/client — the create-order edge
            // function (service role) recomputes them from the catalogue.
            const requestedItems = Array.isArray(rawOrderData.items)
              ? rawOrderData.items
                  .filter((it: any) => it && typeof it.name === 'string')
                  .map((it: any) => ({ name: it.name, quantity: Number(it.quantity) || 1 }))
              : [];

            // Always strip the hidden marker from what the customer sees.
            aiResponse = aiResponse.replace(orderMatch[0], '').trim();

            if (requestedItems.length > 0) {
              const { data: orderResult, error: orderError } = await supabase.functions.invoke('create-order', {
                body: {
                  businessId,
                  sessionId,
                  items: requestedItems,
                  customerName: customerInfo.name,
                  customerEmail: customerInfo.email,
                },
              });

              const placedOrder = (orderResult as any)?.order;
              if (!orderError && placedOrder?.id) {
                toast({ title: "🎉 Order Placed!", description: `Total: $${placedOrder.total_amount}. Check your email for confirmation.` });
                if (!aiResponse.toLowerCase().includes("order")) aiResponse += "\n\n✅ **Your order has been placed successfully!**";

                // ─── POST-ORDER AUTOMATION ───
                // Fire-and-forget background tasks; show results as AI messages when ready
                processPostOrder(placedOrder.id).catch(e => console.error("Post-order automation failed:", e));
              } else {
                console.error("Order creation failed:", orderError || orderResult);
                aiResponse += "\n\n⚠️ I couldn't finalise that order automatically — our team will follow up to confirm the details.";
              }
            }
          } catch (e) {
            console.error("Failed to parse AI order data:", e);
            aiResponse = aiResponse.replace(orderMatch[0], "");
          }
        }
        await directSupabaseRequest('POST', '/rest/v1/chat_messages', { session_id: sessionId, sender_type: 'ai', content: aiResponse });
        loadMessages();
      }
    } catch (error) {
      console.error("Chat Error:", error);
      setTyping(false);
      setMessages(prev => prev.filter(m => m.id !== optimisticId));
      toast({ title: "Error", description: "Failed to send message. Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
      isSendingRef.current = false;
    }
  };

  // ---- SUPPORT / FEEDBACK ----
  // ---- POST-ORDER AUTOMATION ----
  // Runs in background after an order is placed.
  // 1) If a courier is connected → create shipment, post tracking info to chat.
  // 2) If invoice_enabled + invoice_auto_generate → generate PDF, post download link.
  // 3) Otherwise if invoice_enabled (manual) → AI asked already in its response.
  const processPostOrder = async (orderId: string) => {
    if (!business || !sessionId) return;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    const FN_URL = (import.meta as any).env?.VITE_SUPABASE_URL?.replace(/\/$/, "") ?? "";

    // ── Auto-shipment ──
    if (business.has_courier) {
      try {
        const res = await fetch(`${FN_URL}/functions/v1/create-shipment`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ businessId, orderId }),
        });
        const data = await res.json();
        if (res.ok) {
          let msg = "";
          if (data.tracking_number) {
            msg = `📦 **Shipment created** via ${data.courier}!\n\nTracking number: \`${data.tracking_number}\`\n\nYou can ask me \"track my order\" anytime for live updates.`;
          } else {
            msg = `📦 **Your order is being prepared** for shipment via ${data.courier}. We'll share tracking info once your parcel is picked up.`;
          }
          await directSupabaseRequest('POST', '/rest/v1/chat_messages', {
            session_id: sessionId, sender_type: 'ai', content: msg,
          });
          await loadMessages();
        }
      } catch (e) {
        console.error("Auto-shipment failed:", e);
      }
    }

    // ── Auto-invoice ──
    if (business.invoice_enabled && business.invoice_auto_generate) {
      try {
        const res = await fetch(`${FN_URL}/functions/v1/generate-invoice`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ businessId, orderId }),
        });
        const data = await res.json();
        if (res.ok && data.invoice?.pdf_url) {
          const msg = `🧾 **Invoice generated**: \`${data.invoice.invoice_number}\`\n\n[📥 Download PDF invoice](${data.invoice.pdf_url})`;
          await directSupabaseRequest('POST', '/rest/v1/chat_messages', {
            session_id: sessionId, sender_type: 'ai', content: msg,
          });
          await loadMessages();
        }
      } catch (e) {
        console.error("Auto-invoice failed:", e);
      }
    } else if (business.invoice_enabled) {
      // Customer-opt-in mode: AI offers, customer says yes → generate
      const msg = `Would you like a PDF invoice for this order? Just reply \"yes, invoice please\" and I'll send it right over.`;
      await directSupabaseRequest('POST', '/rest/v1/chat_messages', {
        session_id: sessionId, sender_type: 'ai', content: msg,
      });
      await loadMessages();
    }
  };

  // Detect customer requests for invoice or tracking and trigger automatically
  const handleSpecialIntent = async (userMessage: string): Promise<boolean> => {
    if (!business || !sessionId) return false;
    const text = userMessage.toLowerCase();

    // ── Invoice request ──
    if (business.invoice_enabled && /\b(invoice|receipt|bill)\b/.test(text) && /\b(yes|please|send|want|give|generate|pdf)\b/.test(text)) {
      const { data: latestOrder } = await supabase
        .from('orders')
        .select('id')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestOrder?.id) {
        const { data: { session } } = await supabase.auth.getSession();
        const FN_URL = (import.meta as any).env?.VITE_SUPABASE_URL?.replace(/\/$/, "") ?? "";
        try {
          const res = await fetch(`${FN_URL}/functions/v1/generate-invoice`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
            body: JSON.stringify({ businessId, orderId: latestOrder.id }),
          });
          const data = await res.json();
          if (res.ok && data.invoice?.pdf_url) {
            await directSupabaseRequest('POST', '/rest/v1/chat_messages', {
              session_id: sessionId, sender_type: 'ai',
              content: `🧾 Here's your invoice: \`${data.invoice.invoice_number}\`\n\n[📥 Download PDF invoice](${data.invoice.pdf_url})`,
            });
            await loadMessages();
            return true; // handled — skip normal AI call
          }
        } catch (e) { console.error("Invoice request failed:", e); }
      }
    }

    // ── Tracking request ──
    if (/\b(track|tracking|where.*order|status.*order|order.*status|where.*my)\b/.test(text)) {
      const { data: latestShipment } = await supabase
        .from('shipments' as any)
        .select('id,tracking_number,status,status_detail,courier_platform,last_synced_at')
        .in('order_id',
          ((await supabase.from('orders').select('id').eq('session_id', sessionId)).data ?? []).map((o: any) => o.id)
        )
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestShipment) {
        const s = latestShipment as any;
        // Refresh via track-shipment
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const FN_URL = (import.meta as any).env?.VITE_SUPABASE_URL?.replace(/\/$/, "") ?? "";
          await fetch(`${FN_URL}/functions/v1/track-shipment`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
            body: JSON.stringify({ businessId, shipmentId: s.id }),
          });
          // Re-fetch updated row
          const { data: updated } = await supabase
            .from('shipments' as any).select('*').eq('id', s.id).single();
          const u = updated as any;
          const statusLabel: Record<string, string> = {
            pending: "Pending pickup", created: "Label created", picked_up: "Picked up",
            in_transit: "🚚 In transit", out_for_delivery: "🛵 Out for delivery",
            delivered: "✅ Delivered", failed: "⚠️ Delivery failed", returned: "↩️ Returned",
            cancelled: "❌ Cancelled", manual: "Being prepared",
          };
          const msg = `📦 **Order tracking**\n\nCourier: **${u.courier_platform}**\n${u.tracking_number ? `Tracking #: \`${u.tracking_number}\`\n` : ""}Status: **${statusLabel[u.status] ?? u.status}**${u.status_detail ? `\n\n_${u.status_detail}_` : ""}`;
          await directSupabaseRequest('POST', '/rest/v1/chat_messages', {
            session_id: sessionId, sender_type: 'ai', content: msg,
          });
          await loadMessages();
          return true;
        } catch (e) { console.error("Tracking request failed:", e); }
      }
    }

    return false;
  };

  const submitTicket = async () => {
    if (!ticketSubject || !ticketMessage) return;
    await directSupabaseRequest('POST', '/rest/v1/support_tickets', {
      business_id: businessId, customer_name: customerInfo.name, customer_email: customerInfo.email || 'No Email',
      subject: ticketSubject, message: ticketMessage, status: 'open',
    });
    toast({ title: "Ticket Submitted", description: "We'll get back to you soon." });
    setSupportOpen(false); setTicketSubject(""); setTicketMessage("");
  };

  const submitFeedback = async () => {
    if (!feedbackComment) return;
    await directSupabaseRequest('POST', '/rest/v1/customer_feedback', {
      business_id: businessId, customer_name: customerInfo.name, rating, comment: feedbackComment,
    });
    toast({ title: "Thank you!", description: "We appreciate your feedback." });
    setFeedbackOpen(false); setFeedbackComment("");
  };

  // ---- RENDER: LOADING ----
  if (!business || isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <p className="text-gray-400 text-sm">Connecting...</p>
        </div>
      </div>
    );
  }

  // ---- RENDER: LOCKED ----
  if (isLocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 p-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4"><Shield className="h-8 w-8 text-red-500" /></div>
          <h2 className="text-white text-xl font-semibold mb-2">Daily Limit Reached</h2>
          <p className="text-gray-400 text-sm">We've reached our daily chat capacity. Please try again tomorrow or contact us directly.</p>
        </div>
      </div>
    );
  }

  const hasCustomerMessages = messages.some(m => m.sender_type === 'customer');

  // ---- RENDER: MAIN CHAT ----
  return (
    <div className="flex flex-col bg-gray-950 text-white overflow-hidden" style={{ height: containerHeight }}>
      <SEO title={`Chat with ${business.name}`} description={`Customer support for ${business.name}. Powered by OctaDezx AI.`} />

      {/* ---- HEADER ---- */}
      <header className="flex-shrink-0 bg-gray-900 border-b border-gray-800 px-4 py-3 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm shadow-lg">
                {business.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-gray-900" />
            </div>
            <div className="min-w-0">
              <h1 className="font-semibold text-base leading-tight truncate">{business.name}</h1>
              <p className="text-xs text-green-400 leading-tight">Online · Typically replies instantly</p>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-gray-800 flex-shrink-0">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-gray-800 border-gray-700 text-white min-w-[160px]">
              <DropdownMenuItem onClick={() => setSupportOpen(true)} className="focus:bg-gray-700 cursor-pointer">
                <LifeBuoy className="mr-2 h-4 w-4" /> Contact Support
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFeedbackOpen(true)} className="focus:bg-gray-700 cursor-pointer">
                <Star className="mr-2 h-4 w-4" /> Rate Experience
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* ---- MESSAGES AREA ---- */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto overscroll-contain"
        onScroll={handleScroll}
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div className="max-w-2xl mx-auto px-4 py-4 space-y-1 pb-2">

          {/* Welcome banner */}
          <div className="text-center mb-6">
            <div className="inline-block bg-gray-800/60 border border-gray-700/50 rounded-2xl px-4 py-3 text-xs text-gray-400">
              Welcome to <span className="text-white font-medium">{business.name}</span> — your AI assistant is here to help
            </div>
          </div>

          {/* Messages */}
          {messages.map((message, idx) => {
            const isCustomer = message.sender_type === 'customer';
            const prevMsg = messages[idx - 1];
            const showAvatar = !isCustomer && (!prevMsg || prevMsg.sender_type === 'customer');
            const isLastInGroup = !messages[idx + 1] || messages[idx + 1].sender_type !== message.sender_type;

            return (
              <div
                key={message.id}
                className={`flex items-end gap-2 ${isCustomer ? 'justify-end' : 'justify-start'} ${idx > 0 && messages[idx - 1].sender_type === message.sender_type ? 'mt-0.5' : 'mt-3'}`}
              >
                {/* AI avatar placeholder (keeps spacing even when hidden) */}
                {!isCustomer && (
                  <div className="w-8 flex-shrink-0 flex items-end">
                    {showAvatar && <BusinessAvatar name={business.name} />}
                  </div>
                )}

                <div className={`max-w-[78%] sm:max-w-[65%] flex flex-col ${isCustomer ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`px-4 py-2.5 shadow-sm ${
                      isCustomer
                        ? 'bg-blue-600 text-white rounded-2xl rounded-br-sm'
                        : 'bg-gray-800 border border-gray-700/60 text-gray-100 rounded-2xl rounded-bl-sm'
                    }`}
                  >
                    <MessageContent content={message.content} />
                    {message.image_url && (
                      <div className="mt-2">
                        <img src={message.image_url} alt="Attachment" className="rounded-xl max-w-full max-h-56 object-cover" />
                      </div>
                    )}
                  </div>
                  {isLastInGroup && (
                    <span className="text-[10px] text-gray-500 mt-1 px-1">{formatTime(message.created_at)}</span>
                  )}
                </div>

                {/* Customer avatar placeholder */}
                {isCustomer && <div className="w-0 flex-shrink-0" />}
              </div>
            );
          })}

          {/* Typing indicator */}
          {typing && (
            <div className="flex items-end gap-2 mt-3">
              <BusinessAvatar name={business.name} />
              <div className="bg-gray-800 border border-gray-700/60 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1 items-center">
                <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} className="h-1" />
        </div>
      </div>

      {/* ---- SUGGESTION CHIPS ---- */}
      {!hasCustomerMessages && !loading && !typing && (
        <div className="flex-shrink-0 bg-gray-950 px-4 pt-2 pb-1">
          <div className="max-w-2xl mx-auto">
            <p className="text-xs text-gray-500 mb-2">Quick questions:</p>
            <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar" style={{ scrollbarWidth: 'none' }}>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  disabled={loading}
                  className="flex-shrink-0 text-xs bg-gray-800 hover:bg-gray-700 active:bg-gray-600 border border-gray-700 hover:border-gray-600 text-gray-200 rounded-full px-3 py-1.5 transition-colors touch-manipulation"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ---- INPUT BAR ---- */}
      <div className="flex-shrink-0 bg-gray-900 border-t border-gray-800 px-4 pt-3 pb-3">
        <div className="max-w-2xl mx-auto">
          {/* Staged image preview */}
          {stagedImage && (
            <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 mb-2">
              <ImageIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
              <p className="text-sm text-gray-200 truncate flex-1">{stagedImage.name}</p>
              <button onClick={() => setStagedImage(null)} className="text-gray-400 hover:text-white ml-1 flex-shrink-0">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <div className="flex items-end gap-2">
            {/* Image upload button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-shrink-0 w-10 h-10 rounded-xl bg-gray-800 hover:bg-gray-700 border border-gray-700 flex items-center justify-center text-gray-400 hover:text-white transition-colors touch-manipulation"
              title="Attach image"
            >
              <ImageIcon className="h-5 w-5" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && setStagedImage(e.target.files[0])}
            />

            {/* Text input */}
            <div className="flex-1 relative flex items-end bg-gray-800 border border-gray-700 rounded-2xl focus-within:border-blue-500 transition-colors">
              <Textarea
                ref={textareaRef}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !loading) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                onFocus={() => {
                  // Small delay lets the keyboard finish animating before scrolling
                  setTimeout(() => {
                    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                  }, 400);
                }}
                className="flex-1 py-2.5 pl-4 pr-12 bg-transparent border-0 text-white placeholder-gray-500 resize-none overflow-y-auto focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-sm leading-relaxed"
                style={{ height: `${textareaHeight}px`, minHeight: '44px', maxHeight: '160px' }}
                disabled={loading}
                rows={1}
              />
              <Button
                onClick={() => sendMessage()}
                disabled={loading || (!newMessage.trim() && !stagedImage)}
                className="absolute right-1.5 bottom-1.5 h-8 w-8 p-0 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-xl flex-shrink-0 transition-colors"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <p className="text-center text-[10px] text-gray-600 mt-2">Powered by OctaDezx AI</p>
        </div>
      </div>

      {/* ---- SCROLL TO BOTTOM BUTTON ---- */}
      {showScrollBtn && (
        <button
          onClick={() => { isUserScrollingRef.current = false; scrollToBottom(true); }}
          className="fixed bottom-24 right-4 w-10 h-10 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-full flex items-center justify-center text-white shadow-lg transition-all z-20 touch-manipulation"
        >
          <ChevronDown className="h-5 w-5" />
        </button>
      )}

      {/* ---- SUPPORT DIALOG ---- */}
      <Dialog open={supportOpen} onOpenChange={setSupportOpen}>
        <DialogContent className="bg-gray-900 text-white border-gray-800 mx-4 rounded-2xl">
          <DialogHeader><DialogTitle className="text-lg">Contact Support</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <Input
              placeholder="Subject"
              value={ticketSubject}
              onChange={(e) => setTicketSubject(e.target.value)}
              className="bg-gray-800 border-gray-700 text-white placeholder-gray-500 rounded-xl"
            />
            <Textarea
              placeholder="Describe your issue..."
              value={ticketMessage}
              onChange={(e) => setTicketMessage(e.target.value)}
              className="bg-gray-800 border-gray-700 text-white placeholder-gray-500 rounded-xl resize-none"
              rows={4}
            />
            <Button onClick={submitTicket} className="w-full bg-blue-600 hover:bg-blue-500 rounded-xl">
              Submit Ticket
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ---- FEEDBACK DIALOG ---- */}
      <Dialog open={feedbackOpen} onOpenChange={setFeedbackOpen}>
        <DialogContent className="bg-gray-900 text-white border-gray-800 mx-4 rounded-2xl">
          <DialogHeader><DialogTitle className="text-lg">Rate Your Experience</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2 text-center">
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button key={star} onClick={() => setRating(star)} className="touch-manipulation">
                  <Star className={`h-9 w-9 transition-colors ${star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600 hover:text-gray-400'}`} />
                </button>
              ))}
            </div>
            <Textarea
              placeholder="Any comments? (optional)"
              value={feedbackComment}
              onChange={(e) => setFeedbackComment(e.target.value)}
              className="bg-gray-800 border-gray-700 text-white placeholder-gray-500 rounded-xl resize-none text-left"
              rows={3}
            />
            <Button onClick={submitFeedback} className="w-full bg-green-600 hover:bg-green-500 rounded-xl">
              Submit Feedback
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CustomerChat;
