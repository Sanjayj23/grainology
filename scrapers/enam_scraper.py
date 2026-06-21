"""
eNAM scraper — fetches live trade/price data from the eNAM (National
Agriculture Market) e-trading platform.

eNAM prices are NOT the same data as Agmarknet/data.gov.in: Agmarknet
reports prices observed by market officials in physical mandis, while eNAM
reports prices from its own electronic auction/trading platform. Keeping
both gives you a genuine point of comparison (traditional mandi vs.
e-trading) instead of two copies of the same number.

This module tries strategies in order of cost/certainty:
  1. The previously-known ajax_ctrl endpoints, in case the prior run's
     HTTP 500 / bad-JSON was transient (rate limiting, a deploy in
     progress, a missing-but-required parameter, etc).
  2. A live network-sniff: load the public Live Price dashboard page in a
     real browser, nudge any visible "search/view" control, and capture
     whatever JSON XHR the page itself fires. This self-discovers the
     correct endpoint+params each run, so it keeps working even if eNAM
     renames an internal ajax action — no hardcoded URL required.
  3. Give up gracefully, with a screenshot + HTML diagnostic dump saved to
     data/debug/enam/ so an exact fix can be written from real evidence
     instead of another guess.
"""

from __future__ import annotations
import json as _json
import logging
import re
import time
from datetime import date, datetime, timezone
from typing import Optional

from playwright.sync_api import Page, Response

from schema import PriceRecord
from normalize import normalize_commodity, normalize_market
from debug_utils import dump_diagnostics

logger = logging.getLogger(__name__)

ENAM_HOME_URL = "https://enam.gov.in/web/"
ENAM_LIVE_PRICE_URL = "https://enam.gov.in/web/dashboard/live_price"
ENAM_TRADE_URL = "https://enam.gov.in/web/ajax_ctrl/trade_data"
ENAM_PRICE_URL = "https://enam.gov.in/web/ajax_ctrl/commodity_arrivals_list"
ENAM_LIVE_CTRL = "https://enam.gov.in/web/Liveprice_ctrl"


def _parse_enam_record(raw: dict, fetched_at: datetime, price_date: date) -> Optional[PriceRecord]:
    """Parse a single eNAM JSON record into a PriceRecord."""
    try:
        raw_state     = raw.get("stateName", raw.get("state", ""))
        raw_district  = raw.get("districtName", raw.get("district", ""))
        raw_market    = raw.get("apmc", raw.get("mandiName", raw.get("market", "")))
        raw_commodity = raw.get("commodity", raw.get("commodityName", ""))
        raw_variety   = raw.get("variety", raw.get("varietyName", ""))

        min_p   = float(str(raw.get("minPrice", raw.get("min_price", 0))).replace(",", "") or 0)
        max_p   = float(str(raw.get("maxPrice", raw.get("max_price", 0))).replace(",", "") or 0)
        modal_p = float(str(raw.get("modalPrice", raw.get("modal_price", max_p))).replace(",", "") or 0)
        arrivals = raw.get(
            "arrivals",
            raw.get("totalArrival", raw.get("commodity_arrivals", None))
        )
        arrivals_f = float(str(arrivals).replace(",", "")) if arrivals else None
        unit = str(raw.get("Commodity_Uom", raw.get("unit", ""))).lower()
        if arrivals_f is not None and ("qui" in unit or "quintal" in unit):
            arrivals_f = arrivals_f * 0.1

        if not raw_commodity or not raw_state:
            return None
        if min_p <= 0 and max_p <= 0 and modal_p <= 0:
            return None  # not a price row -- probably a different shaped object

        commodity, _ = normalize_commodity(raw_commodity)
        market, district, state, _ = normalize_market(raw_market, raw_district, raw_state)

        return PriceRecord(
            source="enam",
            fetched_at=fetched_at,
            price_date=price_date,
            state=state,
            district=district,
            market=market,
            commodity=commodity,
            variety=raw_variety.strip(),
            min_price=max(min_p, 0.01),
            max_price=max(max_p, 0.01),
            modal_price=max(modal_p, 0.01),
            arrivals_tonnes=arrivals_f,
            raw_source_name=raw_commodity,
        )
    except Exception as exc:
        logger.debug("eNAM: skipping row %r: %s", raw, exc)
        return None


