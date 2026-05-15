// backend/src/i18n/emails/fr.js
// Traductions françaises des emails transactionnels.

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

  // ── Commandes ────────────────────────────────────────────────

  order_pending_payment: (v) => ({
    subject: `Commande ${v.order_number} — En attente de paiement`,
    html: wrap(`
      <h2 style="color:#111827;margin:0 0 8px">Votre commande est en attente de paiement</h2>
      <p style="color:#374151;margin:0 0 20px">Bonjour <strong>${v.customer_name}</strong>,</p>
      <p style="color:#374151;margin:0 0 8px">Votre commande a bien été créée et est en attente de paiement.</p>
      ${info([
        ["Commande", v.order_number],
        ["Facture", v.invoice_number],
        ["Montant", `${v.total} ${v.currency}`],
        ["Mode de paiement", v.payment_method],
        ["Date d'échéance", v.due_date],
      ])}
      ${v.payment_instructions ? alert("Instructions de paiement", v.payment_instructions) : ""}
      <p style="color:#374151;font-size:14px">Votre commande sera traitée dès réception du paiement.</p>
    `),
    text: `Commande ${v.order_number} — En attente de paiement\n\nBonjour ${v.customer_name},\nFacture : ${v.invoice_number}\nMontant : ${v.total} ${v.currency}\nMode de paiement : ${v.payment_method}\nÉchéance : ${v.due_date}\n${v.payment_instructions ? `\nInstructions :\n${v.payment_instructions}` : ""}`,
  }),

  order_confirmation_customer: (v) => ({
    subject: `Confirmation de commande #${v.order_number}`,
    html: wrap(`
      <h2 style="color:#111827;margin:0 0 8px">Commande confirmée !</h2>
      <p style="color:#374151;margin:0 0 20px">Bonjour <strong>${v.customer_name}</strong>,</p>
      <p style="color:#374151;margin:0 0 8px">Votre commande <strong>#${v.order_number}</strong> a bien été reçue et est en cours de traitement. Vos cartes NFC seront fabriquées et expédiées sous 2 à 5 jours ouvrés.</p>
      ${info([
        ["Commande", `#${v.order_number}`],
        ["Facture", v.invoice_number],
        ["Sous-total", `${v.subtotal} ${v.currency}`],
        ["Livraison", `${v.shipping_cost} ${v.currency}`],
        ["Total", `${v.total} ${v.currency}`],
        ["Livré à", `${v.shipping_name}, ${v.shipping_city} ${v.shipping_country}`],
      ])}
      ${v.items_html ? `<div style="margin:16px 0">${v.items_html}</div>` : ""}
      <p style="color:#6b7280;font-size:13px">Vous recevrez une notification de suivi dès l'expédition de votre commande.</p>
    `),
    text: `Confirmation de commande #${v.order_number}\n\nBonjour ${v.customer_name},\nTotal : ${v.total} ${v.currency}\nLivré à : ${v.shipping_name}, ${v.shipping_city} ${v.shipping_country}\n\nMerci pour votre commande !`,
  }),

  order_confirmation_admin: (v) => ({
    subject: `Nouvelle commande #${v.order_number} — ${v.company_name}`,
    html: wrap(`
      <h2 style="color:#111827;margin:0 0 8px">Nouvelle commande reçue</h2>
      <p style="color:#374151;margin:0 0 20px">Une nouvelle commande a été passée par <strong>${v.company_name}</strong>.</p>
      ${info([
        ["Commande", `#${v.order_number}`],
        ["Total", `${v.total} ${v.currency}`],
        ["Livraison", `${v.shipping_method} → ${v.shipping_city}, ${v.shipping_country}`],
        ["Date", v.order_date],
      ])}
      ${v.items_html ? `<div style="margin:16px 0">${v.items_html}</div>` : ""}
    `),
    text: `Nouvelle commande #${v.order_number} de ${v.company_name}.\nTotal : ${v.total} ${v.currency}\nLivraison : ${v.shipping_method}`,
  }),

  order_notification_superadmin: (v) => ({
    subject: `Nouvelle vente #${v.order_number} — ${v.total} ${v.currency}`,
    html: wrap(`
      <h2 style="color:#111827;margin:0 0 8px">💰 Nouvelle vente !</h2>
      ${info([
        ["Commande", `#${v.order_number}`],
        ["Client", v.company_name],
        ["Email", v.admin_email],
        ["Montant", `${v.total} ${v.currency}`],
        ["Livraison", v.shipping_method],
        ["Date", v.order_date],
      ])}
    `),
    text: `Nouvelle vente #${v.order_number} — ${v.total} ${v.currency}\nClient : ${v.company_name} (${v.admin_email})`,
  }),

  // ── Abonnements ──────────────────────────────────────────────

  subscription_welcome: (v) => ({
    subject: `Bienvenue dans ${v.plan_name} !`,
    html: wrap(`
      <h2 style="color:#111827;margin:0 0 8px">Bienvenue dans ${v.plan_name} !</h2>
      <p style="color:#374151;margin:0 0 20px">Bonjour <strong>${v.customer_name}</strong>,</p>
      <p style="color:#374151;margin:0 0 8px">Votre abonnement est désormais actif. Voici un résumé :</p>
      ${info([
        ["Offre", v.plan_name],
        ["Entreprise", v.company_name],
        ["Tarif", `${v.plan_price} ${v.currency} / ${v.billing_cycle}`],
        ["Prochain paiement", v.next_billing_date],
        ["Facture", v.invoice_number],
      ])}
      <p style="color:#374151;font-size:14px">Merci de nous faire confiance !</p>
    `),
    text: `Bienvenue dans ${v.plan_name} !\n\nBonjour ${v.customer_name},\nOffre : ${v.plan_name} — ${v.plan_price} ${v.currency}/${v.billing_cycle}\nProchain paiement : ${v.next_billing_date}\nFacture : ${v.invoice_number}`,
  }),

  subscription_pending_payment: (v) => ({
    subject: `Abonnement ${v.plan_name} — En attente de paiement`,
    html: wrap(`
      <h2 style="color:#111827;margin:0 0 8px">Abonnement créé — Paiement en attente</h2>
      <p style="color:#374151;margin:0 0 20px">Bonjour <strong>${v.customer_name}</strong>,</p>
      <p style="color:#374151;margin:0 0 8px">Votre abonnement a été créé. Il sera activé dès réception de votre paiement.</p>
      ${info([
        ["Offre", v.plan_name],
        ["Facture", v.invoice_number],
        ["Montant", `${v.total} EUR`],
        ["Mode de paiement", v.payment_method],
        ["Date d'échéance", v.due_date],
      ])}
      ${v.payment_instructions ? alert("Instructions de paiement", v.payment_instructions) : ""}
      <p style="color:#374151;font-size:14px">Votre abonnement sera activé dès réception du paiement.</p>
    `),
    text: `Abonnement ${v.plan_name} — En attente de paiement\n\nBonjour ${v.customer_name},\nFacture : ${v.invoice_number} — ${v.total} EUR\nMode : ${v.payment_method}\n${v.payment_instructions ? `\nInstructions :\n${v.payment_instructions}` : ""}`,
  }),

  subscription_payment_failed: (v) => ({
    subject: `Paiement échoué — ${v.plan_name}`,
    html: wrap(`
      <h2 style="color:#dc2626;margin:0 0 8px">Échec du paiement</h2>
      <p style="color:#374151;margin:0 0 20px">Bonjour <strong>${v.customer_name}</strong>,</p>
      <p style="color:#374151;margin:0 0 8px">Nous n'avons pas pu traiter votre paiement pour <strong>${v.plan_name}</strong>.</p>
      ${info([
        ["Offre", v.plan_name],
        ["Entreprise", v.company_name],
        ["Montant", `${v.total} ${v.currency}`],
        ["Motif", v.reason],
      ])}
      ${alert("Action requise", "Veuillez mettre à jour votre moyen de paiement pour éviter toute interruption de service.")}
      <p style="margin:20px 0 0">
        <a href="${v.update_card_url}" style="background:#E10600;color:#fff;padding:11px 22px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;display:inline-block">
          Mettre à jour mon moyen de paiement
        </a>
      </p>
    `),
    text: `Paiement échoué — ${v.plan_name}\n\nBonjour ${v.customer_name},\nNous n'avons pas pu débiter ${v.total} ${v.currency} pour ${v.plan_name}.\nMotif : ${v.reason}\nMettez à jour votre carte : ${v.update_card_url}`,
  }),

  // ── Cartes NFC ───────────────────────────────────────────────

  nfc_card_printed: (v) => ({
    subject: `Votre carte NFC a été imprimée — ${v.businessName}`,
    html: wrap(`
      <h2 style="color:#059669;margin:0 0 8px">✅ Votre carte NFC a été imprimée !</h2>
      <p style="color:#374151;margin:0 0 20px">Bonjour <strong>${v.adminName}</strong>,</p>
      <p style="color:#374151;margin:0 0 8px">Excellente nouvelle ! Votre carte NFC pour <strong>${v.businessName}</strong> a été imprimée avec succès et est prête pour la prochaine étape.</p>
      ${info([
        ["Établissement", v.businessName],
        ["ID carte", `${v.cardId}…`],
        ["Statut", "IMPRIMÉE"],
        ["Date", v.printedDate],
      ])}
      <p style="color:#374151;font-size:14px">Votre carte sera expédiée sous peu. Vous recevrez une notification dès l'envoi !</p>
    `),
    text: `Votre carte NFC a été imprimée !\n\nBonjour ${v.adminName},\nÉtablissement : ${v.businessName}\nCarte : ${v.cardId}…\nDate : ${v.printedDate}\n\nVotre carte sera expédiée sous peu.`,
  }),

  nfc_card_shipped: (v) => ({
    subject: `Votre carte NFC est en route — ${v.businessName}`,
    html: wrap(`
      <h2 style="color:#7c3aed;margin:0 0 8px">📦 Votre carte NFC est en route !</h2>
      <p style="color:#374151;margin:0 0 20px">Bonjour <strong>${v.adminName}</strong>,</p>
      <p style="color:#374151;margin:0 0 8px">Excellente nouvelle ! Votre carte NFC pour <strong>${v.businessName}</strong> a été expédiée et est en route vers vous.</p>
      ${info([
        ["Établissement", v.businessName],
        ["ID carte", `${v.cardId}…`],
        ["Statut", "EXPÉDIÉE"],
        ["Date", v.shippedDate],
      ])}
      ${alert("📍 Et ensuite ?", "Votre carte devrait arriver sous 5 à 7 jours ouvrés. Une fois livrée, elle sera automatiquement activée et prête à l'emploi !")}
    `),
    text: `Votre carte NFC est en route !\n\nBonjour ${v.adminName},\nÉtablissement : ${v.businessName}\nCarte : ${v.cardId}…\nExpédiée le : ${v.shippedDate}\n\nDélai estimé : 5–7 jours ouvrés.`,
  }),

  nfc_card_delivered: (v) => ({
    subject: `Votre carte NFC a été livrée — ${v.businessName}`,
    html: wrap(`
      <h2 style="color:#d97706;margin:0 0 8px">📬 Votre carte NFC a été livrée !</h2>
      <p style="color:#374151;margin:0 0 20px">Bonjour <strong>${v.adminName}</strong>,</p>
      <p style="color:#374151;margin:0 0 8px">Votre carte NFC pour <strong>${v.businessName}</strong> a bien été livrée à votre adresse.</p>
      ${info([
        ["Établissement", v.businessName],
        ["ID carte", `${v.cardId}…`],
        ["Statut", "LIVRÉE"],
        ["Date", v.deliveredDate],
      ])}
      ${alert("⏳ Presque prête !", "Votre carte sera automatiquement activée dans les prochaines heures. Une fois activée, vous recevrez un email de confirmation et pourrez commencer à collecter des avis !")}
    `),
    text: `Votre carte NFC a été livrée !\n\nBonjour ${v.adminName},\nÉtablissement : ${v.businessName}\nCarte : ${v.cardId}…\nLivrée le : ${v.deliveredDate}\n\nActivation en cours…`,
  }),

  nfc_card_activated: (v) => ({
    subject: `Votre carte NFC est maintenant active — ${v.businessName}`,
    html: wrap(`
      <h2 style="color:#0891b2;margin:0 0 8px">🎉 Votre carte NFC est maintenant active !</h2>
      <p style="color:#374151;margin:0 0 20px">Bonjour <strong>${v.adminName}</strong>,</p>
      <p style="color:#374151;margin:0 0 8px">Fantastique ! Votre carte NFC pour <strong>${v.businessName}</strong> est désormais pleinement activée et prête à collecter des avis.</p>
      ${info([
        ["Établissement", v.businessName],
        ["ID carte", `${v.cardId}…`],
        ["Statut", "ACTIVE"],
        ["Activée le", v.activatedDate],
      ])}
      ${alert("🚀 Commencez à collecter des avis !", "Votre carte est en ligne et prête à l'emploi. Il suffit de l'approcher d'un téléphone ou de scanner le QR code pour commencer à recevoir des avis 5 étoiles !")}
    `),
    text: `Votre carte NFC est maintenant active !\n\nBonjour ${v.adminName},\nÉtablissement : ${v.businessName}\nCarte : ${v.cardId}…\nActivée le : ${v.activatedDate}\n\nVotre carte est prête à collecter des avis !`,
  }),

  nfc_card_disabled: (v) => ({
    subject: `Votre carte NFC a été désactivée — ${v.businessName}`,
    html: wrap(`
      <h2 style="color:#dc2626;margin:0 0 8px">⚠️ Votre carte NFC a été désactivée</h2>
      <p style="color:#374151;margin:0 0 20px">Bonjour <strong>${v.adminName}</strong>,</p>
      <p style="color:#374151;margin:0 0 8px">Votre carte NFC pour <strong>${v.businessName}</strong> a été désactivée et ne collecte plus d'avis.</p>
      ${info([
        ["Établissement", v.businessName],
        ["ID carte", `${v.cardId}…`],
        ["Statut", "DÉSACTIVÉE"],
        ["Date", v.disabledDate],
      ])}
      ${alert("❓ Pourquoi cette désactivation ?", "Votre carte peut avoir été désactivée pour maintenance, problème de compte ou à votre demande. Si vous pensez qu'il s'agit d'une erreur, contactez notre support immédiatement.")}
      <p style="color:#374151;font-size:14px">Pour réactiver votre carte, contactez le support à <a href="mailto:support@opinoor.com" style="color:#E10600">support@opinoor.com</a></p>
    `),
    text: `Votre carte NFC a été désactivée\n\nBonjour ${v.adminName},\nÉtablissement : ${v.businessName}\nCarte : ${v.cardId}…\nDate : ${v.disabledDate}\n\nContactez support@opinoor.com pour réactiver.`,
  }),

  // ── Avis ─────────────────────────────────────────────────────

  feedback_received: (v) => ({
    subject: `⭐ Nouvel avis ${v.stars}/5 — ${v.location}`,
    html: wrap(`
      <h2 style="color:#111827;margin:0 0 8px">Nouvel avis reçu</h2>
      <p style="color:#374151;margin:0 0 8px">Un client a laissé un avis pour <strong>${v.location}</strong>.</p>
      ${info([
        ["Note", `${v.stars} / 5 ⭐`],
        ["Établissement", v.location],
        ["Date", v.date],
      ])}
      ${v.message ? `<div style="background:#f3f4f6;border-radius:8px;padding:16px;margin:16px 0"><p style="color:#374151;font-style:italic;margin:0">« ${v.message} »</p></div>` : ""}
    `),
    text: `Nouvel avis ${v.stars}/5\n\nÉtablissement : ${v.location}\nDate : ${v.date}\n${v.message ? `\nMessage : « ${v.message} »` : ""}`,
  }),

  // ── Demande d'avis ───────────────────────────────────────────

  review_request: (v) => ({
    subject: `${v.company_name} — Votre avis nous intéresse !`,
    html: wrap(`
      <h2 style="color:#111827;margin:0 0 8px">Partagez votre expérience</h2>
      <p style="color:#374151;margin:0 0 16px">Bonjour <strong>${v.customer_name}</strong>,</p>
      <p style="color:#374151;margin:0 0 20px">${v.custom_message}</p>
      <p style="margin:24px 0">
        <a href="${v.review_url}" style="background:#E10600;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block">
          Laisser un avis
        </a>
      </p>
      <p style="color:#374151;font-size:14px">Merci,<br><strong>${v.company_name}</strong></p>
    `),
    text: `Bonjour ${v.customer_name},\n\n${v.custom_message}\n\nLaisser un avis : ${v.review_url}\n\nMerci,\n${v.company_name}`,
  }),

  // ── Équipe ───────────────────────────────────────────────────

  team_invite_new: (v) => ({
    subject: `Vous avez été invité à rejoindre ${v.company_name}`,
    html: wrap(`
      <h2 style="color:#111827;margin:0 0 8px">Vous êtes invité !</h2>
      <p style="color:#374151;margin:0 0 16px">Bonjour <strong>${v.member_name}</strong>,</p>
      <p style="color:#374151;margin:0 0 20px">Vous avez été invité à rejoindre <strong>${v.company_name}</strong> en tant que <strong>${v.role}</strong> sur Opinoor.</p>
      <p style="margin:24px 0">
        <a href="${v.invite_url}" style="background:#E10600;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block">
          Créer mon compte
        </a>
      </p>
      <p style="color:#6b7280;font-size:13px">Ce lien d'invitation est valable 7 jours.</p>
    `),
    text: `Vous avez été invité à rejoindre ${v.company_name} en tant que ${v.role}.\n\nCréez votre compte : ${v.invite_url}`,
  }),

  verification_code: (v) => ({
    subject: `Votre code de vérification — ${v.company_name}`,
    html: wrap(`
      <h2 style="color:#111827;margin:0 0 8px">Vérifiez votre compte</h2>
      <p style="color:#374151;margin:0 0 20px">Bonjour <strong>${v.name}</strong> 👋</p>
      <p style="color:#374151;margin:0 0 8px">
        Merci d'avoir créé votre compte <strong>${v.company_name}</strong>.<br>
        Pour activer votre accès, veuillez saisir le code de vérification ci-dessous :
      </p>
      <div style="background:linear-gradient(135deg,#f4f4f5,#e4e4e7);border:2px solid #E10600;border-radius:12px;padding:24px;text-align:center;margin:28px 0">
        <p style="font-size:11px;text-transform:uppercase;color:#71717a;margin:0 0 8px;font-weight:600;letter-spacing:.05em">Votre code de vérification</p>
        <p style="font-size:36px;font-weight:700;letter-spacing:8px;color:#E10600;font-family:monospace;margin:0">${v.formatted_code}</p>
      </div>
      <p style="color:#71717a;font-size:13px;text-align:center;margin:0 0 16px">Entrez ce code sur la page de vérification pour activer votre compte.</p>
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;font-size:12px;color:#92400e;margin-bottom:12px">
        ⚠️ <strong>Ce code expire dans ${v.expires_hours} heures.</strong><br>
        Sans vérification dans ce délai, votre compte sera automatiquement suspendu.
      </div>
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px 16px;font-size:12px;color:#1e40af">
        💡 <strong>Conseil de sécurité :</strong> Ne partagez jamais ce code avec qui que ce soit.
      </div>
    `),
    text: `Bonjour ${v.name},\n\nVotre code de vérification pour ${v.company_name} :\n\n${v.formatted_code}\n\nCe code expire dans ${v.expires_hours} heures.\nNe partagez jamais ce code avec qui que ce soit.\n\n© ${new Date().getFullYear()} Opinoor`,
  }),

  team_invite_existing: (v) => ({
    subject: `Vous avez été ajouté à ${v.company_name}`,
    html: wrap(`
      <h2 style="color:#111827;margin:0 0 8px">Nouvel accès accordé</h2>
      <p style="color:#374151;margin:0 0 16px">Bonjour <strong>${v.member_name}</strong>,</p>
      <p style="color:#374151;margin:0 0 20px">Vous avez été ajouté à <strong>${v.company_name}</strong> en tant que <strong>${v.role}</strong> sur Opinoor.</p>
      <p style="margin:24px 0">
        <a href="${v.invite_url}" style="background:#E10600;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block">
          Se connecter
        </a>
      </p>
    `),
    text: `Vous avez maintenant accès à ${v.company_name} en tant que ${v.role}.\n\nConnectez-vous : ${v.invite_url}`,
  }),
};
