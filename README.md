# FlipScope — Resale Intelligence Engine

AI-powered resale price lookup for live auction buyers. Snap a photo or type a product name, get instant pricing data from across the resale market.

## What It Does

FlipScope identifies products (via photo or text), searches live marketplace data, and returns:
- **Resale prices** — Low / Median / High from eBay, StockX, Mercari, Poshmark, GOAT, Facebook Marketplace
- **Trade-in values** — Back Market, Gazelle, Swappa, Decluttr, ItsWorthMore, BuyBackWorld, SellCell, ecoATM, GameStop
- **Net after fees** — Factors in platform fees, shipping costs, and tax
- **Confidence rating** — High / Medium / Low based on data availability

## Quick Start

1. Open `flipscope.html` in any browser
2. Enter your name and Anthropic API key on the setup screen
3. Type a product name or upload a photo
4. Hit "Spin the Whale" 🐋

## Architecture

```
flipscope.html          → Single-file app (HTML/CSS/JS, no dependencies)
workers/
  cloudflare-worker-anthropic.js  → Production proxy (hides API key from users)
  cloudflare-worker-openai.js     → Fallback proxy (translates to OpenAI format)
docs/
  auction-data-collector-prompt.md → Chrome extension prompt for live auction data harvesting
```

### Two Modes

**Developer mode** (current): User provides their own API key. Works standalone — just open the HTML file.

**Production mode**: Set `PROXY_URL` at the top of the script to your deployed Cloudflare Worker URL. The API key setup screen disappears and all requests route through your proxy.

## Deploy the Proxy (Cloudflare Workers)

1. Create a free account at [dash.cloudflare.com](https://dash.cloudflare.com)
2. Go to **Workers & Pages** → **Create Worker**
3. Paste the contents of `workers/cloudflare-worker-anthropic.js`
4. Deploy, then go to **Settings** → **Variables**:
   - `ANTHROPIC_API_KEY` = your key (encrypt it)
   - `ALLOWED_ORIGIN` = `*` for testing, your domain for production
5. Copy the worker URL into `flipscope.html` at the `PROXY_URL` line

To switch to OpenAI (if Anthropic credits run out), deploy `cloudflare-worker-openai.js` to the same URL with `OPENAI_API_KEY` instead. No app changes needed — the OpenAI worker translates request/response formats automatically.

## Features

- **Multi-input**: Photo upload, text entry, clipboard paste, drag-and-drop
- **Condition chips**: New/Sealed, Open Box, Like New, Used-Good, Used-Fair, For Parts
- **Detail chips**: With Box, With Tags, Battery, Charger, Manual, Missing Parts, Unopened, Complete Set, Limited Edition, Vintage
- **Live timer**: Counts during search, shows breakdown (vision time + pricing time)
- **Performance telemetry**: Silently logs timing, input type, image size, confidence, category — never blocks the UI
- **Search history**: Deduplicated, tracks lookup count, browsable, persists in localStorage
- **Personalized**: Remembers your name, greets you, customizes the search button
- **Selling fees**: Adjustable platform fee %, shipping cost, tax rate

## Telemetry

Every search logs metadata to `localStorage` for performance analysis:

```js
// Access in browser console:
JSON.parse(localStorage.getItem('flipscope_telemetry'))
```

Fields: `total_s`, `vision_s`, `pricing_s`, `input_type`, `img.size_kb`, `query_len`, `condition`, `detail_count`, `source_count`, `confidence`, `category`, `product`, `error`

## Tech Stack

- **Frontend**: Vanilla HTML/CSS/JS, zero dependencies
- **AI**: Anthropic Claude Sonnet 4 (vision + web search), OpenAI GPT-4o (fallback)
- **Proxy**: Cloudflare Workers (free tier: 100K requests/day)
- **Fonts**: JetBrains Mono + Playfair Display (Google Fonts)

## Cost

~$0.003–0.01 per lookup on Claude Sonnet. Free tier Cloudflare Workers handles 100K requests/day.

## License

Proprietary — Switch Studio

---

Built by Franky @ [Switch Studio](http://ryankramerart.com)
