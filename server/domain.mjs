import Decimal from "decimal.js";
import { purchasing, markSupplierSale } from "./purchasing.mjs";
import { randomUUID } from "node:crypto";
import {
  all,
  get,
  put,
  uid,
  now,
  audit,
  transaction,
  settings,
} from "./db.mjs";
Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
export const roles = [
  "Owner",
  "Sales staff",
  "Inventory clerk",
  "Accounts",
  "Cutter / lab liaison",
  "Gem reviewer",
];
export function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status });
}
export function text(v, label, max = 500) {
  if (typeof v !== "string" || !v.trim() || v.trim().length > max)
    fail(`${label} is required (up to ${max} characters).`);
  return v.trim();
}
export function amount(v, label = "Amount", places = 2, zero = true) {
  if (typeof v !== "string" || !/^\d{1,12}(\.\d+)?$/.test(v))
    fail(`${label} must be a positive decimal number.`);
  const n = new Decimal(v);
  if (n.decimalPlaces() > places || (zero ? n.lt(0) : n.lte(0)))
    fail(
      `${label} requires ${places} decimal places at most${zero ? "" : " and must be greater than zero"}.`,
    );
  return n.toFixed(places);
}
export function money(v) {
  return new Decimal(v).toFixed(settings()?.minorUnits ?? 2);
}
export function sum(values) {
  return values.reduce((a, b) => a.plus(b || "0"), new Decimal(0));
}
export function allow(user, allowed) {
  if (user.role !== "Owner" && !allowed.includes(user.role))
    fail("Your role cannot perform this action.", 403);
}
export function record(kind, id) {
  const r = get(kind, id);
  if (!r) fail("Record not found.", 404);
  return r;
}
export function freshStone(id, version) {
  const s = record("stones", id);
  if (!Number.isInteger(version) || s.version !== version)
    fail("This stone changed. Refresh the record and try again.", 409);
  return s;
}
export function change(user, before, patch, action) {
  const after = {
    ...before,
    ...patch,
    version: before.version + 1,
    updatedAt: now(),
  };
  put("stones", after);
  audit(user, action, before.id, before, after);
  return after;
}
export function approved(s) {
  if (s.evidence !== "Approved" || !s.disclosure)
    fail("A reviewer must approve disclosure wording first.");
}
export function available(s, user, device = "") {
  approved(s);
  if (!s.ownershipConfirmed) fail("Ownership authority must be confirmed.");
  if (!s.internal) fail("The stone must be in internal custody.");
  if (s.showId && s.deviceId !== device)
    fail("This stone is assigned to a show device.", 409);
  if (s.state === "Held" && s.holdBy === user.id) return;
  if (s.state !== "In stock")
    fail(`Stone is ${s.state}; it is not available.`, 409);
}
export function expireHolds(user) {
  for (const s of all("stones"))
    if (s.state === "Held" && Date.parse(s.holdUntil) <= Date.now())
      change(
        user,
        s,
        { state: "In stock", holdBy: null, holdUntil: null },
        "Hold expired",
      );
}
export function createStone(user, b) {
  allow(user, ["Inventory clerk"]);
  const cost =
    user.role === "Owner"
      ? amount(b.cost || "0", "Cost", settings().minorUnits)
      : "0.00";
  const s = {
    id: uid("GEM"),
    variety: text(b.variety, "Variety", 100),
    shape: text(b.shape || "Unspecified", "Shape", 80),
    carats: amount(b.carats, "Carat weight", 3, false),
    count: Number(b.count || 1),
    location: text(b.location, "Location", 150),
    custodian: text(b.custodian || "Internal intake", "Custodian", 150),
    internal: true,
    state: "Draft",
    evidence: "Review needed",
    disclosure: "",
    claimsVersion: 0,
    approvedVersion: null,
    version: 1,
    ownershipConfirmed: b.ownershipConfirmed === true,
    ownershipShares: Array.isArray(b.ownershipShares) ? b.ownershipShares : [],
    supplier:
      user.role === "Owner" ? String(b.supplier || "").slice(0, 150) : "",
    cost,
    price:
      user.role === "Owner"
        ? amount(b.price || "0", "Price", settings().minorUnits)
        : money("0"),
    origin: String(b.origin || "").slice(0, 100),
    treatment: String(b.treatment || "").slice(0, 100),
    color: String(b.color || "").slice(0, 100),
    dimensions: String(b.dimensions || "").slice(0, 100),
    createdAt: now(),
    updatedAt: now(),
  };
  if (!Number.isInteger(s.count) || s.count < 1 || s.count > 100000)
    fail("Count must be a positive whole number.");
  if (s.ownershipShares.length) {
    const shares = s.ownershipShares.map((x) => ({
      ...x,
      owner: text(x.owner, "Share owner", 100),
      percent: amount(x.percent, "Ownership share", 3, false),
    }));
    if (!sum(shares.map((x) => x.percent)).eq(100))
      fail("Ownership shares must total 100%.");
    s.ownershipShares = shares;
  }
  put("stones", s);
  audit(user, "Stone received", s.id, null, s);
  return s;
}
export function currencyInfo(code, rate = "1") {
  const currency = String(code || settings().currency).toUpperCase();
  if (!Intl.supportedValuesOf("currency").includes(currency))
    fail("Choose a supported three-letter currency code.");
  const places = new Intl.NumberFormat("en", {
    style: "currency",
    currency,
  }).resolvedOptions().maximumFractionDigits;
  const exchangeRate = amount(rate, "Exchange rate", 6, false);
  if (currency === settings().currency && !new Decimal(exchangeRate).eq(1))
    fail("Base-currency transactions require an exchange rate of 1.");
  return { currency, places, exchangeRate };
}
export function createInvoice(user, b, fromMemo = false, device = "") {
  allow(user, ["Sales staff"]);
  const customer = record("customers", b.customerId);
  const fx = currencyInfo(b.currency, b.exchangeRate || "1");
  const quote = b.quoteId ? record("quotes", b.quoteId) : null;
  if (
    quote &&
    (quote.customerId !== customer.id ||
      Date.parse(quote.expires) < Date.now() ||
      quote.status === "Converted" ||
      quote.status === "Awaiting owner")
  )
    fail("Quote is expired, already converted or awaiting approval.");
  if (quote && quote.currency !== fx.currency)
    fail("Quote currency must match the invoice.");
  if (fromMemo && record("memos", b.memoId).customerId !== customer.id)
    fail("The sale customer must match the memo.");
  if (!Array.isArray(b.lines) || !b.lines.length || b.lines.length > 100)
    fail("Choose at least one stone.");
  if (new Set(b.lines.map((l) => l.stoneId)).size !== b.lines.length)
    fail("Duplicate invoice lines are not allowed.");
  const lines = b.lines.map((l) => {
    const s = freshStone(l.stoneId, l.version);
    if (fromMemo) {
      if (s.state !== "On memo" || s.memoId !== b.memoId)
        fail("Stone is not on this memo.", 409);
      approved(s);
    } else {
      available(s, user, device);
      if (s.state === "Held" && s.holdCustomerId !== customer.id)
        fail("The hold belongs to another customer.");
    }
    const price = amount(l.price, "Sale price", fx.places, false);
    const basePrice = money(new Decimal(price).times(fx.exchangeRate));
    const discount = new Decimal(s.price || 0).minus(basePrice);
    const pct = new Decimal(s.price || 0).gt(0)
      ? discount.div(s.price).times(100)
      : new Decimal(0);
    const authorizedQuote =
      quote &&
      quote.status === "Approved" &&
      quote.lines.some((q) => q.stoneId === s.id && q.price === price);
    if (
      quote &&
      !quote.lines.some((q) => q.stoneId === s.id && q.price === price)
    )
      fail("Sale lines must match the quote.");
    if (
      user.role === "Sales staff" &&
      pct.gt(settings().salesDiscountLimit || 0) &&
      !authorizedQuote
    )
      fail(
        "Discount exceeds your limit. Ask the owner to complete this sale.",
        403,
      );
    return {
      stoneId: s.id,
      variety: s.variety,
      carats: s.carats,
      price,
      basePrice,
      disclosure: s.disclosure,
      disclosureVersion: s.approvedVersion,
      returned: false,
    };
  });
  const total = sum(lines.map((l) => l.price)).toFixed(fx.places);
  const inv = {
    id: uid("INV"),
    customerId: customer.id,
    customerName: customer.name,
    lines,
    total,
    currency: fx.currency,
    minorUnits: fx.places,
    exchangeRate: fx.exchangeRate,
    baseTotal: money(new Decimal(total).times(fx.exchangeRate)),
    createdAt: now(),
    memoId: b.memoId || null,
  };
  put("invoices", inv);
  for (const l of lines) {
    const s = record("stones", l.stoneId);
    markSupplierSale(s, inv.id);
    change(
      user,
      s,
      {
        state: "Sold",
        internal: false,
        custodian: customer.name,
        location: inv.id,
        invoiceId: inv.id,
        holdBy: null,
        holdUntil: null,
      },
      "Stone sold",
    );
  }
  if (fromMemo) {
    const m = record("memos", b.memoId);
    m.lines = m.lines.map((l) =>
      lines.some((x) => x.stoneId === l.stoneId)
        ? { ...l, status: "Sold", invoiceId: inv.id }
        : l,
    );
    put("memos", m);
  }
  if (quote)
    put("quotes", { ...quote, status: "Converted", invoiceId: inv.id });
  audit(user, "Invoice issued", inv.id, null, inv);
  return inv;
}
export function balance(inv) {
  const credits = sum(
    all("credits")
      .filter((p) => p.invoiceId === inv.id)
      .map((p) => p.amount),
  );
  const paid = sum(
    all("payments")
      .flatMap((p) => p.allocations || [])
      .filter((a) => a.invoiceId === inv.id)
      .map((a) => a.amount),
  );
  return new Decimal(inv.total)
    .minus(credits)
    .minus(paid)
    .plus(
      sum(
        all("refunds")
          .filter((r) => r.invoiceId === inv.id)
          .map((r) => r.amount),
      ),
    )
    .toFixed(inv.minorUnits ?? settings().minorUnits);
}
export function command(user, action, b) {
  return transaction(() => {
    expireHolds(user);
    const purchaseResult = purchasing(user, action, b);
    if (purchaseResult) return purchaseResult;
    switch (action) {
      case "receive":
        return createStone(user, b);
      case "edit-stone": {
        allow(user, ["Inventory clerk"]);
        const s = freshStone(b.id, b.version);
        if (["Sold", "On memo", "With lab or cutter"].includes(s.state))
          fail("Receive the stone back before editing.");
        const patch = {
          location: text(b.location || s.location, "Location", 150),
        };
        if (user.role === "Owner") {
          for (const k of ["cost", "price"])
            if (b[k] !== undefined)
              patch[k] = amount(b[k], k, settings().minorUnits);
          if (b.supplier !== undefined)
            patch.supplier = String(b.supplier).slice(0, 150);
          if (b.ownershipConfirmed !== undefined)
            patch.ownershipConfirmed = b.ownershipConfirmed === true;
        }
        return change(user, s, patch, "Stone details updated");
      }
      case "stock-in": {
        allow(user, ["Inventory clerk"]);
        const s = freshStone(b.id, b.version);
        if (!s.internal)
          fail(
            "Receive the stone into internal custody before releasing stock.",
          );
        if (!["Draft", "Returned"].includes(s.state))
          fail("Only drafts and inspected returns can enter stock.");
        approved(s);
        if (!s.ownershipConfirmed)
          fail("Owner must confirm ownership authority.");
        return change(
          user,
          s,
          { state: "In stock", internal: true },
          "Stock released",
        );
      }
      case "block": {
        allow(user, ["Gem reviewer"]);
        const s = freshStone(b.id, b.version);
        if (["Sold", "On memo", "With lab or cutter"].includes(s.state))
          fail("Stone must be returned before blocking.");
        return change(
          user,
          s,
          {
            state: "Blocked",
            blockReason: text(b.reason, "Reason"),
            holdBy: null,
            holdUntil: null,
          },
          "Stock blocked",
        );
      }
      case "unblock": {
        allow(user, ["Gem reviewer"]);
        const s = freshStone(b.id, b.version);
        if (s.state !== "Blocked") fail("Stone is not blocked.");
        if (s.children?.length)
          fail("A split parent cannot re-enter stock. Use its child records.");
        return change(
          user,
          s,
          { state: "Draft", blockReason: null },
          "Stock unblocked for review",
        );
      }
      case "claim": {
        allow(user, ["Inventory clerk", "Gem reviewer"]);
        if (b.source === "AI" && b.aiConfirmed !== true)
          fail(
            "Confirm every critical field against the original before saving an AI draft.",
          );
        const s = freshStone(b.stoneId, b.version);
        const c = {
          id: uid("CLM"),
          stoneId: s.id,
          source: b.source === "AI" ? "AI draft confirmed by human" : "Manual",
          type: ["Supplier claim", "Lab opinion", "Custody record"].includes(
            b.type,
          )
            ? b.type
            : "Supplier claim",
          statement: text(b.statement, "Claim", 6000),
          reportNumber: String(b.reportNumber || "").slice(0, 100),
          fileId: b.fileId || null,
          version: s.claimsVersion + 1,
          createdAt: now(),
          actor: user.name,
        };
        if (c.fileId) {
          const f = record("fileMeta", c.fileId);
          if (f.stoneId !== s.id)
            fail("Document belongs to a different stone.");
        }
        put("claims", c);
        change(
          user,
          s,
          {
            claimsVersion: c.version,
            evidence: b.conflict ? "Conflict" : "Review needed",
            approvedVersion: null,
            disclosure: "",
          },
          "Evidence version added",
        );
        audit(user, "Claim preserved", c.id, null, c);
        return c;
      }
      case "approve": {
        allow(user, ["Gem reviewer"]);
        const s = freshStone(b.id, b.version);
        if (!all("claims").some((c) => c.stoneId === s.id))
          fail("Add supporting evidence before approval.");
        if (s.evidence === "Conflict" && !b.resolution)
          fail("Explain how the conflict was reviewed.");
        const buyerFileIds = Array.isArray(b.buyerFileIds)
          ? b.buyerFileIds
          : [];
        for (const id of buyerFileIds) {
          const f = record("fileMeta", id);
          if (f.stoneId !== s.id)
            fail("Shared evidence must belong to this stone.");
        }
        const review = {
          id: uid("REV"),
          stoneId: s.id,
          claimVersion: s.claimsVersion,
          wording: text(b.disclosure, "Disclosure wording", 3000),
          resolution: String(b.resolution || ""),
          actor: user.name,
          createdAt: now(),
        };
        put("reviews", review);
        return change(
          user,
          s,
          {
            evidence: "Approved",
            disclosure: review.wording,
            buyerFileIds,
            approvedVersion: review.id,
          },
          "Disclosure approved",
        );
      }
      case "quote": {
        allow(user, ["Sales staff"]);
        const customer = record("customers", b.customerId);
        if (
          !Array.isArray(b.lines) ||
          !b.lines.length ||
          new Set(b.lines.map((l) => l.stoneId)).size !== b.lines.length
        )
          fail("Choose distinct quote lines.");
        let needsApproval = false;
        const lines = b.lines.map((l) => {
          const s = record("stones", l.stoneId);
          available(s, user);
          const price = amount(
            l.price,
            "Quote price",
            settings().minorUnits,
            false,
          );
          if (
            user.role !== "Owner" &&
            new Decimal(s.price).gt(0) &&
            new Decimal(s.price)
              .minus(price)
              .div(s.price)
              .times(100)
              .gt(settings().salesDiscountLimit)
          )
            needsApproval = true;
          return {
            stoneId: s.id,
            variety: s.variety,
            carats: s.carats,
            price,
            disclosure: s.disclosure,
            disclosureVersion: s.approvedVersion,
          };
        });
        const days = Number(b.days || 7);
        if (!Number.isInteger(days) || days < 1 || days > 30)
          fail("Quote validity must be 1 to 30 days.");
        const quote = {
          id: uid("QUO"),
          customerId: customer.id,
          customerName: customer.name,
          lines,
          total: money(sum(lines.map((l) => l.price))),
          currency: settings().currency,
          status: needsApproval ? "Awaiting owner" : "Ready",
          expires: new Date(Date.now() + days * 86400000).toISOString(),
          createdAt: now(),
        };
        put("quotes", quote);
        audit(user, "Quote created", quote.id, null, quote);
        return quote;
      }
      case "approve-quote": {
        allow(user, []);
        const q = record("quotes", b.id);
        if (q.status !== "Awaiting owner")
          fail("Quote is not awaiting approval.");
        const after = {
          ...q,
          status: "Approved",
          approvedBy: user.name,
          approvedAt: now(),
        };
        put("quotes", after);
        audit(user, "Discount approved", q.id, q, after);
        return after;
      }
      case "convert-quote": {
        allow(user, ["Sales staff"]);
        const q = record("quotes", b.id);
        return createInvoice(user, {
          customerId: q.customerId,
          quoteId: q.id,
          lines: q.lines.map((l) => ({
            ...l,
            version: record("stones", l.stoneId).version,
          })),
        });
      }
      case "customer": {
        allow(user, ["Sales staff", "Accounts"]);
        const c = {
          id: uid("CUS"),
          name: text(b.name, "Customer name", 150),
          email: String(b.email || "").slice(0, 200),
          phone: String(b.phone || "").slice(0, 80),
          notes: String(b.notes || "").slice(0, 2000),
          createdAt: now(),
        };
        put("customers", c);
        audit(user, "Customer created", c.id, null, c);
        return c;
      }
      case "hold": {
        allow(user, ["Sales staff"]);
        const s = freshStone(b.id, b.version);
        available(s, user);
        const hours = Number(b.hours || 24);
        if (!Number.isFinite(hours) || hours < 0.1 || hours > 168)
          fail("Hold must last between 0.1 and 168 hours.");
        record("customers", b.customerId);
        return change(
          user,
          s,
          {
            state: "Held",
            holdBy: user.id,
            holdCustomerId: b.customerId,
            holdUntil: new Date(Date.now() + hours * 3600000).toISOString(),
          },
          "Hold placed",
        );
      }
      case "release-hold": {
        allow(user, ["Sales staff"]);
        const s = freshStone(b.id, b.version);
        if (s.state !== "Held") fail("Stone is not held.");
        if (user.role !== "Owner" && s.holdBy !== user.id)
          fail("Only the holder or owner can release this hold.", 403);
        return change(
          user,
          s,
          {
            state: "In stock",
            holdBy: null,
            holdCustomerId: null,
            holdUntil: null,
          },
          "Hold released",
        );
      }
      case "memo": {
        allow(user, ["Sales staff"]);
        const c = record("customers", b.customerId);
        if (
          !Array.isArray(b.stones) ||
          !b.stones.length ||
          new Set(b.stones.map((x) => x.id)).size !== b.stones.length
        )
          fail("Choose distinct stones.");
        const due = new Date(b.due);
        if (!Number.isFinite(due.getTime()) || due <= new Date())
          fail("Choose a future due date.");
        const terms = text(b.terms, "Memo terms", 3000);
        const stones = b.stones.map((x) => {
          const s = freshStone(x.id, x.version);
          available(s, user);
          return s;
        });
        const m = {
          id: uid("MEM"),
          customerId: c.id,
          customerName: c.name,
          due: due.toISOString(),
          terms,
          commissionRate: amount(b.commissionRate || "0", "Commission rate", 3),
          lines: stones.map((s) => ({
            stoneId: s.id,
            status: "Pending",
            price: s.price,
          })),
          createdAt: now(),
        };
        if (new Decimal(m.commissionRate).gt(100))
          fail("Commission cannot exceed 100%.");
        put("memos", m);
        for (const s of stones)
          change(
            user,
            s,
            {
              state: "On memo",
              internal: false,
              custodian: c.name,
              location: m.id,
              memoId: m.id,
              holdBy: null,
              holdUntil: null,
            },
            "Memo issued",
          );
        audit(user, "Memo issued", m.id, null, m);
        return m;
      }
      case "return-memo": {
        allow(user, ["Inventory clerk"]);
        const m = record("memos", b.memoId);
        const s = freshStone(b.id, b.version);
        if (s.state !== "On memo" || s.memoId !== m.id)
          fail("Stone is not pending on this memo.");
        const condition = text(b.condition, "Return condition", 1000);
        m.lines = m.lines.map((l) =>
          l.stoneId === s.id
            ? { ...l, status: "Returned", condition, returnedAt: now() }
            : l,
        );
        put("memos", m);
        return change(
          user,
          s,
          {
            state: "Returned",
            internal: true,
            custodian: text(b.custodian || "Internal intake", "Custodian", 150),
            location: text(b.location, "Return location", 150),
            returnCondition: condition,
            memoId: null,
          },
          "Memo return inspected",
        );
      }
      case "sale":
        return createInvoice(user, b);
      case "memo-sale":
        return createInvoice(user, b, true);
      case "sale-return": {
        allow(user, ["Inventory clerk"]);
        const inv = record("invoices", b.invoiceId);
        const s = freshStone(b.id, b.version);
        const line = inv.lines.find((l) => l.stoneId === s.id);
        if (
          !line ||
          line.returned ||
          s.state !== "Sold" ||
          s.invoiceId !== inv.id
        )
          fail("This sale line cannot be returned.");
        if (s.incomingMemoId) {
          const m = record("incomingMemos", s.incomingMemoId);
          const supplierLine = m.lines.find((l) => l.stoneId === s.id);
          if (supplierLine) {
            supplierLine.status = "Pending";
            supplierLine.invoiceId = null;
            put("incomingMemos", m);
          }
        }
        line.returned = true;
        line.condition = text(b.condition, "Condition", 1000);
        put("invoices", inv);
        change(
          user,
          s,
          {
            state: "Returned",
            internal: true,
            custodian: "Internal intake",
            location: text(b.location, "Return location", 150),
            returnCondition: line.condition,
          },
          "Sale return inspected",
        );
        const credit = {
          id: uid("CRD"),
          invoiceId: inv.id,
          stoneId: s.id,
          amount: line.price,
          currency: inv.currency,
          baseAmount: money(new Decimal(line.price).times(inv.exchangeRate)),
          status: "Awaiting accounts",
          createdAt: now(),
        };
        put("creditRequests", credit);
        return credit;
      }
      case "credit": {
        allow(user, ["Accounts"]);
        const request = record("creditRequests", b.id);
        if (request.status !== "Awaiting accounts")
          fail("Credit already issued.");
        put("creditRequests", { ...request, status: "Issued" });
        const credit = { ...request, status: "Issued", createdAt: now() };
        put("credits", credit);
        audit(user, "Credit issued", credit.id, null, credit);
        return credit;
      }
      case "payment": {
        allow(user, ["Accounts"]);
        const c = record("customers", b.customerId);
        if (!Array.isArray(b.allocations) || !b.allocations.length)
          fail("Allocate the payment to at least one invoice.");
        if (
          new Set(b.allocations.map((a) => a.invoiceId)).size !==
          b.allocations.length
        )
          fail("Duplicate allocations are not allowed.");
        const firstInvoice = record("invoices", b.allocations[0].invoiceId);
        const fx = currencyInfo(firstInvoice.currency, b.exchangeRate || "1");
        const allocations = b.allocations.map((a) => {
          const inv = record("invoices", a.invoiceId);
          if (inv.customerId !== c.id)
            fail("Invoices must belong to this customer.");
          if (inv.currency !== fx.currency)
            fail("Allocate one receipt to invoices in the same currency.");
          const n = amount(a.amount, "Allocation", fx.places, false);
          if (new Decimal(n).gt(balance(inv)))
            fail("Allocation exceeds the outstanding invoice balance.");
          return { invoiceId: inv.id, amount: n };
        });
        const p = {
          id: uid("PAY"),
          customerId: c.id,
          customerName: c.name,
          amount: sum(allocations.map((a) => a.amount)).toFixed(fx.places),
          baseAmount: money(
            sum(allocations.map((a) => a.amount)).times(fx.exchangeRate),
          ),
          allocations,
          reference: text(b.reference, "Payment reference", 200),
          method: text(b.method || "Bank transfer", "Method", 100),
          currency: fx.currency,
          exchangeRate: fx.exchangeRate,
          createdAt: now(),
        };
        put("payments", p);
        audit(user, "Payment allocated", p.id, null, p);
        return p;
      }
      case "process-issue": {
        allow(user, ["Cutter / lab liaison"]);
        const s = freshStone(b.id, b.version);
        if (!["Draft", "In stock"].includes(s.state) || !s.internal || s.showId)
          fail("Stone must be internally available and unassigned.");
        const p = {
          id: uid("JOB"),
          stoneId: s.id,
          type: b.type === "Cutting" ? "Cutting" : "Laboratory",
          custodian: text(b.custodian, "Lab or cutter", 150),
          instructions: text(b.instructions, "Instructions", 2000),
          preWeight: s.carats,
          status: "Issued",
          createdAt: now(),
        };
        put("jobs", p);
        change(
          user,
          s,
          {
            state: "With lab or cutter",
            internal: false,
            custodian: p.custodian,
            location: p.id,
          },
          "Processing issued",
        );
        return p;
      }
      case "process-return": {
        allow(user, ["Cutter / lab liaison"]);
        const p = record("jobs", b.jobId);
        const s = freshStone(p.stoneId, b.version);
        if (p.status !== "Issued" || s.state !== "With lab or cutter")
          fail("Job already returned.");
        const charges = amount(
          b.charges || "0",
          "Charges",
          settings().minorUnits,
        );
        const postWeight = amount(b.postWeight, "Return weight", 3, false);
        const loss = amount(b.loss || "0", "Weight loss", 3);
        if (!new Decimal(postWeight).plus(loss).eq(p.preWeight))
          fail("Return weight plus recorded loss must equal issue weight.");
        put("jobs", {
          ...p,
          charges,
          postWeight,
          loss,
          yield: new Decimal(postWeight).div(p.preWeight).times(100).toFixed(2),
          status: "Returned",
          returnedAt: now(),
        });
        return change(
          user,
          s,
          {
            state: "Returned",
            internal: true,
            carats: postWeight,
            cost: money(new Decimal(s.cost).plus(charges)),
            custodian: "Internal intake",
            location: text(b.location, "Return location", 150),
            evidence: "Review needed",
            approvedVersion: null,
            disclosure: "",
          },
          "Processing returned",
        );
      }
      case "split": {
        allow(user, ["Cutter / lab liaison"]);
        const s = freshStone(b.id, b.version);
        if (
          !["Draft", "Returned", "In stock"].includes(s.state) ||
          !s.internal ||
          s.showId
        )
          fail("Parent must be internally available.");
        if (
          !Array.isArray(b.children) ||
          b.children.length < 2 ||
          b.children.length > 100
        )
          fail("Provide between 2 and 100 child stones.");
        const weights = b.children.map((x) =>
          amount(x.carats, "Child weight", 3, false),
        );
        const loss = amount(b.loss || "0", "Recorded loss", 3);
        if (!sum(weights).plus(loss).eq(s.carats))
          fail("Children plus loss must equal parent weight.");
        const totalWeight = sum(weights);
        let allocated = new Decimal(0);
        const children = b.children.map((c, i) => {
          const cost =
            i === b.children.length - 1
              ? new Decimal(s.cost).minus(allocated)
              : new Decimal(s.cost)
                  .times(weights[i])
                  .div(totalWeight)
                  .toDecimalPlaces(settings().minorUnits);
          allocated = allocated.plus(cost);
          const child = {
            ...s,
            id: uid("GEM"),
            parentId: s.id,
            carats: weights[i],
            count: 1,
            cost: money(cost),
            price: "0.00",
            state: "Draft",
            evidence: "Review needed",
            claimsVersion: 0,
            approvedVersion: null,
            disclosure: "",
            version: 1,
            shape: String(c.shape || s.shape),
            createdAt: now(),
            updatedAt: now(),
          };
          put("stones", child);
          audit(user, "Child stone created", child.id, null, child);
          return child;
        });
        if (s.incomingMemoId) {
          const m = record("incomingMemos", s.incomingMemoId);
          const parent = m.lines.find((l) => l.stoneId === s.id);
          if (!parent || parent.status !== "Pending")
            fail("Supplier memo parent is not pending.");
          parent.status = "Split";
          let supplierAllocated = new Decimal(0);
          for (let i = 0; i < children.length; i++) {
            const n =
              i === children.length - 1
                ? new Decimal(parent.cost).minus(supplierAllocated)
                : new Decimal(parent.cost)
                    .times(weights[i])
                    .div(totalWeight)
                    .toDecimalPlaces(settings().minorUnits);
            supplierAllocated = supplierAllocated.plus(n);
            m.lines.push({
              stoneId: children[i].id,
              cost: money(n),
              status: "Pending",
            });
          }
          put("incomingMemos", m);
        }
        change(
          user,
          s,
          {
            state: "Blocked",
            blockReason: "Split into linked child records",
            children: children.map((c) => c.id),
            loss,
          },
          "Parcel split",
        );
        return children;
      }
      case "selection": {
        allow(user, ["Sales staff"]);
        const c = record("customers", b.customerId);
        if (!Array.isArray(b.stoneIds) || !b.stoneIds.length)
          fail("Choose stones.");
        const ids = [...new Set(b.stoneIds)];
        for (const id of ids) {
          const s = record("stones", id);
          approved(s);
          if (
            !["In stock", "Held"].includes(s.state) ||
            !s.internal ||
            !s.ownershipConfirmed ||
            s.showId
          )
            fail("Selections require available stock.");
        }
        const sel = {
          id: uid("SEL"),
          token: randomUUID() + randomUUID(),
          customerId: c.id,
          customerName: c.name,
          stoneIds: ids,
          title: text(b.title, "Selection title", 150),
          expires: new Date(Date.now() + 7 * 86400000).toISOString(),
          decisions: [],
          createdAt: now(),
        };
        put("selections", sel);
        audit(user, "Private selection created", sel.id, null, {
          ...sel,
          token: "[private]",
        });
        return sel;
      }
      case "stocktake": {
        allow(user, ["Inventory clerk"]);
        if (!Array.isArray(b.ids)) fail("Provide scanned IDs.");
        const location = text(b.location, "Location", 150);
        const expected = all("stones").filter(
          (s) => s.internal && s.location === location && !s.children,
        );
        const scanned = [...new Set(b.ids)];
        const r = {
          id: uid("CNT"),
          location,
          scanned,
          matched: scanned.filter((id) => expected.some((s) => s.id === id)),
          missing: expected
            .filter((s) => !scanned.includes(s.id))
            .map((s) => s.id),
          unexpected: scanned.filter(
            (id) => !expected.some((s) => s.id === id),
          ),
          createdAt: now(),
          actor: user.name,
        };
        put("stocktakes", r);
        audit(user, "Stocktake recorded", r.id, null, r);
        return r;
      }
      case "refund": {
        allow(user, ["Accounts"]);
        const inv = record("invoices", b.invoiceId);
        const fx = currencyInfo(inv.currency, b.exchangeRate || "1");
        const value = amount(b.amount, "Refund amount", fx.places, false);
        const owed = new Decimal(balance(inv)).negated();
        if (new Decimal(value).gt(owed))
          fail("Refund exceeds the customer credit balance.");
        const r = {
          id: uid("REF"),
          invoiceId: inv.id,
          customerId: inv.customerId,
          amount: value,
          currency: inv.currency,
          baseAmount: money(new Decimal(value).times(fx.exchangeRate)),
          exchangeRate: fx.exchangeRate,
          reference: text(b.reference, "Refund reference", 200),
          createdAt: now(),
        };
        put("refunds", r);
        audit(user, "Refund recorded", r.id, null, r);
        return r;
      }
      case "expense": {
        allow(user, ["Accounts"]);
        const e = {
          id: uid("EXP"),
          description: text(b.description, "Description", 300),
          amount: amount(b.amount, "Expense", settings().minorUnits, false),
          category: text(b.category || "Operating", "Category", 100),
          createdAt: now(),
        };
        put("expenses", e);
        audit(user, "Expense recorded", e.id, null, e);
        return e;
      }
      case "settlement": {
        allow(user, ["Accounts"]);
        const inv = record("invoices", b.invoiceId);
        if (new Decimal(balance(inv)).gt(0))
          fail("Collect the invoice balance before settlement.");
        const type = ["Broker", "Shared owner"].includes(b.type)
          ? b.type
          : "Broker";
        const recipient = text(b.recipient, "Recipient", 150);
        if (
          all("settlements").some(
            (x) =>
              x.invoiceId === inv.id &&
              x.recipient === recipient &&
              x.type === type,
          )
        )
          fail("This recipient was already settled for this invoice.");
        const n = amount(
          b.amount,
          "Settlement amount",
          settings().minorUnits,
          false,
        );
        const net = new Decimal(inv.baseTotal || inv.total).minus(
          sum(
            all("credits")
              .filter((c) => c.invoiceId === inv.id)
              .map((c) => c.baseAmount || c.amount),
          ),
        );
        if (
          sum(
            all("settlements")
              .filter((x) => x.invoiceId === inv.id)
              .map((x) => x.amount),
          )
            .plus(n)
            .gt(net)
        )
          fail("Settlements exceed net invoice value.");
        const r = {
          id: uid("SET"),
          invoiceId: inv.id,
          type,
          recipient,
          amount: n,
          reference: text(b.reference, "Reference", 200),
          createdAt: now(),
        };
        put("settlements", r);
        audit(user, "Settlement recorded", r.id, null, r);
        return r;
      }
      case "reconcile": {
        allow(user, ["Accounts"]);
        const expected = money(
          sum(all("payments").map((p) => p.baseAmount || p.amount))
            .minus(sum(all("supplierPayments").map((p) => p.amount)))
            .minus(sum(all("refunds").map((p) => p.baseAmount || p.amount)))
            .minus(sum(all("expenses").map((p) => p.amount)))
            .minus(sum(all("settlements").map((p) => p.amount))),
        );
        if (
          typeof b.actual !== "string" ||
          !/^[-]?\d{1,12}(\.\d+)?$/.test(b.actual) ||
          new Decimal(b.actual).decimalPlaces() > settings().minorUnits
        )
          fail("Statement net must be a signed decimal in the base currency.");
        const actual = money(b.actual);
        const difference = money(new Decimal(actual).minus(expected));
        if (!new Decimal(difference).eq(0) && !b.note)
          fail("Explain the reconciliation difference.");
        const r = {
          id: uid("REC"),
          expected,
          actual,
          difference,
          note: String(b.note || ""),
          actor: user.name,
          createdAt: now(),
        };
        put("reconciliations", r);
        audit(user, "Reconciliation recorded", r.id, null, r);
        return r;
      }
      default:
        fail("Unknown action.", 404);
    }
  });
}
