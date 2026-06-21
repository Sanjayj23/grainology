const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function scrapeEnam(page) {
    console.log("Scraping eNAM...");
    const url = `https://enam.gov.in/web/ajax_ctrl/commodity_arrivals_list?language=en&date=${new Date().toISOString().split('T')[0]}`;
    
    // Go to homepage first to get cookies and pass Cloudflare
    await page.goto('https://enam.gov.in/web/', { waitUntil: 'networkidle' });
    
    await page.goto(url, { waitUntil: 'networkidle' });
    const content = await page.evaluate(() => document.body.innerText);
    const response = JSON.parse(content);

    const records = response.data || response || [];
    console.log(`eNAM returned ${records.length} records.`);
    
    // Normalize and save
    const normalized = records.map(r => ({
        source: "enam",
        fetched_at: new Date().toISOString(),
        price_date: new Date().toISOString().split('T')[0],
        state: r.stateName || r.state || "",
        district: r.districtName || r.district || "",
        market: r.apmc || r.mandiName || r.market || "",
        commodity: r.commodity || r.commodityName || "",
        variety: r.variety || r.varietyName || "",
        min_price: Math.max(parseFloat((r.minPrice || r.min_price || 0).toString().replace(/,/g, '')), 0.01),
        max_price: Math.max(parseFloat((r.maxPrice || r.max_price || 0).toString().replace(/,/g, '')), 0.01),
        modal_price: Math.max(parseFloat((r.modalPrice || r.modal_price || 0).toString().replace(/,/g, '')), 0.01),
        arrivals_tonnes: parseFloat((r.arrivals || r.totalArrival || 0).toString().replace(/,/g, '')) || null,
        raw_source_name: r.commodity || r.commodityName || ""
    })).filter(r => r.commodity && r.state);
    
    fs.writeFileSync(path.join(__dirname, '../data/latest/enam.json'), JSON.stringify(normalized, null, 2));
    console.log(`Saved ${normalized.length} eNAM records.`);
}

async function scrapeIDP(page) {
    console.log("Scraping IndiaDataPortal...");
    const url = "https://indiadataportal.com/api/v1/agri/mandi-prices?limit=5000&format=json";
    
    await page.goto(url, { waitUntil: 'networkidle' });
    const content = await page.evaluate(() => document.body.innerText);
    const response = JSON.parse(content);

    const records = response.data || response.records || response || [];
    console.log(`IDP returned ${records.length} records.`);
    
    const normalized = records.map(r => ({
        source: "indiadataportal",
        fetched_at: new Date().toISOString(),
        price_date: r.date || r.arrival_date || new Date().toISOString().split('T')[0],
        state: r.state || r.State || "",
        district: r.district || r.District || "",
        market: r.market || r.Market || r.mandi || "",
        commodity: r.commodity || r.Commodity || "",
        variety: r.variety || r.Variety || "",
        min_price: Math.max(parseFloat((r.min_price || r.Min_Price || 0).toString().replace(/,/g, '')), 0.01),
        max_price: Math.max(parseFloat((r.max_price || r.Max_Price || 0).toString().replace(/,/g, '')), 0.01),
        modal_price: Math.max(parseFloat((r.modal_price || r.Modal_Price || 0).toString().replace(/,/g, '')), 0.01),
        arrivals_tonnes: null,
        raw_source_name: r.commodity || r.Commodity || ""
    })).filter(r => r.commodity && r.state);

    fs.writeFileSync(path.join(__dirname, '../data/latest/indiadataportal.json'), JSON.stringify(normalized, null, 2));
    console.log(`Saved ${normalized.length} IDP records.`);
}

async function main() {
    console.log("Launching Chromium...");
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
    });
    const page = await context.newPage();

    try {
        await scrapeEnam(page);
    } catch (e) {
        console.error("eNAM Error:", e);
    }

    try {
        await scrapeIDP(page);
    } catch (e) {
        console.error("IDP Error:", e);
    }

    await browser.close();
    console.log("Done.");
}

main();