def _records_from_json(data, fetched_at: datetime, price_date: date) -> list[PriceRecord]:
    """Pull a list of row-dicts out of whatever shape the API wrapped them
    in, then parse each into a PriceRecord."""
    if isinstance(data, list):
        raw_records = data
    elif isinstance(data, dict):
        raw_records = (
            data.get("data") or data.get("records") or data.get("result")
            or data.get("Data") or []
        )
        if isinstance(raw_records, dict):
            raw_records = [raw_records]
    else:
        raw_records = []

    out: list[PriceRecord] = []
    for raw in raw_records:
        if not isinstance(raw, dict):
            continue
        rec = _parse_enam_record(raw, fetched_at, price_date)
        if rec:
            out.append(rec)
    return out


def _try_known_endpoints(page: Page, target_date: date, fetched_at: datetime) -> list[PriceRecord]:
    endpoints = [
        f"{ENAM_TRADE_URL}?language=en&start_date={target_date.strftime('%d-%b-%Y')}"
        f"&end_date={target_date.strftime('%d-%b-%Y')}&state_name=&commodity_id=",
        f"{ENAM_PRICE_URL}?language=en&date={target_date.strftime('%Y-%m-%d')}",
    ]
    try:
        page.goto(ENAM_HOME_URL, wait_until="domcontentloaded", timeout=30000)
        time.sleep(1.5)
    except Exception as exc:
        logger.info("eNAM: could not preload homepage for cookies/session: %s", exc)

    for url in endpoints:
        try:
            resp = page.request.get(url, headers={"X-Requested-With": "XMLHttpRequest"})
            if not resp.ok:
                logger.info("eNAM: known endpoint %s -> HTTP %s", url, resp.status)
                continue
            data = resp.json()
            records = _records_from_json(data, fetched_at, target_date)
            if records:
                logger.info("eNAM: known endpoint succeeded -- %d records", len(records))
                return records
            logger.info("eNAM: known endpoint %s returned JSON but 0 usable records", url)
        except Exception as exc:
            logger.info("eNAM: known endpoint %s failed: %s", url, exc)
    return []


def _api_post(page: Page, endpoint: str, form: Optional[dict] = None) -> Optional[dict]:
    try:
        resp = page.request.post(
            f"{ENAM_LIVE_CTRL}/{endpoint}",
            form=form or {},
            headers={
                "X-Requested-With": "XMLHttpRequest",
                "Referer": ENAM_LIVE_PRICE_URL,
            },
        )
        if not resp.ok:
            logger.info("eNAM: Liveprice_ctrl/%s -> HTTP %s", endpoint, resp.status)
            return None
        data = resp.json()
        if isinstance(data, dict) and data.get("status") == 200:
            return data
        logger.info("eNAM: Liveprice_ctrl/%s returned non-success payload: %s", endpoint, data)
    except Exception as exc:
        logger.info("eNAM: Liveprice_ctrl/%s failed: %s", endpoint, exc)
    return None


def _latest_liveprice_date(page: Page, fallback: date) -> date:
    data = _api_post(page, "current_date")
    if not data:
        return fallback
    rows = data.get("data") or []
    if not rows:
        return fallback
    date_str = str(rows[0].get("created_at", "")).split(" ")[0]
    try:
        return datetime.strptime(date_str, "%Y-%m-%d").date()
    except Exception:
        return fallback


def _try_liveprice_ctrl(page: Page, target_date: date, fetched_at: datetime) -> list[PriceRecord]:
    """Current eNAM live-price dashboard API.

    The dashboard posts to Liveprice_ctrl endpoints. The all-state/all-
    commodity placeholders can return {"status":500}, so the robust path is:
    get the date eNAM says is current, get concrete states for that date,
    then call trade_data_list once per state.
    """
    try:
        page.goto(ENAM_LIVE_PRICE_URL, wait_until="domcontentloaded", timeout=30000)
        time.sleep(1)
    except Exception as exc:
        logger.info("eNAM: could not load live price dashboard before API calls: %s", exc)

    live_date = _latest_liveprice_date(page, target_date)
    if live_date != target_date:
        logger.warning(
            "eNAM: dashboard latest date is %s; requested %s. Using dashboard date.",
            live_date, target_date,
        )

    date_str = live_date.strftime("%Y-%m-%d")
    states_payload = _api_post(
        page,
        "states_name_live",
        {"fromDate": date_str, "toDate": date_str},
    )
    state_rows = (states_payload or {}).get("data") or []
    states = [str(row.get("state", "")).strip() for row in state_rows if row.get("state")]

    if not states:
        logger.info("eNAM: Liveprice_ctrl returned no states for %s", date_str)
        return []

    all_records: list[PriceRecord] = []
    for state_name in states:
        data = _api_post(
            page,
            "trade_data_list",
            {
                "language": "en",
                "stateName": state_name,
                "fromDate": date_str,
                "toDate": date_str,
            },
        )
        records = _records_from_json(data, fetched_at, live_date) if data else []
        logger.info("eNAM: Liveprice_ctrl state=%s -> %d records", state_name, len(records))
        all_records.extend(records)
        time.sleep(0.25)

    return all_records


