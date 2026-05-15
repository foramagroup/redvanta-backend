// backend/src/i18n/emails/en.js
// English fallback templates for all transactional email slugs.
// Each entry is a function (vars) => { subject, html, text }.
// vars = the same object passed as `variables` to sendTemplatedMail.

const wrap = (content) => `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f9fafb">
  <div style="background:#fff;border-radius:10px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,.1)">
    ${content}
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0 16px">
    <p style="color:#9ca3af;font-size:12px;margin:0;text-align:center">
      © ${new Date().getFullYear()} Opinoor — <a href="mailto:support@opinoor.com" style="color:#6b7280;text-decoration:none">support@opinoor.com</a>
    </p>
  </div>
</div>`.trim();

const info = (rows) => `
<div style="background:#f3f4f6;border-radius:8px;padding:20px;margin:20px 0">
  <table style="width:100%;border-collapse:collapse">
    ${rows.map(([label, val]) => `
    <tr>
      <td style="padding:6px 0;color:#6b7280;font-size:13px;width:45%">${label}</td>
      <td style="padding:6px 0;color:#111827;font-size:13px;font-weight:600">${val}</td>
    </tr>`).join("")}
  </table>
</div>`;

const alert = (title, msg) => `
<div style="background:#fef3c7;border-left:4px solid #f59e0b;border-radius:6px;padding:14px 16px;margin:20px 0">
  <p style="color:#92400e;font-weight:700;margin:0 0 6px;font-size:13px">${title}</p>
  <p style="color:#78350f;font-size:13px;margin:0;line-height:1.5">${msg}</p>
</div>`;

