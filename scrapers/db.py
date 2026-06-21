import sqlite3
import os
import json
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "data" / "entity_resolution.db"

def get_db():
    # Ensure data directory exists
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    c = conn.cursor()
    
    # 1. Commodity_Master
    c.execute('''
        CREATE TABLE IF NOT EXISTS Commodity_Master (
            commodity_id INTEGER PRIMARY KEY AUTOINCREMENT,
            standard_name TEXT UNIQUE NOT NULL,
            category TEXT
        )
    ''')
    
    # 2. Commodity_Alias_Mapping
    c.execute('''
        CREATE TABLE IF NOT EXISTS Commodity_Alias_Mapping (
            alias_id INTEGER PRIMARY KEY AUTOINCREMENT,
            alias_name TEXT UNIQUE NOT NULL,
            commodity_id INTEGER NOT NULL,
            confidence_score REAL,
            source_stage TEXT,
            FOREIGN KEY(commodity_id) REFERENCES Commodity_Master(commodity_id)
        )
    ''')
    
    # 3. Raw_Ingestion_Log
    c.execute('''
        CREATE TABLE IF NOT EXISTS Raw_Ingestion_Log (
            log_id INTEGER PRIMARY KEY AUTOINCREMENT,
            raw_text TEXT NOT NULL,
            source_website TEXT,
            status TEXT
        )
    ''')
    
    conn.commit()
    conn.close()

def seed_db():
    """Seed the database with data from reference/commodity_map.json."""
    init_db()
    conn = get_db()
    c = conn.cursor()
    
    ref_dir = Path(__file__).parent.parent / "data" / "reference"
    com_map_path = ref_dir / "commodity_map.json"
    
    if com_map_path.exists():
        with open(com_map_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        for canonical, variants in data.items():
            # Insert into Master
            c.execute('''
                INSERT OR IGNORE INTO Commodity_Master (standard_name, category) 
                VALUES (?, ?)
            ''', (canonical, "Unknown"))
            
            c.execute('SELECT commodity_id FROM Commodity_Master WHERE standard_name = ?', (canonical,))
            row = c.fetchone()
            if not row: continue
            c_id = row['commodity_id']
            
            # Insert self as alias
            c.execute('''
                INSERT OR IGNORE INTO Commodity_Alias_Mapping (alias_name, commodity_id, confidence_score, source_stage)
                VALUES (?, ?, ?, ?)
            ''', (canonical.lower(), c_id, 1.0, "System"))
            
            # Insert variants
            for v in variants:
                c.execute('''
                    INSERT OR IGNORE INTO Commodity_Alias_Mapping (alias_name, commodity_id, confidence_score, source_stage)
                    VALUES (?, ?, ?, ?)
                ''', (v.lower(), c_id, 1.0, "System"))
                
    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
    seed_db()
    print("Database initialized and seeded.")
