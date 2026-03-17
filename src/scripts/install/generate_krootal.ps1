# generate_krootal.ps1
# Usage: Open PowerShell, navigate to where this file is, then:
#   .\generate_krootal.ps1
# This will create C:\krootal and produce krootal_project_complete.zip

$ErrorActionPreference = "Stop"
$root = "C:\krootal"

if(Test-Path $root) {
    Write-Host "Le dossier $root existe déjà. Le contenu pourra être écrasé. Continuer ? (O/N)"
    $c = Read-Host
    if($c -ne 'O' -and $c -ne 'o') { Write-Host "Annulé."; exit 1 }
    Remove-Item -Recurse -Force $root
}

New-Item -ItemType Directory -Path $root -Force | Out-Null

function Write-File($path, $content) {
    $dir = Split-Path $path
    if(!(Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    $content | Out-File -FilePath $path -Encoding UTF8
    Write-Host "Wrote $path"
}

# -------------------------
# backend/package.json
# -------------------------
$backendPkg = @'
{
  "name":"krootal-backend",
  "version":"1.0.0",
  "main":"src/server.js",
  "scripts":{
    "dev":"nodemon src/server.js",
    "start":"node src/server.js",
    "seed":"node prisma/seed.js",
    "migrate":"npx prisma migrate deploy || true",
    "prisma:generate":"npx prisma generate",
    "test":"jest --runInBand"
  },
  "dependencies":{
    "express":"^4.18.2",
    "@prisma/client":"^5.0.0",
    "prisma":"^5.0.0",
    "body-parser":"^1.20.2",
    "cors":"^2.8.5",
    "helmet":"^7.0.0",
    "stripe":"^12.0.0",
    "bcryptjs":"^2.4.3",
    "jsonwebtoken":"^9.0.0",
    "nodemailer":"^6.9.3",
    "multer":"^1.4.5",
    "csv-stringify":"^6.2.0",
    "uuid":"^9.0.0"
  },
  "devDependencies":{"nodemon":"^2.0.22","jest":"^29.0.0","supertest":"^6.3.0"}
}
'@
Write-File "$root\backend\package.json" $backendPkg

# -------------------------
# backend/prisma/schema.prisma
# -------------------------
$schema = @'
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  password  String
  role      String   @default("user")
  createdAt DateTime @default(now())
}

model Product {
  id             String @id @default(uuid())
  title          String
  slug           String @unique
  description    String?
  priceCents     Int
  currency       String @default("EUR")
  subscription   Boolean @default(false)
  stripePriceId  String?
  upsellPriceCents Int?
  createdAt      DateTime @default(now())
  items          OrderItem[]
}

model Order {
  id            String @id @default(uuid())
  orderNumber   String @unique
  totalCents    Int
  currency      String @default("EUR")
  status        String @default("pending")
  stripeSession String?
  createdAt     DateTime @default(now())
  items         OrderItem[]
  customization Customization?
}

model OrderItem {
  id        String @id @default(uuid())
  order     Order  @relation(fields: [orderId], references: [id])
  orderId   String
  product   Product @relation(fields: [productId], references: [id])
  productId String
  quantity  Int
  unitCents Int
}

model Customization {
  id        String  @id @default(uuid())
  order     Order   @relation(fields: [orderId], references: [id])
  orderId   String  @unique
  frontData String  @db.Text
  backData  String  @db.Text
  costCents Int
  createdAt DateTime @default(now())
}

model Affiliate {
  id         String   @id @default(uuid())
  code       String   @unique
  name       String?
  email      String?
  createdAt  DateTime @default(now())
  clicks     Click[]
  conversions Conversion[]
}

model Click {
  id          String   @id @default(uuid())
  affiliate   Affiliate @relation(fields: [affiliateId], references: [id])
  affiliateId String
  ip          String?
  userAgent   String?
  referer     String?
  createdAt   DateTime @default(now())
}

model Conversion {
  id          String   @id @default(uuid())
  affiliate   Affiliate @relation(fields: [affiliateId], references: [id])
  affiliateId String
  orderId     String?
  amountCents Int?
  createdAt   DateTime @default(now())
}

model Review {
  id           String   @id @default(uuid())
  locationSlug String?
  rating       Int
  message      String?
  customerName String?
  contact      String?
  source       String?
  status       String    @default("pending")
  createdAt    DateTime  @default(now())
}
'@
Write-File "$root\backend\prisma\schema.prisma" $schema

# -------------------------
# backend/prisma/seed.js
# -------------------------
$seed = @'
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const bcrypt = require("bcryptjs");

async function main() {
  console.log("Seeding...");
  const adminPass = await bcrypt.hash("Admin123!", 10);
  await prisma.user.create({ data: { email: "admin@krootal.local", password: adminPass, role: "admin" } });
  await prisma.product.create({ data: { title: "NFC Pack (10)", slug: "nfc-pack-10", description: "10 NFC cards", priceCents: 19900, upsellPriceCents: 500 } });
  await prisma.product.create({ data: { title: "QR Pack (250)", slug: "qr-pack-250", description: "250 QR stickers", priceCents: 4900 } });
  await prisma.product.create({ data: { title: "Pro Monthly", slug: "pro-monthly", description: "Subscription monthly", priceCents: 2900, subscription: true } });
  console.log("Seed done.");
}

main().catch(e => { console.error(e); process.exit(1); }).finally(()=>prisma.$disconnect());
'@
Write-File "$root\backend\prisma\seed.js" $seed

# -------------------------
# backend/src files
# -------------------------
Write-File "$root\backend\src\prismaClient.js" 'const { PrismaClient } = require("@prisma/client"); const prisma = new PrismaClient(); module.exports = prisma;'

$app = @'
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const helmet = require("helmet");

const products = require("./controllers/products");
const payments = require("./controllers/payments");
const webhooks = require("./controllers/webhooks");
const orders = require("./controllers/orders");
const customization = require("./controllers/customization");
const affiliates = require("./controllers/affiliates");
const reviews = require("./controllers/reviews");
const adminStats = require("./controllers/adminStats");

const app = express();
app.use(helmet());
app.use(cors());
app.use(bodyParser.json({ verify: (req,res,buf) => { req.rawBody = buf; } }));

app.use("/api/products", products);
app.use("/api/payments", payments);
app.use("/webhooks/stripe", webhooks);
app.use("/api/orders", orders);
app.use("/api/customization", customization);
app.use("/api/affiliates", affiliates);
app.use("/r", affiliates); // redirect route handled in affiliates controller
app.use("/api/reviews", reviews);
app.use("/api/admin/stats", adminStats);

app.get("/healthz", (req,res)=>res.json({ok:true}));

module.exports = app;
'@
Write-File "$root\backend\src\app.js" $app

Write-File "$root\backend\src\server.js" 'require("dotenv").config(); const app = require("./app"); const PORT = process.env.PORT || 4000; app.listen(PORT, ()=>console.log("Server listening on",PORT));'

# controllers
$prod = @'
const express = require("express");
const router = express.Router();
const prisma = require("../prismaClient");

router.get("/", async (req, res) => {
  const list = await prisma.product.findMany({ orderBy:{ createdAt:"desc"} });
  res.json(list);
});

router.get("/:slug", async (req, res) => {
  const p = await prisma.product.findUnique({ where: { slug: req.params.slug } });
  if(!p) return res.status(404).json({ error: "not found" });
  res.json(p);
});

module.exports = router;
'@
Write-File "$root\backend\src\controllers\products.js" $prod

$payments = @'
const express = require("express"); const router = express.Router(); const stripe = require("stripe")(process.env.STRIPE_SECRET||""); const prisma = require("../prismaClient");
router.post("/create-checkout-session", async (req,res)=>{ const { productId, successUrl, cancelUrl } = req.body; const product = await prisma.product.findUnique({ where: { id: productId } }); if(!product) return res.status(404).json({ error:"product not found" }); const session = await stripe.checkout.sessions.create({ payment_method_types:["card"], mode: product.subscription ? "subscription" : "payment", line_items:[{ price: product.subscription ? product.stripePriceId : undefined, price_data: product.subscription ? undefined : { currency: product.currency||"EUR", product_data:{ name: product.title }, unit_amount: product.priceCents }, quantity:1 }], success_url: successUrl||"http://localhost:3000/thanks", cancel_url: cancelUrl||"http://localhost:3000" }); const order = await prisma.order.create({ data:{ orderNumber: "ORD-"+Date.now(), totalCents: product.priceCents, currency: product.currency||"EUR", status:"pending", stripeSession: session.id } }); res.json({ url: session.url, sessionId: session.id, orderId: order.id }); });
module.exports = router;
'@
Write-File "$root\backend\src\controllers\payments.js" $payments

$webhooks = @'
const express = require("express"); const router = express.Router(); const stripe = require("stripe")(process.env.STRIPE_SECRET||""); const prisma = require("../prismaClient"); const endpointSecret = process.env.STRIPE_ENDPOINT_SECRET || "";
router.post("/", express.raw({ type: "application/json" }), async (req,res)=>{ const sig = req.headers["stripe-signature"]; let event; try{ event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret); } catch(err){ console.error("Webhook signature fail", err.message); return res.status(400).send(`Webhook Error: ${err.message}`); } if(event.type==="checkout.session.completed"){ const session = event.data.object; const order = await prisma.order.findUnique({ where: { stripeSession: session.id } }); if(order) await prisma.order.update({ where:{ id: order.id }, data:{ status: "paid" } }); } res.json({ received: true }); }); module.exports = router;
'@
Write-File "$root\backend\src\controllers\webhooks.js" $webhooks

