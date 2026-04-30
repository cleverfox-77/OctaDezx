import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, businessId, sessionId } = await req.json();

    console.log('Processing chat request:', { message, businessId, sessionId });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select(`
        *,
        products (
          id,
          name,
          description,
          category,
          price,
          product_images (
            image_url,
            alt_text,
            is_primary
          )
        )
      `)
      .eq('id', businessId)
      .single();

    if (businessError || !business) {
      console.error('Business not found:', businessError);
      return new Response(
        JSON.stringify({ escalated: true, reason: 'Business configuration error' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: chatHistory } = await supabase
      .from('chat_messages')
      .select('sender_type, content, image_url')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(10);

    const products = (business.products || []).slice(0, 20).map((p: any) => ({
      name: p.name,
      category: p.category || 'General',
      price: p.price,
      description: (p.description || '').slice(0, 300)
    }));

    const historyMessages = (chatHistory || []).slice(-8).map((msg: any) => ({
      role: msg.sender_type === 'ai' ? 'assistant' : 'user',
      content: msg.content || ''
    }));

    const systemPrompt = `You are a helpful, sales-focused Customer Support agent for ${business.name}.
Business Description: ${business.description || ''}
Policies: ${business.policies || 'Standard customer service policies apply'}
AI Instructions: ${business.ai_instructions || 'Be helpful, professional, and courteous.'}
Rules:
- IMPORTANT: You are Customer Support. Do not refer to yourself as an AI.
- IMPORTANT: Detect the language of the customer's message and respond in the SAME language they are using.
- If the customer uses mixed or transliterated language, mirror their style.
- Always help with product info, pricing, availability, and next steps to purchase.
- Recommend relevant products with clear, concise descriptions and prices.
- Do NOT escalate unless there is a clear complaint, technical issue, or request requiring humans.
- Be friendly and proactive about closing a sale.
`;

    const catalogSnippet = products.length
      ? products.map((p: any) => `- ${p.name} (${p.category}) - $${p.price ?? 'Price on request'}\n  ${p.description}`).join('\n')
      : 'No products available';

    const messages = [
      { role: 'system', content: systemPrompt + `\nCatalog:\n${catalogSnippet}` },
      ...historyMessages,
      { role: 'user', content: message }
    ];

    const groqApiKey = Deno.env.get('GROQ_API_KEY');
    if (!groqApiKey) {
      console.error('Groq API key not found');
      const fallback = localSmartReply(message, products, business);
      return new Response(JSON.stringify({ response: fallback }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GROQ IMPLEMENTATION
    async function callGroq(model: string): Promise<string | null> {
      const body = { 
        model, 
        messages, 
        max_tokens: 450, 
        temperature: 0.3 
      };
      
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.error('Groq API error:', res.status, res.statusText, errText);
        return null;
      }
      
      const json = await res.json().catch(() => null);
      return json?.choices?.[0]?.message?.content?.trim() || null;
    }

    async function withRetry(): Promise<string | null> {
      const models = ['llama-3.1-8b-instant', 'mixtral-8x7b-32768'];
      for (let i = 0; i < models.length; i++) {
        console.log(`AI attempt ${i + 1} using ${models[i]}`);
        const result = await callGroq(models[i]);
        if (result) return result;
        if (i < models.length - 1) {
          const delay = 300 * Math.pow(2, i);
          await new Promise((r) => setTimeout(r, delay));
        }
      }
      return null;
    }

    function isGenericAIResponse(text: string): boolean {
      const t = (text || '').toLowerCase();
      return t.includes("as an ai") || t.includes("i am an ai");
    }

    function normalizePrice(v: any): number | null {
      if (typeof v === 'number') return isFinite(v) ? v : null;
      if (v == null) return null;
      const n = Number(v);
      return isFinite(n) ? n : null;
    }

    function formatCurrency(n: number): string {
      try {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n);
      } catch {
        return `$${n.toFixed(2)}`;
      }
    }

    function detectLanguage(text: string): string {
      const t = (text || '').toLowerCase();
      if (/[\u0900-\u097F]/.test(t)) return 'hi';
      if (/[\u0980-\u09FF]/.test(t)) return 'bn';
      if (/[\u0600-\u06FF]/.test(t)) return 'ar';
      const spanish = /\b(hola|gracias|cuánto|precio|comprar)\b/i.test(t);
      if (spanish) return 'es';
      return 'en';
    }

    function localSmartReply(userMessage: string, products: any[], business: any): string {
      const msg = (userMessage || '').toLowerCase();
      const hasProducts = Array.isArray(products) && products.length > 0;
      const language = detectLanguage(userMessage);

      const responses = {
        en: {
          greeting: `Thanks for reaching out to ${business.name}!`,
          recommendations: 'Here are a few recommendations:',
          tellMe: 'Tell me what you\'re looking for, and I\'ll tailor suggestions.',
          helpToday: `Thanks for contacting ${business.name}! How can I help?`,
        },
        es: {
          greeting: `¡Gracias por contactar a ${business.name}!`,
          recommendations: 'Aquí tienes algunas recomendaciones:',
          tellMe: 'Dime qué estás buscando y te daré sugerencias.',
          helpToday: `¡Gracias por contactar a ${business.name}! ¿Cómo puedo ayudarte?`,
        },
      };
      const lang = responses[language as keyof typeof responses] || responses.en;

      if (hasProducts) {
        const picks = products.slice(0, 3).map((p: any) => `• ${p.name}${p.price != null ? ` – ${formatCurrency(Number(p.price))}` : ''}`).join('\n');
        return `${lang.greeting} ${lang.recommendations}\n\n${picks}\n\n${lang.tellMe}`;
      }
      return lang.helpToday;
    }

    let finalMessage = await withRetry();

    if (!finalMessage || isGenericAIResponse(finalMessage)) {
      console.warn('Using local smart fallback');
      finalMessage = localSmartReply(message, products, business);
    }

    console.log('AI Response:', finalMessage);

    if (finalMessage.startsWith('ESCALATE:')) {
      const reason = finalMessage.replace('ESCALATE:', '').trim();
      return new Response(
        JSON.stringify({ escalated: true, reason }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ response: finalMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing chat request:', error);
    return new Response(
      JSON.stringify({ escalated: true, reason: 'System error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});