from curl_cffi import requests
import re

url = "https://agmarknet.gov.in/static/js/main.260cd73f.js"
headers = {"User-Agent": "Mozilla/5.0"}
resp = requests.get(url, impersonate="chrome120")
print("Status:", resp.status_code)
js = resp.text
print("JS length:", len(js))

urls = re.findall(r'https?://[^\s\'"]+', js)
print("Found URLs:")
for u in set(urls):
    if "agmarknet" in u or "api" in u:
        print(u)
