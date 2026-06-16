import PDFDocument from "pdfkit";

const PLATFORM = {
  name:    process.env.COMPANY_NAME    || "OPINOOR",
  address: process.env.COMPANY_ADDRESS || "1 Performance Plaza · Bucharest, Romania",
  email:   process.env.COMPANY_EMAIL   || "billing@redvanta.com",
  reg:     process.env.COMPANY_REG     || "RO123456789",
};

const RED   = "#e11d48";
const DARK  = "#0f0f0f";
const GREY  = "#6b6b6b";
const LIGHT = "#f5f5f7";

const CURRENCY_SYMBOL = { EUR: "€", USD: "$", GBP: "£" };

export function generateInvoicePdfBuffer(inv) {
  return new Promise((resolve, reject) => {
    const doc    = new PDFDocument({ size: "A4", margin: 0 });
    const chunks = [];
    doc.on("data",  chunk => chunks.push(chunk));
    doc.on("end",   ()    => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = doc.page.width;
    const M = 48;
    const sym = CURRENCY_SYMBOL[inv.currency] || "€";

    // ── Red top bar ──
    doc.rect(0, 0, W, 6).fill(RED);

    // ── Header left: platform name + address ──
    doc.font("Helvetica-Bold").fontSize(18).fillColor(DARK)
       .text(PLATFORM.name, M, M + 10);
    doc.font("Helvetica").fontSize(9).fillColor(GREY)
       .text(PLATFORM.address, M, M + 32)
       .text(PLATFORM.email,   M, M + 44)
       .text(`Reg: ${PLATFORM.reg}`, M, M + 56);

    // ── Header right: INVOICE + number + dates ──
    const RW = W - 2 * M; // content width (respects both margins)
    doc.font("Helvetica-Bold").fontSize(26).fillColor(DARK)
       .text("INVOICE", M, M + 10, { align: "right", width: RW });
    doc.font("Helvetica").fontSize(10).fillColor(GREY);
    const invNumber = inv.invoiceNumber || inv.id;
    doc.text(`# ${invNumber}`,    M, M + 44, { align: "right", width: RW });
    const issDate = inv.invoiceDate
      ? new Date(inv.invoiceDate).toLocaleDateString("fr-FR") : "-";
    const dueDate = inv.dueDate
      ? new Date(inv.dueDate).toLocaleDateString("fr-FR") : "-";
    doc.text(`Issued: ${issDate}`, M, M + 57, { align: "right", width: RW });
    doc.text(`Due: ${dueDate}`,    M, M + 70, { align: "right", width: RW });

    // ── Divider ──
    const divY = M + 90;
    doc.moveTo(M, divY).lineTo(W - M, divY).strokeColor("#e6e6e6").lineWidth(1).stroke();

    // ── Bill To / From ──
    const blockY = divY + 18;
    doc.font("Helvetica").fontSize(8).fillColor("#999")
       .text("BILL TO", M, blockY)
       .text("FROM",    W / 2 + 12, blockY);

    const billName = inv.billingName || inv.company?.name || "Client";
    const billEmail = inv.billingEmail || "";
    const billPhone = inv.billingPhone || "";

    doc.font("Helvetica-Bold").fontSize(11).fillColor(DARK)
       .text(billName,        M,          blockY + 14)
       .text(PLATFORM.name,  W / 2 + 12, blockY + 14);

    doc.font("Helvetica").fontSize(9).fillColor(GREY);
    let bY = blockY + 28;
    if (billEmail) { doc.text(billEmail, M, bY); bY += 12; }
    if (billPhone) { doc.text(billPhone, M, bY); }
    doc.text(PLATFORM.address, W / 2 + 12, blockY + 28)
       .text(PLATFORM.email,   W / 2 + 12, blockY + 40);

    // ── Status badge ──
    const badgeColors = {
      paid:      RED,
      pending:   "#eab308",
      failed:    RED,
      overdue:   "#f97316",
      refunded:  "#888",
      draft:     "#888",
      sent:      "#3b82f6",
    };
    const badgeColor = badgeColors[String(inv.status).toLowerCase()] || "#888";
    const badgeX = W - M - 72;
    const badgeY = blockY + 48;
    doc.roundedRect(badgeX, badgeY, 72, 18, 9).fill(badgeColor);
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#fff")
       .text(String(inv.status || "").toUpperCase(), badgeX, badgeY + 4,
         { width: 72, align: "center" });

    // ── Items table ──
    const tableTop = blockY + 82;
    doc.rect(M, tableTop, W - 2 * M, 24).fill(LIGHT);
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#505050");
    doc.text("ITEM",       M + 10,        tableTop + 8);
    doc.text("QTY",        W - M - 220,   tableTop + 8, { width: 40, align: "right" });
    doc.text("UNIT PRICE", W - M - 170,   tableTop + 8, { width: 80, align: "right" });
    doc.text("TOTAL",      W - M - 70,    tableTop + 8, { width: 60, align: "right" });

    let rowY = tableTop + 24;
    let subtotal = 0;
    let taxTotal = 0;

    // Pour les factures subscription (pas addon), on injecte les addons actifs non déjà listés
    const activeAddons = inv.reference !== "addon"
      ? (() => {
          const existingItemNames = new Set((inv.items || []).map((i) => (i.service || "").toLowerCase()));
          return (inv.company?.subscription?.addons ?? [])
            .filter((a) => a.status === "active" && !existingItemNames.has((a.addon?.name || "").toLowerCase()))
            .map((a) => ({
              service:     a.addon?.name ?? "Add-on",
              description: "Active subscription add-on",
              quantity:    a.quantity ?? 1,
              unitPrice:   Number(a.amount ?? 0),
              taxRate:     0,
              discount:    0,
              total:       Number(a.amount ?? 0) * (a.quantity ?? 1),
            }));
        })()
      : [];

    const allItems = [...(inv.items || []), ...activeAddons];

    allItems.forEach((item, idx) => {
      const qty        = Number(item.quantity ?? item.qty ?? 0);
      const unitPrice  = Number(item.unitPrice ?? item.price ?? 0);
      const taxRate    = Number(item.taxRate ?? 0);
      const lineSub    = qty * unitPrice - Number(item.discount ?? 0);
      const lineTax    = lineSub * (taxRate / 100);
      const lineTotal  = Number(item.total ?? (lineSub + lineTax));
      subtotal += lineSub;
      taxTotal += lineTax;

      const rowH = 38;
      if (idx % 2 === 1) {
        doc.rect(M, rowY, W - 2 * M, rowH).fill("#fafafa");
      }

      doc.font("Helvetica-Bold").fontSize(10).fillColor(DARK)
         .text(item.service || "-", M + 10, rowY + 8, { width: W - 2 * M - 260 });
      if (item.description) {
        doc.font("Helvetica").fontSize(8).fillColor(GREY)
           .text(item.description, M + 10, rowY + 22, { width: W - 2 * M - 260 });
      }

      doc.font("Helvetica").fontSize(10).fillColor(DARK)
         .text(String(qty),                    W - M - 220, rowY + 12, { width: 40,  align: "right" })
         .text(`${sym}${unitPrice.toFixed(2)}`, W - M - 170, rowY + 12, { width: 80,  align: "right" });
      doc.font("Helvetica-Bold").fontSize(10).fillColor(DARK)
         .text(`${sym}${lineTotal.toFixed(2)}`, W - M - 70,  rowY + 12, { width: 60,  align: "right" });

      rowY += rowH;
    });

    // ── Totals ──
    rowY += 16;
    const totL = W - M - 260;
    const totR = W - M;

    doc.moveTo(totL, rowY).lineTo(totR, rowY).strokeColor("#e6e6e6").lineWidth(1).stroke();
    rowY += 20;

    const totRow = (label, value, bold = false) => {
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 12 : 10)
         .fillColor(bold ? DARK : GREY)
         .text(label, totL, rowY, { width: 130 })
         .text(value, totR - 80, rowY, { width: 80, align: "right" });
      rowY += bold ? 22 : 18;
    };

    totRow("Subtotal", `${sym}${subtotal.toFixed(2)}`);
    totRow("Tax",      `${sym}${taxTotal.toFixed(2)}`);
    doc.moveTo(totL, rowY - 4).lineTo(totR, rowY - 4).strokeColor(DARK).lineWidth(1).stroke();
    rowY += 4;
    // Use the actual invoice total from the DB to avoid double-counting addons
    const actualTotal = Number(inv.displayTotal ?? inv.total ?? (subtotal + taxTotal));
    totRow("Total Due", `${sym}${actualTotal.toFixed(2)}`, true);

    // ── Payment method ──
    if (inv.paymentMethod) {
      rowY += 10;
      doc.font("Helvetica").fontSize(9).fillColor("#999")
         .text("PAYMENT METHOD", M, rowY);
      doc.font("Helvetica").fontSize(10).fillColor(DARK)
         .text(inv.paymentMethod, M, rowY + 14);
    }

    // ── Footer ──
    const pageH = doc.page.height;
    doc.moveTo(M, pageH - 72).lineTo(W - M, pageH - 72)
       .strokeColor("#e6e6e6").lineWidth(1).stroke();
    doc.font("Helvetica").fontSize(9).fillColor(GREY)
       .text("Thank you for your business.", M, pageH - 52)
       .text(`Questions? ${PLATFORM.email}`, M, pageH - 38)
       .text("Page 1 of 1", W - M - 60, pageH - 38, { width: 60, align: "right" });

    doc.end();
  });
}
