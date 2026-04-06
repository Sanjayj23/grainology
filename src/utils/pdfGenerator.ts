// PDF Generator utility for confirmed orders
export const generateOrderPDF = (order: any, orderType: 'sales' | 'purchase') => {
  const toUpperText = (value: unknown) => String(value ?? '').trim().toUpperCase();
  const toUpperOrNA = (value: unknown) => {
    const normalized = toUpperText(value);
    return normalized || 'N/A';
  };

  // Create a printable HTML content
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${orderType === 'sales' ? 'Sales' : 'Purchase'} Order - ${order.invoice_number}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          padding: 20px;
          color: #333;
        }
        .header {
          text-align: center;
          border-bottom: 3px solid #16a34a;
          padding-bottom: 20px;
          margin-bottom: 30px;
        }
        .header h1 {
          color: #16a34a;
          margin: 0;
        }
        .order-type {
          display: inline-block;
          padding: 5px 15px;
          background: ${orderType === 'sales' ? '#dcfce7' : '#dbeafe'};
          color: ${orderType === 'sales' ? '#166534' : '#1e40af'};
          border-radius: 5px;
          font-weight: bold;
          margin-top: 10px;
        }
        .section {
          margin-bottom: 25px;
          page-break-inside: avoid;
        }
        .section-title {
          background: #f3f4f6;
          padding: 10px;
          font-weight: bold;
          border-left: 4px solid #16a34a;
          margin-bottom: 15px;
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 15px;
        }
        .field {
          margin-bottom: 10px;
        }
        .field-label {
          font-weight: bold;
          color: #666;
          font-size: 12px;
        }
        .field-value {
          font-size: 14px;
          color: #333;
        }
        .amount-highlight {
          background: #fef3c7;
          padding: 10px;
          border-radius: 5px;
          font-weight: bold;
        }
        .deduction-item {
          background: #f9fafb;
          padding: 10px;
          margin-bottom: 10px;
          border-left: 3px solid #ef4444;
          border-radius: 3px;
        }
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 2px solid #e5e7eb;
          text-align: center;
          color: #666;
          font-size: 12px;
        }
        @media print {
          body { margin: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Grainology</h1>
        <div class="order-type">${orderType === 'sales' ? 'SALES ORDER' : 'PURCHASE ORDER'}</div>
        <p style="margin-top: 10px;">Invoice: ${order.invoice_number}</p>
      </div>

      <div class="section">
        <div class="section-title">Customer Information</div>
        <div class="grid">
          <div class="field">
            <div class="field-label">Customer Name</div>
            <div class="field-value">${order.customer_id?.name || 'N/A'}</div>
          </div>
          <div class="field">
            <div class="field-label">Email</div>
            <div class="field-value">${order.customer_id?.email || 'N/A'}</div>
          </div>
          <div class="field">
            <div class="field-label">Mobile</div>
            <div class="field-value">${order.customer_id?.mobile_number || 'N/A'}</div>
          </div>
          <div class="field">
            <div class="field-label">Transaction Date</div>
            <div class="field-value">${new Date(order.transaction_date).toLocaleDateString('en-IN')}</div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Commodity Details</div>
        <div class="grid">
          <div class="field">
            <div class="field-label">Commodity</div>
            <div class="field-value">${toUpperOrNA(order.commodity)}</div>
          </div>
          <div class="field">
            <div class="field-label">Variety</div>
            <div class="field-value">${toUpperOrNA(order.variety)}</div>
          </div>
          <div class="field">
            <div class="field-label">${orderType === 'sales' ? 'Seller' : 'Supplier'} Name</div>
            <div class="field-value">${orderType === 'sales' ? order.seller_name : order.supplier_name || 'N/A'}</div>
          </div>
          <div class="field">
            <div class="field-label">State</div>
            <div class="field-value">${toUpperOrNA(order.state)}</div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Vehicle & Weight Details</div>
        <div class="grid">
          <div class="field">
            <div class="field-label">Vehicle No.</div>
            <div class="field-value">${order.vehicle_no}</div>
          </div>
          <div class="field">
            <div class="field-label">Weight Slip No.</div>
            <div class="field-value">${order.weight_slip_no || 'N/A'}</div>
          </div>
          <div class="field">
            <div class="field-label">Gross Weight (MT)</div>
            <div class="field-value">${order.gross_weight_mt?.toFixed(2) || 'N/A'}</div>
          </div>
          <div class="field">
            <div class="field-label">Tare Weight (MT)</div>
            <div class="field-value">${order.tare_weight_mt?.toFixed(2) || 'N/A'}</div>
          </div>
          <div class="field">
            <div class="field-label">Net Weight (MT)</div>
            <div class="field-value"><strong>${order.net_weight_mt?.toFixed(2)}</strong></div>
          </div>
          <div class="field">
            <div class="field-label">No. of Bags</div>
            <div class="field-value">${order.no_of_bags || 'N/A'}</div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Financial Details</div>
        <div class="grid">
          <div class="field">
            <div class="field-label">Rate Per MT</div>
            <div class="field-value">₹${order.rate_per_mt?.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
          </div>
          <div class="field">
            <div class="field-label">Gross Amount</div>
            <div class="field-value amount-highlight">₹${order.gross_amount?.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
          </div>
        </div>
      </div>

      ${order.deduction_amount_hlw || order.deduction_amount_moi_bdoi || order.deduction_amount_moi_bddi ? `
      <div class="section">
        <div class="section-title">Quality Deductions</div>
        <div class="grid">
          ${order.deduction_amount_hlw ? `
          <div class="field">
            <div class="field-label">HLW Deduction</div>
            <div class="field-value">₹${order.deduction_amount_hlw.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
          </div>
          ` : ''}
          ${order.deduction_amount_moi_bdoi || order.deduction_amount_moi_bddi ? `
          <div class="field">
            <div class="field-label">${orderType === 'sales' ? 'MOI+BDOI' : 'MOI+BDDI'} Deduction</div>
            <div class="field-value">₹${(order.deduction_amount_moi_bdoi || order.deduction_amount_moi_bddi).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
          </div>
          ` : ''}
        </div>
      </div>
      ` : ''}

      ${order.other_deductions && order.other_deductions.length > 0 ? `
      <div class="section">
        <div class="section-title">Other Deductions</div>
        ${order.other_deductions.map((ded: any, index: number) => `
          <div class="deduction-item">
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
              <strong>Deduction ${index + 1}</strong>
              <strong style="color: #dc2626;">₹${ded.amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong>
            </div>
            ${ded.remarks ? `<div style="color: #666; font-size: 12px;"><em>${ded.remarks}</em></div>` : ''}
          </div>
        `).join('')}
      </div>
      ` : ''}

      <div class="section">
        <div class="section-title">Final Amount</div>
        <div style="background: #dcfce7; padding: 20px; border-radius: 5px; text-align: center;">
          <div style="font-size: 12px; color: #666; margin-bottom: 5px;">Total Deduction</div>
          <div style="font-size: 18px; color: #dc2626; font-weight: bold; margin-bottom: 15px;">
            ₹${(order.total_deduction || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
          <div style="font-size: 12px; color: #666; margin-bottom: 5px;">Net Amount</div>
          <div style="font-size: 32px; color: #16a34a; font-weight: bold;">
            ₹${order.net_amount?.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      ${order.remarks ? `
      <div class="section">
        <div class="section-title">Remarks</div>
        <div style="padding: 10px; background: #f9fafb; border-radius: 5px;">
          ${order.remarks}
        </div>
      </div>
      ` : ''}

      <div class="footer">
        <p>Generated on ${new Date().toLocaleString('en-IN')}</p>
        <p>Grainology - Agricultural Trading Platform</p>
      </div>
    </body>
    </html>
  `;

  // Open print dialog
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    // Wait for content to load, then print
    setTimeout(() => {
      printWindow.print();
    }, 250);
  }
};
