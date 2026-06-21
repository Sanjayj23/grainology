# Grainology - Live Agricultural Price Intelligence

Compare agricultural commodity prices across live and near-live sources, including data.gov.in/Agmarknet, eNAM, Agmarknet direct scrape, Vegetable Market Price, and optional IndiaDataPortal history.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

---

## Architecture

```text
GitHub Actions (3 scheduled runs/day)
  -> Python scrapers -> data/latest/*.json + data/history/**/*.csv
       -> raw GitHub first, jsDelivr fallback -> Next.js frontend (Vercel)
```

No database is required. The GitHub repo is the data store. Vercel reads committed JSON files directly from raw GitHub first, then falls back to jsDelivr CDN. New scrape runs show up on the live site after the GitHub Actions commit; no Vercel rebuild is needed.

---

## Data Sources

| Source | Type | Freshness | Notes |
|--------|------|-----------|-------|
| Vegetable Market Price | HTML scrape | Daily | Retail + wholesale vegetable prices, no API key |
| data.gov.in | Official REST API | Daily / near-live when published | Agmarknet-generated mandi data |
| eNAM | Public dashboard/API sniff | Live / best-effort | e-trading market prices |
| Agmarknet direct | Browser scrape | Best-effort | Redundant cross-check for data.gov.in |
| IndiaDataPortal | Manual/API candidate | Historical / optional | Not part of the default live run |

The portal is designed to keep working when a source is slow or redesigned. Critical data comes from the most stable source available; fragile sources are treated as best-effort and write diagnostics when they fail.

---

## Setup

### 1. Get a data.gov.in API key

Register at [https://data.gov.in](https://data.gov.in), then add this GitHub Actions secret:

```text
DATAGOVIN_API_KEY=your-data-gov-in-key
```

### 2. Configure repo identity

The project defaults to:

```text
NEXT_PUBLIC_GITHUB_USER=Sanjayj23
NEXT_PUBLIC_GITHUB_REPO=grainology
```

Set these in Vercel only if you fork or rename the repo. You can also set `NEXT_PUBLIC_DATA_BASE_URL` later if you move the JSON snapshots to a bucket, Worker, or API.

### 3. Run scrapers locally

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

Open [http://localhost:3000](http://localhost:3000). Local development reads `public/data` first, then falls back to committed GitHub data.

---

## Data Format

All sources normalize to this unified schema:

| Field | Type | Description |
|-------|------|-------------|
| `source` | string | `vegetablemarketprice` / `datagovin` / `enam` / `agmarknet` / `indiadataportal` |
| `price_date` | YYYY-MM-DD | Market trading date |
| `state` | string | Canonical state name |
| `district` | string | District name |
| `market` | string | Mandi/market name |
| `commodity` | string | Canonical commodity name |
| `variety` | string | Variety, when available |
| `min_price` | float | Minimum price, normalized to rupees per quintal when the source provides that unit |
| `max_price` | float | Maximum price |
| `modal_price` | float | Modal or midpoint price |
| `arrivals_tonnes` | float/null | Quantity arrived, when available |

---

## Project Structure

```text
grainology/
  scrapers/
    schema.py                     # Pydantic unified schema
    normalize.py                  # Name normalization + crosswalk
    vegetablemarketprice_scraper.py
    datagovin_client.py           # data.gov.in REST API client
    enam_scraper.py               # eNAM live/best-effort scraper
    agmarknet_scraper.py          # Agmarknet direct scrape diagnostics
    indiadataportal_client.py     # Optional historical client
    run_all.py                    # Orchestrator
  data/
    latest/                       # Most recent JSON snapshots
    history/                      # Daily CSVs per source
    reference/                    # Name crosswalk files
    debug/                        # Screenshots/HTML diagnostics from scraper failures
    scrape_log.csv                # Run history
  src/
    app/page.tsx                  # Main dashboard
    components/                   # Tables, charts, filters, freshness indicators
    lib/dataFetcher.ts            # GitHub/CDN fetch + compare logic
  .github/workflows/scrape.yml    # Automated scraping cron
```

---

## Source Debugging

If eNAM or Agmarknet returns zero rows after a redesign, the scraper saves screenshots and HTML under `data/debug/`. The GitHub Action uploads those files as artifacts for seven days. Download the latest artifact and inspect the changed form/API calls before changing selectors.

---

## License

MIT. Source data remains subject to each source site's terms and published data license.
