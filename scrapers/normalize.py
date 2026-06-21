"""
Name normalization: implements the 5-stage Hybrid Entity Resolution Pipeline.
Zero external dependencies version.
"""

from __future__ import annotations
import logging
import json
import urllib.request
import urllib.error
import difflib
from db import get_db, init_db, seed_db

logger = logging.getLogger(__name__)

# Ensure DB is seeded on module load
init_db()
seed_db()

def _log_unresolved(raw_text: str, source_website: str):
    conn = get_db()
    conn.execute(
        "INSERT INTO Raw_Ingestion_Log (raw_text, source_website, status) VALUES (?, ?, ?)",
        (raw_text, source_website, "Review_Required")
    )
    conn.commit()
    conn.close()

def _add_alias(alias_name: str, commodity_id: int, confidence: float, stage: str):
    conn = get_db()
    try:
        conn.execute(
            "INSERT INTO Commodity_Alias_Mapping (alias_name, commodity_id, confidence_score, source_stage) VALUES (?, ?, ?, ?)",
            (alias_name.lower(), commodity_id, confidence, stage)
        )
        conn.commit()
    except Exception as e:
        logger.debug(f"Alias insert failed (maybe duplicate): {e}")
    finally:
        conn.close()

def _call_gemini_api(prompt: str) -> str:
    # Use the user-provided key for the simulation via REST
    api_key = os.environ.get("GEMINI_API_KEY", "")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key={api_key}"
    headers = {"Content-Type": "application/json"}
    data = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.0
        }
    }
    req = urllib.request.Request(url, data=json.dumps(data).encode("utf-8"), headers=headers)
    try:
        with urllib.request.urlopen(req) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            return res_data["candidates"][0]["content"]["parts"][0]["text"].strip()
    except Exception as e:
        logger.warning(f"Gemini API call failed: {e}")
        return "NO MATCH"

def normalize_commodity(raw: str, source_website: str = "Unknown") -> tuple[str, bool, str]:
    """
    5-Stage Pipeline:
    Returns (canonical_name, was_resolved, stage_resolved)
    """
    raw_stripped = raw.strip()
    raw_lower = raw_stripped.lower()
    
    conn = get_db()
    conn.row_factory = dict_factory
    c = conn.cursor()
    
    # STAGE 1: Exact Match
    c.execute("SELECT commodity_id, standard_name FROM Commodity_Master WHERE LOWER(standard_name) = ?", (raw_lower,))
    row = c.fetchone()
    if row:
        conn.close()
        return row['standard_name'], True, "1. Exact Match"
        
    # STAGE 2: Historic Alias
    c.execute('''
        SELECT m.standard_name, m.commodity_id 
        FROM Commodity_Alias_Mapping a
        JOIN Commodity_Master m ON a.commodity_id = m.commodity_id
        WHERE a.alias_name = ?
    ''', (raw_lower,))
    row = c.fetchone()
    if row:
        conn.close()
        return row['standard_name'], True, "2. Alias Table"

    # STAGE 3: Fuzzy Match (Using built-in difflib)
    c.execute("SELECT commodity_id, standard_name FROM Commodity_Master")
    all_masters = c.fetchall()
    
    best_match = None
    best_score = 0
    best_id = None
    
    for m in all_masters:
        # Using difflib ratio (returns 0.0 to 1.0)
        score = difflib.SequenceMatcher(None, raw_lower, m['standard_name'].lower()).ratio() * 100.0
        if score > best_score:
            best_score = score
            best_match = m['standard_name']
            best_id = m['commodity_id']
            
    if best_score >= 80.0:
        _add_alias(raw_lower, best_id, best_score/100.0, "3. Fuzzy Match")
        conn.close()
        return best_match, True, f"3. Fuzzy ({best_score:.1f}%)"
        
    # STAGE 4: Semantic / LLM Match (via REST)
    master_names = [m['standard_name'] for m in all_masters]
    prompt = f"Map the agricultural commodity name '{raw_stripped}' to the closest exact match from this list: {master_names}. If there is no logical match, reply strictly with 'NO MATCH'. Reply ONLY with the matched name or 'NO MATCH'. Do not provide explanations."
    
    result = _call_gemini_api(prompt)
    
    if result != 'NO MATCH' and result in master_names:
        c.execute("SELECT commodity_id FROM Commodity_Master WHERE standard_name = ?", (result,))
        match_id = c.fetchone()['commodity_id']
        _add_alias(raw_lower, match_id, 0.95, "4. LLM Semantic")
        conn.close()
        return result, True, "4. LLM Semantic"

    conn.close()
    
    # STAGE 5: Human in the loop Fallback
    _log_unresolved(raw_stripped, source_website)
    return raw_stripped.title(), False, "5. Review Required"


def normalize_market(raw_market: str, raw_district: str, raw_state: str) -> tuple[str, str, str, bool]:
    return raw_market.title(), raw_district.title(), raw_state.title(), True

def dict_factory(cursor, row):
    d = {}
    for idx, col in enumerate(cursor.description):
        d[col[0]] = row[idx]
    return d

def reload_maps() -> None:
    pass
