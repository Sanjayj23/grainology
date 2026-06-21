import sys
import time
from playwright.sync_api import sync_playwright

def main():
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        page = browser.new_page()

        print("Navigating to eNAM trade-data...")
        page.goto("https://enam.gov.in/web/dashboard/trade-data", wait_until="domcontentloaded", timeout=30000)
        time.sleep(3)

        def on_request(request):
            if "Ajax_ctrl/trade_data_list" in request.url or "trade" in request.url:
                print(f"REQUEST URL: {request.url}")
                print(f"POST DATA: {request.post_data}")

        def on_response(response):
            if "Ajax_ctrl/trade_data_list" in response.url or "trade" in response.url:
                try:
                    ctype = response.headers.get("content-type", "")
                    if "json" in ctype or "text/html" in ctype:
                        print(f"RESPONSE URL: {response.url} (Status: {response.status})")
                        body = response.body().decode("utf-8", errors="replace")
                        print("Body snippet:", body[:500])
                except Exception:
                    pass

        page.on("request", on_request)
        page.on("response", on_response)

        print("Trying to submit search...")
        try:
            # Look for any search or view button on trade-data page
            btns = page.get_by_role("button")
            for i in range(btns.count()):
                text = btns.nth(i).inner_text().lower()
                if "search" in text or "view" in text or "submit" in text:
                    print(f"Clicking button: {text}")
                    btns.nth(i).click()
                    time.sleep(3)
                    break
        except Exception as e:
            print("Failed to click:", e)
            
        print("Evaluating js to select elements if needed...")
        try:
            page.evaluate('''() => {
                let btn = document.querySelector('#btnSearch') || document.querySelector('.search-btn');
                if(btn) btn.click();
            }''')
            time.sleep(3)
        except:
            pass

        browser.close()

if __name__ == "__main__":
    main()
