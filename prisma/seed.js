import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seed start");

  const modules = [
    "Accounts",
    "Billing",
    "Pricing",
    "Integrations",
    "Events",
    "Security",
    "Analytics"
  ];

  const permissions = [
    "View",
    "Edit",
    "Delete",
    "Impersonate",
    "Refund",
    "Suspend"
  ];

  const roles = [
    "Super Admin",
    "Finance Admin",
    "Support Admin",
    "Technical Admin",
    "Growth Admin"
  ];

  for (const mod of modules) {
    await prisma.module.upsert({
      where: { name: mod },
      update: {},
      create: { name: mod }
    });
  }

  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { name: perm },
      update: {},
      create: { name: perm }
    });
  }

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role },
      update: {},
      create: { name: role }
    });
  }


  //  await prisma.featureFlag.createMany({
  //   data: [
  //     {
  //       name: "new_dashboard_ui",
  //       description: "Redesigned dashboard interface",
  //       scope: "All",
  //       enabled: true
  //     },
  //     {
  //       name: "advanced_automation_v2",
  //       description: "Next-gen automation engine",
  //       scope: "Beta Accounts",
  //       enabled: false
  //     },
  //     {
  //       name: "ai_review_response",
  //       description: "AI-powered review replies",
  //       scope: "Pro + Agency",
  //       enabled: true
  //     },
  //     {
  //       name: "multi_language_support",
  //       description: "Multi-language review forms",
  //       scope: "All",
  //       enabled: false
  //     },
  //     {
  //       name: "webhook_v2",
  //       description: "Enhanced webhook delivery system",
  //       scope: "All",
  //       enabled: true
  //     },
  //     {
  //       name: "white_label_custom_domain",
  //       description: "Custom domain for white-label",
  //       scope: "Agency",
  //       enabled: true
  //     }
  //   ],
  //   skipDuplicates: true
  // });

  // ------------------------------
  // USERS
  // ------------------------------
  const adminPassword = await bcrypt.hash(process.env.ADMIN_DEFAULT_PASSWORD || "Admin123!", 10);
  const superadminPassword = await bcrypt.hash(process.env.SUPERADMIN_DEFAULT_PASSWORD || "SuperAdmin123!", 10);

  await prisma.user.upsert({
    where: { email: "superadmin@demo.local" },
    update: {
      role: "superadmin",
      isSuperadmin: true,
      superadminSince: new Date(),
    },
    create: {
      id: randomBytes(16).toString("hex"),
      email: "superadmin@demo.local",
      password: superadminPassword,
      role: "superadmin",
      isSuperadmin: true,
      superadminSince: new Date(),
      name: "Super Admin",
      phone: "+33100000000",
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: "admin@demo.local" },
    update: {},
    create: {
      id: randomBytes(16).toString("hex"),
      email: "admin@demo.local",
      password: adminPassword,
      role: "admin",
      name: "Admin User",
      phone: "+33123456789",
    },
  });

  const userPassword = await bcrypt.hash("User123!", 10);
  const user = await prisma.user.upsert({
    where: { email: "user@demo.local" },
    update: {},
    create: {
      id: randomBytes(16).toString("hex"),
      email: "user@demo.local",
      password: userPassword,
      role: "user",
      name: "Normal User",
      phone: "+33198765432",
    },
  });

  // ------------------------------
  // LOCATIONS
  // ------------------------------
  const paris = await prisma.location.upsert({
    where: { slug: "studio-paris" },
    update: {},
    create: {
      id: randomBytes(16).toString("hex"),
      ownerId: admin.id,
      name: "Studio Paris",
      slug: "studio-paris",
      address: "10 Rue de Paris",
      city: "Paris",
      country: "FR",
      phone: "+33122334455",
      email: "contact.paris@demo.local",
    },
  });

  const lyon = await prisma.location.upsert({
    where: { slug: "studio-lyon" },
    update: {},
    create: {
      id: randomBytes(16).toString("hex"),
      ownerId: admin.id,
      name: "Studio Lyon",
      slug: "studio-lyon",
      address: "20 Rue de Lyon",
      city: "Lyon",
      country: "FR",
      phone: "+33411223344",
      email: "contact.lyon@demo.local",
    },
  });

  // ------------------------------
  // PRODUCTS
  // ------------------------------
  const p1 = await prisma.product.upsert({
    where: { slug: "nfc-pack-10" },
    update: {},
    create: {
      id: randomBytes(16).toString("hex"),
      locationId: paris.id,
      name: "NFC Pack (10)",
      slug: "nfc-pack-10",
      description: "Pack de 10 cartes NFC imprimées",
      price: 199.0,
      currency: "EUR",
      upsellPriceCents: 500,
      upsellEnabled: true,
      visible: true,
      stock: 100,
    },
  });

  // ------------------------------
  // DESIGNS
  // ------------------------------
  const design1 = await prisma.design.create({
    data: {
      id: randomBytes(16).toString("hex"),
      userId: user.id,
      title: "Sample Design 1",
      frontFile: "design1-front.png",
      backFile: "design1-back.png",
      thumbnail: "thumb1.png",
      jsonFront: "{}",
      jsonBack: "{}",
    },
  });

  const design2 = await prisma.design.create({
    data: {
      id: randomBytes(16).toString("hex"),
      userId: admin.id,
      title: "Sample Design 2",
      frontFile: "design2-front.png",
      backFile: "design2-back.png",
      thumbnail: "thumb2.png",
      jsonFront: "{}",
      jsonBack: "{}",
      updatedAt: new Date()
    },
  });

  // ------------------------------
  // LINK PRODUCTS & DESIGNS (Many-to-Many)
  // ------------------------------
  await prisma.productDesign.createMany({
    data: [
      { productId: p1.id, designId: design1.id },
      { productId: p1.id, designId: design2.id },
    ],
  });

