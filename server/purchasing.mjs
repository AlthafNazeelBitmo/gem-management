import Decimal from "decimal.js";
import { all, put, uid, now, audit, settings } from "./db.mjs";
import {
  allow,
  fail,
  text,
  amount,
  money,
  sum,
  record,
  createStone,
  freshStone,
  change,
} from "./domain.mjs";
export function purchasing(user, action, b) {
  switch (action) {
    case "supplier": {
      allow(user, ["Accounts"]);
      const r = {
        id: uid("SUP"),
        name: text(b.name, "Supplier name", 150),
        email: String(b.email || "").slice(0, 200),
        phone: String(b.phone || "").slice(0, 80),
        createdAt: now(),
      };
      put("suppliers", r);
      audit(user, "Supplier created", r.id, null, r);
      return r;
    }
    case "purchase-order": {
      allow(user, []);
      const supplier = record("suppliers", b.supplierId);
      if (!Array.isArray(b.lines) || !b.lines.length || b.lines.length > 100)
        fail("Provide purchase lines.");
      const lines = b.lines.map((l) => ({
        variety: text(l.variety, "Variety", 100),
        shape: text(l.shape || "Parcel", "Shape", 80),
        carats: amount(l.carats, "Weight", 3, false),
        cost: amount(l.cost, "Agreed line cost", settings().minorUnits, false),
        count: Number(l.count || 1),
      }));
      if (lines.some((l) => !Number.isInteger(l.count) || l.count < 1))
        fail("Count must be a positive whole number.");
      const r = {
        id: uid("PO"),
        supplierId: supplier.id,
        supplierName: supplier.name,
        lines,
        total: money(sum(lines.map((l) => l.cost))),
        status: "Ordered",
        terms: text(b.terms, "Agreed purchase terms", 2000),
        createdAt: now(),
      };
      put("purchaseOrders", r);
      audit(user, "Purchase order created", r.id, null, r);
      return r;
    }
    case "receive-purchase": {
      allow(user, ["Inventory clerk"]);
      const po = record("purchaseOrders", b.id);
      if (po.status !== "Ordered") fail("Purchase order is already received.");
      const location = text(b.location, "Receiving location", 150);
      const stones = po.lines.map((l) => {
        const s = createStone(user, {
          ...l,
          location,
          ownershipConfirmed: true,
          supplier: po.supplierName,
        });
        const priced = {
          ...s,
          cost: l.cost,
          supplier: po.supplierName,
          purchaseOrderId: po.id,
          ownershipConfirmed: true,
        };
        put("stones", priced);
        audit(user, "Purchase terms applied", s.id, null, {
          orderId: po.id,
          cost: l.cost,
        });
        return priced.id;
      });
      const updated = {
        ...po,
        status: "Received",
        stoneIds: stones,
        receivedAt: now(),
      };
      put("purchaseOrders", updated);
      audit(user, "Purchase received", po.id, po, updated);
      return { id: po.id, stoneIds: stones };
    }
    case "incoming-memo": {
      allow(user, []);
      const supplier = record("suppliers", b.supplierId);
      const due = new Date(b.due);
      if (!Number.isFinite(due.getTime()) || due <= new Date())
        fail("Choose a future supplier return date.");
      if (!Array.isArray(b.lines) || !b.lines.length || b.lines.length > 100)
        fail("Provide incoming stock.");
      const terms = text(b.terms, "Supplier consignment terms", 2000);
      if (b.authorityConfirmed !== true)
        fail("Confirm supplier authority and sale terms.");
      const r = {
        id: uid("MIN"),
        supplierId: supplier.id,
        supplierName: supplier.name,
        due: due.toISOString(),
        terms,
        createdAt: now(),
      };
      const lines = b.lines.map((l) => {
        const cost = amount(
          l.cost,
          "Supplier obligation",
          settings().minorUnits,
          false,
        );
        const s = createStone(user, {
          ...l,
          cost,
          supplier: supplier.name,
          ownershipConfirmed: true,
        });
        put("stones", { ...s, incomingMemoId: r.id, supplierOwned: true });
        return { stoneId: s.id, cost, status: "Pending" };
      });
      r.lines = lines;
      put("incomingMemos", r);
      audit(user, "Supplier memo received", r.id, null, r);
      return r;
    }
    case "return-supplier": {
      allow(user, ["Inventory clerk"]);
      const m = record("incomingMemos", b.memoId);
      const s = freshStone(b.id, b.version);
      const line = m.lines.find((l) => l.stoneId === s.id);
      if (
        !line ||
        line.status !== "Pending" ||
        !["Draft", "In stock", "Returned"].includes(s.state) ||
        !s.internal ||
        s.showId ||
        s.children?.length
      )
        fail(
          "Receive this stone back and release any reservations before returning it to its supplier.",
        );
      const condition = text(b.condition, "Return condition", 1000);
      line.status = "Returned";
      line.condition = condition;
      line.returnedAt = now();
      put("incomingMemos", m);
      return change(
        user,
        s,
        {
          state: "Returned",
          internal: false,
          custodian: m.supplierName,
          location: "Returned to supplier",
          ownershipConfirmed: false,
        },
        "Supplier return recorded",
      );
    }
    case "supplier-payment": {
      allow(user, ["Accounts"]);
      const reference = text(b.reference, "Payment reference", 200);
      const r = { id: uid("SPY"), reference, createdAt: now() };
      let due;
      if (b.orderId) {
        const po = record("purchaseOrders", b.orderId);
        if (po.status !== "Received")
          fail("Receive the purchase before recording a supplier payment.");
        r.orderId = po.id;
        r.supplierId = po.supplierId;
        r.supplierName = po.supplierName;
        due = new Decimal(po.total).minus(
          sum(
            all("supplierPayments")
              .filter((p) => p.orderId === po.id)
              .map((p) => p.amount),
          ),
        );
      } else {
        const m = record("incomingMemos", b.memoId);
        r.memoId = m.id;
        r.supplierId = m.supplierId;
        r.supplierName = m.supplierName;
        due = sum(
          m.lines.filter((l) => l.status === "Sold").map((l) => l.cost),
        ).minus(
          sum(
            all("supplierPayments")
              .filter((p) => p.memoId === m.id)
              .map((p) => p.amount),
          ),
        );
      }
      r.amount = amount(
        b.amount,
        "Supplier payment",
        settings().minorUnits,
        false,
      );
      if (new Decimal(r.amount).gt(due))
        fail("Payment exceeds the outstanding supplier obligation.");
      put("supplierPayments", r);
      audit(user, "Supplier payment recorded", r.id, null, r);
      return r;
    }
    default:
      return null;
  }
}
export function markSupplierSale(stone, invoiceId) {
  if (!stone.incomingMemoId) return;
  const m = record("incomingMemos", stone.incomingMemoId);
  const line = m.lines.find((l) => l.stoneId === stone.id);
  if (!line || line.status !== "Pending")
    fail("Supplier memo line is not available.");
  line.status = "Sold";
  line.invoiceId = invoiceId;
  put("incomingMemos", m);
}
