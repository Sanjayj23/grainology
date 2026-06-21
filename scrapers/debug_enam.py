import sys
import time
from playwright.sync_api import sync_playwright

def main():
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        page = browser.new_page()

        print("Navigating to eNAM live price...")
        page.goto("https://enam.gov.in/web/dashboard/live_price", wait_until="domcontentloaded", timeout=30000)
        time.sleep(3)

        def on_response(response):
            try:
                ctype = response.headers.get("content-type", "")
                if "json" in ctype:
                    print(f"JSON Response: {response.url} (Status: {response.status})")
                    # Try to read body
                    body = response.body().decode("utf-8", errors="replace")
                    print("Body summary:", body[:300])
            except Exception:
                pass

        page.on("response", on_response)

        print("Clicking 'State Wise'...")
        try:
            state_wise = page.get_by_label("State Wise")
            if state_wise.count() > 0:
                state_wise.first.click(timeout=8000)
                time.sleep(3)
        except Exception as e:
            print("Failed to click State Wise:", e)

        print("Selecting state via JS...")
        try:
            page.evaluate('''() => {
                let sel = document.querySelector('select');
                if (sel && sel.options.length > 1) {
                    sel.value = sel.options[2].value;
                    sel.dispatchEvent(new Event('change'));
                }
            }''')
            time.sleep(5)
        except Exception as e:
            print("Failed to select state:", e)
            
        print("Page text after selection:")
        try:
            # Just print the text in the table or the main div
            text = page.evaluate("() => document.body.innerText")
            lines = [line for line in text.split('\\n') if line.strip()][:50]
            print('\\n'.join(lines))
        except:
            pass

        browser.close()

if __name__ == "__main__":
    main()
