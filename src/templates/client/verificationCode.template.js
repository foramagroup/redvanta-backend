// src/templates/client/verificationCode.template.js

export function buildVerificationCodeTemplate({ 
  name, 
  companyName, 
  verificationCode, 
  expiresHours = 72, 
  primaryColor = "#E10600" 
}) {
  const formattedCode = `${verificationCode.substring(0, 3)} ${verificationCode.substring(3)}`;
  
  return {
    subject: `Votre code de vérification — ${companyName}`,
    html: `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Code de vérification</title>
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
    .code-box{background:linear-gradient(135deg,#f4f4f5,#e4e4e7);border:2px solid ${primaryColor};border-radius:12px;padding:24px;text-align:center;margin:28px 0}
    .code{font-size:36px;font-weight:700;letter-spacing:8px;color:${primaryColor};font-family:monospace}
    .code-label{font-size:11px;text-transform:uppercase;color:#71717a;margin-bottom:8px;font-weight:600}
    .warning{background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;font-size:12px;color:#92400e;margin-top:20px}
    .info{background:#eff6ff;border:1px solid:#bfdbfe;border-radius:8px;padding:12px 16px;font-size:12px;color:#1e40af;margin-top:16px}
    .footer{background:#f4f4f5;padding:20px 40px;text-align:center;font-size:11px;color:#a1a1aa}
  </style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <h1>REDVANTA</h1>
    <p>Vérification de votre compte</p>
  </div>
  <div class="body">
    <p class="greeting">Bonjour ${name} 👋</p>
    <p class="text">
      Merci d'avoir créé votre compte <strong>${companyName}</strong> sur REDVANTA.<br/>
      Pour activer votre accès, veuillez saisir le code de vérification ci-dessous :
    </p>
    
    <div class="code-box">
      <div class="code-label">Votre code de vérification</div>
      <div class="code">${formattedCode}</div>
    </div>
    
    <p class="text" style="font-size:13px;color:#71717a;text-align:center">
      Entrez ce code sur la page de vérification pour activer votre compte.
    </p>
    
    <div class="warning">
      ⚠️ <strong>Ce code expire dans ${expiresHours} heures.</strong><br/>
      Sans vérification dans ce délai, votre compte sera automatiquement suspendu pour des raisons de sécurité.
    </div>
    
    <div class="info">
      💡 <strong>Conseil de sécurité :</strong><br/>
      Ne partagez jamais ce code avec qui que ce soit. L'équipe REDVANTA ne vous demandera jamais ce code.
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

Votre code de vérification :

${formattedCode}

Entrez ce code sur la page de vérification pour activer votre compte.

⚠️ Ce code expire dans ${expiresHours} heures.
Sans vérification, votre compte sera suspendu automatiquement.

Ne partagez jamais ce code avec qui que ce soit.

© ${new Date().getFullYear()} REDVANTA
`.trim(),
  };
}