def _try_network_sniff(page: Page, target_date: date, fetched_at: datetime) -> list[PriceRecord]:
    """Load the live dashboard for real and capture whatever JSON XHR it
    fires, instead of guessing the endpoint by hand. Self-heals across
    eNAM redesigns since nothing here depends on a hardcoded URL."""
    captured: list[dict] = []

    def on_response(response: Response) -> None:
        try:
            if response.status != 200:
                return
            try:
                body_bytes = response.body()
                body_text = body_bytes.decode("utf-8", errors="replace").strip()
            except Exception:
                return
            if not body_text or body_text[0] not in ('{', '['):
                return
            try:
                body = _json.loads(body_text)
                if isinstance(body, (dict, list)):
                    captured.append({"url": response.url, "body": body})
            except Exception:
                pass
        except Exception:
            pass  # ignore consumed bodies etc.

    page.on("response", on_response)
    try:
        page.goto(ENAM_LIVE_PRICE_URL, wait_until="domcontentloaded", timeout=30000)
        time.sleep(2)

        # eNAM Live Price page has "State Wise" / "Commodity Wise" radio buttons
        # that must be clicked to trigger the actual data XHR.
        try:
            state_wise = page.get_by_label("State Wise")
            if state_wise.count() > 0:
                state_wise.first.click(timeout=8000)
                logger.info("eNAM: clicked 'State Wise' radio button")
                time.sleep(3)
        except Exception as e:
            logger.info("eNAM: could not click 'State Wise' radio: %s", e)

        # Also try search/view/go buttons as backup
        try:
            submit_btn = page.get_by_role("button", name=re.compile(r"search|submit|go|view|show|get", re.I))
            if submit_btn.count() > 0:
                submit_btn.first.click(timeout=5000)
        except Exception:
            pass

        time.sleep(4)  # let XHR land
    except Exception as exc:
        logger.warning("eNAM: network-sniff navigation failed: %s", exc)
    finally:
        try:
            page.remove_listener("response", on_response)
        except Exception:
            pass

    logger.info("eNAM: network-sniff captured %d JSON responses", len(captured))

    best_records: list[PriceRecord] = []
    for entry in captured:
        logger.info("DEBUG URL: %s", entry["url"])
        body = entry["body"]
        logger.info("DEBUG KEYS: %s", list(body.keys()) if isinstance(body, dict) else type(body))
        records = _records_from_json(body, fetched_at, target_date)
        logger.info("eNAM: candidate endpoint %s yielded %d records", entry["url"], len(records))
        if len(records) > len(best_records):
            best_records = records

    if not best_records:
        dump_diagnostics(page, "enam", "network_sniff_no_records")

    return best_records


def scrape_enam(target_date: Optional[date], page: Page) -> list[PriceRecord]:
    """
    Fetch eNAM live price data. Tries known endpoints first (cheap), then
    falls back to a live network-sniff of the dashboard page. Returns []
    (never raises) if both fail -- the calling pipeline treats this source
    as best-effort.
    """
    if target_date is None:
        target_date = date.today()
    fetched_at = datetime.now(tz=timezone.utc)
    logger.info("eNAM: starting scrape for %s", target_date)

    records = _try_liveprice_ctrl(page, target_date, fetched_at)
    if records:
        logger.info("eNAM: %d valid records for %s (Liveprice_ctrl)", len(records), target_date)
        return records

    records = _try_known_endpoints(page, target_date, fetched_at)
    if records:
        logger.info("eNAM: %d valid records for %s (known endpoints)", len(records), target_date)
        return records

    records = _try_network_sniff(page, target_date, fetched_at)
    if not records:
        logger.warning("eNAM: all strategies failed or returned no usable data for %s", target_date)

    logger.info("eNAM: %d valid records for %s", len(records), target_date)
    return records