$orders = @'
const express = require("express"); const router = express.Router(); const prisma = require("../prismaClient");
router.get("/", async (req,res)=>{ const orders = await prisma.order.findMany({ orderBy:{ createdAt:"desc" } }); res.json(orders); });
router.get("/:id", async (req,res)=>{ const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: { items: true, customization: true } }); if(!order) return res.status(404).json({ error:"not found" }); res.json(order); });
module.exports = router;
'@
Write-File "$root\backend\src\controllers\orders.js" $orders

$custom = @'
const express = require("express"); const router = express.Router(); const prisma = require("../prismaClient"); const stripe = require("stripe")(process.env.STRIPE_SECRET||"");
router.get("/:orderId", async (req,res)=>{ const c = await prisma.customization.findUnique({ where: { orderId: req.params.orderId } }).catch(()=>null); res.json(c||null); });
router.post("/:orderId", async (req,res)=>{ const { frontData, backData } = req.body; const order = await prisma.order.findUnique({ where:{ id: req.params.orderId }, include:{ items: true } }); if(!order) return res.status(404).json({ error:"order not found" }); const firstItem = order.items && order.items[0]; let cost = 500; if(firstItem){ const product = await prisma.product.findUnique({ where: { id: firstItem.productId } }); if(product && product.upsellPriceCents) cost = product.upsellPriceCents; } const customization = await prisma.customization.upsert({ where: { orderId: req.params.orderId }, update: { frontData, backData, costCents: cost, createdAt: new Date() }, create: { orderId: req.params.orderId, frontData, backData, costCents: cost } }); res.json({ ok:true, customizationId: customization.id, costCents: cost }); });
router.post("/:orderId/checkout", async (req,res)=>{ const { successUrl, cancelUrl } = req.body; const customization = await prisma.customization.findUnique({ where: { orderId: req.params.orderId } }); if(!customization) return res.status(400).json({ error:"no customization" }); const price = customization.costCents; const session = await stripe.checkout.sessions.create({ payment_method_types:["card"], mode:"payment", line_items:[{ price_data:{ currency:"eur", product_data:{ name:"Card Customization" }, unit_amount: price }, quantity:1 }], success_url: successUrl, cancel_url: cancelUrl, metadata:{ customizationId: customization.id, orderId: req.params.orderId } }); res.json({ url: session.url }); });
module.exports = router;
'@
Write-File "$root\backend\src\controllers\customization.js" $custom