export default {

  // ── Orders ───────────────────────────────────────────────────

  order_pending_payment: (v) => ({
    subject: `Order ${v.order_number} — Awaiting Payment`,
    html: wrap(`
      <h2 style="color:#111827;margin:0 0 8px">Your Order Is Awaiting Payment</h2>
      <p style="color:#374151;margin:0 0 20px">Hello <strong>${v.customer_name}</strong>,</p>
      <p style="color:#374151;margin:0 0 8px">Your order has been created and is waiting for payment.</p>
      ${info([
        ["Order", v.order_number],
        ["Invoice", v.invoice_number],
        ["Amount", `${v.total} ${v.currency}`],
        ["Payment method", v.payment_method],
        ["Due date", v.due_date],
      ])}
      ${v.payment_instructions ? alert("Payment Instructions", v.payment_instructions) : ""}
      <p style="color:#374151;font-size:14px">Your order will be processed as soon as payment is received.</p>
    `),
    text: `Order ${v.order_number} — Awaiting Payment\n\nHello ${v.customer_name},\nInvoice: ${v.invoice_number}\nAmount: ${v.total} ${v.currency}\nPayment method: ${v.payment_method}\nDue: ${v.due_date}\n${v.payment_instructions ? `\nInstructions:\n${v.payment_instructions}` : ""}`,
  }),

  order_confirmation_customer: (v) => ({
    subject: `Order Confirmation #${v.order_number}`,
    html: wrap(`
      <h2 style="color:#111827;margin:0 0 8px">Order Confirmed!</h2>
      <p style="color:#374151;margin:0 0 20px">Hello <strong>${v.customer_name}</strong>,</p>
      <p style="color:#374151;margin:0 0 8px">Your order <strong>#${v.order_number}</strong> has been received and is being processed. Your NFC cards will be manufactured and shipped within 2–5 business days.</p>
      ${info([
        ["Order", `#${v.order_number}`],
        ["Invoice", v.invoice_number],
        ["Subtotal", `${v.subtotal} ${v.currency}`],
        ["Shipping", `${v.shipping_cost} ${v.currency}`],
        ["Total", `${v.total} ${v.currency}`],
        ["Ship to", `${v.shipping_name}, ${v.shipping_city} ${v.shipping_country}`],
      ])}
      ${v.items_html ? `<div style="margin:16px 0">${v.items_html}</div>` : ""}
      <p style="color:#6b7280;font-size:13px">You will receive a tracking notification once your order ships.</p>
    `),
    text: `Order Confirmed #${v.order_number}\n\nHello ${v.customer_name},\nTotal: ${v.total} ${v.currency}\nShip to: ${v.shipping_name}, ${v.shipping_city} ${v.shipping_country}\n\nThank you for your order!`,
  }),

  order_confirmation_admin: (v) => ({
    subject: `New Order #${v.order_number} — ${v.company_name}`,
    html: wrap(`
      <h2 style="color:#111827;margin:0 0 8px">New Order Received</h2>
      <p style="color:#374151;margin:0 0 20px">A new order has been placed by <strong>${v.company_name}</strong>.</p>
      ${info([
        ["Order", `#${v.order_number}`],
        ["Total", `${v.total} ${v.currency}`],
        ["Shipping", `${v.shipping_method} → ${v.shipping_city}, ${v.shipping_country}`],
        ["Date", v.order_date],
      ])}
      ${v.items_html ? `<div style="margin:16px 0">${v.items_html}</div>` : ""}
    `),
    text: `New order #${v.order_number} from ${v.company_name}.\nTotal: ${v.total} ${v.currency}\nShipping: ${v.shipping_method}`,
  }),

  order_notification_superadmin: (v) => ({
    subject: `New Sale #${v.order_number} — ${v.total} ${v.currency}`,
    html: wrap(`
      <h2 style="color:#111827;margin:0 0 8px">💰 New Sale!</h2>
      ${info([
        ["Order", `#${v.order_number}`],
        ["Customer", v.company_name],
        ["Email", v.admin_email],
        ["Amount", `${v.total} ${v.currency}`],
        ["Shipping", v.shipping_method],
        ["Date", v.order_date],
      ])}
    `),
    text: `New sale #${v.order_number} — ${v.total} ${v.currency}\nCustomer: ${v.company_name} (${v.admin_email})`,
  }),

  // ── Subscriptions ────────────────────────────────────────────

  subscription_welcome: (v) => ({
    subject: `Welcome to ${v.plan_name}!`,
    html: wrap(`
      <h2 style="color:#111827;margin:0 0 8px">Welcome to ${v.plan_name}!</h2>
      <p style="color:#374151;margin:0 0 20px">Hello <strong>${v.customer_name}</strong>,</p>
      <p style="color:#374151;margin:0 0 8px">Your subscription is now active. Here's a summary:</p>
      ${info([
        ["Plan", v.plan_name],
        ["Company", v.company_name],
        ["Price", `${v.plan_price} ${v.currency} / ${v.billing_cycle}`],
        ["Next billing", v.next_billing_date],
        ["Invoice", v.invoice_number],
      ])}
      <p style="color:#374151;font-size:14px">Thank you for choosing Opinoor!</p>
    `),
    text: `Welcome to ${v.plan_name}!\n\nHello ${v.customer_name},\nPlan: ${v.plan_name} — ${v.plan_price} ${v.currency}/${v.billing_cycle}\nNext billing: ${v.next_billing_date}\nInvoice: ${v.invoice_number}`,
  }),

  subscription_pending_payment: (v) => ({
    subject: `Subscription ${v.plan_name} — Awaiting Payment`,
    html: wrap(`
      <h2 style="color:#111827;margin:0 0 8px">Subscription Created — Payment Pending</h2>
      <p style="color:#374151;margin:0 0 20px">Hello <strong>${v.customer_name}</strong>,</p>
      <p style="color:#374151;margin:0 0 8px">Your subscription has been created. We're waiting for your payment to activate it.</p>
      ${info([
        ["Plan", v.plan_name],
        ["Invoice", v.invoice_number],
        ["Amount", `${v.total} EUR`],
        ["Payment method", v.payment_method],
        ["Due date", v.due_date],
      ])}
      ${v.payment_instructions ? alert("Payment Instructions", v.payment_instructions) : ""}
      <p style="color:#374151;font-size:14px">Your subscription will be activated once payment is received.</p>
    `),
    text: `Subscription ${v.plan_name} — Awaiting Payment\n\nHello ${v.customer_name},\nInvoice: ${v.invoice_number} — ${v.total} EUR\nMethod: ${v.payment_method}\n${v.payment_instructions ? `\nInstructions:\n${v.payment_instructions}` : ""}`,
  }),

  subscription_payment_failed: (v) => ({
    subject: `Payment Failed — ${v.plan_name}`,
    html: wrap(`
      <h2 style="color:#dc2626;margin:0 0 8px">Payment Failed</h2>
      <p style="color:#374151;margin:0 0 20px">Hello <strong>${v.customer_name}</strong>,</p>
      <p style="color:#374151;margin:0 0 8px">We were unable to process your payment for <strong>${v.plan_name}</strong>.</p>
      ${info([
        ["Plan", v.plan_name],
        ["Company", v.company_name],
        ["Amount", `${v.total} ${v.currency}`],
        ["Reason", v.reason],
      ])}
      ${alert("Action Required", "Please update your payment method to avoid service interruption.")}
      <p style="margin:20px 0 0">
        <a href="${v.update_card_url}" style="background:#E10600;color:#fff;padding:11px 22px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;display:inline-block">
          Update Payment Method
        </a>
      </p>
    `),
    text: `Payment Failed — ${v.plan_name}\n\nHello ${v.customer_name},\nWe couldn't process ${v.total} ${v.currency} for ${v.plan_name}.\nReason: ${v.reason}\nUpdate your card: ${v.update_card_url}`,
  }),

  // ── NFC Cards ────────────────────────────────────────────────

  nfc_card_printed: (v) => ({
    subject: `Your NFC Card Has Been Printed — ${v.businessName}`,
    html: wrap(`
      <h2 style="color:#059669;margin:0 0 8px">✅ Your NFC Card Has Been Printed!</h2>
      <p style="color:#374151;margin:0 0 20px">Hello <strong>${v.adminName}</strong>,</p>
      <p style="color:#374151;margin:0 0 8px">Great news! Your NFC card for <strong>${v.businessName}</strong> has been successfully printed and is ready for the next step.</p>
      ${info([
        ["Business", v.businessName],
        ["Card ID", `${v.cardId}…`],
        ["Status", "PRINTED"],
        ["Date", v.printedDate],
      ])}
      <p style="color:#374151;font-size:14px">Your card will be shipped shortly. You'll receive another notification once it's on its way!</p>
    `),
    text: `Your NFC Card Has Been Printed!\n\nHello ${v.adminName},\nBusiness: ${v.businessName}\nCard: ${v.cardId}…\nDate: ${v.printedDate}\n\nYour card will be shipped shortly.`,
  }),

  nfc_card_shipped: (v) => ({
    subject: `Your NFC Card Is On Its Way — ${v.businessName}`,
    html: wrap(`
      <h2 style="color:#7c3aed;margin:0 0 8px">📦 Your NFC Card Is On Its Way!</h2>
      <p style="color:#374151;margin:0 0 20px">Hello <strong>${v.adminName}</strong>,</p>
      <p style="color:#374151;margin:0 0 8px">Excellent news! Your NFC card for <strong>${v.businessName}</strong> has been shipped and is now on its way to you.</p>
      ${info([
        ["Business", v.businessName],
        ["Card ID", `${v.cardId}…`],
        ["Status", "SHIPPED"],
        ["Date", v.shippedDate],
      ])}
      ${alert("📍 What's Next?", "Your card should arrive within 5–7 business days. Once delivered, it will be automatically activated and ready to use!")}
    `),
    text: `Your NFC Card Is On Its Way!\n\nHello ${v.adminName},\nBusiness: ${v.businessName}\nCard: ${v.cardId}…\nShipped: ${v.shippedDate}\n\nExpected delivery: 5–7 business days.`,
  }),

  nfc_card_delivered: (v) => ({
    subject: `Your NFC Card Has Been Delivered — ${v.businessName}`,
    html: wrap(`
      <h2 style="color:#d97706;margin:0 0 8px">📬 Your NFC Card Has Been Delivered!</h2>
      <p style="color:#374151;margin:0 0 20px">Hello <strong>${v.adminName}</strong>,</p>
      <p style="color:#374151;margin:0 0 8px">Your NFC card for <strong>${v.businessName}</strong> has been successfully delivered to your address.</p>
      ${info([
        ["Business", v.businessName],
        ["Card ID", `${v.cardId}…`],
        ["Status", "DELIVERED"],
        ["Date", v.deliveredDate],
      ])}
      ${alert("⏳ Almost Ready!", "Your card will be automatically activated within the next few hours. Once activated, you'll receive a final confirmation email and can start collecting reviews immediately!")}
    `),
    text: `Your NFC Card Has Been Delivered!\n\nHello ${v.adminName},\nBusiness: ${v.businessName}\nCard: ${v.cardId}…\nDelivered: ${v.deliveredDate}\n\nActivation coming soon!`,
  }),

  nfc_card_activated: (v) => ({
    subject: `Your NFC Card Is Now Active — ${v.businessName}`,
    html: wrap(`
      <h2 style="color:#0891b2;margin:0 0 8px">🎉 Your NFC Card Is Now Active!</h2>
      <p style="color:#374151;margin:0 0 20px">Hello <strong>${v.adminName}</strong>,</p>
      <p style="color:#374151;margin:0 0 8px">Fantastic! Your NFC card for <strong>${v.businessName}</strong> has been delivered and is now fully activated and ready to collect reviews.</p>
      ${info([
        ["Business", v.businessName],
        ["Card ID", `${v.cardId}…`],
        ["Status", "ACTIVE"],
        ["Activated", v.activatedDate],
      ])}
      ${alert("🚀 Start Collecting Reviews!", "Your card is live and ready to use. Simply tap it to a phone or scan the QR code to start collecting 5-star reviews from your customers!")}
    `),
    text: `Your NFC Card Is Now Active!\n\nHello ${v.adminName},\nBusiness: ${v.businessName}\nCard: ${v.cardId}…\nActivated: ${v.activatedDate}\n\nYour card is ready to collect reviews!`,
  }),

  nfc_card_disabled: (v) => ({
    subject: `Your NFC Card Has Been Disabled — ${v.businessName}`,
    html: wrap(`
      <h2 style="color:#dc2626;margin:0 0 8px">⚠️ Your NFC Card Has Been Disabled</h2>
      <p style="color:#374151;margin:0 0 20px">Hello <strong>${v.adminName}</strong>,</p>
      <p style="color:#374151;margin:0 0 8px">Your NFC card for <strong>${v.businessName}</strong> has been disabled and is no longer collecting reviews.</p>
      ${info([
        ["Business", v.businessName],
        ["Card ID", `${v.cardId}…`],
        ["Status", "DISABLED"],
        ["Date", v.disabledDate],
      ])}
      ${alert("❓ Why Was This Disabled?", "Your card may have been disabled for maintenance, account issues, or at your request. If you believe this is an error, please contact our support team immediately.")}
      <p style="color:#374151;font-size:14px">To reactivate your card, please contact support at <a href="mailto:support@opinoor.com" style="color:#E10600">support@opinoor.com</a></p>
    `),
    text: `Your NFC Card Has Been Disabled\n\nHello ${v.adminName},\nBusiness: ${v.businessName}\nCard: ${v.cardId}…\nDate: ${v.disabledDate}\n\nContact support@opinoor.com to reactivate.`,
  }),

  // ── Feedback ─────────────────────────────────────────────────

  feedback_received: (v) => ({
    subject: `⭐ New Feedback ${v.stars}/5 — ${v.location}`,
    html: wrap(`
      <h2 style="color:#111827;margin:0 0 8px">New Feedback Received</h2>
      <p style="color:#374151;margin:0 0 8px">A customer left a review for <strong>${v.location}</strong>.</p>
      ${info([
        ["Rating", `${v.stars} / 5 ⭐`],
        ["Location", v.location],
        ["Date", v.date],
      ])}
      ${v.message ? `<div style="background:#f3f4f6;border-radius:8px;padding:16px;margin:16px 0"><p style="color:#374151;font-style:italic;margin:0">"${v.message}"</p></div>` : ""}
    `),
    text: `New Feedback ${v.stars}/5\n\nLocation: ${v.location}\nDate: ${v.date}\n${v.message ? `\nMessage: "${v.message}"` : ""}`,
  }),

  // ── Review Request ───────────────────────────────────────────

  review_request: (v) => ({
    subject: `${v.company_name} — We'd love your feedback!`,
    html: wrap(`
      <h2 style="color:#111827;margin:0 0 8px">Share Your Experience</h2>
      <p style="color:#374151;margin:0 0 16px">Hello <strong>${v.customer_name}</strong>,</p>
      <p style="color:#374151;margin:0 0 20px">${v.custom_message}</p>
      <p style="margin:24px 0">
        <a href="${v.review_url}" style="background:#E10600;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block">
          Leave a Review
        </a>
      </p>
      <p style="color:#374151;font-size:14px">Thank you,<br><strong>${v.company_name}</strong></p>
    `),
    text: `Hello ${v.customer_name},\n\n${v.custom_message}\n\nLeave a review: ${v.review_url}\n\nThank you,\n${v.company_name}`,
  }),

  // ── Team Invites ─────────────────────────────────────────────

  team_invite_new: (v) => ({
    subject: `You've been invited to join ${v.company_name}`,
    html: wrap(`
      <h2 style="color:#111827;margin:0 0 8px">You're Invited!</h2>
      <p style="color:#374151;margin:0 0 16px">Hello <strong>${v.member_name}</strong>,</p>
      <p style="color:#374151;margin:0 0 20px">You've been invited to join <strong>${v.company_name}</strong> as <strong>${v.role}</strong> on Opinoor.</p>
      <p style="margin:24px 0">
        <a href="${v.invite_url}" style="background:#E10600;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block">
          Set Up Your Account
        </a>
      </p>
      <p style="color:#6b7280;font-size:13px">This invitation link is valid for 7 days.</p>
    `),
    text: `You've been invited to join ${v.company_name} as ${v.role}.\n\nSet up your account: ${v.invite_url}`,
  }),

  verification_code: (v) => ({
    subject: `Your verification code — ${v.company_name}`,
    html: wrap(`
      <h2 style="color:#111827;margin:0 0 8px">Verify your account</h2>
      <p style="color:#374151;margin:0 0 20px">Hello <strong>${v.name}</strong> 👋</p>
      <p style="color:#374151;margin:0 0 8px">
        Thank you for creating your <strong>${v.company_name}</strong> account.<br>
        Enter the verification code below to activate your access:
      </p>
      <div style="background:linear-gradient(135deg,#f4f4f5,#e4e4e7);border:2px solid #E10600;border-radius:12px;padding:24px;text-align:center;margin:28px 0">
        <p style="font-size:11px;text-transform:uppercase;color:#71717a;margin:0 0 8px;font-weight:600;letter-spacing:.05em">Your verification code</p>
        <p style="font-size:36px;font-weight:700;letter-spacing:8px;color:#E10600;font-family:monospace;margin:0">${v.formatted_code}</p>
      </div>
      <p style="color:#71717a;font-size:13px;text-align:center;margin:0 0 16px">Enter this code on the verification page to activate your account.</p>
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;font-size:12px;color:#92400e;margin-bottom:12px">
        ⚠️ <strong>This code expires in ${v.expires_hours} hours.</strong><br>
        Without verification within this time, your account will be automatically suspended.
      </div>
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px 16px;font-size:12px;color:#1e40af">
        💡 <strong>Security tip:</strong> Never share this code with anyone.
      </div>
    `),
    text: `Hello ${v.name},\n\nYour verification code for ${v.company_name}:\n\n${v.formatted_code}\n\nThis code expires in ${v.expires_hours} hours.\nNever share this code with anyone.\n\n© ${new Date().getFullYear()} Opinoor`,
  }),

  team_invite_existing: (v) => ({
    subject: `You've been invited to join ${v.company_name}`,
    html: wrap(`
      <h2 style="color:#111827;margin:0 0 8px">New Access Granted</h2>
      <p style="color:#374151;margin:0 0 16px">Hello <strong>${v.member_name}</strong>,</p>
      <p style="color:#374151;margin:0 0 20px">You've been added to <strong>${v.company_name}</strong> as <strong>${v.role}</strong> on Opinoor.</p>
      <p style="margin:24px 0">
        <a href="${v.invite_url}" style="background:#E10600;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block">
          Sign In to Access
        </a>
      </p>
    `),
    text: `You now have access to ${v.company_name} as ${v.role}.\n\nSign in: ${v.invite_url}`,
  }),
};
