// backend/src/i18n/emails/ro.js
// Traduceri românești ale emailurilor tranzacționale.

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

  // ── Comenzi ──────────────────────────────────────────────────

  order_pending_payment: (v) => ({
    subject: `Comanda ${v.order_number} — În așteptarea plății`,
    html: wrap(`
      <h2 style="color:#111827;margin:0 0 8px">Comanda dvs. este în așteptarea plății</h2>
      <p style="color:#374151;margin:0 0 20px">Bună ziua, <strong>${v.customer_name}</strong>,</p>
      <p style="color:#374151;margin:0 0 8px">Comanda dvs. a fost creată și este în așteptarea plății.</p>
      ${info([
        ["Comandă", v.order_number],
        ["Factură", v.invoice_number],
        ["Sumă", `${v.total} ${v.currency}`],
        ["Metodă de plată", v.payment_method],
        ["Dată scadentă", v.due_date],
      ])}
      ${v.payment_instructions ? alert("Instrucțiuni de plată", v.payment_instructions) : ""}
      <p style="color:#374151;font-size:14px">Comanda va fi procesată imediat după confirmarea plății.</p>
    `),
    text: `Comanda ${v.order_number} — În așteptarea plății\n\nBună ziua, ${v.customer_name},\nFactură: ${v.invoice_number}\nSumă: ${v.total} ${v.currency}\nMetodă: ${v.payment_method}\nScadent: ${v.due_date}\n${v.payment_instructions ? `\nInstrucțiuni:\n${v.payment_instructions}` : ""}`,
  }),

  order_confirmation_customer: (v) => ({
    subject: `Confirmare comandă #${v.order_number}`,
    html: wrap(`
      <h2 style="color:#111827;margin:0 0 8px">Comandă confirmată!</h2>
      <p style="color:#374151;margin:0 0 20px">Bună ziua, <strong>${v.customer_name}</strong>,</p>
      <p style="color:#374151;margin:0 0 8px">Comanda dvs. <strong>#${v.order_number}</strong> a fost primită și este în curs de procesare. Cardurile NFC vor fi fabricate și expediate în 2–5 zile lucrătoare.</p>
      ${info([
        ["Comandă", `#${v.order_number}`],
        ["Factură", v.invoice_number],
        ["Subtotal", `${v.subtotal} ${v.currency}`],
        ["Transport", `${v.shipping_cost} ${v.currency}`],
        ["Total", `${v.total} ${v.currency}`],
        ["Livrat la", `${v.shipping_name}, ${v.shipping_city} ${v.shipping_country}`],
      ])}
      ${v.items_html ? `<div style="margin:16px 0">${v.items_html}</div>` : ""}
      <p style="color:#6b7280;font-size:13px">Veți primi o notificare de urmărire odată ce comanda este expediată.</p>
    `),
    text: `Confirmare comandă #${v.order_number}\n\nBună ziua, ${v.customer_name},\nTotal: ${v.total} ${v.currency}\nLivrat la: ${v.shipping_name}, ${v.shipping_city} ${v.shipping_country}\n\nVă mulțumim pentru comandă!`,
  }),

  order_confirmation_admin: (v) => ({
    subject: `Comandă nouă #${v.order_number} — ${v.company_name}`,
    html: wrap(`
      <h2 style="color:#111827;margin:0 0 8px">Comandă nouă primită</h2>
      <p style="color:#374151;margin:0 0 20px">O nouă comandă a fost plasată de <strong>${v.company_name}</strong>.</p>
      ${info([
        ["Comandă", `#${v.order_number}`],
        ["Total", `${v.total} ${v.currency}`],
        ["Livrare", `${v.shipping_method} → ${v.shipping_city}, ${v.shipping_country}`],
        ["Dată", v.order_date],
      ])}
      ${v.items_html ? `<div style="margin:16px 0">${v.items_html}</div>` : ""}
    `),
    text: `Comandă nouă #${v.order_number} de la ${v.company_name}.\nTotal: ${v.total} ${v.currency}\nLivrare: ${v.shipping_method}`,
  }),

  order_notification_superadmin: (v) => ({
    subject: `Vânzare nouă #${v.order_number} — ${v.total} ${v.currency}`,
    html: wrap(`
      <h2 style="color:#111827;margin:0 0 8px">💰 Vânzare nouă!</h2>
      ${info([
        ["Comandă", `#${v.order_number}`],
        ["Client", v.company_name],
        ["Email", v.admin_email],
        ["Sumă", `${v.total} ${v.currency}`],
        ["Livrare", v.shipping_method],
        ["Dată", v.order_date],
      ])}
    `),
    text: `Vânzare nouă #${v.order_number} — ${v.total} ${v.currency}\nClient: ${v.company_name} (${v.admin_email})`,
  }),

  // ── Abonamente ───────────────────────────────────────────────

  subscription_welcome: (v) => ({
    subject: `Bun venit în ${v.plan_name}!`,
    html: wrap(`
      <h2 style="color:#111827;margin:0 0 8px">Bun venit în ${v.plan_name}!</h2>
      <p style="color:#374151;margin:0 0 20px">Bună ziua, <strong>${v.customer_name}</strong>,</p>
      <p style="color:#374151;margin:0 0 8px">Abonamentul dvs. este acum activ. Iată un rezumat:</p>
      ${info([
        ["Plan", v.plan_name],
        ["Companie", v.company_name],
        ["Preț", `${v.plan_price} ${v.currency} / ${v.billing_cycle}`],
        ["Următoarea factură", v.next_billing_date],
        ["Factură", v.invoice_number],
      ])}
      <p style="color:#374151;font-size:14px">Vă mulțumim că ne-ați ales!</p>
    `),
    text: `Bun venit în ${v.plan_name}!\n\nBună ziua, ${v.customer_name},\nPlan: ${v.plan_name} — ${v.plan_price} ${v.currency}/${v.billing_cycle}\nUrmătoarea factură: ${v.next_billing_date}\nFactură: ${v.invoice_number}`,
  }),

  subscription_pending_payment: (v) => ({
    subject: `Abonament ${v.plan_name} — În așteptarea plății`,
    html: wrap(`
      <h2 style="color:#111827;margin:0 0 8px">Abonament creat — Plată în așteptare</h2>
      <p style="color:#374151;margin:0 0 20px">Bună ziua, <strong>${v.customer_name}</strong>,</p>
      <p style="color:#374151;margin:0 0 8px">Abonamentul dvs. a fost creat și va fi activat la primirea plății.</p>
      ${info([
        ["Plan", v.plan_name],
        ["Factură", v.invoice_number],
        ["Sumă", `${v.total} EUR`],
        ["Metodă de plată", v.payment_method],
        ["Dată scadentă", v.due_date],
      ])}
      ${v.payment_instructions ? alert("Instrucțiuni de plată", v.payment_instructions) : ""}
      <p style="color:#374151;font-size:14px">Abonamentul va fi activat imediat după confirmarea plății.</p>
    `),
    text: `Abonament ${v.plan_name} — În așteptarea plății\n\nBună ziua, ${v.customer_name},\nFactură: ${v.invoice_number} — ${v.total} EUR\nMetodă: ${v.payment_method}\n${v.payment_instructions ? `\nInstrucțiuni:\n${v.payment_instructions}` : ""}`,
  }),

  subscription_payment_failed: (v) => ({
    subject: `Plată eșuată — ${v.plan_name}`,
    html: wrap(`
      <h2 style="color:#dc2626;margin:0 0 8px">Plată eșuată</h2>
      <p style="color:#374151;margin:0 0 20px">Bună ziua, <strong>${v.customer_name}</strong>,</p>
      <p style="color:#374151;margin:0 0 8px">Nu am putut procesa plata pentru <strong>${v.plan_name}</strong>.</p>
      ${info([
        ["Plan", v.plan_name],
        ["Companie", v.company_name],
        ["Sumă", `${v.total} ${v.currency}`],
        ["Motiv", v.reason],
      ])}
      ${alert("Acțiune necesară", "Vă rugăm să actualizați metoda de plată pentru a evita întreruperea serviciului.")}
      <p style="margin:20px 0 0">
        <a href="${v.update_card_url}" style="background:#E10600;color:#fff;padding:11px 22px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;display:inline-block">
          Actualizați metoda de plată
        </a>
      </p>
    `),
    text: `Plată eșuată — ${v.plan_name}\n\nBună ziua, ${v.customer_name},\nNu am putut debita ${v.total} ${v.currency} pentru ${v.plan_name}.\nMotiv: ${v.reason}\nActualizați cardul: ${v.update_card_url}`,
  }),

  // ── Carduri NFC ──────────────────────────────────────────────

  nfc_card_printed: (v) => ({
    subject: `Cardul dvs. NFC a fost tipărit — ${v.businessName}`,
    html: wrap(`
      <h2 style="color:#059669;margin:0 0 8px">✅ Cardul dvs. NFC a fost tipărit!</h2>
      <p style="color:#374151;margin:0 0 20px">Bună ziua, <strong>${v.adminName}</strong>,</p>
      <p style="color:#374151;margin:0 0 8px">Vești bune! Cardul NFC pentru <strong>${v.businessName}</strong> a fost tipărit cu succes și este pregătit pentru etapa următoare.</p>
      ${info([
        ["Unitate", v.businessName],
        ["ID card", `${v.cardId}…`],
        ["Stare", "TIPĂRIT"],
        ["Dată", v.printedDate],
      ])}
      <p style="color:#374151;font-size:14px">Cardul va fi expediat în curând. Veți primi o notificare la expediere!</p>
    `),
    text: `Cardul dvs. NFC a fost tipărit!\n\nBună ziua, ${v.adminName},\nUnitate: ${v.businessName}\nCard: ${v.cardId}…\nDată: ${v.printedDate}\n\nCardul va fi expediat în curând.`,
  }),

  nfc_card_shipped: (v) => ({
    subject: `Cardul dvs. NFC este pe drum — ${v.businessName}`,
    html: wrap(`
      <h2 style="color:#7c3aed;margin:0 0 8px">📦 Cardul dvs. NFC este pe drum!</h2>
      <p style="color:#374151;margin:0 0 20px">Bună ziua, <strong>${v.adminName}</strong>,</p>
      <p style="color:#374151;margin:0 0 8px">Vești excelente! Cardul NFC pentru <strong>${v.businessName}</strong> a fost expediat și se îndreaptă spre dvs.</p>
      ${info([
        ["Unitate", v.businessName],
        ["ID card", `${v.cardId}…`],
        ["Stare", "EXPEDIAT"],
        ["Dată", v.shippedDate],
      ])}
      ${alert("📍 Ce urmează?", "Cardul ar trebui să ajungă în 5–7 zile lucrătoare. Odată livrat, va fi activat automat și gata de utilizare!")}
    `),
    text: `Cardul dvs. NFC este pe drum!\n\nBună ziua, ${v.adminName},\nUnitate: ${v.businessName}\nCard: ${v.cardId}…\nExpediat: ${v.shippedDate}\n\nTermen estimat: 5–7 zile lucrătoare.`,
  }),

  nfc_card_delivered: (v) => ({
    subject: `Cardul dvs. NFC a fost livrat — ${v.businessName}`,
    html: wrap(`
      <h2 style="color:#d97706;margin:0 0 8px">📬 Cardul dvs. NFC a fost livrat!</h2>
      <p style="color:#374151;margin:0 0 20px">Bună ziua, <strong>${v.adminName}</strong>,</p>
      <p style="color:#374151;margin:0 0 8px">Cardul NFC pentru <strong>${v.businessName}</strong> a fost livrat cu succes la adresa dvs.</p>
      ${info([
        ["Unitate", v.businessName],
        ["ID card", `${v.cardId}…`],
        ["Stare", "LIVRAT"],
        ["Dată", v.deliveredDate],
      ])}
      ${alert("⏳ Aproape gata!", "Cardul dvs. va fi activat automat în câteva ore. Odată activat, veți primi un email de confirmare și puteți începe să colectați recenzii!")}
    `),
    text: `Cardul dvs. NFC a fost livrat!\n\nBună ziua, ${v.adminName},\nUnitate: ${v.businessName}\nCard: ${v.cardId}…\nLivrat: ${v.deliveredDate}\n\nActivare în curs…`,
  }),

  nfc_card_activated: (v) => ({
    subject: `Cardul dvs. NFC este acum activ — ${v.businessName}`,
    html: wrap(`
      <h2 style="color:#0891b2;margin:0 0 8px">🎉 Cardul dvs. NFC este acum activ!</h2>
      <p style="color:#374151;margin:0 0 20px">Bună ziua, <strong>${v.adminName}</strong>,</p>
      <p style="color:#374151;margin:0 0 8px">Fantastic! Cardul NFC pentru <strong>${v.businessName}</strong> a fost activat și este pregătit să colecteze recenzii.</p>
      ${info([
        ["Unitate", v.businessName],
        ["ID card", `${v.cardId}…`],
        ["Stare", "ACTIV"],
        ["Activat la", v.activatedDate],
      ])}
      ${alert("🚀 Începeți să colectați recenzii!", "Cardul dvs. este activ. Apropiați-l de un telefon sau scanați codul QR pentru a colecta recenzii de 5 stele de la clienții dvs.!")}
    `),
    text: `Cardul dvs. NFC este acum activ!\n\nBună ziua, ${v.adminName},\nUnitate: ${v.businessName}\nCard: ${v.cardId}…\nActivat: ${v.activatedDate}\n\nCardul dvs. este gata să colecteze recenzii!`,
  }),

  nfc_card_disabled: (v) => ({
    subject: `Cardul dvs. NFC a fost dezactivat — ${v.businessName}`,
    html: wrap(`
      <h2 style="color:#dc2626;margin:0 0 8px">⚠️ Cardul dvs. NFC a fost dezactivat</h2>
      <p style="color:#374151;margin:0 0 20px">Bună ziua, <strong>${v.adminName}</strong>,</p>
      <p style="color:#374151;margin:0 0 8px">Cardul NFC pentru <strong>${v.businessName}</strong> a fost dezactivat și nu mai colectează recenzii.</p>
      ${info([
        ["Unitate", v.businessName],
        ["ID card", `${v.cardId}…`],
        ["Stare", "DEZACTIVAT"],
        ["Dată", v.disabledDate],
      ])}
      ${alert("❓ De ce a fost dezactivat?", "Cardul poate fi dezactivat pentru întreținere, probleme de cont sau la cererea dvs. Dacă considerați că este o eroare, contactați imediat suportul nostru.")}
      <p style="color:#374151;font-size:14px">Pentru reactivarea cardului, contactați suportul la <a href="mailto:support@opinoor.com" style="color:#E10600">support@opinoor.com</a></p>
    `),
    text: `Cardul dvs. NFC a fost dezactivat\n\nBună ziua, ${v.adminName},\nUnitate: ${v.businessName}\nCard: ${v.cardId}…\nDată: ${v.disabledDate}\n\nContactați support@opinoor.com pentru reactivare.`,
  }),

  // ── Recenzii ─────────────────────────────────────────────────

  feedback_received: (v) => ({
    subject: `⭐ Recenzie nouă ${v.stars}/5 — ${v.location}`,
    html: wrap(`
      <h2 style="color:#111827;margin:0 0 8px">Recenzie nouă primită</h2>
      <p style="color:#374151;margin:0 0 8px">Un client a lăsat o recenzie pentru <strong>${v.location}</strong>.</p>
      ${info([
        ["Notă", `${v.stars} / 5 ⭐`],
        ["Unitate", v.location],
        ["Dată", v.date],
      ])}
      ${v.message ? `<div style="background:#f3f4f6;border-radius:8px;padding:16px;margin:16px 0"><p style="color:#374151;font-style:italic;margin:0">„${v.message}"</p></div>` : ""}
    `),
    text: `Recenzie nouă ${v.stars}/5\n\nUnitate: ${v.location}\nDată: ${v.date}\n${v.message ? `\nMesaj: „${v.message}"` : ""}`,
  }),

  // ── Cerere recenzie ──────────────────────────────────────────

  review_request: (v) => ({
    subject: `${v.company_name} — Opinia dvs. contează!`,
    html: wrap(`
      <h2 style="color:#111827;margin:0 0 8px">Împărtășiți experiența dvs.</h2>
      <p style="color:#374151;margin:0 0 16px">Bună ziua, <strong>${v.customer_name}</strong>,</p>
      <p style="color:#374151;margin:0 0 20px">${v.custom_message}</p>
      <p style="margin:24px 0">
        <a href="${v.review_url}" style="background:#E10600;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block">
          Lăsați o recenzie
        </a>
      </p>
      <p style="color:#374151;font-size:14px">Vă mulțumim,<br><strong>${v.company_name}</strong></p>
    `),
    text: `Bună ziua, ${v.customer_name},\n\n${v.custom_message}\n\nLăsați o recenzie: ${v.review_url}\n\nVă mulțumim,\n${v.company_name}`,
  }),

  // ── Echipă ───────────────────────────────────────────────────

  team_invite_new: (v) => ({
    subject: `Ați fost invitat să vă alăturați ${v.company_name}`,
    html: wrap(`
      <h2 style="color:#111827;margin:0 0 8px">Sunteți invitat!</h2>
      <p style="color:#374151;margin:0 0 16px">Bună ziua, <strong>${v.member_name}</strong>,</p>
      <p style="color:#374151;margin:0 0 20px">Ați fost invitat să vă alăturați <strong>${v.company_name}</strong> în calitate de <strong>${v.role}</strong> pe Opinoor.</p>
      <p style="margin:24px 0">
        <a href="${v.invite_url}" style="background:#E10600;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block">
          Creați-vă contul
        </a>
      </p>
      <p style="color:#6b7280;font-size:13px">Acest link de invitație este valabil 7 zile.</p>
    `),
    text: `Ați fost invitat să vă alăturați ${v.company_name} ca ${v.role}.\n\nCreați-vă contul: ${v.invite_url}`,
  }),

  verification_code: (v) => ({
    subject: `Codul dvs. de verificare — ${v.company_name}`,
    html: wrap(`
      <h2 style="color:#111827;margin:0 0 8px">Verificați-vă contul</h2>
      <p style="color:#374151;margin:0 0 20px">Bună ziua, <strong>${v.name}</strong> 👋</p>
      <p style="color:#374151;margin:0 0 8px">
        Vă mulțumim că ați creat un cont pentru <strong>${v.company_name}</strong>.<br>
        Pentru a vă activa accesul, introduceți codul de verificare de mai jos:
      </p>
      <div style="background:linear-gradient(135deg,#f4f4f5,#e4e4e7);border:2px solid #E10600;border-radius:12px;padding:24px;text-align:center;margin:28px 0">
        <p style="font-size:11px;text-transform:uppercase;color:#71717a;margin:0 0 8px;font-weight:600;letter-spacing:.05em">Codul dvs. de verificare</p>
        <p style="font-size:36px;font-weight:700;letter-spacing:8px;color:#E10600;font-family:monospace;margin:0">${v.formatted_code}</p>
      </div>
      <p style="color:#71717a;font-size:13px;text-align:center;margin:0 0 16px">Introduceți acest cod pe pagina de verificare pentru a vă activa contul.</p>
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;font-size:12px;color:#92400e;margin-bottom:12px">
        ⚠️ <strong>Acest cod expiră în ${v.expires_hours} ore.</strong><br>
        Fără verificare în acest interval, contul dvs. va fi suspendat automat.
      </div>
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px 16px;font-size:12px;color:#1e40af">
        💡 <strong>Sfat de securitate:</strong> Nu împărtășiți niciodată acest cod cu nimeni.
      </div>
    `),
    text: `Bună ziua, ${v.name},\n\nCodul dvs. de verificare pentru ${v.company_name}:\n\n${v.formatted_code}\n\nAcest cod expiră în ${v.expires_hours} ore.\nNu împărtășiți niciodată acest cod.\n\n© ${new Date().getFullYear()} Opinoor`,
  }),

  team_invite_existing: (v) => ({
    subject: `Ați fost adăugat la ${v.company_name}`,
    html: wrap(`
      <h2 style="color:#111827;margin:0 0 8px">Acces nou acordat</h2>
      <p style="color:#374151;margin:0 0 16px">Bună ziua, <strong>${v.member_name}</strong>,</p>
      <p style="color:#374151;margin:0 0 20px">Ați fost adăugat la <strong>${v.company_name}</strong> în calitate de <strong>${v.role}</strong> pe Opinoor.</p>
      <p style="margin:24px 0">
        <a href="${v.invite_url}" style="background:#E10600;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block">
          Autentificați-vă
        </a>
      </p>
    `),
    text: `Aveți acum acces la ${v.company_name} ca ${v.role}.\n\nAutentificați-vă: ${v.invite_url}`,
  }),

  // ── IA Auto-Reply ────────────────────────────────────────────

  ai_reply_suggestion: (v) => ({
    subject: `Sugestie răspuns IA — ${v.reviewer_name} a lăsat ${v.review_rating}⭐`,
    html: wrap(`
      <h2 style="color:#111827;margin:0 0 8px">Nouă sugestie de răspuns IA</h2>
      <p style="color:#374151;margin:0 0 20px">Bună ziua, <strong>${v.admin_name}</strong>,</p>
      <p style="color:#374151;margin:0 0 8px">IA a generat un răspuns pentru o nouă recenzie primită de <strong>${v.company_name}</strong>. Acesta așteaptă aprobarea dvs. înainte de publicare.</p>
      ${info([
        ["Client", v.reviewer_name],
        ["Notă", `${v.review_rating} / 5 ⭐`],
      ])}
      <div style="background:#f3f4f6;border-radius:8px;padding:16px;margin:16px 0">
        <p style="color:#6b7280;font-size:12px;font-weight:600;margin:0 0 8px;text-transform:uppercase;letter-spacing:.05em">Recenzia clientului</p>
        <p style="color:#374151;font-style:italic;margin:0">"${v.review_text}"</p>
      </div>
      <div style="background:#eff6ff;border-left:4px solid #3b82f6;border-radius:6px;padding:16px;margin:16px 0">
        <p style="color:#1e40af;font-size:12px;font-weight:600;margin:0 0 8px;text-transform:uppercase;letter-spacing:.05em">Răspuns IA (ciornă)</p>
        <p style="color:#1e3a8a;margin:0;line-height:1.6">${v.reply_draft}</p>
      </div>
      <p style="margin:24px 0">
        <a href="${v.dashboard_url}" style="background:#E10600;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block">
          Validați &amp; Publicați
        </a>
      </p>
      <p style="color:#6b7280;font-size:13px">Accesați tabloul de bord pentru a aproba, edita sau respinge acest răspuns.</p>
    `),
    text: `Sugestie răspuns IA\n\nBună ziua, ${v.admin_name},\n\nO nouă recenzie așteaptă validarea pe ${v.company_name}.\n\nClient: ${v.reviewer_name}\nNotă: ${v.review_rating}/5\n\nRecenzie:\n"${v.review_text}"\n\nCiornă IA:\n${v.reply_draft}\n\nValidați sau editați: ${v.dashboard_url}`,
  }),
};
