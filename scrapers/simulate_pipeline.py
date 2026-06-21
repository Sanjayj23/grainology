import sys
from pathlib import Path
from normalize import normalize_commodity
from db import get_db

# Colorful output
class colors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

def print_result(raw, canonical, resolved, stage):
    status = f"{colors.OKGREEN}RESOLVED{colors.ENDC}" if resolved else f"{colors.FAIL}UNRESOLVED{colors.ENDC}"
    print(f"| {raw:<20} | {status:<20} | {canonical:<15} | {colors.OKCYAN}{stage}{colors.ENDC}")

def run_simulation():
    print(f"\n{colors.HEADER}{colors.BOLD}--- Grainology Entity Resolution Pipeline Simulation ---{colors.ENDC}\n")
    print(f"| {'Raw Input':<20} | {'Status':<11}          | {'Canonical':<15} | {'Resolution Stage'}")
    print("-" * 85)

    test_cases = [
        # Stage 1 Expected (Exact Match)
        "Wheat",
        "Onion",
        # Stage 2 Expected (Alias Match if Kanda/Pyaaz is in map, otherwise falls to Stage 4 LLM)
        "Pyaaz", 
        "Kanda",
        # Stage 3 Expected (Fuzzy Match - Typos)
        "Oniun",
        "Wheaat",
        "Soyyabeen",
        # Stage 4 Expected (Semantic / LLM Match)
        "Red bulb vegetable",
        "Maize kernels",
        # Stage 5 Expected (Review Required / No Match)
        "Smartphone Model X",
        "Random Unrelated String"
    ]

    for test in test_cases:
        canonical, resolved, stage = normalize_commodity(test, source_website="Simulation")
        print_result(test, canonical, resolved, stage)
        
    print(f"\n{colors.HEADER}--- Simulation Complete ---{colors.ENDC}\n")
    
    # Show what's in the Human Review table
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT raw_text, source_website FROM Raw_Ingestion_Log")
    logs = c.fetchall()
    
    if logs:
        print(f"{colors.WARNING}Items flagged for Human Review (Stage 5):{colors.ENDC}")
        for log in logs:
            print(f"  - {log['raw_text']} (Source: {log['source_website']})")
    
    conn.close()

if __name__ == "__main__":
    run_simulation()
