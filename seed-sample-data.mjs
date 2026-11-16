import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { randomUUID, randomBytes, createHash, scryptSync } from "node:crypto";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import Decimal from "decimal.js";

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

const dbPath = path.resolve("data", "gem.sqlite");
console.log("Connecting to database at:", dbPath);
const db = new DatabaseSync(dbPath);

// Helper functions matching the app
const uid = (prefix) => `${prefix}-${randomUUID().slice(0, 8).toUpperCase()}`;
const now = (offsetMinutes = 0) => new Date(Date.now() + offsetMinutes * 60000).toISOString();
const hash = (v) => createHash("sha256").update(v).digest("hex");

function passwordHash(p) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(p, salt, 64).toString("hex");
}

function put(kind, record) {
  db.prepare(
    "INSERT INTO records(kind,id,data) VALUES(?,?,?) ON CONFLICT(kind,id) DO UPDATE SET data=excluded.data"
  ).run(kind, record.id, JSON.stringify(record));
  return record;
}

function audit(actor, role, action, recordId, before, after, timestamp = now()) {
  db.prepare(
    "INSERT INTO events(id,at,actor,role,action,record_id,before_json,after_json) VALUES(?,?,?,?,?,?,?,?)"
  ).run(
    uid("EVT"),
    timestamp,
    actor,
    role,
    action,
    recordId || "",
    before ? JSON.stringify(before) : null,
    after ? JSON.stringify(after) : null
  );
}

