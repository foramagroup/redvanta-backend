// src/templates/orderEmails.js
// Templates hardcodés (fallback si absents en DB)

import  SettingService  from '../../services/superadmin/settingService.js';      
const appName = await SettingService.getCompanyName(); 

// ─── Email client — confirmation de commande ─────────────────
export function buildOrderConfirmationCustomer({ order, items, currency, displayTotal }) {
  const itemRows = items.map((item) =>
    `<tr>
      <td style="padding:8px 0;border-bottom:1px solid #2a2a2a;font-size:13px">${item.productName}</td>
      <td style="padding:8px 0;border-bottom:1px solid #2a2a2a;font-size:13px;text-align:center">${item.totalCards} cartes</td>
      <td style="padding:8px 0;border-bottom:1px solid #2a2a2a;font-size:13px;text-align:right">${item.displayLineTotal} ${currency}</td>
    </tr>`
  ).join("");

  return {
    subject: `Order Confirmation #${order.orderNumber} — ${appName}`,
    html: `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#0d0d0d;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#fff">
<div style="max-width:600px;margin:40px auto;background:#111;border-radius:12px;overflow:hidden">
  <div style="background:#E10600;padding:28px 40px">
    <h1 style="margin:0;font-size:22px;font-weight:700;color:#fff">${appName}</h1>
    <p style="margin:6px 0 0;color:rgba(255,255,255,.8);font-size:13px">Order Confirmation</p>
  </div>
  <div style="padding:36px 40px">
    <p style="font-size:16px;margin:0 0 20px">Hello <strong>{{customer_name}}</strong>,</p>
    <p style="color:#aaa;font-size:14px;line-height:1.6;margin:0 0 24px">
      Your order <strong style="color:#fff">#{{order_number}}</strong> has been received and is currently being processed.
      Your NFC cards will be manufactured and shipped within 2 to 5 business days.
    </p>

    <div style="background:#1a1a1a;border-radius:8px;padding:20px;margin-bottom:24px">
      <h3 style="margin:0 0 16px;font-size:14px;font-weight:600;color:#aaa;text-transform:uppercase;letter-spacing:.5px">Summary</h3>
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr>
            <th style="text-align:left;font-size:11px;color:#666;padding-bottom:8px">PRODUCT</th>
            <th style="text-align:center;font-size:11px;color:#666;padding-bottom:8px">QUANTITY</th>
            <th style="text-align:right;font-size:11px;color:#666;padding-bottom:8px">AMOUNT</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>
      <div style="margin-top:12px;padding-top:12px;border-top:1px solid #2a2a2a">
        <div style="display:flex;justify-content:space-between;font-size:13px;color:#aaa;margin-bottom:6px">
          <span>Subtotal</span><span>{{subtotal}} {{currency}}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:13px;color:#aaa;margin-bottom:8px">
          <span>Shipping ({{shipping_method}})</span><span>{{shipping_cost}} {{currency}}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:700">
          <span>Total</span><span style="color:#E10600">{{total}} {{currency}}</span>
        </div>
      </div>
    </div>

    <div style="background:#1a1a1a;border-radius:8px;padding:20px;margin-bottom:24px">
      <h3 style="margin:0 0 12px;font-size:14px;font-weight:600;color:#aaa;text-transform:uppercase;letter-spacing:.5px">Shipping Address</h3>
      <p style="margin:0;font-size:13px;color:#ddd;line-height:1.8">
        {{shipping_name}}<br>{{shipping_address}}<br>{{shipping_city}}, {{shipping_state}} {{shipping_zip}}<br>{{shipping_country}}
      </p>
    </div>

    <p style="font-size:13px;color:#aaa;line-height:1.6">
      You will receive a tracking email as soon as your order ships.<br>
      Any questions? Contact us: <a href="mailto:support@opinoor.com" style="color:#E10600">support@opinoor.com</a>
    </p>
  </div>
  <div style="background:#0d0d0d;padding:20px 40px;text-align:center;font-size:11px;color:#555">
    © ${new Date().getFullYear()} ${appName} — Order #{{order_number}}
  </div>
</div>
</body></html>`,
    text: `Order #{{order_number}} confirmed. Total: {{total}} {{currency}}. Thank you for your purchase!`,
  };
}

