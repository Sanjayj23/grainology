# 🌾 Grainology — Live Agricultural Price Intelligence

Compare live mandi prices across **4 government data sources** — Agmarknet, eNAM, data.gov.in, and IndiaDataPortal — with filters by state, district, market, commodity, and variety.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

---

## Architecture

```
GitHub Actions (every 2 hrs)
  └── Python scrapers → data/latest/*.json + data/history/**/*.csv
        └── jsDelivr CDN → Next.js frontend (Vercel)
```

**No database.** The GitHub repo is the data store. Vercel reads data from jsDelivr CDN URLs that point directly at the committed JSON files. New scrape runs show up on the live site within ~5 minutes of the GitHub Actions commit — no Vercel rebuild needed.

---

## Data Sources

| Source | Type | Freshness | Coverage |
|--------|------|-----------|----------|
| **data.gov.in** | REST API | Daily (T-1) | ~2,000 markets, 300 commodities |
| **Agmarknet** | HTML scrape | Daily (T-1) | Same data, gap-fill |
| **eNAM** | JSON endpoint | Live (T-0) | 1,000+ mandis, 18+ states |
| **IndiaDataPortal** | REST API | Historical | Aggregated APMC data |

---

## Setup

### 1. Get a data.gov.in API Key
Register at [https://data.gov.in](https://data.gov.in) (free, takes 5 minutes).

### 2. Fork & configure
```bash
git clone https://github.com/YOUR_USERNAME/grainology.git
cd grainology
```

Add to GitHub Actions secrets (`Settings → Secrets → Actions`):
- `DATAGOVIN_API_KEY` — your data.gov.in API key
- `IDP_API_KEY` — IndiaDataPortal key (optional)

Update the CDN base URL in `src/lib/dataFetcher.ts`:
```typescript
const GITHUB_USER = 'YOUR_GITHUB_USERNAME';
const GITHUB_REPO = 'grainology';
```

Or set Vercel environment variables:
```
NEXT_PUBLIC_GITHUB_USER=your-github-username
NEXT_PUBLIC_GITHUB_REPO=grainology
```

### 3. Run scrapers locally (Python)
```bash
cd scrapers
pip install -r requirements.txt
DATAGOVIN_API_KEY=your_key python run_all.py
```

### 4. Run the frontend locally
```bash
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000)

### 5. Deploy to Vercel
```bash
npx vercel --prod
```
Or connect the GitHub repo in the Vercel dashboard — it auto-deploys on every push.

---

## Data Format

All sources normalize to this unified schema:

| Field | Type | Description |
|-------|------|-------------|
| `source` | string | `agmarknet` / `enam` / `datagovin` / `indiadataportal` |
| `price_date` | YYYY-MM-DD | Market trading date |
| `state` | string | Canonical state name |
| `district` | string | District name |
| `market` | string | Mandi/market name |
| `commodity` | string | Canonical commodity name |
| `variety` | string | Variety (e.g. "Red", "Local") |
| `min_price` | float | Minimum price (₹/quintal) |
| `max_price` | float | Maximum price (₹/quintal) |
| `modal_price` | float | Modal (most common) price (₹/quintal) |
| `arrivals_tonnes` | float\|null | Quantity arrived |

---

## Project Structure

```
grainology/
├── scrapers/
│   ├── schema.py                  # Pydantic unified schema
│   ├── normalize.py               # Name normalization + crosswalk
│   ├── agmarknet_scraper.py       # ASP.NET form POST scraper
│   ├── datagovin_client.py        # data.gov.in REST API client
│   ├── enam_scraper.py            # eNAM live price scraper
│   ├── indiadataportal_client.py  # IndiaDataPortal client
│   ├── run_all.py                 # Orchestrator
│   └── requirements.txt
├── data/
│   ├── latest/                    # Most recent JSON snapshots (used by frontend)
│   ├── history/                   # Daily CSVs per source
│   ├── reference/                 # Name crosswalk files
│   └── scrape_log.csv             # Run history
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx               # Main dashboard
│   │   └── globals.css
│   ├── components/
│   │   ├── ComparisonTable.tsx    # Source comparison table
│   │   ├── TrendChart.tsx         # 30-day price trend
│   │   ├── FilterSidebar.tsx      # Cascading filters
│   │   └── FreshnessStrip.tsx     # Data health indicators
│   └── lib/
│       ├── types.ts               # TypeScript interfaces
│       └── dataFetcher.ts         # CDN fetch + filter/compare logic
├── .github/workflows/scrape.yml   # Automated scraping cron
├── next.config.js
├── vercel.json
└── tsconfig.json
```

---

## License

MIT — data from government sources used under their respective open data policies.
