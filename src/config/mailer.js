import nodemailer from 'nodemailer';

const SENDGRID_KEY = process.env.SENDGRID_API_KEY || '';
let sgMail = null;

// Load SendGrid lazily so local/dev can run without the package installed.
async function getSendGridClient() {
  if (!SENDGRID_KEY) return null;
  if (sgMail) return sgMail;

  try {
    const mod = await import('@sendgrid/mail');
    sgMail = mod.default;
    sgMail.setApiKey(SENDGRID_KEY);
    return sgMail;
  } catch {
    return null;
  }
}

// Send email via SendGrid if available, otherwise fallback to nodemailer
export async function sendEmail({ to, subject, html, text, from }) {
  const sendGridClient = await getSendGridClient();
  if (sendGridClient) {
    const msg = {
      to,
      from: from || process.env.EMAIL_FROM || 'no-reply@krootal.local',
      subject,
      html,
      text
    };
    return sendGridClient.send(msg);
  }

  // Fallback nodemailer (dev environment)
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.example.com",
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const info = await transporter.sendMail({
    from: process.env.FROM_EMAIL || "no-reply@krootal-review.com",
    to,
    subject,
    text,
    html,
  });

  return info;
}

// Convenience wrapper for invitation emails
export async function sendInvitationEmail(opts) {
  return sendEmail(opts);
}
