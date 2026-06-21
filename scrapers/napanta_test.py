import urllib.request
from bs4 import BeautifulSoup
import re
import sys
import json
sys.stdout.reconfigure(encoding='utf-8')

base_url = 'https://www.napanta.com/market-price'
req = urllib.request.Request(base_url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
html = urllib.request.urlopen(req, timeout=10).read().decode('utf-8')
soup = BeautifulSoup(html, 'html.parser')

links = soup.find_all('a', href=True)
district_urls = set()
for link in links:
    href = link['href']
    if 'market-price/' in href and href != 'https://www.napanta.com/market-price':
        # looks like https://www.napanta.com/market-price/state/district
        parts = [p for p in href.split('/') if p]
        if len(parts) >= 5 and parts[-3] == 'market-price':
            state = parts[-2]
            district = parts[-1]
            district_urls.add(href)

print(f"Found {len(district_urls)} district URLs")

# Now let's try to scrape the first 2 districts
results = []
for url in list(district_urls)[:2]:
    print(f"Scraping {url}")
    try:
        r = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        res = urllib.request.urlopen(r, timeout=10).read().decode('utf-8')
        s = BeautifulSoup(res, 'html.parser')
        tables = s.find_all('table')
        if not tables:
            print("No tables found")
            continue
        rows = tables[0].find_all('tr')[1:]
        print(f"Found {len(rows)} rows")
        for row in rows[:2]:
            cells = [td.get_text(strip=True) for td in row.find_all('td')]
            print(cells)
            if len(cells) >= 6:
                results.append(cells)
    except Exception as e:
        print(f"Failed to scrape {url}: {e}")

print("Done testing Napanta.")
