"""
Shared diagnostic helper for Playwright-based scrapers.

When a site's structure changes (a new portal relaunch, a moved button, a
renamed field) a hardcoded selector breaks instantly and silently. Instead
of just logging "element not found" and leaving you to guess, every scraper
that uses this helper drops a timestamped screenshot + full HTML snapshot
into data/debug/<source>/ whenever it can't complete its job. Upload that
file (or just the screenshot) back to Claude and the actual fix becomes a
two-minute job instead of a blind retry.

The GitHub Actions workflow uploads data/debug/ as a build artifact on every
run, so these are always one click away in the Actions tab — no need to
commit them to the repo.
"""

from __future__ import annotations
import logging
from datetime import datetime, timezone
from pathlib import Path

from playwright.sync_api import Page

logger = logging.getLogger(__name__)

REPO_ROOT = Path(__file__).parent.parent
DEBUG_DIR = REPO_ROOT / "data" / "debug"


def dump_diagnostics(page: Page, source: str, reason: str) -> None:
    """Best-effort capture of a screenshot + HTML for later debugging.
    Never raises — a diagnostic failure must never crash the scraper."""
    try:
        out_dir = DEBUG_DIR / source
        out_dir.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now(tz=timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        safe_reason = "".join(c if c.isalnum() else "_" for c in reason)[:60]
        base = out_dir / f"{stamp}_{safe_reason}"

        page.screenshot(path=str(base.with_suffix(".png")), full_page=True, timeout=10000)
        base.with_suffix(".html").write_text(page.content(), encoding="utf-8")

        logger.warning(
            "%s: saved diagnostics to %s.png / .html (reason: %s) -- "
            "share these with Claude to get an exact selector fix",
            source, base.name, reason,
        )
    except Exception as exc:
        logger.debug("%s: could not save diagnostics: %s", source, exc)