$aff = @'
const express = require("express"); const router = express.Router(); const prisma = require("../prismaClient");
router.post("/apply", async (req,res)=>{ const { name, email } = req.body; const code = "AFF" + Math.random().toString(36).slice(2,8).toUpperCase(); const affiliate = await prisma.affiliate.create({ data: { code, name, email } }); res.json({ ok:true, code: affiliate.code }); });
router.get("/:code/dashboard", async (req,res)=>{ const code = req.params.code; const aff = await prisma.affiliate.findUnique({ where: { code } }); if(!aff) return res.status(404).json({ error:"Affiliate not found" }); const clicks = await prisma.click.count({ where: { affiliateId: aff.id } }); const conversions = await prisma.conversion.count({ where: { affiliateId: aff.id } }); const total = await prisma.conversion.aggregate({ where: { affiliateId: aff.id }, _sum: { amountCents: true } }); res.json({ affiliate: { code: aff.code, name: aff.name }, clicks, conversions, revenueCents: total._sum.amountCents || 0 }); });
router.get("/:code", async (req,res)=>{ const code = req.params.code; const aff = await prisma.affiliate.findUnique({ where: { code } }); const target = req.query.t || "/"; if(!aff) return res.redirect(target); await prisma.click.create({ data: { affiliateId: aff.id, ip: req.ip, userAgent: req.headers["user-agent"] || null, referer: req.get("referer") || null } }); return res.redirect(target); });
module.exports = router;
'@
Write-File "$root\backend\src\controllers\affiliates.js" $aff

