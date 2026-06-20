"""
Unified Pydantic schema for agricultural price data from all sources.
Every scraper must produce records conforming to this schema.
"""

from __future__ import annotations
from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, field_validator, model_validator
import json
from pathlib import Path

# Load master lists for validation
_REF_DIR = Path(__file__).parent.parent / "data" / "reference"


def _load_canonical_names(filepath: Path) -> set[str]:
    """Load canonical names from a crosswalk JSON file."""
    if not filepath.exists():
        return set()
    with open(filepath, encoding="utf-8") as f:
        data = json.load(f)
    return set(data.keys())


CANONICAL_COMMODITIES: set[str] = _load_canonical_names(
    _REF_DIR / "commodity_map.json"
)
CANONICAL_STATES: set[str] = _load_canonical_names(_REF_DIR / "state_map.json")

VALID_SOURCES = {"agmarknet", "enam", "datagovin", "indiadataportal"}


class PriceRecord(BaseModel):
    """
    Single normalized price record from any source.
    All monetary values are in ₹/quintal.
    """

    source: str
    fetched_at: datetime
    price_date: date
    state: str
    district: str
    market: str
    commodity: str
    variety: str = ""
    min_price: float
    max_price: float
    modal_price: float
    arrivals_tonnes: Optional[float] = None
    raw_source_name: str = ""  # original un-normalized commodity name

    @field_validator("source")
    @classmethod
    def validate_source(cls, v: str) -> str:
        if v not in VALID_SOURCES:
            raise ValueError(f"source must be one of {VALID_SOURCES}, got {v!r}")
        return v

    @field_validator("min_price", "max_price", "modal_price")
    @classmethod
    def validate_price(cls, v: float) -> float:
        if v <= 0:
            raise ValueError(f"Price must be positive, got {v}")
        if v > 200_000:
            raise ValueError(f"Price {v} seems unrealistically high (>₹2,00,000/quintal)")
        return round(v, 2)

    @field_validator("price_date")
    @classmethod
    def validate_date(cls, v: date) -> date:
        from datetime import date as _date
        if v > _date.today():
            raise ValueError(f"price_date {v} is in the future")
        return v

    @field_validator("arrivals_tonnes")
    @classmethod
    def validate_arrivals(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and v < 0:
            raise ValueError(f"arrivals_tonnes must be non-negative, got {v}")
        return v

    @model_validator(mode="after")
    def validate_price_ordering(self) -> "PriceRecord":
        if not (self.min_price <= self.modal_price <= self.max_price):
            # Sometimes sources report inverted; try to fix silently
            prices = sorted([self.min_price, self.modal_price, self.max_price])
            self.min_price, self.modal_price, self.max_price = prices
        return self

    def to_dict(self) -> dict:
        return {
            "source": self.source,
            "fetched_at": self.fetched_at.isoformat(),
            "price_date": self.price_date.isoformat(),
            "state": self.state,
            "district": self.district,
            "market": self.market,
            "commodity": self.commodity,
            "variety": self.variety,
            "min_price": self.min_price,
            "max_price": self.max_price,
            "modal_price": self.modal_price,
            "arrivals_tonnes": self.arrivals_tonnes,
            "raw_source_name": self.raw_source_name,
        }


class ScrapeRun(BaseModel):
    """Single row in scrape_log.csv"""

    run_id: str
    source: str
    started_at: datetime
    finished_at: datetime
    records_fetched: int
    records_valid: int
    records_rejected: int
    status: str  # "success" | "partial" | "failed"
    error_message: str = ""

    def to_dict(self) -> dict:
        return {
            "run_id": self.run_id,
            "source": self.source,
            "started_at": self.started_at.isoformat(),
            "finished_at": self.finished_at.isoformat(),
            "records_fetched": self.records_fetched,
            "records_valid": self.records_valid,
            "records_rejected": self.records_rejected,
            "status": self.status,
            "error_message": self.error_message,
        }
