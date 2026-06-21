import sys
from datetime import date, timedelta
from playwright.sync_api import sync_playwright

def main():
    with sync_playwright() as pw:
        # Run headful to bypass bot detection
        browser = pw.chromium.launch(headless=False)
        page = browser.new_page()

        print("Navigating to eNAM trade-data...")
        try:
            page.goto("https://enam.gov.in/web/dashboard/trade-data", wait_until="domcontentloaded", timeout=60000)
        except Exception as e:
            print("Failed to load page:", e)
            browser.close()
            return

        def on_response(response):
            if "Ajax_ctrl/trade_data_list" in response.url or "trade" in response.url.lower():
                try:
                    ctype = response.headers.get("content-type", "")
                    if "json" in ctype or "text/html" in ctype:
                        print(f"RESPONSE URL: {response.url} (Status: {response.status})")
                        body = response.body().decode("utf-8", errors="replace")
                        print("Body snippet:", body[:500])
                except Exception:
                    pass
        page.on("response", on_response)

        print("Waiting a bit for initial load...")
        page.wait_for_timeout(5000)
        
        print("Looking for Search button...")
        try:
            # Let's find the search button and click it
            page.evaluate('''() => {
                let btn = document.querySelector('#btnSearch') || document.querySelector('.search-btn') || Array.from(document.querySelectorAll('button')).find(el => el.textContent.toLowerCase().includes('search'));
                if(btn) { console.log("Clicking button"); btn.click(); }
            }''')
        except Exception as e:
            print("Failed to click:", e)

        print("Waiting for data...")
        page.wait_for_timeout(10000)

        browser.close()

if __name__ == "__main__":
    main()