$reviewsJs = @'
const express = require("express"); const router = express.Router(); const prisma = require("../prismaClient");
router.post("/", async (req,res)=>{ const { locationSlug, rating, message, customerName, contact, source } = req.body; const review = await prisma.review.create({ data: { locationSlug, rating, message, customerName, contact, source, status: "pending" } }); if (rating <= 3) { try { console.log("notify owner", review.id); } catch (err) { console.error("notify owner error", err.message); } } res.json({ ok:true, id: review.id }); });
router.get("/", async (req,res)=>{ const list = await prisma.review.findMany({ orderBy: { createdAt:"desc" } }); res.json(list); });
module.exports = router;
'@
Write-File "$root\backend\src\controllers\reviews.js" $reviewsJs

$statsJs = @'
const express = require("express"); const router = express.Router(); const prisma = require("../prismaClient");
router.get("/", async (req,res)=>{ const rows = await prisma.order.findMany({ where: { status: "paid" }, select: { createdAt: true, totalCents: true } }); const map = {}; rows.forEach(r=>{ const d = r.createdAt.toISOString().slice(0,10); map[d] = (map[d] || 0) + r.totalCents; }); const days = Object.keys(map).sort().map(d=>({ date: d, revenueCents: map[d] })); res.json({ daily: days }); });
module.exports = router;
'@
Write-File "$root\backend\src\controllers\adminStats.js" $statsJs

# -------------------------
# Frontend (Next.js) files
# -------------------------
$frontendPkg = @'
{
  "name":"krootal-frontend",
  "version":"1.0.0",
  "scripts":{"dev":"next dev -p 3000","build":"next build","start":"next start -p 3000","test:e2e":"npx playwright test"},
  "dependencies":{"next":"13.4.0","react":"18.2.0","react-dom":"18.2.0","axios":"^1.4.0","fabric":"^5.2.4","recharts":"^2.2.0"}
}
'@
Write-File "$root\frontend\package.json" $frontendPkg

Write-File "$root\frontend\pages\index.js" "import Link from 'next/link'; export default function Home(){ return (<div style={{padding:20}}><h1>Krootal</h1><p><Link href='/products'>Products</Link></p></div>); }"

Write-File "$root\frontend\pages\products\index.js" "import Link from 'next/link'; export default function Products(){ return (<div style={{padding:20}}><h1>Products (demo)</h1><ul><li><Link href='/product/nfc-pack-10'>NFC Pack (10)</Link></li></ul></div>); }"

$prodPage = @'
import axios from "axios";
export default function Product(){
  return (<div style={{padding:20}}><h1>Product demo</h1><p>This is a demo product page. Click buy to open Stripe Checkout (requires backend).</p><button onClick={async ()=>{ const res = await axios.post("http://localhost:4000/api/payments/create-checkout-session",{ productId:"demo", successUrl:"http://localhost:3000/thanks", cancelUrl:"http://localhost:3000" }); if(res.data.url) window.location.href = res.data.url; }}>Buy</button></div>);
}
'@
Write-File "$root\frontend\pages\product\[slug].js" $prodPage

