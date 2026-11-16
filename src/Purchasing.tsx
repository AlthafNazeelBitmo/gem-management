import { Table } from "./RecordsTable";
import { list, str, rows, type Row, type Workspace } from "./api";
import type { FormSpec } from "./main";
type Props = {
  workspace: Workspace;
  role: string;
  open: (form: FormSpec) => void;
  execute: (action: string, body: unknown) => Promise<unknown>;
};
export function Purchasing({ workspace: w, role, open, execute }: Props) {
  const owner = role === "Owner",
    accounts = owner || role === "Accounts",
    clerk = owner || role === "Inventory clerk";
  const suppliers = list(w, "suppliers");
  const options = suppliers.map((r) => ({
    value: str(r, "id"),
    label: str(r, "name"),
  }));
  const orders = list(w, "purchaseOrders"),
    memos = list(w, "incomingMemos"),
    payments = list(w, "supplierPayments");
  const currency = str(w.settings, "currency");
  const common = [
    { key: "supplierId", label: "Supplier", options },
    { key: "variety", label: "Variety" },
    { key: "shape", label: "Shape", value: "Parcel" },
    { key: "carats", label: "Total weight (ct)", type: "decimal" },
    { key: "count", label: "Stone count", type: "number", value: "1" },
    {
      key: "cost",
      label: `Agreed total supplier cost (${currency})`,
      type: "decimal",
    },
    { key: "terms", label: "Agreed terms", type: "textarea" },
  ];
  const pay = (r: Row, isMemo = false) =>
    open({
      title: "Record supplier payment",
      intro:
        "Record a verified base-currency payment. Incoming memo payments cannot exceed the cost of sold lines.",
      submit: "Record supplier payment",
      fields: [
        { key: "amount", label: `Amount (${currency})`, type: "decimal" },
        { key: "reference", label: "Verified payment reference" },
      ],
      onSubmit: async (v) => {
        await execute("supplier-payment", {
          ...v,
          ...(isMemo ? { memoId: r.id } : { orderId: r.id }),
        });
      },
    });
  return (
    <>
      <div className="actions section-gap">
        {accounts && (
          <button
            className="secondary"
            onClick={() =>
              open({
                title: "Add supplier",
                submit: "Save supplier",
                fields: [
                  { key: "name", label: "Supplier name" },
                  {
                    key: "email",
                    label: "Email",
                    type: "email",
                    required: false,
                  },
                  { key: "phone", label: "Phone", required: false },
                ],
                onSubmit: async (v) => {
                  await execute("supplier", v);
                },
              })
            }
          >
            Add supplier
          </button>
        )}
        {owner && suppliers.length > 0 && (
          <>
            <button
              className="primary"
              onClick={() =>
                open({
                  title: "Create purchase order",
                  intro:
                    "This agrees a purchase. Inventory is created only when the clerk receives it. Add separate orders for differently priced parcels.",
                  submit: "Create purchase order",
                  fields: common,
                  onSubmit: async (v) => {
                    await execute("purchase-order", {
                      supplierId: v.supplierId,
                      terms: v.terms,
                      lines: [v],
                    });
                  },
                })
              }
            >
              Create purchase order
            </button>
            <button
              className="secondary"
              onClick={() =>
                open({
                  title: "Receive supplier consignment",
                  intro:
                    "Supplier-owned goods remain linked to their terms. Receiving creates a draft; evidence still requires review.",
                  submit: "Receive incoming memo",
                  fields: [
                    ...common,
                    { key: "location", label: "Internal location" },
                    { key: "due", label: "Return due", type: "datetime-local" },
                    {
                      key: "authorityConfirmed",
                      label:
                        "Supplier authorises sale under these agreed terms",
                      type: "checkbox",
                    },
                  ],
                  onSubmit: async (v) => {
                    await execute("incoming-memo", {
                      supplierId: v.supplierId,
                      terms: v.terms,
                      due: v.due,
                      authorityConfirmed: v.authorityConfirmed === "true",
                      lines: [v],
                    });
                  },
                })
              }
            >
              Receive supplier memo
            </button>
          </>
        )}
      </div>
      {owner && !suppliers.length && (
        <p className="info-note">Add a supplier before creating a purchase order or receiving supplier stock.</p>
      )}
      <h2>Purchase orders</h2>
      {!orders.length ? (
        <div className="empty">
          No purchase orders. Add a supplier, agree the purchase, then receive
          the stock.
        </div>
      ) : (
        orders.map((po) => (
          <section className="panel memo-section" key={str(po, "id")}>
            <div className="section-heading">
              <div>
                <h2>
                  {str(po, "id")} · {str(po, "supplierName")}
                </h2>
                <p>{str(po, "terms")}</p>
              </div>
              <span className="badge">{str(po, "status")}</span>
            </div>
            <div className="purchase-body">
              <p>
                {rows(po.lines)
                  .map((l) => `${l.variety} · ${l.carats} ct`)
                  .join(", ")}
                {accounts && ` · ${po.total} ${currency}`}
              </p>
              <div className="actions">
                {po.status === "Ordered" && clerk && (
                  <button
                    className="secondary"
                    onClick={() =>
                      open({
                        title: "Receive agreed purchase",
                        intro:
                          "Agreed order cost is applied by the server; the clerk does not set pricing.",
                        submit: "Receive purchase",
                        fields: [
                          {
                            key: "location",
                            label: "Internal receiving location",
                          },
                        ],
                        onSubmit: async (v) => {
                          await execute("receive-purchase", {
                            ...v,
                            id: po.id,
                          });
                        },
                      })
                    }
                  >
                    Receive purchase
                  </button>
                )}
                {po.status === "Received" && accounts && (
                  <button className="secondary" onClick={() => pay(po)}>
                    Record supplier payment
                  </button>
                )}
              </div>
            </div>
          </section>
        ))
      )}
      <h2 className="section-title">Incoming supplier memos</h2>
      {!memos.length ? (
        <div className="empty">No supplier-owned goods on memo.</div>
      ) : (
        memos.map((m) => (
          <section className="panel memo-section" key={str(m, "id")}>
            <div className="section-heading">
              <div>
                <h2>
                  {str(m, "id")} · {str(m, "supplierName")}
                </h2>
                <p>
                  Due {new Date(str(m, "due")).toLocaleDateString()} ·{" "}
                  {str(m, "terms")}
                </p>
              </div>
              {accounts && (
                <button className="secondary" onClick={() => pay(m, true)}>
                  Pay sold-line obligation
                </button>
              )}
            </div>
            <Table
              data={rows(m.lines)}
              columns={[
                { label: "Stone", render: (line) => str(line, "stoneId") },
                { label: "Outcome", render: (line) => str(line, "status") },
                ...(accounts
                  ? [
                      {
                        label: "Supplier cost",
                        render: (line: Row) =>
                          `${str(line, "cost")} ${currency}`,
                      },
                    ]
                  : []),
                {
                  label: "Return",
                  render: (l) =>
                    clerk && l.status === "Pending" ? (
                      <button
                        className="text-button"
                        onClick={() =>
                          open({
                            title: "Return to supplier",
                            intro:
                              "The stone must be internally held and free of reservations or show assignments.",
                            submit: "Record supplier return",
                            fields: [
                              {
                                key: "condition",
                                label: "Return condition",
                                type: "textarea",
                              },
                            ],
                            onSubmit: async (v) => {
                              const stone = list(w, "stones").find(
                                (s) => s.id === l.stoneId,
                              );
                              await execute("return-supplier", {
                                ...v,
                                memoId: m.id,
                                id: l.stoneId,
                                version: stone?.version,
                              });
                            },
                          })
                        }
                      >
                        Return stone
                      </button>
                    ) : (
                      str(l, "invoiceId") || "Recorded"
                    ),
                },
              ]}
            />
          </section>
        ))
      )}
      <h2 className="section-title">Suppliers</h2>
      <div className="export-list">
        {suppliers.length ? (
          suppliers.map((s) => (
            <div key={str(s, "id")}>
              <span>
                {str(s, "name")}
                <small>
                  {str(s, "email")} · {str(s, "phone")}
                </small>
              </span>
            </div>
          ))
        ) : (
          <p className="muted">No suppliers added.</p>
        )}
      </div>
      {accounts && (
        <>
          <h2 className="section-title">Verified supplier payments</h2>
          {payments.length ? (
            payments.map((p) => (
              <p key={str(p, "id")}>
                {str(p, "supplierName")} · {str(p, "amount")} {currency} ·{" "}
                {str(p, "reference")}
              </p>
            ))
          ) : (
            <p className="muted">No supplier payments recorded.</p>
          )}
        </>
      )}
    </>
  );
}
