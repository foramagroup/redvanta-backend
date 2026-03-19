
export function buildWelcomeEmail({ companyName, adminName, email, password, loginUrl, primaryColor = "#E10600" }) {
  return {
    subject: `Bienvenue sur REDVANTA — Vos accès pour ${companyName}`,
    html: `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bienvenue sur REDVANTA</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f4f4f5; color: #18181b; }
    .wrapper { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: ${primaryColor}; padding: 36px 40px; text-align: center; }
    .header h1 { color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.3px; }
    .header p { color: rgba(255,255,255,0.85); font-size: 14px; margin-top: 6px; }
    .body { padding: 40px; }
    .greeting { font-size: 18px; font-weight: 600; margin-bottom: 12px; color: #18181b; }
    .text { font-size: 15px; line-height: 1.7; color: #52525b; margin-bottom: 20px; }
    .credentials-box { background: #f4f4f5; border: 1px solid #e4e4e7; border-radius: 10px; padding: 24px; margin: 28px 0; }
    .credentials-box h3 { font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #71717a; margin-bottom: 16px; }
    .cred-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #e4e4e7; }
    .cred-row:last-child { border-bottom: none; }
    .cred-label { font-size: 13px; color: #71717a; }
    .cred-value { font-size: 14px; font-weight: 600; color: #18181b; font-family: 'Courier New', monospace; background: #ffffff; padding: 4px 10px; border-radius: 6px; border: 1px solid #e4e4e7; }
    .cta-btn { display: block; width: fit-content; margin: 28px auto; padding: 14px 32px; background: ${primaryColor}; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 15px; font-weight: 600; text-align: center; }
    .warning-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 14px 18px; margin: 24px 0; }
    .warning-box p { font-size: 13px; color: #92400e; line-height: 1.6; }
    .warning-box strong { color: #78350f; }
    .footer { background: #f4f4f5; padding: 24px 40px; text-align: center; }
    .footer p { font-size: 12px; color: #a1a1aa; line-height: 1.6; }
    .footer a { color: #71717a; text-decoration: underline; }
    .divider { height: 1px; background: #e4e4e7; margin: 28px 0; }
    .feature-list { list-style: none; margin: 16px 0; }
    .feature-list li { font-size: 14px; color: #52525b; padding: 6px 0; padding-left: 20px; position: relative; }
    .feature-list li::before { content: "✓"; position: absolute; left: 0; color: ${primaryColor}; font-weight: 700; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>REDVANTA</h1>
      <p>Plateforme de gestion des avis clients</p>
    </div>

    <div class="body">
      <p class="greeting">Bonjour ${adminName} 👋</p>

      <p class="text">
        Félicitations ! Votre compte <strong>${companyName}</strong> a été créé avec succès sur la plateforme REDVANTA.
        Vous pouvez dès maintenant accéder à votre espace et commencer à gérer vos avis clients.
      </p>

      <div class="credentials-box">
        <h3>Vos identifiants de connexion</h3>
        <div class="cred-row">
          <span class="cred-label">Adresse email</span>
          <span class="cred-value">${email}</span>
        </div>
        <div class="cred-row">
          <span class="cred-label">Mot de passe temporaire</span>
          <span class="cred-value">${password}</span>
        </div>
        <div class="cred-row">
          <span class="cred-label">Entreprise</span>
          <span class="cred-value">${companyName}</span>
        </div>
      </div>

      <div class="warning-box">
        <p>
          ⚠️ <strong>Changez votre mot de passe</strong> dès votre première connexion.
          Ce mot de passe temporaire a été généré automatiquement. Pour votre sécurité,
          définissez un nouveau mot de passe personnel immédiatement après connexion.
        </p>
      </div>

      <a href="${loginUrl}" class="cta-btn">Accéder à mon espace →</a>

      <div class="divider"></div>

      <p class="text" style="font-size: 14px;">Avec votre compte REDVANTA, vous pouvez :</p>
      <ul class="feature-list">
        <li>Gérer vos emplacements et points de vente</li>
        <li>Collecter et analyser les avis clients</li>
        <li>Personnaliser votre carte NFC et QR code</li>
        <li>Suivre vos statistiques en temps réel</li>
        <li>Configurer vos intégrations Google, Facebook, Yelp</li>
      </ul>

      <div class="divider"></div>

      <p class="text" style="font-size: 13px; color: #71717a;">
        Si vous avez des questions, notre équipe support est disponible à
        <a href="mailto:support@redvanta.com" style="color: ${primaryColor};">support@redvanta.com</a>
      </p>
    </div>

    <div class="footer">
      <p>
        Cet email a été envoyé automatiquement par REDVANTA.<br />
        <a href="${loginUrl}">Se connecter</a> · <a href="mailto:support@redvanta.com">Support</a>
      </p>
      <p style="margin-top: 8px;">© ${new Date().getFullYear()} REDVANTA. Tous droits réservés.</p>
    </div>
  </div>
</body>
</html>`,
    text: `
Bienvenue sur REDVANTA — ${companyName}

Bonjour ${adminName},

Félicitations ! Votre compte a été créé avec succès.

Vos identifiants :
- Email     : ${email}
- Mot de passe : ${password}
- Entreprise  : ${companyName}

⚠️ Changez votre mot de passe dès la première connexion.

Accéder à votre espace : ${loginUrl}

Support : support@redvanta.com
© ${new Date().getFullYear()} REDVANTA
`.trim(),
  };
}