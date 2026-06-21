import urllib.request
import re

url = 'https://agmarknet.gov.in/static/js/main.260cd73f.js'
res = urllib.request.urlopen(url).read().decode('utf-8', errors='ignore')

# Match endpoints like /v1/mandi/prices or /mandi/daily
endpoints = re.findall(r'\"(/[a-zA-Z0-9/\-\_]+)\"', res)
print('All paths:')
for e in set(endpoints):
    if len(e) > 3 and not e.endswith('.js'):
        print('  ', e)