// ------------------------------
// TAGS
// ------------------------------
const tag1 = await prisma.tag.upsert({
  where: { name: "Special Edition" },
  update: {}, // nothing to update
  create: {
    id: randomBytes(16).toString("hex"),
    name: "Special Edition",
  },
});

await prisma.productTag.upsert({
  where: {
    productId_tagId: {
      productId: p1.id,
      tagId: tag1.id,
    },
  },
  update: {},
  create: {
    productId: p1.id,
    tagId: tag1.id,
  },
});

  // ------------------------------
  // BUNDLES (Int IDs now)
  // ------------------------------
  const bundle1 = await prisma.bundle.create({
    data: {
      title: "Starter Pack",
    },
  });

  await prisma.bundleProduct.create({
    data: {
      bundleId: bundle1.id,
      productId: p1.id,
    },
  });

  // ------------------------------
  // REVIEWS
  // ------------------------------
  await prisma.review.createMany({
    data: [
      { id: randomBytes(16).toString("hex"), locationId: paris.id, userId: user.id, rating: 5, comment: "Amazing studio!" },
      { id: randomBytes(16).toString("hex"), locationId: paris.id, userId: user.id, rating: 4, comment: "Very good experience" },
      { id: randomBytes(16).toString("hex"), locationId: lyon.id, userId: user.id, rating: 3, comment: "Average" },
    ],
  });

  // ------------------------------
  // ORDERS & ITEMS
  // ------------------------------
  const order1 = await prisma.order.create({
    data: {
      id: randomBytes(16).toString("hex"),
      orderNumber: `ORD-${Date.now()}`,
      userId: user.id,
      locationId: paris.id,
      total: 199.0,
      currency: "EUR",
      status: "paid",
      items: {
        create: [
          {
            id: randomBytes(16).toString("hex"),
            productId: p1.id,
            quantity: 1,
            unitCents: 19900,
          },
        ],
      },
    },
  });

  console.log("✅ Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
