"""
Name normalization: maps raw source-specific names to canonical names
using the crosswalk JSON files in data/reference/.
"""

from __future__ import annotations
import json
import logging
from pathlib import Path
from functools import lru_cache

logger = logging.getLogger(__name__)

_REF_DIR = Path(__file__).parent.parent / "data" / "reference"


@lru_cache(maxsize=1)
def _load_commodity_map() -> dict[str, str]:
    """Returns {raw_name_lower: canonical_name}"""
    path = _REF_DIR / "commodity_map.json"
    if not path.exists():
        logger.warning("commodity_map.json not found at %s", path)
        return {}
    with open(path, encoding="utf-8") as f:
        data: dict[str, list[str]] = json.load(f)
    mapping: dict[str, str] = {}
    for canonical, variants in data.items():
        mapping[canonical.lower()] = canonical
        for v in variants:
            mapping[v.lower()] = canonical
    return mapping


@lru_cache(maxsize=1)
def _load_market_map() -> dict[str, str]:
    """Returns {raw_market_lower: canonical_market}"""
    path = _REF_DIR / "market_map.json"
    if not path.exists():
        logger.warning("market_map.json not found at %s", path)
        return {}
    with open(path, encoding="utf-8") as f:
        data: dict[str, list[str]] = json.load(f)
    mapping: dict[str, str] = {}
    for canonical, variants in data.items():
        mapping[canonical.lower()] = canonical
        for v in variants:
            mapping[v.lower()] = canonical
    return mapping


@lru_cache(maxsize=1)
def _load_state_map() -> dict[str, str]:
    """Returns {raw_state_lower: canonical_state}"""
    path = _REF_DIR / "state_map.json"
    if not path.exists():
        return {}
    with open(path, encoding="utf-8") as f:
        data: dict[str, list[str]] = json.load(f)
    mapping: dict[str, str] = {}
    for canonical, variants in data.items():
        mapping[canonical.lower()] = canonical
        for v in variants:
            mapping[v.lower()] = canonical
    return mapping


def normalize_commodity(raw: str) -> tuple[str, bool]:
    """
    Returns (canonical_name, was_found).
    If not found, returns (title-cased raw, False) so data isn't dropped.
    """
    raw_stripped = raw.strip()
    mapping = _load_commodity_map()
    canonical = mapping.get(raw_stripped.lower())
    if canonical:
        return canonical, True
    # Try partial match (e.g. "Onion(Red)" → "Onion")
    for key, val in mapping.items():
        if key in raw_stripped.lower() or raw_stripped.lower() in key:
            logger.debug("Partial commodity match: %r → %r", raw_stripped, val)
            return val, True
    logger.debug("No commodity match for %r — using raw title-cased", raw_stripped)
    return raw_stripped.title(), False


def normalize_market(raw_market: str, raw_district: str, raw_state: str) -> tuple[str, str, str, bool]:
    """
    Returns (canonical_market, canonical_district, canonical_state, was_found).
    """
    market_map = _load_market_map()
    state_map = _load_state_map()

    canonical_state = state_map.get(raw_state.strip().lower(), raw_state.strip().title())
    canonical_market = market_map.get(raw_market.strip().lower(), raw_market.strip().title())
    canonical_district = raw_district.strip().title()

    found = raw_market.strip().lower() in market_map
    return canonical_market, canonical_district, canonical_state, found


def reload_maps() -> None:
    """Clear LRU cache to reload crosswalk files after updates."""
    _load_commodity_map.cache_clear()
    _load_market_map.cache_clear()
    _load_state_map.cache_clear()
