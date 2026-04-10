// ============================================================
// FLIPSCOPE API PROXY — OpenAI VERSION — Cloudflare Worker
// ============================================================
// SETUP:
// 1. Go to dash.cloudflare.com → Workers & Pages → Create Worker
// 2. Paste this entire file into the editor
// 3. Click "Deploy"
// 4. Go to Settings → Variables → Add:
//    - OPENAI_API_KEY = your sk-proj-... key (click "Encrypt")
//    - OPENAI_MODEL = gpt-4o (or gpt-4o-mini for cheaper)
//    - ALLOWED_ORIGIN = https://yourdomain.com (or * for testing)
// 5. Your proxy URL will be the same as the Anthropic one
//
// NOTE: This worker translates Anthropic-format requests from
// FlipScope into OpenAI-format requests. The app doesn't need
// to change — just deploy this worker instead of the Anthropic one.
// ============================================================

export default {
  async fetch(request, env) {
    const allowedOrigin = env.ALLOWED_ORIGIN || '*';
    const corsHeaders = {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!body.messages) {
      return new Response(JSON.stringify({ error: 'Missing messages' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // --- TRANSLATE Anthropic format → OpenAI format ---
    const oaiMessages = body.messages.map(msg => {
      if (typeof msg.content === 'string') {
        return { role: msg.role, content: msg.content };
      }
      // Array content (vision messages)
      const parts = msg.content.map(c => {
        if (c.type === 'text') return { type: 'text', text: c.text };
        if (c.type === 'image') {
          return {
            type: 'image_url',
            image_url: {
              url: `data:${c.source.media_type};base64,${c.source.data}`,
              detail: 'low' // Use 'low' to save tokens, 'high' for max quality
            }
          };
        }
        return null;
      }).filter(Boolean);
      return { role: msg.role, content: parts };
    });

    const model = env.OPENAI_MODEL || 'gpt-4o';
    const maxTokens = Math.min(body.max_tokens || 1000, 2000);

    const oaiBody = {
      model: model,
      max_tokens: maxTokens,
      messages: oaiMessages
    };

    // Note: OpenAI doesn't have native web search in the same way.
    // The app sends tools:[{type:'web_search_20250305'}] for deep research.
    // We strip that — GPT-4o will use training knowledge instead.
    // For better web search, consider OpenAI's browsing or Responses API.

    try {
      const oaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.OPENAI_API_KEY}`
        },
        body: JSON.stringify(oaiBody)
      });

      const oaiData = await oaiResponse.json();

      if (!oaiResponse.ok) {
        return new Response(JSON.stringify({
          error: oaiData.error?.message || 'OpenAI error',
          type: 'openai_error'
        }), {
          status: oaiResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // --- TRANSLATE OpenAI response → Anthropic format ---
      // FlipScope expects: { content: [{ type: 'text', text: '...' }] }
      const text = oaiData.choices?.[0]?.message?.content || '';
      const anthropicFormat = {
        content: [{ type: 'text', text: text }],
        model: model,
        usage: oaiData.usage
      };

      return new Response(JSON.stringify(anthropicFormat), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (e) {
      return new Response(JSON.stringify({ error: 'Proxy error: ' + e.message }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};