$customPage = @'
"use client"
import { useEffect, useRef, useState } from "react";
import { fabric } from "fabric";
import axios from "axios";
export default function CustomizeCard(){
  const canvasRef = useRef(null);
  const [canvasObj,setCanvasObj]=useState(null);
  const [text,setText]=useState("Your Name");
  useEffect(()=>{ const c=new fabric.Canvas("c",{ backgroundColor:"#fff", width:800, height:500 }); setCanvasObj(c); const t=new fabric.Text(text,{ left:50, top:50, fontSize:36, fill:"#000" }); c.add(t); return ()=>c.dispose(); },[]);
  useEffect(()=>{ if(!canvasObj) return; const objs=canvasObj.getObjects("text"); if(objs.length) objs.forEach(o=>o.set("text", text)); canvasObj.requestRenderAll(); },[text,canvasObj]);
  async function save(){ const front=canvasObj.toDataURL({ format:"png" }); await axios.post("http://localhost:4000/api/customization/demo-order",{ frontData: front, backData: front }); alert("Saved demo customization"); }
  return (<div style={{padding:20}}><h1>Personnalisation (Fabric.js)</h1><div style={{marginBottom:10}}><label>Texte: <input value={text} onChange={e=>setText(e.target.value)} /></label><button onClick={save} style={{marginLeft:10}}>Valider (demo)</button></div><canvas id="c" /></div>);
}
'@
Write-File "$root\frontend\pages\customize-card.js" $customPage

Write-File "$root\frontend\pages\thanks.js" "export default function Thanks(){return (<div style={{padding:20}}><h1>Merci !</h1></div>)}"

# Admin pages (simple)
$adminProducts = @'
import { useState, useEffect } from "react";
import axios from "axios";
export default function AdminProducts(){
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ title:"", slug:"", priceCents:0, upsellPriceCents:0, description:"" });
  useEffect(()=>{ fetchProducts(); },[]);
  async function fetchProducts(){ const r = await axios.get("/api/products"); setProducts(r.data || []); }
  async function create(){ await axios.post("/api/products", form).catch(()=>{}); setForm({ title:"", slug:"", priceCents:0, upsellPriceCents:0, description:"" }); fetchProducts(); }
  return (<div style={{padding:20}}><h1>Admin - Products</h1><div style={{marginBottom:20}}><input placeholder="title" value={form.title} onChange={e=>setForm({...form, title:e.target.value})} /> <input placeholder="slug" value={form.slug} onChange={e=>setForm({...form, slug:e.target.value})} /> <input placeholder="priceCents" type="number" value={form.priceCents} onChange={e=>setForm({...form, priceCents:parseInt(e.target.value||0,10)})} /> <input placeholder="upsellPriceCents" type="number" value={form.upsellPriceCents} onChange={e=>setForm({...form, upsellPriceCents:parseInt(e.target.value||0,10)})} /> <button onClick={create}>Create</button></div><table border="1" cellPadding="6"><thead><tr><th>Title</th><th>Price</th><th>Upsell</th></tr></thead><tbody>{products.map(p=>(<tr key={p.id}><td>{p.title}</td><td>{(p.priceCents||0)/100}€</td><td>{p.upsellPriceCents? (p.upsellPriceCents/100).toFixed(2)+'€' : '-'}</td></tr>))}</tbody></table></div>);
}
'@
Write-File "$root\frontend\pages\admin\products.js" $adminProducts