// Generate minimal genuine PDF for lab certificates
async function createCertificatePdf(labName, reportNo, variety, weight, origin, treatment) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]); // A4
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);

  page.drawRectangle({
    x: 20,
    y: 20,
    width: 555,
    height: 802,
    borderWidth: 2,
    borderColor: rgb(0.12, 0.23, 0.37),
    color: rgb(0.98, 0.99, 1.0),
  });

  page.drawText(labName.toUpperCase(), {
    x: 40,
    y: 780,
    size: 22,
    font: fontBold,
    color: rgb(0.1, 0.2, 0.4),
  });

  page.drawText("GEMSTONE IDENTIFICATION & ORIGIN REPORT", {
    x: 40,
    y: 755,
    size: 11,
    font: fontBold,
    color: rgb(0.3, 0.3, 0.3),
  });

  page.drawText(`Report Number: ${reportNo}`, {
    x: 40,
    y: 710,
    size: 13,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });

  page.drawText(`Issue Date: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, {
    x: 40,
    y: 690,
    size: 10,
    font: fontRegular,
    color: rgb(0.4, 0.4, 0.4),
  });

  const details = [
    ["Object", "One faceted loose gemstone"],
    ["Identification", variety],
    ["Carat Weight", `${weight} ct`],
    ["Origin Opinion", origin],
    ["Treatment / Comments", treatment],
  ];

  let y = 630;
  for (const [k, v] of details) {
    page.drawText(k, { x: 40, y, size: 11, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
    page.drawText(v, { x: 180, y, size: 11, font: fontRegular, color: rgb(0.1, 0.1, 0.1) });
    y -= 30;
  }

  page.drawText("This certificate represents the professional opinion of the testing laboratory based on gemological analysis.", {
    x: 40,
    y: 80,
    size: 9,
    font: fontRegular,
    color: rgb(0.5, 0.5, 0.5),
  });

  return Buffer.from(await doc.save());
}

async function seed() {
  console.log("--- Starting Comprehensive Data Seeding ---");

  // 1. Team Users for every Role
  const teamUsers = [
    { name: "Elena Rostova", email: "elena.sales@bitmo.test", role: "Sales staff" },
    { name: "Marcus Vance", email: "marcus.clerk@bitmo.test", role: "Inventory clerk" },
    { name: "Sophia Chen", email: "sophia.accounts@bitmo.test", role: "Accounts" },
    { name: "Dr. Tariq Al-Mansoor", email: "tariq.reviewer@bitmo.test", role: "Gem reviewer" },
    { name: "Liam O'Connor", email: "liam.liaison@bitmo.test", role: "Cutter / lab liaison" },
  ];

  const defaultPassword = passwordHash("Password1234!");
  for (const tu of teamUsers) {
    const existing = db.prepare("SELECT id FROM users WHERE email=?").get(tu.email);
    if (!existing) {
      const id = uid("USR");
      db.prepare("INSERT INTO users(id, name, email, password, role, active) VALUES(?,?,?,?,?,1)").run(
        id, tu.name, tu.email, defaultPassword, tu.role
      );
      audit("Humaid", "Owner", "User created", id, null, { id, name: tu.name, email: tu.email, role: tu.role });
      console.log(`Created user ${tu.name} (${tu.role}) with password 'Password1234!'`);
    }
  }

  // 2. Customers
  const customers = [
    { id: uid("CUS"), name: "Cartier High Jewelry Atelier", email: "francois.moreau@cartier.example", phone: "+33 1 42 68 55 00", notes: "VIP Paris high-jewelry salon. Seeks unheated sapphires >4ct and Colombian emeralds." },
    { id: uid("CUS"), name: "Graff Diamonds & Rare Gems", email: "victoria.sterling@graff.example", phone: "+44 20 7584 8571", notes: "New Bond St atelier. Frequent memo borrower; high conversion rate on fancy colors." },
    { id: uid("CUS"), name: "Tiffany & Co. Private Client Salon", email: "alexander.hayes@tiffany.example", phone: "+1 212 755 8000", notes: "Fifth Ave private salon. Focus on unheated spinels and imperial topaz." },
    { id: uid("CUS"), name: "Van Cleef & Arpels Bespoke", email: "claire.delacroix@vancleef.example", phone: "+41 22 310 12 12", notes: "Geneva bespoke commissions. Requires EUR invoicing with full SSEF/Gübelin dossiers." },
  ];
  for (const c of customers) {
    put("customers", { ...c, createdAt: now(-5000) });
    audit("Elena Rostova", "Sales staff", "Customer created", c.id, null, c, now(-5000));
  }
  const [cusCartier, cusGraff, cusTiffany, cusVanCleef] = customers;

  // 3. Suppliers
  const suppliers = [
    { id: uid("SUP"), name: "Ceylon Sapphire Syndicate", email: "trade@ceylonsapphire.example", phone: "+94 45 222 3411", createdAt: now(-6000) },
    { id: uid("SUP"), name: "Mogok Artisan Gems", email: "direct@mogokgems.example", phone: "+66 2 234 8890", createdAt: now(-6000) },
    { id: uid("SUP"), name: "Muzo Emerald Miners Corp", email: "export@muzoemerald.example", phone: "+57 1 345 6789", createdAt: now(-6000) },
    { id: uid("SUP"), name: "Tunduru Rough & Cut Exporters", email: "info@tunduru.example", phone: "+255 22 211 4455", createdAt: now(-6000) },
  ];
  for (const s of suppliers) {
    put("suppliers", s);
    audit("Sophia Chen", "Accounts", "Supplier created", s.id, null, s, now(-6000));
  }
  const [supCeylon, supMogok, supMuzo, supTunduru] = suppliers;

  // Helper to attach real certificate PDF
  async function attachDocument(stone, lab, reportNo, variety, weight, origin, treatment) {
    const pdfBuf = await createCertificatePdf(lab, reportNo, variety, weight, origin, treatment);
    const docId = uid("DOC");
    const meta = {
      id: docId,
      stoneId: stone.id,
      name: `${lab.replace(/\s+/g, "_")}_${reportNo}.pdf`,
      mime: "application/pdf",
      size: pdfBuf.length,
      createdAt: now(-4000),
      sha256: hash(pdfBuf),
    };
    db.prepare("INSERT INTO files VALUES(?,?,?,?,?,?)").run(
      docId, stone.id, meta.name, meta.mime, pdfBuf, meta.createdAt
    );
    put("fileMeta", meta);
    return meta;
  }

  // 4. Detailed Stones Register
  // Stone 1: Royal Blue Sapphire (Approved, In Stock, Available)
  const gemSapphire = {
    id: uid("GEM"),
    variety: "Natural Sapphire",
    shape: "Cushion",
    carats: "4.850",
    count: 1,
    location: "Main Safe / Tray A1",
    custodian: "Internal intake",
    internal: true,
    state: "In stock",
    evidence: "Approved",
    disclosure: "Natural sapphire, 4.850 ct, unheated with royal blue hue. Origin: Sri Lanka (SSEF opinion).",
    claimsVersion: 1,
    approvedVersion: uid("REV"),
    version: 3,
    ownershipConfirmed: true,
    ownershipShares: [],
    supplier: supCeylon.name,
    cost: "9200.00",
    price: "15500.00",
    origin: "Sri Lanka",
    treatment: "None (Unheated)",
    color: "Royal Blue",
    dimensions: "9.82 x 8.41 x 6.55 mm",
    createdAt: now(-4500),
    updatedAt: now(-3000),
  };
  put("stones", gemSapphire);
  const docSsef = await attachDocument(gemSapphire, "SSEF Swiss Gemmological Institute", "SSEF-119284", gemSapphire.variety, gemSapphire.carats, gemSapphire.origin, gemSapphire.treatment);
  gemSapphire.buyerFileIds = [docSsef.id];
  put("stones", gemSapphire);

  put("claims", {
    id: uid("CLM"),
    stoneId: gemSapphire.id,
    source: "Manual",
    type: "Lab opinion",
    statement: "SSEF Report #119284 confirms no indications of thermal enhancement; geographic origin: Sri Lanka (Ceylon).",
    reportNumber: "SSEF-119284",
    fileId: docSsef.id,
    version: 1,
    createdAt: now(-4000),
    actor: "Dr. Tariq Al-Mansoor",
  });
  put("reviews", {
    id: gemSapphire.approvedVersion,
    stoneId: gemSapphire.id,
    claimVersion: 1,
    wording: gemSapphire.disclosure,
    resolution: "Fully verified with SSEF verification portal.",
    actor: "Dr. Tariq Al-Mansoor",
    createdAt: now(-3500),
  });
  audit("Marcus Vance", "Inventory clerk", "Stone received", gemSapphire.id, null, gemSapphire, now(-4500));
  audit("Dr. Tariq Al-Mansoor", "Gem reviewer", "Disclosure approved", gemSapphire.id, null, gemSapphire, now(-3500));
  audit("Marcus Vance", "Inventory clerk", "Stock released", gemSapphire.id, null, gemSapphire, now(-3000));

  // Stone 2: Muzo Colombian Emerald (In Stock, minor oil)
  const gemEmerald = {
    id: uid("GEM"),
    variety: "Natural Emerald",
    shape: "Octagonal Step Cut",
    carats: "3.120",
    count: 1,
    location: "Main Safe / Tray B3",
    custodian: "Internal intake",
    internal: true,
    state: "In stock",
    evidence: "Approved",
    disclosure: "Natural beryl / emerald from Muzo Colombia. Factual minor clarity enhancement (traditional cedarwood oil).",
    claimsVersion: 1,
    approvedVersion: uid("REV"),
    version: 3,
    ownershipConfirmed: true,
    ownershipShares: [
      { owner: "Bitmo Treasury", percent: "70.000" },
      { owner: "Muzo Syndicate Partner", percent: "30.000" },
    ],
    supplier: supMuzo.name,
    cost: "7800.00",
    price: "13200.00",
    origin: "Colombia (Muzo)",
    treatment: "Minor Clarity Enhancement (Cedarwood Oil)",
    color: "Vivid Green",
    dimensions: "9.10 x 7.35 x 5.80 mm",
    createdAt: now(-4000),
    updatedAt: now(-2800),
  };
  put("stones", gemEmerald);
  const docGub = await attachDocument(gemEmerald, "Gübelin Gem Lab", "GUB-220491", gemEmerald.variety, gemEmerald.carats, gemEmerald.origin, gemEmerald.treatment);
  gemEmerald.buyerFileIds = [docGub.id];
  put("stones", gemEmerald);
  put("claims", {
    id: uid("CLM"),
    stoneId: gemEmerald.id,
    source: "Manual",
    type: "Lab opinion",
    statement: "Gübelin report #220491 confirms origin Muzo, Colombia with minor traditional oil enhancement.",
    reportNumber: "GUB-220491",
    fileId: docGub.id,
    version: 1,
    createdAt: now(-3600),
    actor: "Dr. Tariq Al-Mansoor",
  });
  put("reviews", {
    id: gemEmerald.approvedVersion,
    stoneId: gemEmerald.id,
    claimVersion: 1,
    wording: gemEmerald.disclosure,
    resolution: "Oil level categorized as minor; disclosure accurately noted for buyer transparency.",
    actor: "Dr. Tariq Al-Mansoor",
    createdAt: now(-3200),
  });

  // Stone 3: Mogok Ruby (Assigned to Show Mode)
  const gemRuby = {
    id: uid("GEM"),
    variety: "Natural Ruby",
    shape: "Cushion",
    carats: "2.100",
    count: 1,
    location: "Main Safe / High Value Safe",
    custodian: "Internal intake",
    internal: true,
    state: "In stock",
    evidence: "Approved",
    disclosure: "Untreated Burmese Ruby with Pigeon's Blood designation. No heat indications.",
    claimsVersion: 1,
    approvedVersion: uid("REV"),
    version: 4,
    ownershipConfirmed: true,
    ownershipShares: [],
    supplier: supMogok.name,
    cost: "14000.00",
    price: "24500.00",
    origin: "Myanmar (Burma)",
    treatment: "None",
    color: "Pigeon's Blood Red",
    dimensions: "7.85 x 6.90 x 4.45 mm",
    createdAt: now(-4200),
    updatedAt: now(-2000),
  };
  put("stones", gemRuby);
  const docGia = await attachDocument(gemRuby, "Gemological Institute of America (GIA)", "GIA-521940", gemRuby.variety, gemRuby.carats, gemRuby.origin, gemRuby.treatment);
  gemRuby.buyerFileIds = [docGia.id];
  put("stones", gemRuby);
  put("claims", {
    id: uid("CLM"),
    stoneId: gemRuby.id,
    source: "Manual",
    type: "Lab opinion",
    statement: "GIA report #521940 confirms Burma origin, unheated with special comment 'Pigeon's Blood'.",
    reportNumber: "GIA-521940",
    fileId: docGia.id,
    version: 1,
    createdAt: now(-3800),
    actor: "Dr. Tariq Al-Mansoor",
  });
  put("reviews", {
    id: gemRuby.approvedVersion,
    stoneId: gemRuby.id,
    claimVersion: 1,
    wording: gemRuby.disclosure,
    resolution: "Approved with full GIA lab opinion.",
    actor: "Dr. Tariq Al-Mansoor",
    createdAt: now(-3400),
  });

  // Stone 4: Padparadscha Sapphire (In stock, standard)
  const gemPadparadscha = {
    id: uid("GEM"),
    variety: "Padparadscha Sapphire",
    shape: "Oval",
    carats: "2.650",
    count: 1,
    location: "Main Safe / Tray A2",
    custodian: "Internal intake",
    internal: true,
    state: "In stock",
    evidence: "Approved",
    disclosure: "Natural unheated Padparadscha sapphire exhibiting harmonious pastel orange and pink balance.",
    claimsVersion: 1,
    approvedVersion: uid("REV"),
    version: 2,
    ownershipConfirmed: true,
    ownershipShares: [],
    supplier: supCeylon.name,
    cost: "8500.00",
    price: "14800.00",
    origin: "Sri Lanka (Elahera)",
    treatment: "None",
    color: "Pinkish-Orange",
    dimensions: "8.90 x 7.15 x 4.80 mm",
    createdAt: now(-3500),
    updatedAt: now(-2500),
  };
  put("stones", gemPadparadscha);
  put("claims", {
    id: uid("CLM"),
    stoneId: gemPadparadscha.id,
    source: "Manual",
    type: "Lab opinion",
    statement: "Lotus Gemology report confirms natural padparadscha color without enhancement.",
    reportNumber: "LOTUS-99321",
    fileId: null,
    version: 1,
    createdAt: now(-3000),
    actor: "Dr. Tariq Al-Mansoor",
  });
  put("reviews", {
    id: gemPadparadscha.approvedVersion,
    stoneId: gemPadparadscha.id,
    claimVersion: 1,
    wording: gemPadparadscha.disclosure,
    resolution: "Lotus certificate accepted.",
    actor: "Dr. Tariq Al-Mansoor",
    createdAt: now(-2700),
  });

  // Stone 5: Merelani Tsavorite Garnet (In stock, display)
  const gemTsavorite = {
    id: uid("GEM"),
    variety: "Tsavorite Garnet",
    shape: "Pear",
    carats: "5.400",
    count: 1,
    location: "Display Case 2",
    custodian: "Internal intake",
    internal: true,
    state: "In stock",
    evidence: "Approved",
    disclosure: "Natural unheated grossular tsavorite garnet from Merelani Hills, Tanzania. Vivid saturation.",
    claimsVersion: 1,
    approvedVersion: uid("REV"),
    version: 2,
    ownershipConfirmed: true,
    ownershipShares: [],
    supplier: supTunduru.name,
    cost: "4200.00",
    price: "7800.00",
    origin: "Tanzania (Merelani)",
    treatment: "None",
    color: "Vivid Emerald-Green",
    dimensions: "12.30 x 8.40 x 6.10 mm",
    createdAt: now(-3000),
    updatedAt: now(-2200),
  };
  put("stones", gemTsavorite);
  put("claims", {
    id: uid("CLM"),
    stoneId: gemTsavorite.id,
    source: "Manual",
    type: "Supplier claim",
    statement: "Supplied by Tunduru Exporters as untreated single rough cut in Dar es Salaam.",
    reportNumber: "",
    fileId: null,
    version: 1,
    createdAt: now(-2800),
    actor: "Marcus Vance",
  });
  put("reviews", {
    id: gemTsavorite.approvedVersion,
    stoneId: gemTsavorite.id,
    claimVersion: 1,
    wording: gemTsavorite.disclosure,
    resolution: "Refractometer test confirms 1.740 isotropic grossular garnet. Untreated.",
    actor: "Dr. Tariq Al-Mansoor",
    createdAt: now(-2400),
  });

  // Stone 6: Mahenge Pink Spinel (HELD for Tiffany)
  const gemSpinelHeld = {
    id: uid("GEM"),
    variety: "Natural Spinel",
    shape: "Cushion",
    carats: "3.800",
    count: 1,
    location: "Main Safe / Tray B1",
    custodian: "Internal intake",
    internal: true,
    state: "Held",
    evidence: "Approved",
    disclosure: "Untreated vibrant neon pink spinel from Mahenge, Tanzania. High clarity.",
    claimsVersion: 1,
    approvedVersion: uid("REV"),
    version: 4,
    ownershipConfirmed: true,
    ownershipShares: [],
    supplier: supTunduru.name,
    cost: "4800.00",
    price: "8600.00",
    origin: "Tanzania (Mahenge)",
    treatment: "None",
    color: "Neon Hot Pink",
    dimensions: "9.20 x 8.80 x 5.40 mm",
    holdBy: "USR-084F8253", // Humaid or Elena
    holdCustomerId: cusTiffany.id,
    holdUntil: new Date(Date.now() + 48 * 3600000).toISOString(),
    createdAt: now(-2500),
    updatedAt: now(-60),
  };
  put("stones", gemSpinelHeld);
  put("claims", {
    id: uid("CLM"),
    stoneId: gemSpinelHeld.id,
    source: "Manual",
    type: "Lab opinion",
    statement: "AGL Prestige Report confirms natural spinel, no heat enhancement.",
    reportNumber: "AGL-10933",
    fileId: null,
    version: 1,
    createdAt: now(-2000),
    actor: "Dr. Tariq Al-Mansoor",
  });
  put("reviews", {
    id: gemSpinelHeld.approvedVersion,
    stoneId: gemSpinelHeld.id,
    claimVersion: 1,
    wording: gemSpinelHeld.disclosure,
    resolution: "AGL report approved.",
    actor: "Dr. Tariq Al-Mansoor",
    createdAt: now(-1800),
  });
  audit("Elena Rostova", "Sales staff", "Hold placed", gemSpinelHeld.id, null, gemSpinelHeld, now(-60));

  // Stone 7: Fancy Intense Yellow Diamond (ON MEMO with Graff)
  const gemYellowDiamond = {
    id: uid("GEM"),
    variety: "Natural Diamond",
    shape: "Radiant",
    carats: "2.050",
    count: 1,
    location: "MEM-GRAFF-01",
    custodian: cusGraff.name,
    internal: false,
    state: "On memo",
    evidence: "Approved",
    disclosure: "Natural fancy intense yellow diamond, VS1 clarity, excellent polish & symmetry (GIA report).",
    claimsVersion: 1,
    approvedVersion: uid("REV"),
    version: 4,
    ownershipConfirmed: true,
    ownershipShares: [],
    supplier: "De Beers Siteholder Partner",
    cost: "11000.00",
    price: "18500.00",
    origin: "South Africa",
    treatment: "None",
    color: "Fancy Intense Yellow",
    dimensions: "7.40 x 6.85 x 4.50 mm",
    memoId: "MEM-GRAFF-01",
    createdAt: now(-3200),
    updatedAt: now(-300),
  };
  put("stones", gemYellowDiamond);
  put("claims", {
    id: uid("CLM"),
    stoneId: gemYellowDiamond.id,
    source: "Manual",
    type: "Lab opinion",
    statement: "GIA Diamond Grading Report #221884 confirms Fancy Intense Yellow, VS1.",
    reportNumber: "GIA-221884",
    fileId: null,
    version: 1,
    createdAt: now(-2900),
    actor: "Dr. Tariq Al-Mansoor",
  });
  put("reviews", {
    id: gemYellowDiamond.approvedVersion,
    stoneId: gemYellowDiamond.id,
    claimVersion: 1,
    wording: gemYellowDiamond.disclosure,
    resolution: "GIA verified.",
    actor: "Dr. Tariq Al-Mansoor",
    createdAt: now(-2500),
  });

  // Stone 8: Rough Tanzanite (WITH LAB OR CUTTER)
  const gemTanzaniteRough = {
    id: uid("GEM"),
    variety: "Tanzanite (Rough)",
    shape: "Natural Crystal",
    carats: "12.400",
    count: 1,
    location: "JOB-SSEF-01",
    custodian: "SSEF Swiss Gemmological Institute (Basel)",
    internal: false,
    state: "With lab or cutter",
    evidence: "Review needed",
    disclosure: "",
    claimsVersion: 0,
    approvedVersion: null,
    version: 2,
    ownershipConfirmed: true,
    ownershipShares: [],
    supplier: supTunduru.name,
    cost: "2400.00",
    price: "0.00",
    origin: "Tanzania (Merelani Block D)",
    treatment: "None",
    color: "Trichroic Violet-Blue",
    dimensions: "18.5 x 11.2 x 9.8 mm",
    createdAt: now(-1500),
    updatedAt: now(-100),
  };
  put("stones", gemTanzaniteRough);
  audit("Liam O'Connor", "Cutter / lab liaison", "Processing issued", gemTanzaniteRough.id, null, gemTanzaniteRough, now(-100));

  // Stone 9: Imperial Topaz (RETURNED from Memo, awaiting stock-in)
  const gemImperialTopaz = {
    id: uid("GEM"),
    variety: "Imperial Topaz",
    shape: "Pear",
    carats: "6.200",
    count: 1,
    location: "Vault / Quarantine Tray",
    custodian: "Internal intake",
    internal: true,
    state: "Returned",
    evidence: "Approved",
    disclosure: "Natural untreated Imperial Topaz with rich sherry-peach saturation from Ouro Preto.",
    claimsVersion: 1,
    approvedVersion: uid("REV"),
    version: 5,
    ownershipConfirmed: true,
    ownershipShares: [],
    supplier: "Minas Gerais Direct",
    cost: "3100.00",
    price: "5500.00",
    origin: "Brazil (Ouro Preto)",
    treatment: "None",
    color: "Sherry Peach",
    dimensions: "14.10 x 8.20 x 5.90 mm",
    returnCondition: "Pristine condition, verified against original microscopic inclusion photograph. Tamper seal intact.",
    createdAt: now(-3600),
    updatedAt: now(-40),
  };
  put("stones", gemImperialTopaz);
  put("claims", {
    id: uid("CLM"),
    stoneId: gemImperialTopaz.id,
    source: "Manual",
    type: "Lab opinion",
    statement: "Gubelin Gemmological Report #190342 confirms natural unheated topaz.",
    reportNumber: "GUB-190342",
    fileId: null,
    version: 1,
    createdAt: now(-3000),
    actor: "Dr. Tariq Al-Mansoor",
  });
  put("reviews", {
    id: gemImperialTopaz.approvedVersion,
    stoneId: gemImperialTopaz.id,
    claimVersion: 1,
    wording: gemImperialTopaz.disclosure,
    resolution: "Approved.",
    actor: "Dr. Tariq Al-Mansoor",
    createdAt: now(-2800),
  });

  // Stone 10: Russian Alexandrite (EVIDENCE CONFLICT)
  const gemAlexandrite = {
    id: uid("GEM"),
    variety: "Natural Alexandrite",
    shape: "Oval",
    carats: "1.450",
    count: 1,
    location: "Reviewer Secure Safe",
    custodian: "Dr. Tariq Al-Mansoor",
    internal: true,
    state: "Draft",
    evidence: "Conflict",
    disclosure: "",
    claimsVersion: 2,
    approvedVersion: null,
    version: 3,
    ownershipConfirmed: true,
    ownershipShares: [],
    supplier: "Ural Gem Heritage Ltd",
    cost: "6000.00",
    price: "11000.00",
    origin: "Russia (Ural)",
    treatment: "Undetermined / Contested",
    color: "Green in daylight / Red in incandescent",
    dimensions: "7.10 x 5.40 x 3.90 mm",
    createdAt: now(-1200),
    updatedAt: now(-80),
  };
  put("stones", gemAlexandrite);
  put("claims", {
    id: uid("CLM"),
    stoneId: gemAlexandrite.id,
    source: "Manual",
    type: "Lab opinion",
    statement: "GIA Report #628190: Natural Chrysoberyl (Alexandrite), 80% color change, no indications of clarity enhancement.",
    reportNumber: "GIA-628190",
    fileId: null,
    version: 1,
    createdAt: now(-1000),
    actor: "Marcus Vance",
  });
  put("claims", {
    id: uid("CLM"),
    stoneId: gemAlexandrite.id,
    source: "Manual",
    type: "Lab opinion",
    statement: "Gübelin Report #33918: Color shift rated moderate (60%); minor foreign substance detected in surface-reaching fissure.",
    reportNumber: "GUB-33918",
    fileId: null,
    version: 2,
    createdAt: now(-80),
    actor: "Dr. Tariq Al-Mansoor",
  });
  audit("Dr. Tariq Al-Mansoor", "Gem reviewer", "Claim preserved", gemAlexandrite.id, null, { note: "Conflicting clarity and shift findings between GIA and Gübelin" }, now(-80));

  // Stone 11: Rough Aquamarine Parcel (Draft, intake awaiting review)
  const gemAquamarineParcel = {
    id: uid("GEM"),
    variety: "Aquamarine (Rough Parcel)",
    shape: "Parcel",
    carats: "15.500",
    count: 5,
    location: "Intake Tray 4",
    custodian: "Internal intake",
    internal: true,
    state: "Draft",
    evidence: "Review needed",
    disclosure: "",
    claimsVersion: 0,
    approvedVersion: null,
    version: 1,
    ownershipConfirmed: true,
    ownershipShares: [],
    supplier: supTunduru.name,
    cost: "1500.00",
    price: "0.00",
    origin: "Mozambique",
    treatment: "None",
    color: "Pastel Sea-Foam Blue",
    dimensions: "Rough crystals (5 pcs)",
    createdAt: now(-300),
    updatedAt: now(-300),
  };
  put("stones", gemAquamarineParcel);
  audit("Marcus Vance", "Inventory clerk", "Stone received", gemAquamarineParcel.id, null, gemAquamarineParcel, now(-300));

  // Stone 12: Paraíba Tourmaline Rough (BLOCKED / SPLIT PARENT)
  const gemTourmalineParent = {
    id: uid("GEM"),
    variety: "Tourmaline (Paraiba-type)",
    shape: "Rough",
    carats: "6.000",
    count: 1,
    location: "Vault Archive / Split",
    custodian: "Internal intake",
    internal: true,
    state: "Blocked",
    blockReason: "Split into linked child records",
    evidence: "Approved",
    disclosure: "Parent parcel split into two fine faceted stones and preserved kerf/cutting loss.",
    claimsVersion: 1,
    approvedVersion: uid("REV"),
    version: 4,
    ownershipConfirmed: true,
    ownershipShares: [],
    supplier: supTunduru.name,
    cost: "3000.00",
    price: "0.00",
    origin: "Mozambique (Alto Ligonha)",
    treatment: "None",
    color: "Neon Turquoise-Blue",
    dimensions: "Pre-split nodule",
    createdAt: now(-5000),
    updatedAt: now(-1400),
  };

  // Two faceted children from the split:
  const gemTourmalineChild1 = {
    id: uid("GEM"),
    parentId: gemTourmalineParent.id,
    variety: "Tourmaline (Paraiba-type)",
    shape: "Oval Brilliant",
    carats: "2.800",
    count: 1,
    location: "Main Safe / Tray B2",
    custodian: "Internal intake",
    internal: true,
    state: "In stock",
    evidence: "Approved",
    disclosure: "Natural copper-bearing tourmaline (Paraiba type). 2.800 ct, vivid neon turquoise blue. Unheated.",
    claimsVersion: 1,
    approvedVersion: uid("REV"),
    version: 2,
    ownershipConfirmed: true,
    ownershipShares: [],
    supplier: supTunduru.name,
    cost: "1615.38", // exact proportional split
    price: "6800.00",
    origin: "Mozambique (Alto Ligonha)",
    treatment: "None",
    color: "Electric Neon Turquoise",
    dimensions: "9.40 x 7.20 x 5.10 mm",
    createdAt: now(-1400),
    updatedAt: now(-1200),
  };

  const gemTourmalineChild2 = {
    id: uid("GEM"),
    parentId: gemTourmalineParent.id,
    variety: "Tourmaline (Paraiba-type)",
    shape: "Emerald Cut",
    carats: "2.400",
    count: 1,
    location: "Main Safe / Tray B2",
    custodian: "Internal intake",
    internal: true,
    state: "In stock",
    evidence: "Approved",
    disclosure: "Natural copper-bearing tourmaline (Paraiba type). 2.400 ct, intense glowing cyan.",
    claimsVersion: 1,
    approvedVersion: uid("REV"),
    version: 2,
    ownershipConfirmed: true,
    ownershipShares: [],
    supplier: supTunduru.name,
    cost: "1384.62", // exact remaining cost conserved to the penny
    price: "5600.00",
    origin: "Mozambique (Alto Ligonha)",
    treatment: "None",
    color: "Electric Cyan",
    dimensions: "8.60 x 6.50 x 4.80 mm",
    createdAt: now(-1400),
    updatedAt: now(-1200),
  };

  gemTourmalineParent.children = [gemTourmalineChild1.id, gemTourmalineChild2.id];
  gemTourmalineParent.loss = "0.800";
  put("stones", gemTourmalineParent);
  put("stones", gemTourmalineChild1);
  put("stones", gemTourmalineChild2);

  // Stone 13: Past Sold Stone (Vivid Blue Sapphire)
  const gemSoldSapphire = {
    id: uid("GEM"),
    variety: "Natural Sapphire",
    shape: "Cushion",
    carats: "3.500",
    count: 1,
    location: "INV-CARTIER-01",
    custodian: cusCartier.name,
    internal: false,
    state: "Sold",
    evidence: "Approved",
    disclosure: "Natural unheated blue sapphire 3.500 ct. Sold to Cartier High Jewelry.",
    claimsVersion: 1,
    approvedVersion: uid("REV"),
    version: 5,
    ownershipConfirmed: true,
    ownershipShares: [],
    supplier: supCeylon.name,
    cost: "6800.00",
    price: "16500.00",
    origin: "Sri Lanka",
    treatment: "None",
    color: "Vivid Royal Blue",
    dimensions: "8.80 x 7.90 x 5.40 mm",
    invoiceId: "INV-CARTIER-01",
    createdAt: now(-6000),
    updatedAt: now(-2000),
  };
  put("stones", gemSoldSapphire);

  // 5. Incoming Consignment Memo (Purchasing -> Incoming Consignment)
  const minMogok = {
    id: uid("MIN"),
    supplierId: supMogok.id,
    supplierName: supMogok.name,
    due: new Date(Date.now() + 25 * 86400000).toISOString(),
    terms: "30-day dealer consignment for private European showings. Unsold items returnable in original tamper seals.",
    createdAt: now(-2800),
    lines: [],
  };

  // Stone 14: Ruby on incoming consignment (Sold)
  const gemConsignRubySold = {
    id: uid("GEM"),
    variety: "Burma Ruby (Consignment)",
    shape: "Oval",
    carats: "2.450",
    count: 1,
    location: "INV-TIFFANY-01",
    custodian: cusTiffany.name,
    internal: false,
    state: "Sold",
    evidence: "Approved",
    disclosure: "Natural unheated Burma Ruby 2.450 ct. Consignment sale.",
    claimsVersion: 1,
    approvedVersion: uid("REV"),
    version: 4,
    ownershipConfirmed: true,
    supplier: supMogok.name,
    incomingMemoId: minMogok.id,
    supplierOwned: true,
    cost: "6000.00",
    price: "9500.00",
    origin: "Myanmar",
    treatment: "None",
    color: "Pigeon's Blood",
    invoiceId: "INV-TIFFANY-01",
    createdAt: now(-2700),
    updatedAt: now(-800),
  };
  put("stones", gemConsignRubySold);

  // Stone 15: Spinel on incoming consignment (Returned to supplier)
  const gemConsignSpinelReturned = {
    id: uid("GEM"),
    variety: "Red Spinel (Consignment)",
    shape: "Cushion",
    carats: "1.820",
    count: 1,
    location: "Returned to supplier",
    custodian: supMogok.name,
    internal: false,
    state: "Returned",
    evidence: "Review needed",
    disclosure: "",
    claimsVersion: 0,
    approvedVersion: null,
    version: 3,
    ownershipConfirmed: false,
    supplier: supMogok.name,
    incomingMemoId: minMogok.id,
    supplierOwned: true,
    cost: "2200.00",
    price: "4200.00",
    origin: "Myanmar",
    treatment: "None",
    color: "Vivid Red",
    returnCondition: "Returned to Mogok Gems Bangkok office via DHL Secure Courier tracking #TH882910.",
    createdAt: now(-2700),
    updatedAt: now(-500),
  };
  put("stones", gemConsignSpinelReturned);

  // Stone 16: Star Ruby on incoming consignment (Pending in stock)
  const gemConsignStarRuby = {
    id: uid("GEM"),
    variety: "Star Ruby (Consignment)",
    shape: "Cabochon",
    carats: "3.100",
    count: 1,
    location: "Main Safe / Tray C1",
    custodian: "Internal intake",
    internal: true,
    state: "In stock",
    evidence: "Approved",
    disclosure: "Natural unheated star ruby displaying sharp, centered 6-ray asterism in direct illumination.",
    claimsVersion: 1,
    approvedVersion: uid("REV"),
    version: 3,
    ownershipConfirmed: true,
    supplier: supMogok.name,
    incomingMemoId: minMogok.id,
    supplierOwned: true,
    cost: "4100.00",
    price: "7200.00",
    origin: "Myanmar",
    treatment: "None",
    color: "Purplish Red Asteriated",
    dimensions: "8.50 x 7.80 x 5.20 mm",
    createdAt: now(-2700),
    updatedAt: now(-1000),
  };
  put("stones", gemConsignStarRuby);

  minMogok.lines = [
    { stoneId: gemConsignRubySold.id, cost: "6000.00", status: "Sold", invoiceId: "INV-TIFFANY-01" },
    { stoneId: gemConsignSpinelReturned.id, cost: "2200.00", status: "Returned", condition: gemConsignSpinelReturned.returnCondition, returnedAt: now(-500) },
    { stoneId: gemConsignStarRuby.id, cost: "4100.00", status: "Pending" },
  ];
  put("incomingMemos", minMogok);
  audit("Humaid", "Owner", "Supplier memo received", minMogok.id, null, minMogok, now(-2800));

  // 6. Purchase Orders (Purchasing -> Purchase Orders)
  // PO-1: Received PO from Ceylon Sapphire Syndicate
  const po1 = {
    id: uid("PO"),
    supplierId: supCeylon.id,
    supplierName: supCeylon.name,
    lines: [
      { variety: "Cornflower Sapphire", shape: "Cushion", carats: "3.150", cost: "4500.00", count: 1 },
      { variety: "Cornflower Sapphire", shape: "Oval", carats: "2.840", cost: "3800.00", count: 1 },
    ],
    total: "8300.00",
    status: "Received",
    terms: "Net 30 days. Agreed FOB Colombo airport. 100% genuine Ceylon rough cut.",
    receivedAt: now(-2200),
    createdAt: now(-2500),
  };
  // Stones generated by PO-1:
  const gemPo1 = {
    id: uid("GEM"),
    variety: "Cornflower Sapphire",
    shape: "Cushion",
    carats: "3.150",
    count: 1,
    location: "Main Safe / Tray A1",
    custodian: "Internal intake",
    internal: true,
    state: "In stock",
    evidence: "Approved",
    disclosure: "Natural Ceylon sapphire, 3.150 ct, cornflower blue, traditional gentle heat.",
    claimsVersion: 1,
    approvedVersion: uid("REV"),
    version: 2,
    ownershipConfirmed: true,
    supplier: supCeylon.name,
    purchaseOrderId: po1.id,
    cost: "4500.00",
    price: "7900.00",
    origin: "Sri Lanka",
    treatment: "Heated",
    color: "Cornflower Blue",
    dimensions: "8.30 x 7.60 x 5.10 mm",
    createdAt: now(-2200),
    updatedAt: now(-1900),
  };
  const gemPo2 = {
    id: uid("GEM"),
    variety: "Cornflower Sapphire",
    shape: "Oval",
    carats: "2.840",
    count: 1,
    location: "Main Safe / Tray A1",
    custodian: "Internal intake",
    internal: true,
    state: "In stock",
    evidence: "Approved",
    disclosure: "Natural Ceylon sapphire, 2.840 ct, vivid blue, traditional gentle heat.",
    claimsVersion: 1,
    approvedVersion: uid("REV"),
    version: 2,
    ownershipConfirmed: true,
    supplier: supCeylon.name,
    purchaseOrderId: po1.id,
    cost: "3800.00",
    price: "6600.00",
    origin: "Sri Lanka",
    treatment: "Heated",
    color: "Cornflower Blue",
    dimensions: "8.10 x 6.90 x 4.80 mm",
    createdAt: now(-2200),
    updatedAt: now(-1900),
  };
  po1.stoneIds = [gemPo1.id, gemPo2.id];
  put("stones", gemPo1);
  put("stones", gemPo2);
  put("purchaseOrders", po1);
  audit("Humaid", "Owner", "Purchase order created", po1.id, null, po1, now(-2500));
  audit("Marcus Vance", "Inventory clerk", "Purchase received", po1.id, null, po1, now(-2200));

  // PO-2: Ordered (Pending receipt) from Muzo Emerald Miners
  const po2 = {
    id: uid("PO"),
    supplierId: supMuzo.id,
    supplierName: supMuzo.name,
    lines: [
      { variety: "Muzo Emerald Solitaire", shape: "Emerald Cut", carats: "4.200", cost: "12500.00", count: 1 },
    ],
    total: "12500.00",
    status: "Ordered",
    terms: "FOB Bogotá. Pre-cleared by Fedex Custom Critical with Brinks transit insurance.",
    createdAt: now(-600),
  };
  put("purchaseOrders", po2);
  audit("Humaid", "Owner", "Purchase order created", po2.id, null, po2, now(-600));

  // 7. Supplier Payments (Purchasing -> Supplier Payments)
  const spy1 = {
    id: uid("SPY"),
    orderId: po1.id,
    supplierId: supCeylon.id,
    supplierName: supCeylon.name,
    amount: "5000.00",
    reference: "WIRE-CEYLON-PARTIAL-8819",
    createdAt: now(-1500),
  };
  put("supplierPayments", spy1);
  audit("Sophia Chen", "Accounts", "Supplier payment recorded", spy1.id, null, spy1, now(-1500));

  const spy2 = {
    id: uid("SPY"),
    memoId: minMogok.id,
    supplierId: supMogok.id,
    supplierName: supMogok.name,
    amount: "6000.00",
    reference: "WIRE-MOGOK-SOLD-LINE1",
    createdAt: now(-600),
  };
  put("supplierPayments", spy2);
  audit("Sophia Chen", "Accounts", "Supplier payment recorded", spy2.id, null, spy2, now(-600));

  // 8. Outgoing Memos (Memos)
  const memoGraff = {
    id: "MEM-GRAFF-01",
    customerId: cusGraff.id,
    customerName: cusGraff.name,
    due: new Date(Date.now() + 14 * 86400000).toISOString(),
    terms: "14-day viewing memo for London private salon presentation. Risk of loss passes to bailee.",
    commissionRate: "5.000",
    lines: [
      { stoneId: gemYellowDiamond.id, status: "Pending", price: gemYellowDiamond.price },
      { stoneId: gemSoldSapphire.id, status: "Sold", price: "16500.00", invoiceId: "INV-CARTIER-01" },
      { stoneId: gemImperialTopaz.id, status: "Returned", condition: gemImperialTopaz.returnCondition, returnedAt: now(-40) },
    ],
    createdAt: now(-3200),
  };
  put("memos", memoGraff);
  audit("Elena Rostova", "Sales staff", "Memo issued", memoGraff.id, null, memoGraff, now(-3200));

  // 9. Quotes (Quotes)
  // Quote 1: Standard Ready Quote for Cartier
  const quoCartier = {
    id: uid("QUO"),
    customerId: cusCartier.id,
    customerName: cusCartier.name,
    lines: [
      {
        stoneId: gemPadparadscha.id,
        variety: gemPadparadscha.variety,
        carats: gemPadparadscha.carats,
        price: gemPadparadscha.price,
        disclosure: gemPadparadscha.disclosure,
        disclosureVersion: gemPadparadscha.approvedVersion,
      },
    ],
    total: gemPadparadscha.price,
    currency: "USD",
    status: "Ready",
    expires: new Date(Date.now() + 10 * 86400000).toISOString(),
    createdAt: now(-400),
  };
  put("quotes", quoCartier);
  audit("Elena Rostova", "Sales staff", "Quote created", quoCartier.id, null, quoCartier, now(-400));

  // Quote 2: Awaiting Owner Approval (Excess discount requested: $11,500 vs $13,200 list = 12.8% > 5% limit)
  const quoDiscountAwaiting = {
    id: uid("QUO"),
    customerId: cusTiffany.id,
    customerName: cusTiffany.name,
    lines: [
      {
        stoneId: gemEmerald.id,
        variety: gemEmerald.variety,
        carats: gemEmerald.carats,
        price: "11500.00", // Discount from $13,200 list
        disclosure: gemEmerald.disclosure,
        disclosureVersion: gemEmerald.approvedVersion,
      },
    ],
    total: "11500.00",
    currency: "USD",
    status: "Awaiting owner",
    expires: new Date(Date.now() + 5 * 86400000).toISOString(),
    createdAt: now(-120),
  };
  put("quotes", quoDiscountAwaiting);
  audit("Elena Rostova", "Sales staff", "Quote created", quoDiscountAwaiting.id, null, quoDiscountAwaiting, now(-120));

  // Quote 3: Approved by Owner
  const quoApproved = {
    id: uid("QUO"),
    customerId: cusGraff.id,
    customerName: cusGraff.name,
    lines: [
      {
        stoneId: gemSapphire.id,
        variety: gemSapphire.variety,
        carats: gemSapphire.carats,
        price: "14000.00", // $1,500 discount approved
        disclosure: gemSapphire.disclosure,
        disclosureVersion: gemSapphire.approvedVersion,
      },
    ],
    total: "14000.00",
    currency: "USD",
    status: "Approved",
    approvedBy: "Humaid",
    approvedAt: now(-60),
    expires: new Date(Date.now() + 7 * 86400000).toISOString(),
    createdAt: now(-300),
  };
  put("quotes", quoApproved);
  audit("Humaid", "Owner", "Discount approved", quoApproved.id, null, quoApproved, now(-60));

  // 10. Private Buyer Selection (Holds & selections)
  const selCartier = {
    id: uid("SEL"),
    token: "cartier-spring-solitaires-" + randomBytes(16).toString("hex"),
    customerId: cusCartier.id,
    customerName: cusCartier.name,
    stoneIds: [gemSapphire.id, gemEmerald.id, gemPadparadscha.id],
    title: "Cartier Spring 2026 Haute Joaillerie Solitaires",
    expires: new Date(Date.now() + 14 * 86400000).toISOString(),
    decisions: [
      { at: now(-180), decision: "Interest recorded: Client reviewed the SSEF report for the 4.85ct Royal Blue." },
      { at: now(-60), decision: "Request hold: Client requested hold discussion for the Padparadscha." },
    ],
    createdAt: now(-2400),
  };
  put("selections", selCartier);
  audit("Elena Rostova", "Sales staff", "Private selection created", selCartier.id, null, { ...selCartier, token: "[private]" }, now(-2400));

  // 11. Invoices & Sales (Sales)
  // Invoice 1: Paid in full (Cartier)
  const invCartier = {
    id: "INV-CARTIER-01",
    customerId: cusCartier.id,
    customerName: cusCartier.name,
    lines: [
      {
        stoneId: gemSoldSapphire.id,
        variety: gemSoldSapphire.variety,
        carats: gemSoldSapphire.carats,
        price: "16500.00",
        basePrice: "16500.00",
        disclosure: gemSoldSapphire.disclosure,
        disclosureVersion: gemSoldSapphire.approvedVersion,
        returned: false,
      },
    ],
    total: "16500.00",
    currency: "USD",
    minorUnits: 2,
    exchangeRate: "1",
    baseTotal: "16500.00",
    createdAt: now(-2000),
    memoId: memoGraff.id,
  };
  put("invoices", invCartier);
  audit("Elena Rostova", "Sales staff", "Invoice issued", invCartier.id, null, invCartier, now(-2000));

  // Invoice 2: Partially paid with open balance (Graff)
  const invGraff = {
    id: "INV-GRAFF-02",
    customerId: cusGraff.id,
    customerName: cusGraff.name,
    lines: [
      {
        stoneId: gemPo1.id,
        variety: gemPo1.variety,
        carats: gemPo1.carats,
        price: "14000.00",
        basePrice: "14000.00",
        disclosure: gemPo1.disclosure,
        disclosureVersion: gemPo1.approvedVersion,
        returned: false,
      },
    ],
    total: "14000.00",
    currency: "USD",
    minorUnits: 2,
    exchangeRate: "1",
    baseTotal: "14000.00",
    createdAt: now(-1200),
    memoId: null,
  };
  put("invoices", invGraff);
  audit("Elena Rostova", "Sales staff", "Invoice issued", invGraff.id, null, invGraff, now(-1200));

  // Invoice 3: Multi-currency EUR invoice (Van Cleef & Arpels)
  const invVanCleefEur = {
    id: "INV-VANCLEEF-03",
    customerId: cusVanCleef.id,
    customerName: cusVanCleef.name,
    lines: [
      {
        stoneId: gemPo2.id,
        variety: gemPo2.variety,
        carats: gemPo2.carats,
        price: "12000.00", // EUR 12,000.00
        basePrice: "13020.00", // at 1.085000
        disclosure: gemPo2.disclosure,
        disclosureVersion: gemPo2.approvedVersion,
        returned: false,
      },
    ],
    total: "12000.00",
    currency: "EUR",
    minorUnits: 2,
    exchangeRate: "1.085000",
    baseTotal: "13020.00",
    createdAt: now(-800),
    memoId: null,
  };
  put("invoices", invVanCleefEur);
  audit("Elena Rostova", "Sales staff", "Invoice issued", invVanCleefEur.id, null, invVanCleefEur, now(-800));

  // Invoice 4: With returned line, credit note and refund (Tiffany)
  const invTiffanyWithReturn = {
    id: "INV-TIFFANY-01",
    customerId: cusTiffany.id,
    customerName: cusTiffany.name,
    lines: [
      {
        stoneId: gemConsignRubySold.id,
        variety: gemConsignRubySold.variety,
        carats: gemConsignRubySold.carats,
        price: "5000.00",
        basePrice: "5000.00",
        disclosure: gemConsignRubySold.disclosure,
        disclosureVersion: gemConsignRubySold.approvedVersion,
        returned: false,
      },
      {
        stoneId: gemImperialTopaz.id,
        variety: gemImperialTopaz.variety,
        carats: gemImperialTopaz.carats,
        price: "4500.00",
        basePrice: "4500.00",
        disclosure: gemImperialTopaz.disclosure,
        disclosureVersion: gemImperialTopaz.approvedVersion,
        returned: true,
        condition: "Buyer client requested different facet cut; returned pristine.",
      },
    ],
    total: "9500.00",
    currency: "USD",
    minorUnits: 2,
    exchangeRate: "1",
    baseTotal: "9500.00",
    createdAt: now(-1000),
    memoId: null,
  };
  put("invoices", invTiffanyWithReturn);

  // 12. Payments, Credits, Refunds (Payments)
  // Payment 1: Full payment for Cartier ($16,500.00)
  const payCartier = {
    id: uid("PAY"),
    customerId: cusCartier.id,
    customerName: cusCartier.name,
    amount: "16500.00",
    baseAmount: "16500.00",
    allocations: [{ invoiceId: invCartier.id, amount: "16500.00" }],
    reference: "BNP-PARIS-WIRE-449102",
    method: "Bank transfer",
    currency: "USD",
    exchangeRate: "1",
    createdAt: now(-1800),
  };
  put("payments", payCartier);
  audit("Sophia Chen", "Accounts", "Payment allocated", payCartier.id, null, payCartier, now(-1800));

  // Payment 2: Partial payment for Graff ($8,000.00 of $14,000.00)
  const payGraff = {
    id: uid("PAY"),
    customerId: cusGraff.id,
    customerName: cusGraff.name,
    amount: "8000.00",
    baseAmount: "8000.00",
    allocations: [{ invoiceId: invGraff.id, amount: "8000.00" }],
    reference: "BARCLAYS-LDN-WIRE-0029",
    method: "Bank transfer",
    currency: "USD",
    exchangeRate: "1",
    createdAt: now(-900),
  };
  put("payments", payGraff);
  audit("Sophia Chen", "Accounts", "Payment allocated", payGraff.id, null, payGraff, now(-900));

  // Payment 3: Tiffany wire of $9,500 against INV-TIFFANY-01
  const payTiffany = {
    id: uid("PAY"),
    customerId: cusTiffany.id,
    customerName: cusTiffany.name,
    amount: "9500.00",
    baseAmount: "9500.00",
    allocations: [{ invoiceId: invTiffanyWithReturn.id, amount: "9500.00" }],
    reference: "JPM-CHASE-WIRE-77312",
    method: "Bank transfer",
    currency: "USD",
    exchangeRate: "1",
    createdAt: now(-700),
  };
  put("payments", payTiffany);
  audit("Sophia Chen", "Accounts", "Payment allocated", payTiffany.id, null, payTiffany, now(-700));

  // Credit Note: Issued by Accounts for the returned stone on Tiffany invoice
  const creditTiffany = {
    id: uid("CRD"),
    invoiceId: invTiffanyWithReturn.id,
    stoneId: gemImperialTopaz.id,
    amount: "4500.00",
    currency: "USD",
    baseAmount: "4500.00",
    status: "Issued",
    createdAt: now(-500),
  };
  put("credits", creditTiffany);
  audit("Sophia Chen", "Accounts", "Credit issued", creditTiffany.id, null, creditTiffany, now(-500));

  // Refund: $1,500.00 cash refund returned to Tiffany against their credit balance
  const refundTiffany = {
    id: uid("REF"),
    invoiceId: invTiffanyWithReturn.id,
    customerId: cusTiffany.id,
    amount: "1500.00",
    currency: "USD",
    baseAmount: "1500.00",
    exchangeRate: "1",
    reference: "REFUND-WIRE-JPM-8812",
    createdAt: now(-300),
  };
  put("refunds", refundTiffany);
  audit("Sophia Chen", "Accounts", "Refund recorded", refundTiffany.id, null, refundTiffany, now(-300));

  // 13. Processing Jobs (Processing)
  // Job 1: Completed cutting job by Master Lapidary Hans Zimmer
  const jobCuttingCompleted = {
    id: "JOB-CUT-01",
    stoneId: gemTourmalineParent.id,
    type: "Cutting",
    custodian: "Idar-Oberstein Lapidary Works (Hans Zimmer)",
    instructions: "Faceting rough parcel into two matched high-yield investment gems. Retain maximum saturation.",
    preWeight: "8.500",
    postWeight: "5.200",
    loss: "3.300",
    charges: "650.00",
    yield: "61.18",
    status: "Returned",
    createdAt: now(-4000),
    returnedAt: now(-1500),
  };
  put("jobs", jobCuttingCompleted);

  // Job 2: Active Laboratory Certification with SSEF
  const jobLabActive = {
    id: "JOB-SSEF-01",
    stoneId: gemTanzaniteRough.id,
    type: "Laboratory",
    custodian: "SSEF Swiss Gemmological Institute (Basel)",
    instructions: "Geographic origin determination and spectroscopy for unheated zoisite / tanzanite crystal.",
    preWeight: "12.400",
    status: "Issued",
    createdAt: now(-100),
  };
  put("jobs", jobLabActive);

  // 14. Stocktake (Stocktake)
  const stocktakeRecord = {
    id: uid("CNT"),
    location: "Main Safe / Tray A1",
    scanned: [gemSapphire.id, gemPo1.id, gemPo2.id],
    matched: [gemSapphire.id, gemPo1.id, gemPo2.id],
    missing: [],
    unexpected: [],
    createdAt: now(-180),
    actor: "Marcus Vance",
  };
  put("stocktakes", stocktakeRecord);
  audit("Marcus Vance", "Inventory clerk", "Stocktake recorded", stocktakeRecord.id, null, stocktakeRecord, now(-180));

  // 15. Operating Expenses & Settlements (Payments / Accounting)
  const expenses = [
    { id: uid("EXP"), description: "Lloyd's of London High-Value Specie & Vault Insurance Rider (Q4)", amount: "1250.00", category: "Insurance & Security", createdAt: now(-2000) },
    { id: uid("EXP"), description: "Brinks Global Armored Logistics (Geneva Vault to Zurich Salon)", amount: "480.00", category: "Secure Transit", createdAt: now(-1400) },
    { id: uid("EXP"), description: "Gemological Optical Spectrometer & Refractometer Annual Calibration", amount: "320.00", category: "Laboratory Equipment", createdAt: now(-800) },
  ];
  for (const exp of expenses) {
    put("expenses", exp);
    audit("Sophia Chen", "Accounts", "Expense recorded", exp.id, null, exp, exp.createdAt);
  }

  const settlements = [
    { id: uid("SET"), invoiceId: invCartier.id, type: "Broker", recipient: "Jean-Paul Dupont (Paris Fine Jewelry Broker)", amount: "1500.00", reference: "COMM-DUPONT-CARTIER-01", createdAt: now(-1600) },
    { id: uid("SET"), invoiceId: invCartier.id, type: "Shared owner", recipient: "Muzo Syndicate Partner Equity Share", amount: "2000.00", reference: "PROFIT-SHARE-EMERALD-Q4", createdAt: now(-1400) },
  ];
  for (const s of settlements) {
    put("settlements", s);
    audit("Sophia Chen", "Accounts", "Settlement recorded", s.id, null, s, s.createdAt);
  }

  // 16. Bank Reconciliation (Payments -> Reconciliation)
  // Compute expected cash based on actual records
  const totalReceipts = new Decimal("16500.00").plus("8000.00").plus("9500.00"); // 34000
  const totalSupplierPayments = new Decimal("5000.00").plus("6000.00"); // 11000
  const totalRefunds = new Decimal("1500.00"); // 1500
  const totalExpenses = new Decimal("1250.00").plus("480.00").plus("320.00"); // 2050
  const totalSettlements = new Decimal("1500.00").plus("2000.00"); // 3500
  const expectedNet = totalReceipts.minus(totalSupplierPayments).minus(totalRefunds).minus(totalExpenses).minus(totalSettlements).toFixed(2); // 15950.00

  const reconciliation = {
    id: uid("REC"),
    expected: expectedNet,
    actual: expectedNet,
    difference: "0.00",
    note: "Primary Swiss operating account matched statement closing balance exactly.",
    actor: "Sophia Chen",
    createdAt: now(-60),
  };
  put("reconciliations", reconciliation);
  audit("Sophia Chen", "Accounts", "Reconciliation recorded", reconciliation.id, null, reconciliation, now(-60));

  // 17. Show Operations (Show mode)
  const showGeneva = {
    id: uid("SHW"),
    name: "Geneva International Gem & Jewellery Exhibition 2026",
    deviceId: "iPad-Pro-Booth-4B",
    stoneIds: [gemRuby.id, gemEmerald.id],
    key: randomBytes(32).toString("hex"),
    status: "Assigned",
    assignedBy: "USR-084F8253",
    createdAt: now(-1800),
    expires: new Date(Date.now() + 5 * 86400000).toISOString(),
  };
  put("shows", showGeneva);

  // Link stones to the assigned show device
  gemRuby.showId = showGeneva.id;
  gemRuby.deviceId = showGeneva.deviceId;
  put("stones", gemRuby);

  gemEmerald.showId = showGeneva.id;
  gemEmerald.deviceId = showGeneva.deviceId;
  put("stones", gemEmerald);

  audit("Humaid", "Owner", "Show assigned", showGeneva.id, null, { ...showGeneva, key: "[private]" }, now(-1800));

  // Show Conflict Resolution record
  const showConflictResolved = {
    id: "EVT-SHOW-OFFLINE-REPLAY-01",
    showId: showGeneva.id,
    showName: showGeneva.name,
    deviceId: showGeneva.deviceId,
    payload: {
      id: "EVT-SHOW-OFFLINE-REPLAY-01",
      showId: showGeneva.id,
      deviceId: showGeneva.deviceId,
      customerId: cusCartier.id,
      stoneId: gemRuby.id,
      at: now(-1200),
    },
    reason: "Offline replay completed. Customer signed on booth device.",
    status: "Reconciled",
    invoiceId: invCartier.id,
    createdAt: now(-1200),
    resolvedAt: now(-600),
  };
  put("showConflicts", showConflictResolved);

  console.log("--- Comprehensive Data Seeding Complete! ---");
  console.log(`- Users: ${teamUsers.length + 1} (Owner + 5 role accounts)`);
  console.log(`- Customers: ${customers.length}`);
  console.log(`- Suppliers: ${suppliers.length}`);
  console.log(`- Purchase Orders: 2 (1 Received, 1 Ordered)`);
  console.log(`- Incoming Consignment Memos: 1 (with 3 lines: Sold, Returned, Pending)`);
  console.log(`- Supplier Payments: 2`);
  console.log(`- Inventory Stones: 16 (across In Stock, Held, On Memo, With Lab/Cutter, Returned, Draft, Conflict, Split)`);
  console.log(`- Evidence: Real PDF Lab Certificates (SSEF, Gübelin, GIA), Claims, Approvals & Conflicts`);
  console.log(`- Holds: 1 active hold for Tiffany with live timer`);
  console.log(`- Private Selections: 1 for Cartier with token link & logged buyer feedback`);
  console.log(`- Outgoing Memos: 1 for Graff (Pending line, Sold line, Returned line)`);
  console.log(`- Quotes: 3 (Ready, Awaiting Owner Approval, Approved)`);
  console.log(`- Invoices: 4 (Paid in full, Partial balance, EUR multi-currency, Return with credit/refund)`);
  console.log(`- Payments & Allocations: 3`);
  console.log(`- Credits & Refunds: 1 credit note + 1 cash refund`);
  console.log(`- Processing Jobs: 2 (Completed cutting job with yield % + Active SSEF lab job)`);
  console.log(`- Stocktakes: 1 completed vault count`);
  console.log(`- Expenses & Settlements: 3 expenses + 2 partner/broker settlements`);
  console.log(`- Financial Reconciliation: 1 verified bank statement reconciliation`);
  console.log(`- Show Mode: 1 assigned international show + 1 replayed conflict record`);
  console.log(`- Activity Log: Full chronological audit trail of all operations`);
}

seed().catch(console.error);