// ─── Email admin — notification nouvelle commande ─────────────
export function buildOrderNotificationAdmin({ order, items, companyName, currency, displayTotal }) {
  const itemLines = items.map((i) =>
    `• ${i.productName} × ${i.totalCards} cartes — ${i.displayLineTotal} ${currency}`
  ).join("\n");

  return {
    subject: `🛒 New Order #${order.orderNumber} — ${companyName}`,
    html: `<!DOCTYPE html>
  <html><head><meta charset="UTF-8"/></head>
  <body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
    <div style="background:#E10600;padding:24px 32px">
      <h1 style="margin:0;font-size:18px;font-weight:700;color:#fff">New Order Received</h1>
      <p style="margin:4px 0 0;color:rgba(255,255,255,.85);font-size:13px">#{{order_number}} · {{company_name}}</p>
    </div>
    <div style="padding:28px 32px">
      <p style="font-size:14px;color:#3d3d3a;margin:0 0 20px">
        The company <strong>{{company_name}}</strong> has just placed an order.
      </p>
      <div style="background:#f8f8f6;border-radius:8px;padding:16px;margin-bottom:20px;font-size:13px;color:#3d3d3a">
        <p style="margin:0 0 8px"><strong>Order:</strong> #{{order_number}}</p>
        <p style="margin:0 0 8px"><strong>Total:</strong> {{total}} {{currency}}</p>
        <p style="margin:0 0 8px"><strong>Shipping:</strong> {{shipping_method}} → {{shipping_city}}, {{shipping_country}}</p>
        <p style="margin:0"><strong>Status:</strong> Awaiting manufacturing</p>
      </div>
      <div style="background:#f8f8f6;border-radius:8px;padding:16px;font-size:13px;color:#3d3d3a">
        <p style="margin:0 0 8px;font-weight:600">Items</p>
        {{items_html}}
      </div>
    </div>
    <div style="background:#f4f4f5;padding:16px 32px;text-align:center;font-size:11px;color:#a1a1aa">
      © ${new Date().getFullYear()} ${appName} · Automatic email
    </div>
  </div>
  </body></html>`,
      text: `New order #{{order_number}} from {{company_name}}.\nTotal: {{total}} {{currency}}\n\nItems:\n${itemLines}`,
    };
}

// ─── Email superadmin — alerte nouvelle vente ─────────────────
export function buildOrderNotificationSuperAdmin({ order, companyName, adminEmail, currency, displayTotal }) {
 return {
    subject: `💰 New Sale #${order.orderNumber} — ${displayTotal} ${currency}`,
    html: `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#0d0d0d;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#fff">
<div style="max-width:480px;margin:40px auto;background:#111;border-radius:12px;padding:32px">
  <p style="font-size:28px;margin:0 0 16px">💰</p>
  <h1 style="margin:0 0 8px;font-size:20px">New Sale!</h1>
  <p style="color:#aaa;font-size:14px;margin:0 0 24px">Order #{{order_number}}</p>
  <div style="background:#1a1a1a;border-radius:8px;padding:20px;font-size:14px;line-height:2">
    <div><span style="color:#666">Customer:</span> <strong>{{company_name}}</strong></div>
    <div><span style="color:#666">Email:</span> {{admin_email}}</div>
    <div><span style="color:#666">Amount:</span> <span style="color:#E10600;font-size:18px;font-weight:700">{{total}} {{currency}}</span></div>
    <div><span style="color:#666">Shipping:</span> {{shipping_method}}</div>
    <div><span style="color:#666">Date:</span> {{order_date}}</div>
  </div>
  <p style="font-size:11px;color:#555;margin:20px 0 0;text-align:center">
    © ${new Date().getFullYear()} ${appName} SuperAdmin
  </p>
</div>
</body></html>`,
    text: `New sale #{{order_number}} — ${displayTotal} ${currency}\nCustomer: {{company_name}} ({{admin_email}})`,
  };
}