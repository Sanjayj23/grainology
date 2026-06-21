import * as fs from 'fs';

async function run() {
  const targetUrl = 'https://enam.gov.in/web/Ajax_ctrl/trade_data_list';
  const today = new Date().toISOString().split('T')[0];
  
  // Try passing specific states
  const states = ['Gujarat', 'Maharashtra', 'Uttar Pradesh'];
  
  for (const state of states) {
      const params = new URLSearchParams();
      params.append('language', 'en');
      params.append('stateName', state);
      params.append('commodityName', '');
      params.append('apmcName', '');
      params.append('fromDate', 'NA');
      params.append('toDate', today);
      
      console.log(`Testing state: ${state}`);
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
            'X-Requested-With': 'XMLHttpRequest',
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'Referer': 'https://enam.gov.in/web/dashboard/trade-data',
            'Origin': 'https://enam.gov.in'
        },
        body: params.toString()
      });

      const text = await response.text();
      console.log(`Response length: ${text.length}, content: ${text.substring(0, 50)}`);
  }
}

run();
