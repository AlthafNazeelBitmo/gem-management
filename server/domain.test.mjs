import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
const directory = mkdtempSync(path.join(tmpdir(), "gem-api-test-"));
// An existing empty file prevents the database loader from copying workstation or demo records.
writeFileSync(path.join(directory, "gem.sqlite"), "", { mode: 0o600 });
const port = 3219,
  base = `http://127.0.0.1:${port}`;
let server;
const sessions = {};
let stone, customer, invoice, memo;
async function call(who, url, body, expected = 200) {
  const s = sessions[who];
  const multipart = body instanceof FormData;
  const response = await fetch(base + url, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(body && !multipart ? { "Content-Type": "application/json" } : {}),
      ...(s ? { Cookie: s.cookie, "X-CSRF-Token": s.csrf } : {}),
    },
    body:
      body === undefined ? undefined : multipart ? body : JSON.stringify(body),
  });
  const result = await response.json();
  assert.equal(response.status, expected, JSON.stringify(result));
  return result;
}
async function login(who, email, password) {
  const response = await fetch(base + "/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const r = await response.json();
  assert.equal(response.status, 200, JSON.stringify(r));
  sessions[who] = {
    cookie: response.headers.get("set-cookie").split(";")[0],
    csrf: r.user.csrf,
  };
}
async function command(who, action, body, expected = 200) {
  return (await call(who, "/api/commands/" + action, body, expected)).result;
}
async function workspace(who = "owner") {
  return call(who, "/api/workspace");
}
async function current(id) {
  return (await workspace()).stones.find((s) => s.id === id);
}
async function release(s) {
  await command("reviewer", "claim", {
    stoneId: s.id,
    version: s.version,
    type: "Supplier claim",
    statement: "Training-only claim supplied by the test.",
  });
  s = await current(s.id);
  await command("reviewer", "approve", {
    id: s.id,
    version: s.version,
    disclosure: "Training stone. No laboratory finding is asserted.",
  });
  s = await current(s.id);
  await command("clerk", "stock-in", { id: s.id, version: s.version });
  return current(s.id);
}
before(async () => {
  server = spawn(process.execPath, ["server/index.mjs"], {
    env: {
      ...process.env,
      DATA_DIR: directory,
      API_PORT: String(port),
      DATABASE_URL: "",
      NEON_REALTIME_SECRET: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let logs = "";
  server.stderr.on("data", (d) => (logs += d));
  server.stdout.on("data", (d) => (logs += d));
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch(base + "/api/health");
      if (r.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  throw Error("API did not start: " + logs);
});
after(() => {
  server?.kill();
  rmSync(directory, { recursive: true, force: true });
});
test("create owner, reject second setup and provision isolated roles", async () => {
  const response = await fetch(base + "/api/setup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Test owner",
      businessName: "Training gem workspace",
      email: "owner@example.test",
      password: "test-password-owner",
      currency: "USD",
      minorUnits: 2,
      country: "Training",
      sandbox: true,
    }),
  });
  const r = await response.json();
  assert.equal(response.status, 201);
  sessions.owner = {
    cookie: response.headers.get("set-cookie").split(";")[0],
    csrf: r.user.csrf,
  };
  await call("owner", "/api/setup", {}, 409);
  for (const [who, role] of [
    ["clerk", "Inventory clerk"],
    ["sales", "Sales staff"],
    ["reviewer", "Gem reviewer"],
    ["accounts", "Accounts"],
    ["liaison", "Cutter / lab liaison"],
  ]) {
    await call("owner", "/api/users", {
      name: `Test ${who}`,
      email: `${who}@example.test`,
      password: "test-password-" + who,
      role,
    });
    await login(who, `${who}@example.test`, "test-password-" + who);
  }
});
test("receipt persists, enforces evidence and hides cost and supplier from sales", async () => {
  stone = await command("owner", "receive", {
    variety: "Training sapphire",
    shape: "Oval",
    carats: "3.240",
    location: "Training vault",
    cost: "100.01",
    price: "200.00",
    supplier: "Restricted supplier",
    ownershipConfirmed: true,
  });
  assert.equal(stone.state, "Draft");
  await command(
    "clerk",
    "stock-in",
    { id: stone.id, version: stone.version },
    400,
  );
  stone = await release(stone);
  const sales = await workspace("sales");
  assert.equal(sales.stones[0].cost, undefined);
  assert.equal(sales.stones[0].supplier, undefined);
  assert.equal(sales.events, undefined);
  await command(
    "sales",
    "edit-stone",
    { id: stone.id, version: stone.version, cost: "0" },
    403,
  );
  await command(
    "accounts",
    "approve",
    { id: stone.id, version: stone.version, disclosure: "forbidden" },
    403,
  );
  const unpriced = await command("clerk", "receive", {
    variety: "Clerk draft",
    shape: "Oval",
    carats: "1",
    location: "Intake",
    cost: "10",
    price: "999",
  });
  assert.equal((await current(unpriced.id)).price, "0.00");
  assert.equal(unpriced.cost, undefined);
});
test("one concurrent hold succeeds; stale versions and competing holds fail", async () => {
  customer = await command("sales", "customer", { name: "Training buyer" });
  const payload = {
    id: stone.id,
    version: stone.version,
    customerId: customer.id,
    hours: "24",
  };
  const responses = await Promise.all([
    fetch(base + "/api/commands/hold", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessions.sales.cookie,
        "X-CSRF-Token": sessions.sales.csrf,
      },
      body: JSON.stringify(payload),
    }),
    fetch(base + "/api/commands/hold", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessions.sales.cookie,
        "X-CSRF-Token": sessions.sales.csrf,
      },
      body: JSON.stringify(payload),
    }),
  ]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]);
  stone = await current(stone.id);
  assert.equal(stone.state, "Held");
});
test("private selection only exposes buyer-safe reviewed fields and logs response", async () => {
  const selection = await command("sales", "selection", {
    title: "Training selection",
    customerId: customer.id,
    stoneIds: [stone.id],
  });
  const buyer = await call(null, "/api/buyer/" + selection.token);
  assert.equal(buyer.stones.length, 1);
  assert.equal(buyer.stones[0].cost, undefined);
  assert.equal(buyer.stones[0].supplier, undefined);
  assert.equal(buyer.customerId, undefined);
  await call(null, "/api/buyer/" + selection.token, {
    decision: "Request hold",
  });
  assert.equal((await current(stone.id)).state, "Held");
});
test("memo issue, partial sale and return preserve custody and balances", async () => {
  let second = await command("owner", "receive", {
    variety: "Training spinel",
    shape: "Round",
    carats: "1.500",
    location: "Training vault",
    cost: "50",
    price: "80",
    ownershipConfirmed: true,
  });
  second = await release(second);
  memo = await command("sales", "memo", {
    customerId: customer.id,
    stones: [
      { id: stone.id, version: stone.version },
      { id: second.id, version: second.version },
    ],
    due: new Date(Date.now() + 86400000).toISOString(),
    terms: "Training return terms",
  });
  stone = await current(stone.id);
  assert.equal(stone.internal, false);
  invoice = await command("sales", "memo-sale", {
    customerId: customer.id,
    memoId: memo.id,
    lines: [{ stoneId: stone.id, version: stone.version, price: "200.00" }],
  });
  second = await current(second.id);
  await command("clerk", "return-memo", {
    id: second.id,
    version: second.version,
    memoId: memo.id,
    condition: "Training inspection passed",
    location: "Returns desk",
  });
  assert.equal((await current(second.id)).state, "Returned");
  const m = (await workspace()).memos.find((m) => m.id === memo.id);
  assert.deepEqual(
    m.lines.map((l) => l.status),
    ["Sold", "Returned"],
  );
  assert.equal(
    invoice.lines[0].disclosure,
    "Training stone. No laboratory finding is asserted.",
  );
});
test("decimal partial payment allocation rejects overpayment and reconciles exactly", async () => {
  await command("accounts", "payment", {
    customerId: customer.id,
    allocations: [{ invoiceId: invoice.id, amount: "33.33" }],
    reference: "Training receipt 1",
  });
  assert.equal((await workspace("accounts")).invoices[0].balance, "166.67");
  await command(
    "accounts",
    "payment",
    {
      customerId: customer.id,
      allocations: [{ invoiceId: invoice.id, amount: "166.68" }],
      reference: "Overpayment",
    },
    400,
  );
  await command("accounts", "payment", {
    customerId: customer.id,
    allocations: [{ invoiceId: invoice.id, amount: "166.67" }],
    reference: "Training receipt 2",
  });
  assert.equal((await workspace("accounts")).invoices[0].balance, "0.00");
  const r = await command("accounts", "reconcile", { actual: "200.00" });
  assert.equal(r.difference, "0.00");
});
test("processing conserves weight and cost; splitting preserves rounding remainder", async () => {
  let rough = await command("owner", "receive", {
    variety: "Training rough",
    shape: "Parcel",
    carats: "5.000",
    location: "Training vault",
    cost: "100.01",
    price: "0",
    ownershipConfirmed: true,
  });
  const job = await command("liaison", "process-issue", {
    id: rough.id,
    version: rough.version,
    type: "Cutting",
    custodian: "Training cutter",
    instructions: "Training only",
  });
  rough = await current(rough.id);
  await command(
    "liaison",
    "process-return",
    {
      jobId: job.id,
      version: rough.version,
      postWeight: "4",
      loss: "0.5",
      charges: "20",
      location: "Returns",
    },
    400,
  );
  await command("liaison", "process-return", {
    jobId: job.id,
    version: rough.version,
    postWeight: "4",
    loss: "1",
    charges: "20",
    location: "Returns",
  });
  rough = await current(rough.id);
  assert.equal(rough.cost, "120.01");
  const children = await command("owner", "split", {
    id: rough.id,
    version: rough.version,
    loss: "0",
    children: [{ carats: "1" }, { carats: "1" }, { carats: "2" }],
  });
  assert.deepEqual(
    children.map((c) => c.cost),
    ["30.00", "30.00", "60.01"],
  );
  assert.equal((await current(rough.id)).state, "Blocked");
});
test("sale return requires Accounts credit and preserves original invoice", async () => {
  stone = await current(stone.id);
  const request = await command("clerk", "sale-return", {
    id: stone.id,
    version: stone.version,
    invoiceId: invoice.id,
    condition: "Training inspection",
    location: "Returns",
  });
  assert.equal((await current(stone.id)).state, "Returned");
  await command("clerk", "credit", { id: request.id }, 403);
  await command("accounts", "credit", { id: request.id });
  assert.equal((await workspace("accounts")).invoices[0].total, "200.00");
  assert.equal((await workspace("accounts")).credits[0].amount, "200.00");
});
test("uploads preserve bytes, invalidate approval, and require authorized download", async () => {
  const { PDFDocument } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  pdf.addPage();
  const bytes = await pdf.save();
  const form = new FormData();
  form.append("stoneId", stone.id);
  form.append(
    "file",
    new Blob([bytes], { type: "application/pdf" }),
    "training-report.pdf",
  );
  const file = await call("clerk", "/api/files", form);
  const download = await fetch(base + "/api/files/" + file.id, {
    headers: { Cookie: sessions.clerk.cookie },
  });
  assert.deepEqual(new Uint8Array(await download.arrayBuffer()), bytes);
  await call("sales", "/api/files/" + file.id, undefined, 403);
  assert.equal((await current(stone.id)).evidence, "Review needed");
});
test("CSRF and export permissions are enforced on the server", async () => {
  const res = await fetch(base + "/api/commands/customer", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: sessions.sales.cookie,
    },
    body: JSON.stringify({ name: "Forbidden" }),
  });
  assert.equal(res.status, 403);
  await call("sales", "/api/export/stones", undefined, 403);
  await call("clerk", "/api/backup", undefined, 403);
});
test("discount approvals are scoped to the quoted stone, price, customer and currency", async () => {
  let item = await command("owner", "receive", {
    variety: "Training quote stone",
    shape: "Oval",
    carats: "1",
    location: "Vault",
    cost: "40",
    price: "100",
    ownershipConfirmed: true,
  });
  item = await release(item);
  const quote = await command("sales", "quote", {
    customerId: customer.id,
    lines: [{ stoneId: item.id, price: "80" }],
  });
  assert.equal(quote.status, "Awaiting owner");
  await command("sales", "convert-quote", { id: quote.id }, 400);
  await command("owner", "approve-quote", { id: quote.id });
  const inv = await command("sales", "convert-quote", { id: quote.id });
  assert.equal(inv.total, "80.00");
  await command("sales", "convert-quote", { id: quote.id }, 400);
});
test("foreign-currency invoices and receipts preserve decimal rate snapshots", async () => {
  let item = await command("owner", "receive", {
    variety: "Training currency stone",
    shape: "Oval",
    carats: "1",
    location: "Vault",
    cost: "10",
    price: "100",
    ownershipConfirmed: true,
  });
  item = await release(item);
  const inv = await command("owner", "sale", {
    customerId: customer.id,
    currency: "EUR",
    exchangeRate: "1.25",
    lines: [{ stoneId: item.id, version: item.version, price: "80" }],
  });
  assert.equal(inv.total, "80.00");
  assert.equal(inv.baseTotal, "100.00");
  assert.equal(inv.currency, "EUR");
  const payment = await command("accounts", "payment", {
    customerId: customer.id,
    exchangeRate: "1.30",
    reference: "Training euro receipt",
    allocations: [{ invoiceId: inv.id, amount: "80" }],
  });
  assert.equal(payment.baseAmount, "104.00");
  assert.equal(payment.currency, "EUR");
  assert.equal(
    (await workspace()).invoices.find((i) => i.id === inv.id).balance,
    "0.00",
  );
});
test("issued credits can be refunded once without losing the original sale", async () => {
  await command("accounts", "refund", {
    invoiceId: invoice.id,
    amount: "200.00",
    reference: "Training refund",
  });
  assert.equal(
    (await workspace()).invoices.find((i) => i.id === invoice.id).balance,
    "0.00",
  );
  await command(
    "accounts",
    "refund",
    { invoiceId: invoice.id, amount: "0.01", reference: "Duplicate refund" },
    400,
  );
});
test("signed show events block other channels and replay idempotently", async () => {
  const { createHmac } = await import("node:crypto");
  let item = await command("owner", "receive", {
    variety: "Training show stone",
    shape: "Oval",
    carats: "1",
    location: "Vault",
    cost: "10",
    price: "100",
    ownershipConfirmed: true,
  });
  item = await release(item);
  const show = await call("owner", "/api/shows", {
    name: "Training show",
    deviceId: "test-device",
    stoneIds: [item.id],
  });
  item = await current(item.id);
  await command(
    "owner",
    "sale",
    {
      customerId: customer.id,
      lines: [{ stoneId: item.id, version: item.version, price: "100" }],
    },
    409,
  );
  const authority = await call("sales", `/api/shows/${show.id}/authority`, {
    deviceId: "test-device",
  });
  const payload = {
    id: "test-signed-event",
    showId: show.id,
    deviceId: "test-device",
    at: new Date().toISOString(),
    customerId: customer.id,
    lines: [{ stoneId: item.id, version: item.version, price: "100" }],
  };
  const signature = createHmac("sha256", Buffer.from(authority.key, "hex"))
    .update(JSON.stringify(payload))
    .digest("hex");
  const result = await call("sales", `/api/shows/${show.id}/replay`, {
    events: [{ payload, signature }],
  });
  assert.equal(result.results[0].status, "Reconciled");
  const replay = await call("sales", `/api/shows/${show.id}/replay`, {
    events: [{ payload, signature }],
  });
  assert.equal(replay.results[0].invoiceId, result.results[0].invoiceId);
  const invalid = await call("sales", `/api/shows/${show.id}/replay`, {
    events: [{ payload: { ...payload, id: "tampered" }, signature }],
  });
  assert.equal(invalid.results[0].status, "Blocked");
  await call("owner", `/api/shows/${show.id}/release`, {
    confirmedReconciled: true,
  });
});
test("CSV import requires an error-free preview, exact source totals and unique references", async () => {
  const form = new FormData();
  form.append(
    "file",
    new Blob(
      [
        "reference,variety,carats,location,cost,price\nTRAINING-IMPORT,Training import,1.250,Training vault,20.01,40.00\n",
      ],
      { type: "text/csv" },
    ),
    "training.csv",
  );
  const preview = await call("owner", "/api/import/preview", form);
  assert.equal(preview.totalCarats, "1.250");
  await call(
    "owner",
    "/api/import/commit",
    { id: preview.id, totalCarats: "1.25", totalCost: "20.01" },
    400,
  );
  await call("owner", "/api/import/commit", {
    id: preview.id,
    totalCarats: "1.250",
    totalCost: "20.01",
  });
  const duplicate = new FormData();
  duplicate.append(
    "file",
    new Blob([
      "reference,variety,carats,location,cost,price\nTRAINING-IMPORT,Training import,1.250,Training vault,20.01,40.00\n",
    ]),
    "training.csv",
  );
  const p = await call("owner", "/api/import/preview", duplicate);
  assert.ok(p.rows[0].errors.includes("Duplicate reference"));
});
test("purchase receipt applies agreed cost without granting clerk pricing rights", async () => {
  const supplier = await command("owner", "supplier", {
    name: "Training supplier",
  });
  const po = await command("owner", "purchase-order", {
    supplierId: supplier.id,
    terms: "Training purchase",
    lines: [
      {
        variety: "Training purchase parcel",
        shape: "Parcel",
        count: 3,
        carats: "3.000",
        cost: "60.03",
      },
    ],
  });
  const receipt = await command("clerk", "receive-purchase", {
    id: po.id,
    location: "Purchase intake",
  });
  assert.equal((await current(receipt.stoneIds[0])).cost, "60.03");
  const clerk = await workspace("clerk");
  assert.equal(clerk.purchaseOrders[0].total, undefined);
  assert.equal(clerk.purchaseOrders[0].lines[0].cost, undefined);
  await command("accounts", "supplier-payment", {
    orderId: po.id,
    amount: "60.03",
    reference: "Training supplier transfer",
  });
  await command(
    "accounts",
    "supplier-payment",
    { orderId: po.id, amount: "0.01", reference: "Duplicate supplier payment" },
    400,
  );
});
test("supplier memo obligations follow sales and block re-entry after supplier return", async () => {
  const supplier = await command("owner", "supplier", {
    name: "Training consignment supplier",
  });
  const incoming = await command("owner", "incoming-memo", {
    supplierId: supplier.id,
    terms: "Authorised training sale",
    authorityConfirmed: true,
    due: new Date(Date.now() + 86400000).toISOString(),
    lines: [
      {
        variety: "Training supplier stone",
        shape: "Oval",
        carats: "1.000",
        cost: "30",
        price: "60",
        location: "Supplier intake",
      },
    ],
  });
  let item = await current(incoming.lines[0].stoneId);
  item = await release(item);
  await command(
    "accounts",
    "supplier-payment",
    { memoId: incoming.id, amount: "30", reference: "Not sold yet" },
    400,
  );
  await command("owner", "sale", {
    customerId: customer.id,
    lines: [{ stoneId: item.id, version: item.version, price: "60" }],
  });
  await command("accounts", "supplier-payment", {
    memoId: incoming.id,
    amount: "30",
    reference: "Training sold-line settlement",
  });
  const another = await command("owner", "incoming-memo", {
    supplierId: supplier.id,
    terms: "Training return terms",
    authorityConfirmed: true,
    due: new Date(Date.now() + 86400000).toISOString(),
    lines: [
      {
        variety: "Training supplier return",
        shape: "Oval",
        carats: "1.000",
        cost: "30",
        price: "60",
        location: "Supplier intake",
      },
    ],
  });
  let returned = await current(another.lines[0].stoneId);
  await command("clerk", "return-supplier", {
    memoId: another.id,
    id: returned.id,
    version: returned.version,
    condition: "Training handback inspected",
  });
  returned = await current(returned.id);
  await command(
    "owner",
    "stock-in",
    { id: returned.id, version: returned.version },
    400,
  );
});
test("backup includes original documents and can restore into an isolated workspace", async () => {
  const { writeFileSync } = await import("node:fs");
  const { spawnSync } = await import("node:child_process");
  const { DatabaseSync } = await import("node:sqlite");
  const response = await fetch(base + "/api/backup", {
    headers: { Cookie: sessions.owner.cookie },
  });
  assert.equal(response.status, 200);
  const file = path.join(directory, "backup.sqlite");
  writeFileSync(file, Buffer.from(await response.arrayBuffer()));
  const target = path.join(directory, "restored");
  const result = spawnSync(
    process.execPath,
    ["server/restore.mjs", file, "--confirm-replace"],
    { env: { ...process.env, DATA_DIR: target }, encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  const restored = new DatabaseSync(path.join(target, "gem.sqlite"), {
    readOnly: true,
  });
  assert.ok(restored.prepare("SELECT count(*) n FROM files").get().n > 0);
  assert.equal(restored.prepare("SELECT count(*) n FROM sessions").get().n, 0);
  assert.ok(restored.prepare("SELECT count(*) n FROM records").get().n > 0);
  restored.close();
});
test("a valid but stale show event needs owner review before stock release", async () => {
  const { createHmac } = await import("node:crypto");
  let item = await command("owner", "receive", {
    variety: "Training show conflict",
    shape: "Oval",
    carats: "1",
    location: "Vault",
    cost: "10",
    price: "100",
    ownershipConfirmed: true,
  });
  item = await release(item);
  const show = await call("owner", "/api/shows", {
    name: "Training conflict show",
    deviceId: "conflict-device",
    stoneIds: [item.id],
  });
  const authority = await call("sales", `/api/shows/${show.id}/authority`, {
    deviceId: "conflict-device",
  });
  item = await current(item.id);
  const version = item.version;
  await command("owner", "edit-stone", {
    id: item.id,
    version: item.version,
    location: "Updated location",
  });
  const payload = {
    id: "stale-show-event",
    showId: show.id,
    deviceId: "conflict-device",
    at: new Date().toISOString(),
    customerId: customer.id,
    lines: [{ stoneId: item.id, version, price: "100" }],
  };
  const signature = createHmac("sha256", Buffer.from(authority.key, "hex"))
    .update(JSON.stringify(payload))
    .digest("hex");
  const response = await call("sales", `/api/shows/${show.id}/replay`, {
    events: [{ payload, signature }],
  });
  assert.equal(response.results[0].status, "Blocked");
  await call(
    "owner",
    `/api/shows/${show.id}/release`,
    { confirmedReconciled: true },
    400,
  );
  await call(
    "sales",
    `/api/shows/${show.id}/conflicts/${payload.id}/reject`,
    { reason: "Forbidden" },
    403,
  );
  await call("owner", `/api/shows/${show.id}/conflicts/${payload.id}/reject`, {
    reason: "Training event checked; no sale should be posted.",
  });
  const replay = await call("sales", `/api/shows/${show.id}/replay`, {
    events: [{ payload, signature }],
  });
  assert.equal(replay.results[0].status, "Cancelled");
  await call("owner", `/api/shows/${show.id}/release`, {
    confirmedReconciled: true,
  });
});

test("a retry of an unconfirmed command returns the original receipt without a duplicate", async () => {
  const owner = sessions.owner;
  const key = "c0994538-ae87-4f28-ace5-0a6489b9d2ff";
  const send = (name) => fetch(base + "/api/commands/customer", {
    method: "POST",
    headers: { Cookie: owner.cookie, "X-CSRF-Token": owner.csrf, "Content-Type": "application/json", "Idempotency-Key": key },
    body: JSON.stringify({ name }),
  });
  const [first, retry] = await Promise.all([send("Receipt fixture"), send("Receipt fixture")]);
  assert.equal(first.status, 200);
  assert.equal(retry.status, 200);
  assert.deepEqual(await first.json(), await retry.json());
  assert.equal((await send("Different fixture")).status, 409);
  assert.equal((await workspace()).customers.filter((entry) => entry.name === "Receipt fixture").length, 1);
});

test("buyer retries deduplicate identical decisions while allowing explicit changes", async () => {
  const stock = await release(await command("owner", "receive", {
    variety: "Buyer retry fixture", shape: "Oval", carats: "1.000",
    location: "Fixture vault", ownershipConfirmed: true,
  }));
  const selection = await command("owner", "selection", {
    customerId: customer.id, title: "Buyer retry fixture", stoneIds: [stock.id],
  });
  const url = "/api/buyer/" + selection.token;
  const same = { decision: "Interested", note: "Fixture response" };
  await call(null, url, same);
  await call(null, url, same);
  await call(null, url, { decision: "Decline", note: "Changed decision" });
  const result = await call(null, url);
  assert.deepEqual(result.decisions.map((entry) => entry.decision), ["Interested", "Decline"]);
});
