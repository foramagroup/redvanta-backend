// src/services/emails/nfcCardStatus.email.js
import prisma from "../config/database.js";
import  SettingService  from '../services/superadmin/settingService.js';      
const appName = await SettingService.getCompanyName(); 
import { sendTemplatedMail } from "../services/client/mail.service.js";

/**
 * Envoie un email à l'admin quand le superadmin change le statut d'une carte NFC
 * @param {Object} card - NFCCard avec company et design includes
 * @param {String} status - PRINTED | SHIPPED | ACTIVE | DISABLED
 */
export async function sendNfcCardStatusEmail(card, status) {
  try {
    // Récupérer l'owner de la company
    const ownerLink = await prisma.userCompany.findFirst({
      where: { companyId: card.companyId, isOwner: true },
      include: { user: true }
    });

    if (!ownerLink) {
      console.log(`[email] ⚠️ No owner found for company ${card.companyId}, skip email`);
      return;
    }

    const adminEmail = ownerLink.user.email;
    const adminName = ownerLink.user.name || "Customer";
    const companyName = card.company?.name || "Your business";
    const businessName = card.design?.businessName || card.locationName || companyName;
    const cardId = card.uid.slice(0, 8);
    const today = new Date().toLocaleDateString("en-US", { 
      year: "numeric", 
      month: "long", 
      day: "numeric" 
    });

    // Router vers le bon template
    switch (status) {
      case "PRINTED":
        await sendPrintedEmail(adminEmail, adminName, businessName, cardId, today);
        break;
      case "SHIPPED":
        await sendShippedEmail(adminEmail, adminName, businessName, cardId, today);
        break;
    case "DELIVERED":  // ✅ NOUVEAU
        await sendDeliveredEmail(adminEmail, adminName, businessName, cardId, today);
        break;
      case "ACTIVE":
        await sendActivatedEmail(adminEmail, adminName, businessName, cardId, today);
        break;
      case "DISABLED":
        await sendDisabledEmail(adminEmail, adminName, businessName, cardId, today);
        break;
      default:
        console.log(`[email] ⚠️ No email template for status: ${status}`);
    }

    console.log(`[email] ✅ ${status} email sent to ${adminEmail} for card ${cardId}`);

  } catch (error) {
    console.error(`[email] ❌ Error sending ${status} email:`, error);
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────
// ✅ PRINTED - Card has been printed
// ─────────────────────────────────────────────────────────────

async function sendPrintedEmail(to, adminName, businessName, cardId, date) {
  await sendTemplatedMail({
    slug: "nfc_card_printed",
    to,
    variables: { adminName, businessName, cardId, printedDate: date },
    fallbackFn: () => ({
      subject: `✅ Your NFC Card Has Been Printed - ${businessName}`,
      html: buildEmailHtml({
        emoji: "✅",
        gradient: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
        title: "Your NFC Card Has Been Printed!",
        greeting: `Hello <strong>${adminName}</strong>,`,
        message: `Great news! Your NFC card for <strong>${businessName}</strong> has been successfully printed and is now ready for the next step.`,
        status: "PRINTED",
        statusBg: "#dbeafe",
        statusColor: "#1e40af",
        cardId,
        businessName,
        date,
        footer: "Your card will be shipped shortly. You'll receive another notification once it's on its way!"
      }),
      text: buildEmailText({
        title: "Your NFC Card Has Been Printed!",
        adminName,
        businessName,
        cardId,
        status: "PRINTED",
        date,
        footer: "Your card will be shipped shortly. You'll receive another notification once it's on its way!"
      })
    })
  });
}


// ─────────────────────────────────────────────────────────────
// 📬 DELIVERED - Card has been delivered
// ─────────────────────────────────────────────────────────────
async function sendDeliveredEmail(to, adminName, businessName, cardId, date) {
  await sendTemplatedMail({
    slug: "nfc_card_delivered",
    to,
    variables: { adminName, businessName, cardId, deliveredDate: date },
    fallbackFn: () => ({
      subject: `📬 Your NFC Card Has Been Delivered - ${businessName}`,
      html: buildEmailHtml({
        emoji: "📬",
        gradient: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
        title: "Your NFC Card Has Been Delivered!",
        greeting: `Hello <strong>${adminName}</strong>,`,
        message: `Perfect! Your NFC card for <strong>${businessName}</strong> has been successfully delivered to your address.`,
        status: "DELIVERED",
        statusBg: "#fef3c7",
        statusColor: "#92400e",
        cardId,
        businessName,
        date,
        alert: {
          title: "⏳ Almost Ready!",
          message: "Your card will be automatically activated within the next few hours. Once activated, you'll receive a final confirmation email and can start collecting reviews immediately!"
        },
        footer: "Keep an eye out for your activation confirmation email coming soon."
      }),
      text: buildEmailText({
        title: "Your NFC Card Has Been Delivered!",
        adminName,
        businessName,
        cardId,
        status: "DELIVERED",
        date,
        alert: "Your card will be automatically activated within the next few hours. Once activated, you'll receive a final confirmation email and can start collecting reviews immediately!",
        footer: "Keep an eye out for your activation confirmation email coming soon."
      })
    })
  });
}

// ─────────────────────────────────────────────────────────────
// 📦 SHIPPED - Card has been shipped
// ─────────────────────────────────────────────────────────────

async function sendShippedEmail(to, adminName, businessName, cardId, date) {
  await sendTemplatedMail({
    slug: "nfc_card_shipped",
    to,
    variables: { adminName, businessName, cardId, shippedDate: date },
    fallbackFn: () => ({
      subject: `📦 Your NFC Card Has Been Shipped - ${businessName}`,
      html: buildEmailHtml({
        emoji: "📦",
        gradient: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
        title: "Your NFC Card Is On Its Way!",
        greeting: `Hello <strong>${adminName}</strong>,`,
        message: `Excellent news! Your NFC card for <strong>${businessName}</strong> has been shipped and is now on its way to you.`,
        status: "SHIPPED",
        statusBg: "#e0e7ff",
        statusColor: "#5b21b6",
        cardId,
        businessName,
        date,
        alert: {
          title: "📍 What's Next?",
          message: "Your card should arrive within 5-7 business days. Once delivered, it will be automatically activated and ready to use immediately!"
        },
        footer: "We'll send you one more notification when your card is delivered and activated."
      }),
      text: buildEmailText({
        title: "Your NFC Card Is On Its Way!",
        adminName,
        businessName,
        cardId,
        status: "SHIPPED",
        date,
        alert: "Your card should arrive within 5-7 business days. Once delivered, it will be automatically activated and ready to use immediately!",
        footer: "We'll send you one more notification when your card is delivered and activated."
      })
    })
  });
}

// ─────────────────────────────────────────────────────────────
// 🎉 ACTIVE - Card has been activated
// ─────────────────────────────────────────────────────────────

async function sendActivatedEmail(to, adminName, businessName, cardId, date) {
  await sendTemplatedMail({
    slug: "nfc_card_activated",
    to,
    variables: { adminName, businessName, cardId, activatedDate: date },
    fallbackFn: () => ({
      subject: `🎉 Your NFC Card Is Now Active - ${businessName}`,
      html: buildEmailHtml({
        emoji: "🎉",
        gradient: "linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)",
        title: "Your NFC Card Is Now Active!",
        greeting: `Hello <strong>${adminName}</strong>,`,
        message: `Fantastic! Your NFC card for <strong>${businessName}</strong> has been delivered and is now fully activated and ready to collect reviews.`,
        status: "ACTIVE",
        statusBg: "#d1fae5",
        statusColor: "#065f46",
        cardId,
        businessName,
        date,
        alert: {
          title: "🚀 Start Collecting Reviews!",
          message: "Your card is live and ready to use. Simply tap it to a phone or scan the QR code to start collecting 5-star reviews from your customers!"
        },
        footer: "Need help getting started? Check out our quick start guide or contact support."
      }),
      text: buildEmailText({
        title: "Your NFC Card Is Now Active!",
        adminName,
        businessName,
        cardId,
        status: "ACTIVE",
        date,
        alert: "Your card is live and ready to use. Simply tap it to a phone or scan the QR code to start collecting 5-star reviews!",
        footer: "Need help getting started? Check out our quick start guide or contact support."
      })
    })
  });
}

// ─────────────────────────────────────────────────────────────
// 🔴 DISABLED - Card has been disabled
// ─────────────────────────────────────────────────────────────

async function sendDisabledEmail(to, adminName, businessName, cardId, date) {
  await sendTemplatedMail({
    slug: "nfc_card_disabled",
    to,
    variables: { adminName, businessName, cardId, disabledDate: date },
    fallbackFn: () => ({
      subject: `⚠️ Your NFC Card Has Been Disabled - ${businessName}`,
      html: buildEmailHtml({
        emoji: "⚠️",
        gradient: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
        title: "Your NFC Card Has Been Disabled",
        greeting: `Hello <strong>${adminName}</strong>,`,
        message: `Your NFC card for <strong>${businessName}</strong> has been disabled and is no longer collecting reviews.`,
        status: "DISABLED",
        statusBg: "#fee2e2",
        statusColor: "#991b1b",
        cardId,
        businessName,
        date,
        alert: {
          title: "❓ Why Was This Disabled?",
          message: "Your card may have been disabled for maintenance, account issues, or at your request. If you believe this is an error, please contact our support team immediately."
        },
        footer: "To reactivate your card, please contact support at support@opinoor.com"
      }),
      text: buildEmailText({
        title: "Your NFC Card Has Been Disabled",
        adminName,
        businessName,
        cardId,
        status: "DISABLED",
        date,
        alert: "Your card may have been disabled for maintenance, account issues, or at your request. If you believe this is an error, please contact support.",
        footer: "To reactivate your card, please contact support at support@opinoor.com"
      })
    })
  });
}

// ─────────────────────────────────────────────────────────────
// 🎨 HTML Email Builder
// ─────────────────────────────────────────────────────────────

function buildEmailHtml({ emoji, gradient, title, greeting, message, status, statusBg, statusColor, cardId, businessName, date, alert, footer }) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
      <div style="background-color: white; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 32px;">
          <div style="width: 64px; height: 64px; background: ${gradient}; border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
            <span style="font-size: 32px;">${emoji}</span>
          </div>
          <h1 style="color: #111827; font-size: 24px; font-weight: 700; margin: 0;">
            ${title}
          </h1>
        </div>

        <!-- Content -->
        <div style="margin-bottom: 24px;">
          <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
            ${greeting}
          </p>
          
          <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
            ${message}
          </p>

          <!-- Card Info Box -->
          <div style="background-color: #f3f4f6; border-radius: 8px; padding: 20px; margin: 24px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 40%;">Business Name:</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600;">${businessName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Card ID:</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px; font-family: monospace;">${cardId}...</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Status:</td>
                <td style="padding: 8px 0;">
                  <span style="background-color: ${statusBg}; color: ${statusColor}; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600;">
                    ${status}
                  </span>
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Date:</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px;">${date}</td>
              </tr>
            </table>
          </div>

          ${alert ? `
          <!-- Alert Box -->
          <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-left: 4px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 24px 0;">
            <h3 style="color: #92400e; font-size: 14px; font-weight: 700; margin: 0 0 8px 0;">
              ${alert.title}
            </h3>
            <p style="color: #78350f; font-size: 14px; line-height: 1.5; margin: 0;">
              ${alert.message}
            </p>
          </div>
          ` : ''}

          <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 24px 0 0 0;">
            ${footer}
          </p>
        </div>

        <!-- Footer -->
        <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb; text-align: center;">
          <p style="color: #6b7280; font-size: 14px; margin: 0;">
            Questions? Contact us at <a href="mailto:support@opinoor.com" style="color: #2563eb; text-decoration: none;">support@opinnor.com</a>
          </p>
          <p style="color: #9ca3af; font-size: 12px; margin: 12px 0 0 0;">
            © ${new Date().getFullYear()} ${appName}. All rights reserved.
          </p>
        </div>

      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────
// 📄 Text Email Builder (fallback)
// ─────────────────────────────────────────────────────────────

function buildEmailText({ title, adminName, businessName, cardId, status, date, alert, footer }) {
  return `
${title}

Hello ${adminName},

Great news! Your NFC card for ${businessName} has been updated.

Card Details:
- Business Name: ${businessName}
- Card ID: ${cardId}...
- Status: ${status}
- Date: ${date}

${alert ? `\n${alert}\n` : ''}

${footer}

Questions? Contact us at support@opinoor.com

© ${new Date().getFullYear()} ${appName}. All rights reserved.
  `.trim();
}