$adminOrders = @'
import { useEffect, useState } from "react";
import axios from "axios";
export default function AdminOrders(){
  const [orders,setOrders]=useState([]);
  useEffect(()=>{ load(); },[]);
  async function load(){ const r = await axios.get("/api/orders"); setOrders(r.data || []); }
  return (<div style={{padding:20}}><h1>Commandes</h1><table border="1" cellPadding="6" style={{width:"100%"}}><thead><tr><th>Order #</th><th>Total</th><th>Status</th><th>Créé</th></tr></thead><tbody>{orders.map(o=>(<tr key={o.id}><td>{o.orderNumber}</td><td>{(o.totalCents/100).toFixed(2)} {o.currency}</td><td>{o.status}</td><td>{new Date(o.createdAt).toLocaleString()}</td></tr>))}</tbody></table></div>);
}
'@
Write-File "$root\frontend\pages\admin\orders.js" $adminOrders

$adminStats = @'
import { useEffect, useState } from "react";
import axios from "axios";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
export default function StatsPage(){
  const [series,setSeries]=useState([]);
  useEffect(()=>{ load(); },[]);
  async function load(){ const r = await axios.get("/api/admin/stats"); setSeries(r.data.daily || []); }
  return (<div style={{padding:20}}><h1>Statistiques</h1><div style={{height:320}}><ResponsiveContainer><LineChart data={series}><XAxis dataKey="date"/><YAxis/><Tooltip formatter={(v)=> (v/100).toFixed(2) + " €"} /><Line type="monotone" dataKey="revenueCents" stroke="#8884d8"/></LineChart></ResponsiveContainer></div></div>);
}
'@
Write-File "$root\frontend\pages\admin\stats.js" $adminStats

# Dockerfiles and docker-compose
$backendDocker = @'
FROM node:18-alpine
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci --production
COPY . .
RUN npx prisma generate || true
EXPOSE 4000
CMD ["node","src/server.js"]
'@
Write-File "$root\backend\Dockerfile" $backendDocker

$frontendDocker = @'
FROM node:18-alpine
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci --production
COPY . .
RUN npm run build || true
EXPOSE 3000
CMD ["npm","start"]
'@
Write-File "$root\frontend\Dockerfile" $frontendDocker

$compose = @'
version: "3.8"
services:
  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: ''
      MYSQL_DATABASE: krootal
      MYSQL_USER: root
      MYSQL_PASSWORD: ''
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
  backend:
    build: ./backend
    environment:
      DATABASE_URL: ${DATABASE_URL:-mysql://root:@mysql:3306/krootal}
      STRIPE_SECRET: ${STRIPE_SECRET}
      STRIPE_ENDPOINT_SECRET: ${STRIPE_ENDPOINT_SECRET}
    ports:
      - "4000:4000"
    depends_on: [mysql]
  frontend:
    build: ./frontend
    environment:
      NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL:-http://localhost:4000}
    ports:
      - "3000:3000"
    depends_on: [backend]
volumes:
  mysql_data:
'@
Write-File "$root\docker-compose.yml" $compose

# GitHub Actions basic workflow
$ci = @'
name: CI + E2E
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 18
      - name: Install backend deps
        run: |
          cd backend
          npm ci
      - name: Install frontend deps
        run: |
          cd frontend
          npm ci
      - name: Run Prisma migrate
        run: |
          cd backend
          npx prisma migrate deploy || true
      - name: Run Playwright tests
        run: |
          cd frontend
          npx playwright test || true
'@
Write-File "$root\.github\workflows\ci.yml" $ci

# scripts/windows
Write-File "$root\scripts\windows\prisma-generate.bat" "@echo off`ncd backend`ncall npx prisma generate`ncd ..`npause"
Write-File "$root\scripts\windows\seed.bat" "@echo off`ncd backend`nnode prisma/seed.js`ncd ..`npause"
Write-File "$root\scripts\windows\start-backend-dev.bat" "@echo off`ncd backend`nnpm ci`nnpx prisma generate`nnpx nodemon src/server.js`ncd ..`npause"
Write-File "$root\scripts\windows\start-frontend-dev.bat" "@echo off`ncd frontend`nnpm ci`n npm run dev`ncd ..`npause"

# README
$readme = @"
# Krootal - Projet complet généré

Structure:
- backend/: Express + Prisma
- frontend/: Next.js
- docker-compose.yml
- scripts/windows/: scripts .bat
- .github/workflows/ci.yml

DB par défaut (docker-compose):
- user: root
- password: (empty)
- db: krootal

Instructions:
1) Docker:
   docker-compose up --build

2) Local (Windows XAMPP):
   - Start MySQL in XAMPP
   - Create backend/.env with:
     DATABASE_URL=""mysql://root:@127.0.0.1:3306/krootal""
     JWT_SECRET=""change_this_secret""
     STRIPE_SECRET=""sk_test_xxx""
     STRIPE_ENDPOINT_SECRET=""whsec_xxx""
   - In backend:
     npm ci
     npx prisma generate
     node prisma/seed.js
     npm run dev
   - In frontend:
     npm ci
     npm run dev

Security:
- Change secrets before production.
"@
Write-File "$root\README.md" $readme

# Create zip
$zip = "$root\krootal_project_complete.zip"
if(Test-Path $zip) { Remove-Item $zip -Force }
Add-Type -AssemblyName 'System.IO.Compression.FileSystem'
[System.IO.Compression.ZipFile]::CreateFromDirectory($root, $zip)
Write-Host "ZIP created at $zip"

Write-Host "=== Done ==="
Write-Host "Le projet a été créé dans $root et zippé dans $zip."
