import sys
from datetime import date, timedelta
from playwright.sync_api import sync_playwright

def main():
    target_date = date.today().strftime("%Y-%m-%d")
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        page = browser.new_page()

        print("Navigating to home to get cookies...")
        page.goto("https://enam.gov.in/web/", wait_until="domcontentloaded", timeout=30000)
        
        # We need a valid ci_session cookie if they check that
        
        url = "https://enam.gov.in/web/Ajax_ctrl/trade_data_list"
        print(f"POSTing to {url}...")
        
        payloads_to_try = [
            {"language": "en", "stateName": "", "fromDate": target_date, "toDate": target_date},
            {"language": "en", "stateName": "Gujarat", "fromDate": target_date, "toDate": target_date},
            # Maybe the new endpoint expects date format like dd-MMM-yyyy or yyyy-mm-dd
            {"language": "en", "stateName": "", "fromDate": date.today().strftime("%d-%b-%Y"), "toDate": date.today().strftime("%d-%b-%Y")}
        ]
        
        for payload in payloads_to_try:
            print(f"Trying payload: {payload}")
            resp = page.request.post(
                url,
                form=payload,
                headers={
                    "X-Requested-With": "XMLHttpRequest",
                    "Referer": "https://enam.gov.in/web/dashboard/trade-data"
                }
            )
            print("Status:", resp.status)
            if resp.status == 200:
                print("Body snippet:", resp.body().decode("utf-8", errors="replace")[:300])

        browser.close()

if __name__ == "__main__":
    main()
