import re

with open("scrapers/get_agmarknet_api.py", "r") as f:
    pass # we have the js in memory in the previous script actually

from curl_cffi import requests
js = requests.get("https://agmarknet.gov.in/static/js/main.260cd73f.js", impersonate="chrome120").text

endpoints = re.findall(r'[\'"](/v1/[^\'"]+)[\'"]', js)
print("Found API endpoints:")
for e in set(endpoints):
    print(e)
    
endpoints2 = re.findall(r'[\'"](/?api/[^\'"]+)[\'"]', js)
print("Found /api endpoints:")
for e in set(endpoints2):
    print(e)
