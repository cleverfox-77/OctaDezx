// OctaDezx — Generate Invoice PDF Edge Function
// Builds a branded PDF for an order, uploads to storage, returns public URL.
// Respects business invoice settings (logo, numbering mode, footer note, currency).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsPDF } from "https://esm.sh/jspdf@2.5.1";
import { corsHeaders } from "../_shared/cors.ts";

interface InvoiceInput {
  businessId: string;
  orderId: string;
  /** If true, force regeneration even if invoice already exists */
  force?: boolean;
}

interface Item { name: string; price: number; quantity: number; }

const CURRENCY_SYMBOL: Record<string, string> = {
  USD: "$", EUR: "€", GBP: "£", BDT: "৳", INR: "₹",
  PKR: "₨", JPY: "¥", CNY: "¥", AUD: "A$", CAD: "C$",
  AED: "د.إ", SAR: "﷼", MYR: "RM", SGD: "S$", THB: "฿",
  PHP: "₱", IDR: "Rp", VND: "₫", BRL: "R$", MXN: "Mex$",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = (await req.json()) as InvoiceInput;
    if (!body.businessId || !body.orderId) {
      return json({ error: "businessId and orderId required" }, 400);
    }
    const sb = adminClient();

    // Existing?
    if (!body.force) {
      const { data: existing } = await sb
        .from("invoices")
        .select("*")
        .eq("order_id", body.orderId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existing) {
        return json({ invoice: existing, regenerated: false });
      }
    }

    // Order
    const { data: order } = await sb.from("orders").select("*").eq("id", body.orderId).single();
    if (!order) return json({ error: "Order not found" }, 404);
    if (order.business_id !== body.businessId) return json({ error: "Mismatch" }, 403);

    // Business
    const { data: business } = await sb.from("businesses").select("*").eq("id", body.businessId).single();
    if (!business) return json({ error: "Business not found" }, 404);

    // Currency — first item's metadata.currency, else fall back to a product lookup, else USD
    const items: Item[] = Array.isArray(order.items) ? order.items : [];
    let currency = "USD";
    if (items.length > 0) {
      const { data: anyProduct } = await sb
        .from("products")
        .select("metadata")
        .eq("business_id", body.businessId)
        .limit(1)
        .maybeSingle();
      const meta = (anyProduct?.metadata as any) ?? {};
      if (meta.currency) currency = meta.currency;
    }
    const symbol = CURRENCY_SYMBOL[currency] ?? currency + " ";

    // Invoice number
    const { data: invNumData, error: invNumErr } = await sb.rpc("next_invoice_number", {
      p_business_id: body.businessId,
    });
    if (invNumErr) return json({ error: invNumErr.message }, 500);
    const invoiceNumber = invNumData as string;

    // Totals
    const subtotal = items.reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.quantity) || 1), 0);
    const total = Number(order.total_amount ?? subtotal);

    // Build PDF
    const pdfBytes = buildPdf({
      business,
      order,
      items,
      invoiceNumber,
      currency,
      symbol,
      subtotal,
      total,
      issuedAt: new Date(),
    });

    // Upload
    const fileName = `${body.businessId}/${invoiceNumber.replace(/[^a-zA-Z0-9-_]/g, "_")}.pdf`;
    const up = await sb.storage.from("invoices").upload(fileName, pdfBytes, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (up.error) return json({ error: `Upload failed: ${up.error.message}` }, 500);

    const { data: urlData } = sb.storage.from("invoices").getPublicUrl(fileName);
    const pdfUrl = urlData.publicUrl;

    // Persist invoice row
    const { data: invoice, error: insErr } = await sb
      .from("invoices")
      .insert({
        business_id: body.businessId,
        order_id: body.orderId,
        invoice_number: invoiceNumber,
        customer_name: order.customer_name,
        customer_email: order.customer_email,
        customer_phone: order.customer_phone,
        customer_address: typeof order.shipping_address === "string"
          ? order.shipping_address
          : JSON.stringify(order.shipping_address ?? {}),
        items: items,
        subtotal,
        total,
        currency,
        pdf_url: pdfUrl,
        status: "issued",
      })
      .select()
      .single();
    if (insErr) return json({ error: insErr.message }, 500);

    return json({ invoice, regenerated: true });
  } catch (err: any) {
    console.error(err);
    return json({ error: err.message ?? "Internal error" }, 500);
  }
});

// ──────────────────── PDF builder ────────────────────
interface BuildArgs {
  business: any;
  order: any;
  items: Item[];
  invoiceNumber: string;
  currency: string;
  symbol: string;
  subtotal: number;
  total: number;
  issuedAt: Date;
}

