// src/templates/confirmEmail.template.js

export function buildConfirmEmailTemplate({ name, companyName, confirmUrl, expiresHours = 48, primaryColor = "#E10600" }) {
  return {
    subject: `Confirmez votre adresse email — ${companyName}`,
    html: `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Confirmer votre email</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f4f4f5;color:#18181b}
    .wrap{max-width:580px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)}
    .header{background:${primaryColor};padding:32px 40px;text-align:center}
    .header h1{color:#fff;font-size:22px;font-weight:700;letter-spacing:-.3px}
    .header p{color:rgba(255,255,255,.8);font-size:13px;margin-top:4px}
    .body{padding:40px}
    .greeting{font-size:17px;font-weight:600;margin-bottom:12px}
    .text{font-size:14px;line-height:1.7;color:#52525b;margin-bottom:18px}
    .btn-wrap{text-align:center;margin:28px 0}
    .btn{display:inline-block;padding:14px 36px;background:${primaryColor};color:#fff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600}
    .url-box{background:#f4f4f5;border:1px solid #e4e4e7;border-radius:8px;padding:12px 16px;font-family:monospace;font-size:11px;color:#71717a;word-break:break-all;margin:16px 0}
    .warning{background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;font-size:12px;color:#92400e;margin-top:20px}
    .footer{background:#f4f4f5;padding:20px 40px;text-align:center;font-size:11px;color:#a1a1aa}
  </style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <h1>REDVANTA</h1>
    <p>Confirmation d'adresse email</p>
  </div>
  <div class="body">
    <p class="greeting">Bonjour ${name} 👋</p>
    <p class="text">
      Merci d'avoir créé votre compte <strong>${companyName}</strong> sur REDVANTA.<br/>
      Pour activer votre accès, veuillez confirmer votre adresse email en cliquant sur le bouton ci-dessous.
    </p>
    <div class="btn-wrap">
      <a href="${confirmUrl}" class="btn">Confirmer mon email →</a>
    </div>
    <p class="text" style="font-size:12px;color:#71717a">
      Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :
    </p>
    <div class="url-box">${confirmUrl}</div>
    <div class="warning">
      ⚠️ Ce lien est valable <strong>${expiresHours} heures</strong>.<br/>
      Sans confirmation dans ce délai, votre compte sera suspendu automatiquement.
    </div>
  </div>
  <div class="footer">
    <p>© ${new Date().getFullYear()} REDVANTA. Si vous n'avez pas créé ce compte, ignorez cet email.</p>
  </div>
</div>
</body>
</html>`,
    text: `
Bonjour ${name},

Merci d'avoir créé votre compte "${companyName}" sur REDVANTA.

Confirmez votre email en cliquant sur ce lien :
${confirmUrl}

Ce lien est valable ${expiresHours} heures.
Sans confirmation, votre compte sera suspendu.

© ${new Date().getFullYear()} REDVANTA
`.trim(),
  };
}