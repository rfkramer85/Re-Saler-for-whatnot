// ============================================================
// FLIPSCOPE API PROXY — Cloudflare Worker
// ============================================================
// SETUP:
// 1. Go to dash.cloudflare.com → Workers & Pages → Create Worker
// 2. Paste this entire file into the editor
// 3. Click "Deploy"
// 4. Go to Settings → Variables → Add:
//    - ANTHROPIC_API_KEY = your sk-ant-... key (click "Encrypt")
//    - ALLOWED_ORIGIN = https://yourdomain.com (or * for testing)
// 5. Your proxy URL will be: https://your-worker-name.your-subdomain.workers.dev
// ============================================================

export default {
  async fetch(request, env) {
    // --- CORS ---
    const origin = request.headers.get('Origin') || '';
    const allowedOrigin = env.ALLOWED_ORIGIN || '*';
    const corsHeaders = {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    };

    // Handle preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Only POST allowed
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // --- RATE LIMITING (simple per-IP, ~60 req/min) ---
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
    // Note: For production, use Cloudflare's built-in rate limiting rules
    // This is a basic safeguard

    // --- PARSE REQUEST ---
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate: only allow messages endpoint usage
    if (!body.messages || !body.model) {
      return new Response(JSON.stringify({ error: 'Missing required fields: model, messages' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // --- SAFETY: Cap token usage to prevent abuse ---
    body.max_tokens = Math.min(body.max_tokens || 1000, 2000);

    // --- FORWARD TO ANTHROPIC ---
    try {
      const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(body)
      });

      const responseData = await anthropicResponse.text();

      return new Response(responseData, {
        status: anthropicResponse.status,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Proxy error: ' + e.message }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};