function buildPdf(a: BuildArgs): Uint8Array {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 48;
  let y = margin;

  // ── Header bar ──
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, pageW, 6, "F");
  y = margin + 8;

  // ── Logo + business name ──
  doc.setTextColor(20, 24, 38);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(a.business.name ?? "Business", margin, y);
  y += 20;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(110, 120, 145);
  if (a.business.business_address) { doc.text(String(a.business.business_address), margin, y); y += 12; }
  const contactParts: string[] = [];
  if (a.business.business_phone) contactParts.push(a.business.business_phone);
  if (a.business.business_email) contactParts.push(a.business.business_email);
  if (contactParts.length) { doc.text(contactParts.join("  ·  "), margin, y); y += 12; }

  // ── Invoice title (right side) ──
  const rightX = pageW - margin;
  doc.setTextColor(20, 24, 38);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.text("INVOICE", rightX, margin + 18, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(110, 120, 145);
  doc.text(`#${a.invoiceNumber}`, rightX, margin + 34, { align: "right" });
  doc.text(`Issued: ${a.issuedAt.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}`,
           rightX, margin + 48, { align: "right" });

  y = Math.max(y, margin + 70);

  // ── Divider ──
  doc.setDrawColor(232, 236, 244);
  doc.setLineWidth(0.7);
  doc.line(margin, y, pageW - margin, y);
  y += 24;

  // ── Bill to ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(140, 150, 175);
  doc.text("BILL TO", margin, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(20, 24, 38);
  doc.text(a.order.customer_name ?? "Customer", margin, y); y += 13;
  if (a.order.customer_email) { doc.text(String(a.order.customer_email), margin, y); y += 12; }
  if (a.order.customer_phone) { doc.text(String(a.order.customer_phone), margin, y); y += 12; }
  if (a.order.shipping_address) {
    const addr = typeof a.order.shipping_address === "string"
      ? a.order.shipping_address
      : JSON.stringify(a.order.shipping_address);
    const lines = doc.splitTextToSize(addr, 300);
    doc.text(lines, margin, y);
    y += lines.length * 12;
  }
  y += 18;

  // ── Items table header ──
  doc.setFillColor(245, 247, 252);
  doc.rect(margin, y - 14, pageW - margin * 2, 22, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(110, 120, 145);
  doc.text("ITEM", margin + 8, y);
  doc.text("QTY", margin + 320, y, { align: "right" });
  doc.text("PRICE", margin + 400, y, { align: "right" });
  doc.text("AMOUNT", pageW - margin - 8, y, { align: "right" });
  y += 18;

  // ── Items rows ──
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(34, 40, 60);
  for (const item of a.items) {
    if (y > 720) { doc.addPage(); y = margin; }
    const qty = Number(item.quantity ?? 1);
    const price = Number(item.price ?? 0);
    const amount = qty * price;
    const nameLines = doc.splitTextToSize(item.name ?? "Item", 290);
    doc.text(nameLines, margin + 8, y);
    doc.text(String(qty), margin + 320, y, { align: "right" });
    doc.text(fmt(a.symbol, price), margin + 400, y, { align: "right" });
    doc.text(fmt(a.symbol, amount), pageW - margin - 8, y, { align: "right" });
    y += Math.max(14, nameLines.length * 12 + 4);
  }

  // ── Divider before totals ──
  y += 6;
  doc.setDrawColor(232, 236, 244);
  doc.line(margin, y, pageW - margin, y);
  y += 16;

  // ── Totals ──
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(110, 120, 145);
  doc.text("Subtotal", pageW - margin - 100, y, { align: "right" });
  doc.setTextColor(34, 40, 60);
  doc.text(fmt(a.symbol, a.subtotal), pageW - margin - 8, y, { align: "right" });
  y += 18;

  doc.setFillColor(37, 99, 235);
  doc.rect(pageW - margin - 200, y - 12, 200, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("TOTAL", pageW - margin - 192, y + 4);
  doc.setFontSize(14);
  doc.text(fmt(a.symbol, a.total), pageW - margin - 8, y + 4, { align: "right" });
  y += 36;

  // ── Footer ──
  y = doc.internal.pageSize.getHeight() - 80;
  doc.setDrawColor(232, 236, 244);
  doc.line(margin, y, pageW - margin, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(140, 150, 175);
  if (a.business.invoice_footer_note) {
    const lines = doc.splitTextToSize(String(a.business.invoice_footer_note), pageW - margin * 2);
    doc.text(lines, margin, y);
    y += lines.length * 11 + 4;
  }
  doc.setFontSize(8);
  doc.setTextColor(160, 170, 195);
  doc.text("Thank you for your business.", margin, y);
  doc.text("Powered by OctaDezx", pageW - margin, y, { align: "right" });

  return new Uint8Array(doc.output("arraybuffer") as ArrayBuffer);
}

function fmt(symbol: string, n: number): string {
  return `${symbol}${(Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}
function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
