from curl_cffi import requests
from bs4 import BeautifulSoup

def test_agmarknet():
    print("Testing Agmarknet with curl_cffi...")
    url = "https://agmarknet.gov.in/SearchCommodityDis.aspx"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    }
    try:
        session = requests.Session(impersonate="chrome120")
        resp = session.get(url, headers=headers, timeout=30)
        print("GET Status:", resp.status_code)
        print("HTML starts with:", resp.text[:1000])
        
        soup = BeautifulSoup(resp.text, "html.parser")
        viewstate = soup.find("input", {"name": "__VIEWSTATE"})["value"]
        eventvalidation = soup.find("input", {"name": "__EVENTVALIDATION"})["value"]
        generator = soup.find("input", {"name": "__VIEWSTATEGENERATOR"})["value"]
        print("Found VIEWSTATE length:", len(viewstate))
        
        form_data = {
            "__VIEWSTATE": viewstate,
            "__VIEWSTATEGENERATOR": generator,
            "__EVENTVALIDATION": eventvalidation,
            "ctl00$cphBody$ddlCommodity": "0",
            "ctl00$cphBody$ddlState": "0",
            "ctl00$cphBody$ddlDistrict": "0",
            "ctl00$cphBody$ddlMarket": "0",
            "ctl00$cphBody$txtDate": "20-Jun-2026",
            "ctl00$cphBody$btnGo": "Submit",
        }
        
        resp2 = session.post(url, data=form_data, headers=headers, timeout=30)
        print("POST Status:", resp2.status_code)
        
        soup2 = BeautifulSoup(resp2.text, "html.parser")
        table = soup2.find("table", {"id": "cphBody_GridPriceData"})
        if table:
            rows = table.find_all("tr")
            print("Found table with rows:", len(rows))
        else:
            print("No table found.")
            
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    test_agmarknet()
