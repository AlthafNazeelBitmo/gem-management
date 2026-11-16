import { countries, currencies, currencyDecimals } from "./setup-options";
import { Purchasing } from "./Purchasing";
import { Table } from "./RecordsTable";
import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  request,
  setCsrf,
  str,
  rows,
  list,
  ids,
  type Row,
  type User,
  type Workspace,
} from "./api";
import "./styles.css";
const ROLES = [
  "Owner",
  "Sales staff",
  "Inventory clerk",
  "Accounts",
  "Cutter / lab liaison",
  "Gem reviewer",
];
const STATES = [
  "Draft",
  "In stock",
  "Held",
  "On memo",
  "Sold",
  "With lab or cutter",
  "Returned",
  "Blocked",
];
const access: Record<string, string[]> = {
  Overview: ROLES,
  Inventory: [
    "Owner",
    "Sales staff",
    "Inventory clerk",
    "Cutter / lab liaison",
    "Gem reviewer",
  ],
  Evidence: ["Owner", "Inventory clerk", "Gem reviewer"],
  Processing: ["Owner", "Cutter / lab liaison", "Inventory clerk"],
  "Holds & selections": ["Owner", "Sales staff"],
  Memos: ["Owner", "Sales staff", "Accounts"],
  Quotes: ["Owner", "Sales staff", "Accounts"],
  Purchasing: ["Owner", "Inventory clerk", "Accounts"],
  Customers: ["Owner", "Sales staff", "Accounts"],
  Sales: ["Owner", "Sales staff", "Accounts"],
  Payments: ["Owner", "Accounts"],
  Stocktake: ["Owner", "Inventory clerk"],
  Reports: ["Owner", "Accounts"],
  "Show mode": ["Owner", "Sales staff", "Inventory clerk"],
  "Activity log": ["Owner", "Accounts"],
  Assistant: ROLES,
  Walkthrough: ROLES,
  Settings: ["Owner"],
};
const descriptions: Record<string, string> = {
  Overview: "Available stock and pending work.",
  Inventory: "Find stones, check availability, and track custody.",
  Evidence: "Preserve the originals. Review the wording before sharing.",
  Processing: "Every handover, return weight and processing charge.",
  "Holds & selections": "A selection shares stock. A hold reserves it.",
  Memos: "Track what is out, who has it and what comes back.",
  Quotes: "Prepare offers and route discounts for owner approval.",
  Purchasing: "Purchases, supplier-owned goods and supplier obligations.",
  Customers: "The people and businesses you trade with.",
  Sales: "Invoices, reviewed disclosures and inspected returns.",
  Payments: "Allocate receipts and settle outstanding obligations.",
  Stocktake: "Compare a physical count with recorded custody.",
  Reports: "Reconciled records, ready for review and export.",
  "Show mode": "Exclusive stock assignment and signed offline sales.",
  "Activity log": "Who changed what, when, and why.",
  Assistant: "Read-only answers about your workspace.",
  Walkthrough: "Follow a parcel through the business, one handoff at a time.",
  Settings: "Workspace, people and sign-in security.",
};
const NAV_GROUPS: { title: string; pages: string[] }[] = [
  {
    title: "MAIN",
    pages: ["Overview", "Inventory", "Evidence", "Customers"],
  },
  {
    title: "OPERATIONS",
    pages: [
      "Processing",
      "Holds & selections",
      "Memos",
      "Quotes",
      "Purchasing",
      "Show mode",
    ],
  },
  {
    title: "FINANCE & AUDIT",
    pages: ["Sales", "Payments", "Stocktake", "Reports", "Activity log"],
  },
  {
    title: "SETTINGS & HELP",
    pages: ["Assistant", "Walkthrough", "Settings"],
  },
];
function GemLogo() {
  return (
    <svg
      className="brand-logo-icon"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M10 4L22 4L28 11L16 28L4 11L10 4Z"
        fill="#5B4DF2"
        fillOpacity="0.16"
        stroke="#5B4DF2"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M4 11H28M10 4L16 28L22 4M10 4L16 11L22 4M16 11V28"
        stroke="#5B4DF2"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function GemThumbnail({
  variety,
  shape = "",
}: {
  variety: string;
  shape?: string;
}) {
  const v = variety.toLowerCase();
  const s = shape.toLowerCase();

  let type = "default";
  if (v.includes("sapphire")) type = "sapphire";
  else if (v.includes("emerald")) type = "emerald";
  else if (v.includes("ruby")) type = "ruby";
  else if (v.includes("spinel")) type = "spinel";
  else if (v.includes("diamond")) type = "diamond";

  // Render cut-specific silhouette matching the physical stone shape
  let icon = (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="8.5" />
      <polygon points="12,5 16.5,7.5 18,12 16.5,16.5 12,19 7.5,16.5 6,12 7.5,7.5" />
      <circle cx="12" cy="12" r="3.2" />
    </svg>
  );

  if (s.includes("emerald") || s.includes("step") || s.includes("octagon") || s.includes("radiant")) {
    icon = (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polygon points="6,3 18,3 22,7 22,17 18,21 6,21 2,17 2,7" />
        <polygon points="8,6 16,6 19,9 19,15 16,18 8,18 5,15 5,9" />
        <line x1="2" y1="7" x2="5" y2="9" />
        <line x1="22" y1="7" x2="19" y2="9" />
        <line x1="22" y1="17" x2="19" y2="15" />
        <line x1="2" y1="17" x2="5" y2="15" />
      </svg>
    );
  } else if (s.includes("oval")) {
    icon = (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <ellipse cx="12" cy="12" rx="9" ry="7" />
        <ellipse cx="12" cy="12" rx="5" ry="3.8" />
        <line x1="3" y1="12" x2="7" y2="12" />
        <line x1="17" y1="12" x2="21" y2="12" />
        <line x1="12" y1="5" x2="12" y2="8.2" />
        <line x1="12" y1="15.8" x2="12" y2="19" />
      </svg>
    );
  } else if (s.includes("cushion")) {
    icon = (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <rect x="7" y="7" width="10" height="10" rx="3" />
        <line x1="3" y1="8" x2="7" y2="10" />
        <line x1="21" y1="8" x2="17" y2="10" />
        <line x1="21" y1="16" x2="17" y2="14" />
        <line x1="3" y1="16" x2="7" y2="14" />
      </svg>
    );
  } else if (s.includes("pear")) {
    icon = (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 3 C12 3, 5 12, 5 16.5 A7 7 0 0 0 19 16.5 C19 12, 12 3, 12 3 Z" />
        <path d="M12 7.5 C12 7.5, 7.8 13.5, 7.8 16 A4.2 4.2 0 0 0 16.2 16 C16.2 13.5, 12 7.5, 12 7.5 Z" />
      </svg>
    );
  } else if (s.includes("cabochon")) {
    icon = (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <ellipse cx="12" cy="13" rx="9" ry="7" />
        <path d="M5 12 C6 7.5, 18 7.5, 19 12" />
        <path d="M9 9.5 C10.5 8.5, 13.5 8.5, 15 9.5" strokeWidth="1.2" />
      </svg>
    );
  } else if (s.includes("rough") || s.includes("crystal") || s.includes("parcel")) {
    icon = (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polygon points="12,2 19,6 20,16 12,22 4,16 5,6" />
        <polyline points="12,2 12,22" />
        <polyline points="5,6 12,11 19,6" />
        <polyline points="4,16 12,11 20,16" />
      </svg>
    );
  }

  return (
    <div
      className={`stone-thumbnail ${type}`}
      title={`${variety}${shape ? ` (${shape})` : ""}`}
      aria-hidden="true"
    >
      {icon}
    </div>
  );
}
function Mark({ name }: { name: string }) {
  const p =
    name === "chevron" ? "m9 6 6 6-6 6"
      : name === "list" ? "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"
      : name === "search"
      ? "m16 16 5 5 M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14"
      : name === "close"
        ? "m6 6 12 12 M6 18 18 6"
        : name === "menu"
          ? "M3 6h18 M3 12h18 M3 18h18"
          : name === "plus"
            ? "M12 5v14 M5 12h14"
            : name === "bell"
              ? "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 0 1-3.46 0"
              : name === "sun"
                ? "M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                : name === "moon"
                  ? "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
                  : name === "table"
                    ? "M3 3h18v18H3z M3 9h18 M3 15h18 M9 3v18"
                    : name === "grid"
                      ? "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z"
                      : name === "edit"
                        ? "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
                        : name === "filter"
                          ? "M22 3H2l8 9.46V19l4 2v-8.54L22 3z"
                          : name === "Overview"
                            ? "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z"
                            : name === "Inventory"
                              ? "m3 7 9-4 9 4-9 4z M3 7v10l9 4 9-4V7 M12 11v10"
                              : name === "Evidence"
                                ? "M12 3 3 7v6c0 4 9 8 9 8s9-4 9-8V7z m-4 9 3 3 5-6"
                                : name === "Customers"
                                  ? "M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3 M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M18 8a3 3 0 0 1 0 6 M19 17h3v4"
                                  : name === "Processing"
                                    ? "m4 5 5 5-4 4 M20 19l-5-5 4-4 M14 4l-4 16"
                                    : name === "Settings"
                                      ? "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z"
                                      : name === "Payments"
                                        ? "M3 6h18v14H3z M3 10h18 M6 16h4"
                                        : name === "Holds & selections"
                                          ? "M8 10V7a4 4 0 0 1 8 0v3 M5 10h14v11H5z M12 14v3"
                                          : name === "Show mode"
                                            ? "M3 4h18v14H3z M8 22h8 M12 18v4"
                                            : name === "Activity log"
                                              ? "M4 5h16 M4 12h16 M4 19h16 M8 3v4 M16 10v4 M10 17v4"
                                              : name === "Assistant"
                                                ? "M4 4h16v12H9l-5 4z M8 8h8 M8 12h5"
                                                : "M6 3h9l4 4v14H6z M14 3v5h5 M9 12h7 M9 16h5";
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={p} />
    </svg>
  );
}
function formatStatusWord(val: string): string {
  switch (val) {
    case "In stock":
      return "In stock";
    case "On memo":
      return "Memo";
    case "Review needed":
      return "Review";
    case "Awaiting accounts":
      return "Accounts";
    case "Awaiting owner":
      return "Owner";
    case "Returned":
      return "Returned";
    case "Sold":
      return "Sold";
    case "Approved":
      return "Approved";
    default:
      return val;
  }
}

function Badge({ value }: { value: unknown }) {
  const v = String(value ?? "");
  const word = formatStatusWord(v);

  const isApproved = ["Approved", "Ready", "Reconciled"].includes(v);
  const isStock = ["In stock", "Stock"].includes(v);
  const isSold = ["Sold", "Converted", "Archived"].includes(v);
  const isMemo = ["On memo", "Memo", "Issued", "Assigned"].includes(v);
  const isWarn = [
    "Held",
    "Ordered",
    "Review needed",
    "Review",
    "Awaiting accounts",
    "Awaiting owner",
    "Draft",
    "Returned",
    "Return",
  ].includes(v);
  const isAlert = ["Blocked", "Conflict", "Overdue", "Rejected"].includes(v);
  const isProcessing = ["With lab or cutter", "Lab", "Processing"].includes(v);

  const statusType = isAlert
    ? "alert"
    : isWarn
      ? "warn"
      : isApproved
        ? "verified"
        : isStock
          ? "stock"
          : isMemo
            ? "memo"
            : isSold
              ? "sold"
              : isProcessing
                ? "processing"
                : "standard";

  return (
    <span className={`status-text status-${statusType}`} title={v}>
      {word}
    </span>
  );
}
function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);
  const generated = React.useId();
  const id = props.id || generated;
  return (
    <span className="password-field">
      <input {...props} id={id} type={visible ? "text" : "password"} />
      <button
        type="button"
        aria-controls={id}
        aria-pressed={visible}
        aria-label={visible ? "Hide password" : "Show password"}
        onClick={() => setVisible(!visible)}
      >
        {visible ? "Hide" : "Show"}
      </button>
    </span>
  );
}
function Dialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = React.useId();
  useEffect(() => {
    const before = document.activeElement;
    ref.current?.showModal();
    return () => {
      ref.current?.close();
      if (before instanceof HTMLElement && before.isConnected) before.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={id}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dialog-head">
        <h2 id={id}>{title}</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <Mark name="close" />
        </button>
      </div>
      {children}
    </dialog>
  );
}
type Option = { value: string; label: string };
type Field = {
  key: string;
  label: string;
  type?: string;
  value?: string;
  required?: boolean;
  options?: Option[];
  hint?: string;
};
export type FormSpec = {
  title: string;
  intro?: string;
  fields: Field[];
  submit: string;
  onSubmit: (
    values: Record<string, string>,
    file: File | null,
  ) => Promise<void>;
};
function Editor({ spec, onClose }: { spec: FormSpec; onClose: () => void }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      title={spec.title}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      {spec.intro && <p className="intro">{spec.intro}</p>}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          const values: Record<string, string> = {};
          for (const f of spec.fields) {
            if (f.type === "multiple")
              values[f.key] = JSON.stringify(data.getAll(f.key));
            else if (f.type === "checkbox")
              values[f.key] = data.has(f.key) ? "true" : "false";
            else values[f.key] = String(data.get(f.key) || "");
          }
          const f = data.get("file");
          setBusy(true);
          setError("");
          try {
            await spec.onSubmit(values, f instanceof File ? f : null);
            onClose();
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {spec.fields.map((f) => (
          <label
            key={f.key}
            className={f.type === "checkbox" ? "check-label" : ""}
          >
            {f.type === "checkbox" ? (
              <>
                <input
                  name={f.key}
                  aria-label={f.label}
                  type="checkbox"
                  defaultChecked={f.value === "true"}
                />
                {f.label}
              </>
            ) : (
              <>
                <span>
                  {f.label}
                  {f.required === false ? " (optional)" : ""}
                </span>
                {f.type === "textarea" ? (
                  <textarea
                    name={f.key}
                    aria-label={f.label}
                    defaultValue={f.value}
                    required={f.required !== false}
                    rows={4}
                  />
                ) : f.options ? (
                  <select
                    name={f.key}
                    aria-label={f.label}
                    defaultValue={
                      f.type === "multiple"
                        ? JSON.parse(f.value || "[]")
                        : f.value || ""
                    }
                    multiple={f.type === "multiple"}
                    required={f.required !== false}
                  >
                    {f.type !== "multiple" && (
                      <option value="" disabled>
                        Choose an option
                      </option>
                    )}
                    {f.options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : f.type === "password" ? (
                  <PasswordInput
                    name={f.key}
                    aria-label={f.label}
                    defaultValue={f.value}
                    required={f.required !== false}
                    maxLength={128}
                    minLength={12}
                    autoComplete={
                      f.key === "currentPassword"
                        ? "current-password"
                        : "new-password"
                    }
                  />
                ) : (
                  <input
                    name={f.key}
                    aria-label={f.label}
                    type={f.type === "decimal" ? "text" : f.type || "text"}
                    inputMode={f.type === "decimal" ? "decimal" : undefined}
                    defaultValue={f.value}
                    required={f.required !== false}
                    maxLength={f.type === "password" ? 128 : 3000}
                    minLength={f.type === "password" ? 12 : undefined}
                    accept={
                      f.type === "file"
                        ? ".pdf,.png,.jpg,.jpeg,.csv"
                        : undefined
                    }
                  />
                )}
              </>
            )}
            {f.hint && <small>{f.hint}</small>}
          </label>
        ))}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button
            type="button"
            className="secondary"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            {busy ? "Saving…" : spec.submit}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
function App() {
  const [user, setUser] = useState<User | null>(null);
  const [setup, setSetup] = useState(false);
  const [setupCurrency, setSetupCurrency] = useState("");
  const [setupDecimals, setSetupDecimals] = useState("2");
  const [boot, setBoot] = useState(true);
  const [w, setW] = useState<Workspace | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [page, setPage] = useState(
    decodeURIComponent(location.hash.slice(1)) || "Overview",
  );
  const [form, setForm] = useState<FormSpec | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [focusAttention, setFocusAttention] = useState(false);
  const [query, setQuery] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [status, setStatus] = useState("All stock");
  const [selected, setSelected] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [sortBy, setSortBy] = useState("default");
  const [varietyFilter, setVarietyFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [evidenceFilter, setEvidenceFilter] = useState("all");
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [inventoryPage, setInventoryPage] = useState(1);
  const [collapsedSections, setCollapsedSections] = useState<
    Record<string, boolean>
  >({});
  const toggleSection = (title: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [title]: !prev[title],
    }));
  };
  const globalSearchRef = useRef<HTMLInputElement>(null);
  const stockSearchButton = useRef<HTMLButtonElement>(null);
  const [focusSearchTrigger, setFocusSearchTrigger] = useState(false);
  const [theme, setTheme] = useState(
    localStorage.getItem("gem-theme") ||
      (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"),
  );
  const [refreshing, setRefreshing] = useState(false);
  const [invoice, setInvoice] = useState<Row | null>(null);
  const [importPreview, setImportPreview] = useState<Row | null>(null);
  const [answer, setAnswer] = useState("");
  const [assistantError, setAssistantError] = useState("");
  const [asking, setAsking] = useState(false);
  const [extractingFile, setExtractingFile] = useState("");
  const [extractionError, setExtractionError] = useState<{ fileId: string; message: string } | null>(null);
  const [mfa, setMfa] = useState<Row | null>(null);
  const [showAuthority, setShowAuthority] = useState<Row | null>(() => {
    try {
      return JSON.parse(localStorage.getItem("gem-show-authority") || "null");
    } catch {
      return null;
    }
  });
  const [queue, setQueue] = useState<Row[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("gem-offline-events") || "[]");
    } catch {
      return [];
    }
  });
  const [online, setOnline] = useState(navigator.onLine);
  const buyerToken = location.pathname.startsWith("/buyer/")
    ? location.pathname.split("/")[2]
    : null;
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      "content", theme === "dark" ? "#0f172a" : "#ffffff",
    );
    localStorage.setItem("gem-theme", theme);
  }, [theme]);
  useEffect(() => {
    const update = () =>
      setPage(decodeURIComponent(location.hash.slice(1)) || "Overview");
    const on = () => {
      setOnline(true);
      request<{ user: User | null }>("/api/auth")
        .then((a) => {
          if (a.user) {
            setCsrf(a.user.csrf);
            setUser(a.user);
          }
        })
        .catch(() => {});
    };
    const off = () => setOnline(false);
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        globalSearchRef.current?.focus();
      }
    };
    window.addEventListener("hashchange", update);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("hashchange", update);
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      window.removeEventListener("keydown", onKey);
    };
  }, []);
  const refresh = async () => {
    setRefreshing(true);
    try {
      const data = await request<Workspace>("/api/workspace");
      setW(data);
      setError("");
    } catch (e) {
      setError((e as Error).message);
      throw e;
    } finally {
      setRefreshing(false);
    }
  };
  useEffect(() => {
    if (buyerToken) {
      setBoot(false);
      return;
    }
    if (!navigator.onLine) {
      try {
        const saved = JSON.parse(
          localStorage.getItem("gem-show-authority") || "null",
        );
        if (saved?.user && saved?.settings) {
          setUser({ ...saved.user, csrf: "" });
          setW({
            settings: saved.settings,
            aiConfigured: false,
            mfaEnabled: false,
            stones: saved.stones,
            customers: saved.customers,
            shows: [
              {
                id: saved.id,
                status: "Assigned",
                stoneIds: saved.stones.map((s: Row) => s.id),
              },
            ],
          });
          setPage("Show mode");
          setBoot(false);
          return;
        }
      } catch {
        setError(
          "Downloaded show authority could not be opened. Reconnect to recover it.",
        );
      }
    }
    request<{ setupRequired: boolean; user: User | null }>("/api/auth")
      .then(async (a) => {
        setSetup(a.setupRequired);
        setUser(a.user);
        if (a.user) {
          setCsrf(a.user.csrf);
          await refresh();
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setBoot(false));
  }, [buyerToken]);
  useEffect(() => {
    if (!user) return;
    const timer = setInterval(() => {
      if (navigator.onLine) refresh().catch(() => {});
    }, 30000);
    return () => clearInterval(timer);
  }, [user]);
  useEffect(() => {
    document.title = `Gem Management | ${page}`;
    setQuery("");
    setStatus("All stock");
    setSelected([]);
    setMenu(false);
    window.scrollTo(0, 0);
  }, [page]);
  useEffect(() => {
    if (page !== "Overview" || !focusAttention) return;
    const attention = document.getElementById("workspace-attention");
    attention?.focus({ preventScroll: true });
    attention?.scrollIntoView();
    setFocusAttention(false);
  }, [page, focusAttention]);
  useEffect(() => {
    if (mobileSearchOpen) globalSearchRef.current?.focus();
    else if (focusSearchTrigger) {
      stockSearchButton.current?.focus();
      setFocusSearchTrigger(false);
    }
  }, [mobileSearchOpen, focusSearchTrigger]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 7000);
    return () => clearTimeout(timer);
  }, [notice]);
  const go = (p: string) => {
    setMobileSearchOpen(false);
    location.hash = encodeURIComponent(p);
    setPage(p);
    setMenu(false);
  };
  const can = (...roles: string[]) =>
    !!user && (user.role === "Owner" || roles.includes(user.role));
  const execute = async (action: string, body: unknown) => {
    const result = await request(`/api/commands/${action}`, body);
    await refresh();
    setNotice("Saved to the workspace.");
    return result;
  };
  const run = async (
    fn: () => Promise<unknown>,
    message = "Saved to the workspace.",
  ) => {
    setError("");
    try {
      await fn();
      await refresh();
      setNotice(message);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const stones = list(w, "stones");
  const customers = list(w, "customers");
  const customerOptions = customers.map((c) => ({
    value: str(c, "id"),
    label: str(c, "name"),
  }));
  const stoneOptions = stones
    .filter(
      (s) =>
        ["In stock", "Held"].includes(str(s, "state")) &&
        s.evidence === "Approved" &&
        !s.showId,
    )
    .map((s) => ({
      value: str(s, "id"),
      label: `${s.id} · ${s.variety} · ${s.carats} ct`,
    }));
  const moneyValue = (v: unknown, currency?: string) =>
    `${String(v ?? "0")} ${currency || w?.settings.currency || ""}`;
  const date = (v: unknown) =>
    v
      ? new Date(String(v)).toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "Not recorded";
  const s = stones.find((x) => x.id === detail);
  const customerField: Field = {
    key: "customerId",
    label: "Customer",
    options: customerOptions,
  };
  const chooseStones: Field = {
    key: "stoneIds",
    label: "Stones",
    type: "multiple",
    value: JSON.stringify(selected),
    options: stoneOptions,
    hint: "Use Command or Control to select several stones.",
  };
  const openReceive = () =>
    setForm({
      title: "Receive stock",
      intro:
        "Create a permanent record. Evidence and ownership must be reviewed before release to stock.",
      submit: "Receive as draft",
      fields: [
        { key: "variety", label: "Gemstone variety" },
        { key: "shape", label: "Shape", value: "Oval" },
        { key: "carats", label: "Weight (ct)", type: "decimal" },
        { key: "count", label: "Stone count", value: "1", type: "number" },
        { key: "location", label: "Internal location" },
        {
          key: "custodian",
          label: "Internal custodian",
          value: "Internal intake",
        },
        { key: "color", label: "Color description", required: false },
        { key: "dimensions", label: "Dimensions", required: false },
        ...(can()
          ? ([
              {
                key: "cost",
                label: "Acquisition cost",
                value: "0",
                type: "decimal",
              },
              {
                key: "price",
                label: "Asking price",
                value: "0",
                type: "decimal",
              },
              { key: "supplier", label: "Supplier", required: false },
              {
                key: "shares",
                label: "Ownership shares",
                type: "textarea",
                required: false,
                hint: "Optional. Enter Owner name: percentage on each line. Percentages must total 100.",
              },
              {
                key: "ownershipConfirmed",
                label: "Ownership authority and terms confirmed",
                type: "checkbox",
              },
            ] as Field[])
          : []),
      ],
      onSubmit: async (v) => {
        const r = await execute("receive", {
          ...v,
          ownershipConfirmed: v.ownershipConfirmed === "true",
          ownershipShares: (v.shares || "")
            .split("\n")
            .filter((x) => x.trim())
            .map((line) => {
              const split = line.lastIndexOf(":");
              if (split < 1)
                throw new Error(
                  "Use Owner name: percentage for each ownership share.",
                );
              return {
                owner: line.slice(0, split).trim(),
                percent: line.slice(split + 1).trim(),
              };
            }),
        });
        setDetail(str(r.result as Row, "id"));
      },
    });
  const openCustomer = () =>
    setForm({
      title: "Add customer",
      submit: "Save customer",
      fields: [
        { key: "name", label: "Customer or business name" },
        { key: "email", label: "Email", type: "email", required: false },
        { key: "phone", label: "Phone", type: "tel", required: false },
        { key: "notes", label: "Notes", type: "textarea", required: false },
      ],
      onSubmit: async (v) => {
        await execute("customer", v);
      },
    });
  const openSale = (memo?: Row, one?: Row) => {
    const choices = memo
      ? rows(memo.lines)
          .filter((l) => l.status === "Pending")
          .map((l) => {
            const stone = stones.find((x) => x.id === l.stoneId);
            return {
              value: str(l, "stoneId"),
              label: `${l.stoneId} · ${stone?.variety || ""}`,
            };
          })
      : stoneOptions;
    setForm({
      title: memo ? "Convert memo lines to sale" : "Create sale",
      intro:
        "Availability, ownership and reviewed wording are checked together before stock moves. Choose the invoice currency and record the rate into the workspace base currency.",
      submit: "Issue invoice",
      fields: [
        { ...customerField, value: memo ? str(memo, "customerId") : undefined },
        {
          key: "stoneIds",
          label: "Stones to sell",
          type: "multiple",
          value: JSON.stringify(one ? [one.id] : selected),
          options: choices,
        },
        {
          key: "price",
          label: "Sale price per selected stone",
          type: "decimal",
          value: one ? str(one, "price") : undefined,
          hint: "For different prices, issue the stones separately. Discounts above your limit require the owner.",
        },
        {
          key: "currency",
          label: "Invoice currency",
          value: str(w!.settings, "currency"),
        },
        {
          key: "exchangeRate",
          label: "Base-currency units per one invoice-currency unit",
          type: "decimal",
          value: "1",
        },
      ],
      onSubmit: async (v) => {
        const chosen = JSON.parse(v.stoneIds) as string[];
        const lines = chosen.map((id) => ({
          stoneId: id,
          version: stones.find((x) => x.id === id)?.version,
          price: v.price,
        }));
        const r = await execute(memo ? "memo-sale" : "sale", {
          customerId: v.customerId,
          lines,
          exchangeRate: v.exchangeRate,
          currency: v.currency,
          memoId: memo?.id,
        });
        setInvoice(r.result as Row);
      },
    });
  };
  const openMemo = () =>
    setForm({
      title: "Issue memo",
      intro:
        "Stones leave internal custody. Each line can later be sold or returned separately.",
      submit: "Issue memo",
      fields: [
        customerField,
        chooseStones,
        { key: "due", label: "Return due", type: "datetime-local" },
        { key: "terms", label: "Agreed terms", type: "textarea" },
        {
          key: "commissionRate",
          label: "Broker commission (%)",
          type: "decimal",
          value: "0",
        },
      ],
      onSubmit: async (v) => {
        const chosen = JSON.parse(v.stoneIds) as string[];
        await execute("memo", {
          ...v,
          stones: chosen.map((id) => ({
            id,
            version: stones.find((x) => x.id === id)?.version,
          })),
        });
      },
    });
  const openSelection = () =>
    setForm({
      title: "Share private selection",
      intro:
        "Only approved descriptions and buyer-safe fields are shared. The link expires after seven days. Sharing does not reserve stock.",
      submit: "Create private link",
      fields: [
        { key: "title", label: "Selection title" },
        customerField,
        chooseStones,
      ],
      onSubmit: async (v) => {
        await execute("selection", { ...v, stoneIds: JSON.parse(v.stoneIds) });
        go("Holds & selections");
      },
    });
  const stoneTable = (
    data: Row[],
    selectable = false,
    customEmpty?: string,
    preview = false,
  ) => (
    <Table
      data={data}
      variant={preview ? "stock-preview" : "stock"}
      empty={
        customEmpty ||
        (query
          ? "No stones match this search. Try another ID, variety or location."
          : "No stones in this view. Receive stock or change the status filter.")
      }
      columns={[
        ...(selectable
          ? [
              {
                label: "Select",
                render: (r: Row) => (
                  <input
                    type="checkbox"
                    aria-label={`Select ${r.id}`}
                    checked={selected.includes(str(r, "id"))}
                    onChange={(e) =>
                      setSelected((v) =>
                        e.target.checked
                          ? [...v, str(r, "id")]
                          : v.filter((id) => id !== r.id),
                      )
                    }
                  />
                ),
              },
            ]
          : []),
        {
          label: "Stone / Specification",
          mobile: "identity",
          render: (r) => (
            <button
              type="button"
              className="record-link stone-cell"
              onClick={() => setDetail(str(r, "id"))}
            >
              <GemThumbnail variety={str(r, "variety")} shape={str(r, "shape")} />
              <span className="stone-meta">
                <span className="stone-title">{str(r, "variety")}</span>
                <span className="stone-sub">
                  {str(r, "id")} · {str(r, "shape")}
                  {r.treatment ? ` · ${str(r, "treatment")}` : ""}
                </span>
              </span>
              <span className="stone-disclosure"><Mark name="chevron" /></span>
            </button>
          ),
        },
        {
          label: "Weight",
          render: (r) => (
            <span className="numeric font-medium">{str(r, "carats")} ct</span>
          ),
        },
        ...(can("Owner", "Sales staff")
          ? [
              {
                label: "List Price",
                mobile: preview ? "omit" as const : undefined,
                render: (r: Row) => (
                  <span className="numeric font-medium">
                    {r.price && str(r, "price") !== "0.00"
                      ? `$${str(r, "price")}`
                      : "Unpriced"}
                  </span>
                ),
              },
            ]
          : []),
        { label: "Status", render: (r) => <Badge value={r.state} /> },
        {
          label: "Location & Custody",
          mobile: preview ? "omit" : "full",
          render: (r) => (
            <div className="stone-meta">
              <span className="font-medium">{str(r, "location")}</span>
              <span className="stone-sub">{str(r, "custodian")}</span>
            </div>
          ),
        },
        { label: "Evidence", render: (r) => <Badge value={r.evidence} /> },
        {
          label: "Action",
          mobile: "omit",
          render: (r) => (
            <div className="action-cell">
              <button
                type="button"
                className="table-action-btn"
                onClick={() => setDetail(str(r, "id"))}
                title={`Inspect stone ${r.id}`}
              >
                <span>View</span>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>
            </div>
          ),
        },
      ]}
    />
  );
  const stoneGrid = (
    data: Row[],
    selectable = false,
    customEmpty?: string,
  ) => {
    if (!data.length) {
      return (
        <div className="empty">
          <p>
            {customEmpty ||
              (query
                ? "No stones match this search. Try another ID, variety or location."
                : "No stones in this view. Receive stock or change the status filter.")}
          </p>
        </div>
      );
    }
    return (
      <div className="stone-grid" role="region" aria-label="Gemstone grid">
        {data.map((r) => {
          const isSelected = selected.includes(str(r, "id"));
          return (
            <article
              key={str(r, "id")}
              className={`stone-card ${isSelected ? "selected" : ""}`}
              onClick={(e) => {
                const target = e.target as HTMLElement;
                if (target.closest("input, button")) return;
                setDetail(str(r, "id"));
              }}
            >
              <div className="stone-card-header">
                <div className="stone-card-badge-wrap">
                  <Badge value={r.state} />
                  <Badge value={r.evidence} />
                </div>
                {selectable && (
                  <input
                    type="checkbox"
                    aria-label={`Select ${r.id}`}
                    checked={isSelected}
                    onChange={(e) =>
                      setSelected((v) =>
                        e.target.checked
                          ? [...v, str(r, "id")]
                          : v.filter((id) => id !== r.id),
                      )
                    }
                    className="stone-card-checkbox"
                  />
                )}
              </div>
              <div className="stone-card-visual">
                <GemThumbnail
                  variety={str(r, "variety")}
                  shape={str(r, "shape")}
                />
              </div>
              <div className="stone-card-body">
                <h3 className="stone-card-title">{str(r, "variety")}</h3>
                <p className="stone-card-spec">
                  {str(r, "id")} · {str(r, "shape")}
                  {r.treatment ? ` · ${str(r, "treatment")}` : ""}
                </p>
                <div className="stone-card-metrics">
                  <div>
                    <span className="metric-label">Weight</span>
                    <strong className="metric-val">{str(r, "carats")} ct</strong>
                  </div>
                  {can("Owner", "Sales staff") && (
                    <div>
                      <span className="metric-label">List Price</span>
                      <strong className="metric-val">
                        {r.price && str(r, "price") !== "0.00"
                          ? `$${str(r, "price")}`
                          : "Unpriced"}
                      </strong>
                    </div>
                  )}
                </div>
                <div className="stone-card-custody">
                  <span className="custody-label">Location:</span>
                  <span className="custody-val">{str(r, "location")}</span>
                  {Boolean(r.custodian) && (
                    <span className="custodian-tag">({str(r, "custodian")})</span>
                  )}
                </div>
              </div>
              <div className="stone-card-footer">
                <button
                  type="button"
                  className="table-action-btn stone-card-view-btn"
                  onClick={() => setDetail(str(r, "id"))}
                  title={`Inspect stone ${r.id}`}
                >
                  <span>View Details</span>
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </button>
              </div>
            </article>
          );
        })}
      </div>
    );
  };
  if (buyerToken) return <Buyer token={buyerToken} />;
  if (boot)
    return (
      <div className="loading-page">
        <h1>Gem Management</h1>
        <p>Opening your workspace…</p>
      </div>
    );
  if (!user)
    return (
      <div className="auth-shell">
        <section className="auth-story">
          <GemLogo />
          <h1>Gem Management</h1>
          <p>Stock, custody, evidence, and settlement.</p>
          <div className="auth-note">
            Your records stay in this workspace.
            <br />
            Start with an empty stock book.
          </div>
        </section>
        <section className="auth-form">
          <h2>{setup ? "Create your workspace" : "Welcome back"}</h2>
          <p>
            {setup
              ? "Set up the owner account. No shared passwords or preview roles."
              : "Sign in with your assigned account."}
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const data = Object.fromEntries(new FormData(e.currentTarget));
              setError("");
              setRefreshing(true);
              try {
                const r = await request<{ user: User }>(
                  setup ? "/api/setup" : "/api/login",
                  { ...data, sandbox: data.sandbox === "on" },
                );
                setCsrf(r.user.csrf);
                setUser(r.user);
                setSetup(false);
                await refresh();
              } catch (err) {
                setError((err as Error).message);
              } finally {
                setRefreshing(false);
              }
            }}
          >
            {setup && (
              <>
                <label>
                  Your name
                  <input name="name" required autoComplete="name" />
                </label>
                <label>
                  Business name
                  <input
                    name="businessName"
                    required
                    autoComplete="organization"
                  />
                </label>
              </>
            )}
            <label>
              Email
              <input
                name="email"
                type="email"
                required
                autoComplete="username"
              />
            </label>
            <label>
              Password
              <PasswordInput
                name="password"
                aria-label="Password"
                required
                minLength={setup ? 12 : undefined}
                maxLength={128}
                autoComplete={setup ? "new-password" : "current-password"}
              />
            </label>
            {setup ? (
              <>
                <div className="form-grid">
                  <label>
                    Base currency
                    <select
                      name="currency"
                      aria-label="Base currency"
                      required
                      value={setupCurrency}
                      onChange={(e) => {
                        setSetupCurrency(e.target.value);
                        setSetupDecimals(
                          String(currencyDecimals(e.target.value)),
                        );
                      }}
                    >
                      <option value="" disabled>
                        Choose currency
                      </option>
                      {currencies.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Currency decimals
                    <select
                      name="minorUnits"
                      value={setupDecimals}
                      onChange={(e) => setSetupDecimals(e.target.value)}
                    >
                      <option>0</option>
                      <option>2</option>
                      <option>3</option>
                    </select>
                  </label>
                </div>
                <label>
                  Launch country
                  <select
                    name="country"
                    aria-label="Launch country"
                    required
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Choose country
                    </option>
                    {countries.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="check-label">
                  <input type="checkbox" name="sandbox" />
                  Use this workspace for training and demonstrations
                </label>
                <small>
                  Currency is fixed after setup to preserve ledger consistency.
                </small>
              </>
            ) : (
              <label>
                Authenticator code (if enabled)
                <input
                  name="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                />
              </label>
            )}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button className="primary wide" disabled={refreshing}>
              {refreshing ? "Opening…" : setup ? "Create workspace" : "Sign in"}
            </button>
          </form>
          {!setup && (
            <button
              className="text-button"
              onClick={() =>
                run(async () => {
                  const a = await request<{ setupRequired: boolean }>(
                    "/api/auth",
                  );
                  setSetup(a.setupRequired);
                }, "Connection checked.")
              }
            >
              Check connection
            </button>
          )}
        </section>
      </div>
    );
  if (!w)
    return (
      <div className="loading-page">
        <h1>Workspace unavailable</h1>
        <p role="alert">{error || "Loading your records…"}</p>
        <button onClick={() => refresh().catch(() => {})}>
          Retry connection
        </button>
      </div>
    );
  const visible = Object.keys(access).filter((p) =>
    access[p].includes(user.role),
  );
  const current = visible.includes(page) ? page : "Overview";
  const mobileTabs = [
    { page: "Overview", label: "Overview" },
    ...(visible.includes("Inventory") ? [{ page: "Inventory", label: "Stock" }] : []),
    ...(visible.includes("Evidence")
      ? [{ page: "Evidence", label: "Evidence" }]
      : visible.includes("Processing") ? [{ page: "Processing", label: "Processing" }] : []),
    ...(visible.includes("Payments") && !visible.includes("Inventory")
      ? [{ page: "Payments", label: "Payments" }] : []),
    ...(visible.includes("Sales") ? [{ page: "Sales", label: "Sales" }] : []),
  ];
  const activeMobilePage = ["Quotes", "Memos"].includes(current) ? "Sales" : current;
  const moreIsCurrent = !mobileTabs.some((tab) => tab.page === activeMobilePage);
  const pendingEvidence = stones.some((stone) => stone.evidence !== "Approved");
  const activeStockFilters = [
    status !== "All stock",
    varietyFilter !== "all",
    locationFilter !== "all",
    evidenceFilter !== "all",
    sortBy !== "default",
  ].filter(Boolean).length;
  const quotes = list(w, "quotes");
  const needsAttention = (stone: Row) =>
    ["Draft", "Returned", "Blocked"].includes(str(stone, "state")) ||
    stone.evidence !== "Approved";
  const attentionStones = stones.filter(needsAttention);
  const overdueMemos = list(w, "memos").filter(
    (memo) => Date.parse(str(memo, "due")) < Date.now() &&
      rows(memo.lines).some((line) => line.status === "Pending"),
  );
  const urgentCount = attentionStones.length + overdueMemos.length;
  const inventoryView = stones
    .filter(
      (r) =>
        (status === "All stock" || r.state === status) &&
        (varietyFilter === "all" || str(r, "variety") === varietyFilter) &&
        (locationFilter === "all" || str(r, "location") === locationFilter) &&
        (evidenceFilter === "all" || str(r, "evidence") === evidenceFilter) &&
        ["id", "variety", "location", "custodian", "color", "shape"].some((k) =>
          str(r, k).toLowerCase().includes(query.toLowerCase()),
        ),
    )
    .sort((a, b) => {
      if (sortBy === "weight-desc")
        return Number(b.carats || 0) - Number(a.carats || 0);
      if (sortBy === "weight-asc")
        return Number(a.carats || 0) - Number(b.carats || 0);
      if (sortBy === "price-desc")
        return Number(b.price || 0) - Number(a.price || 0);
      if (sortBy === "price-asc")
        return Number(a.price || 0) - Number(b.price || 0);
      return 0;
    });
  const PAGE_SIZE = 8;
  const totalPages = Math.max(1, Math.ceil(inventoryView.length / PAGE_SIZE));
  const currentPage = Math.min(inventoryPage, totalPages);
  const paginatedInventory = inventoryView.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  const stockStatusSummary = (
    <div className="status-summary">
      {STATES.filter((state) => state !== "In stock").map((state) => (
        <div key={state}>
          <span>{formatStatusWord(state)}</span>
          <strong>{stones.filter((stone) => stone.state === state).length}</strong>
        </div>
      ))}
    </div>
  );
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <div className="workspace">
        <aside className="sidebar">
          <div className="brand">
            <GemLogo />
            <div>
              <strong>GemVault</strong>
              <small>
                {w.settings.sandbox ? "Training workspace" : "Bitmo Precision Stock"}
              </small>
            </div>
          </div>
          <nav aria-label="Workspace">
            {NAV_GROUPS.map((group) => {
              const groupPages = group.pages.filter((p) => visible.includes(p));
              if (!groupPages.length) return null;
              const isCollapsed = Boolean(collapsedSections[group.title]);
              const sectionId = `nav-section-${group.title.toLowerCase().replace(/[^a-z]+/g, "-")}`;
              return (
                <div key={group.title} className="nav-section">
                  <button
                    type="button"
                    className="nav-section-toggle"
                    onClick={() => toggleSection(group.title)}
                    aria-expanded={!isCollapsed}
                    aria-controls={sectionId}
                    title={
                      isCollapsed
                        ? `Expand ${group.title}`
                        : `Minimize ${group.title}`
                    }
                  >
                    <span className="nav-section-title">{group.title}</span>
                    <span
                      className={`nav-section-chevron ${isCollapsed ? "collapsed" : ""}`}
                    >
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </span>
                  </button>
                  <div
                    id={sectionId}
                    className={`nav-section-body ${isCollapsed ? "collapsed" : ""}`}
                    inert={isCollapsed}
                  >
                    {groupPages.map((p) => (
                      <button
                        key={p}
                        aria-label={p}
                        aria-current={current === p ? "page" : undefined}
                        className={current === p ? "active" : ""}
                        onClick={() => go(p)}
                      >
                        <Mark name={p} />
                        <span>{p}</span>
                        {p === "Evidence" &&
                          stones.some((s) => s.evidence !== "Approved") && (
                            <span className="nav-count" aria-hidden="true">
                              {
                                stones.filter((s) => s.evidence !== "Approved")
                                  .length
                              }
                            </span>
                          )}
                        {p === "Quotes" &&
                          quotes.filter(
                            (q) => str(q, "status") === "Awaiting owner",
                          ).length > 0 && (
                            <span className="nav-count" aria-hidden="true">
                              {
                                quotes.filter(
                                  (q) => str(q, "status") === "Awaiting owner",
                                ).length
                              }
                            </span>
                          )}
                        {p === "Holds & selections" &&
                          stones.some((s) => s.state === "Held") && (
                            <span className="nav-count" aria-hidden="true">
                              {stones.filter((s) => s.state === "Held").length}
                            </span>
                          )}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </nav>
          <div className="account">
            <strong>{user.name}</strong>
            <small>{user.role}</small>
            <button
              className="text-button"
              onClick={() =>
                run(async () => {
                  await request("/api/logout", {});
                  setUser(null);
                  setAnswer("");
                  setAssistantError("");
                  setW(null);
                  setCsrf("");
                  localStorage.removeItem("gem-show-authority");
                  setShowAuthority(null);
                }, "Signed out.")
              }
            >
              Sign out
            </button>
          </div>
        </aside>
        <main id="main" tabIndex={-1}>
          <header className="toolbar">
            {mobileSearchOpen ? (
              <div className="mobile-search-active-bar">
                <Mark name="search" />
                <input
                  ref={globalSearchRef}
                  type="search"
                  enterKeyHint="search"
                  aria-label="Search stock"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setInventoryPage(1);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Escape" || e.key === "Enter") {
                      setFocusSearchTrigger(true);
                      setMobileSearchOpen(false);
                    }
                  }}
                  placeholder="Search stock"
                  className="mobile-search-input"
                />
                {query && (
                  <button
                    type="button"
                    className="search-clear-btn"
                    aria-label="Clear search"
                    onClick={() => {
                      setQuery("");
                      globalSearchRef.current?.focus();
                    }}
                  >
                    ✕
                  </button>
                )}
                <button
                  type="button"
                  className="text-button mobile-search-done-btn"
                  onClick={() => {
                    setFocusSearchTrigger(true);
                    setMobileSearchOpen(false);
                  }}
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <div className="mobile-toolbar-brand mobile-only">
                  <GemLogo />
                  <span className="mobile-toolbar-title">Gem Management</span>
                </div>

                <div className="toolbar-start desktop-only">
                  <div className="global-search-container">
                    <Mark name="search" />
                    <input
                      ref={globalSearchRef}
                      aria-label="Search records"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search stones, custody, certificates, customers..."
                      className="global-search-input"
                    />
                    {query && (
                      <button
                        type="button"
                        className="search-clear-btn"
                        aria-label="Clear search"
                        onClick={() => {
                          setQuery("");
                          globalSearchRef.current?.focus();
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                <div className="toolbar-end">
                  {visible.includes("Inventory") && (
                    <button
                      ref={stockSearchButton}
                      type="button"
                      className="icon-utility-btn mobile-only"
                      aria-label="Search stock"
                      onClick={() => {
                        go("Inventory");
                        setMobileSearchOpen(true);
                      }}
                    >
                      <Mark name="search" />
                    </button>
                  )}
                  <button
                    type="button"
                    className="icon-utility-btn desktop-only"
                    title="AI Assistant"
                    aria-label="AI Assistant"
                    onClick={() => go("Assistant")}
                  >
                    <Mark name="Assistant" />
                  </button>
                  <button
                    type="button"
                    className="icon-utility-btn"
                    title="Overview & Alerts"
                    aria-label={urgentCount ? `Needs attention: ${urgentCount} records` : "Needs attention"}
                    onClick={() => {
                      go("Overview");
                      if (current === "Overview") {
                        document.getElementById("workspace-attention")?.focus({ preventScroll: true });
                        document.getElementById("workspace-attention")?.scrollIntoView();
                      } else {
                        setFocusAttention(true);
                      }
                    }}
                  >
                    <Mark name="bell" />
                    {urgentCount > 0 && <span className="notification-dot" />}
                  </button>
                  <button
                    type="button"
                    className="icon-utility-btn desktop-only"
                    title={theme === "light" ? "Dark appearance" : "Light appearance"}
                    aria-label="Toggle theme"
                    onClick={() => setTheme(theme === "light" ? "dark" : "light")}
                  >
                    <Mark name={theme === "light" ? "moon" : "sun"} />
                  </button>
                  <button
                    type="button"
                    className="user-profile-pill"
                    onClick={() => setMenu(true)}
                    title={`${user.name} (${user.role})`}
                    aria-label={`Open workspaces and settings menu for ${user.name}`}
                  >
                    <div className="user-avatar">{user.name.slice(0, 2).toUpperCase()}</div>
                    <div className="user-info desktop-only">
                      <span className="user-name">{user.name}</span>
                      <span className="user-role">{user.role}</span>
                    </div>
                  </button>
                </div>
              </>
            )}
          </header>
          <div className="page-content">
            {w.settings.sandbox === true && (
              <div className="training-note">
                Training workspace. Use sample records when presenting; these
                are not live business transactions.
              </div>
            )}
            {!online && (
              <div className="info-note">
                You are offline. Use Show mode only if this device has a
                downloaded stock assignment. Other actions require a connection.
              </div>
            )}
            {error && (
              <div className="error" role="alert">
                {error}
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setError("")}
                >
                  Dismiss
                </button>
              </div>
            )}
            {notice && (
              <div className="toast" role="status">
                {notice}
              </div>
            )}
            <div className="page-heading">
              <div>
                <h1>{current}</h1>
                <p>{descriptions[current]}</p>
              </div>
              <div className="actions">
                {["Overview", "Inventory"].includes(current) &&
                  can("Inventory clerk") && (
                    <button
                      type="button"
                      className="primary"
                      onClick={openReceive}
                    >
                      <Mark name="plus" />
                      Receive stock
                    </button>
                  )}
                {current === "Customers" && can("Sales staff", "Accounts") && (
                  <button
                    type="button"
                    className="primary"
                    onClick={openCustomer}
                  >
                    Add customer
                  </button>
                )}
                {current === "Processing" && can("Cutter / lab liaison") && (
                  <button
                    type="button"
                    className="primary"
                    onClick={() =>
                      setForm({
                        title: "Issue stone to lab or cutter",
                        intro:
                          "Select an available stone to issue for cutting or lab certification. The stone becomes unsellable while away.",
                        submit: "Issue stone",
                        fields: [
                          {
                            key: "stoneId",
                            label: "Select stone",
                            options: stones
                              .filter((s) =>
                                ["Draft", "In stock"].includes(str(s, "state")),
                              )
                              .map((s) => ({
                                value: str(s, "id"),
                                label: `${s.id} · ${s.variety} (${s.carats} ct) · ${s.state}`,
                              })),
                          },
                          {
                            key: "type",
                            label: "Work type",
                            options: ["Laboratory", "Cutting"].map((v) => ({
                              value: v,
                              label: v,
                            })),
                            value: "Laboratory",
                          },
                          { key: "custodian", label: "Receiving lab / cutter" },
                          {
                            key: "instructions",
                            label: "Instructions",
                            type: "textarea",
                          },
                        ],
                        onSubmit: async (v) => {
                          const target = stones.find((s) => s.id === v.stoneId);
                          if (!target)
                            throw new Error("Select a stone to issue.");
                          await execute("process-issue", {
                            id: target.id,
                            version: target.version,
                            type: v.type,
                            custodian: v.custodian,
                            instructions: v.instructions,
                          });
                        },
                      })
                    }
                  >
                    <Mark name="plus" />
                    <span>Issue for processing</span>
                  </button>
                )}
                {current === "Quotes" && can("Sales staff") && (
                  <button
                    className="primary"
                    onClick={() =>
                      setForm({
                        title: "Prepare quote",
                        intro:
                          "A quote does not reserve stock. Discounts above your limit wait for owner approval.",
                        submit: "Save quote",
                        fields: [
                          customerField,
                          chooseStones,
                          {
                            key: "price",
                            label: "Price per selected stone",
                            type: "decimal",
                          },
                          {
                            key: "days",
                            label: "Valid for (days)",
                            value: "7",
                            type: "number",
                          },
                        ],
                        onSubmit: async (v) => {
                          await execute("quote", {
                            customerId: v.customerId,
                            days: v.days,
                            lines: (JSON.parse(v.stoneIds) as string[]).map(
                              (stoneId) => ({ stoneId, price: v.price }),
                            ),
                          });
                        },
                      })
                    }
                  >
                    Prepare quote
                  </button>
                )}
                {current === "Sales" && can("Sales staff") && (
                  <button
                    type="button"
                    className="primary"
                    onClick={() => openSale()}
                  >
                    Create sale
                  </button>
                )}
                {current === "Memos" && can("Sales staff") && (
                  <button
                    type="button"
                    className="primary"
                    onClick={openMemo}
                  >
                    Issue memo
                  </button>
                )}
                {current === "Holds & selections" && (
                  <button
                    type="button"
                    className="primary"
                    onClick={openSelection}
                  >
                    Create selection
                  </button>
                )}
              </div>
            </div>
            {current === "Overview" && (
              <>
                <section className="overview-lead">
                  <div>
                    <span className="muted">Available stock</span>
                    <div className="stock-number">
                      {
                        stones.filter(
                          (s) =>
                            s.state === "In stock" &&
                            !s.showId &&
                            s.evidence === "Approved" &&
                            s.internal &&
                            s.ownershipConfirmed,
                        ).length
                      }
                      <span>stones & parcels</span>
                    </div>
                    <p>Reviewed, internally held, and authorized for sale.</p>
                    {visible.includes("Inventory") && (
                      <button className="text-button desktop-only" onClick={() => go("Inventory")}>
                        Open stock book
                      </button>
                    )}
                  </div>
                  <div className="desktop-only">{stockStatusSummary}</div>
                  <details className="custody-disclosure mobile-only">
                    <summary>Custody breakdown</summary>
                    {stockStatusSummary}
                  </details>
                </section>
                <section className="panel recent-stock">
                  <div className="section-heading">
                    <h2>Recent stock</h2>
                    {visible.includes("Inventory") && (
                      <button className="text-button" onClick={() => go("Inventory")}>
                        All stock <Mark name="chevron" />
                      </button>
                    )}
                  </div>
                  {stoneTable(stones.slice(0, 5), false, undefined, true)}
                </section>
                <section
                  className="work-list"
                  id="workspace-attention"
                  tabIndex={-1}
                  aria-labelledby="attention-heading"
                >
                  <h2 id="attention-heading">Needs attention</h2>
                  {attentionStones.slice(0, 6)
                    .map((s) => (
                      <button
                        key={str(s, "id")}
                        onClick={() => {
                          go(
                            access.Inventory.includes(user.role)
                              ? "Inventory"
                              : "Walkthrough",
                          );
                          setDetail(str(s, "id"));
                        }}
                      >
                        <span>
                          <strong>{str(s, "variety")}</strong>
                          <small>
                            {str(s, "id")} · {str(s, "location")}
                          </small>
                        </span>
                        <Badge
                          value={
                            s.evidence !== "Approved" ? s.evidence : s.state
                          }
                        />
                      </button>
                    ))}
                  {!attentionStones.length && !overdueMemos.length && (
                    <p className="muted">
                      No stock waiting for intake or evidence review.
                    </p>
                  )}
                  {overdueMemos.map((m) => (
                      <button key={str(m, "id")} onClick={() => go("Memos")}>
                        <span>
                          <strong>{str(m, "id")} overdue</strong>
                          <small>
                            {str(m, "customerName")} · {date(m.due)}
                          </small>
                        </span>
                        <Badge value="Overdue" />
                      </button>
                    ))}
                </section>
              </>
            )}
            {current === "Inventory" && (
              <>
                {/* Mobile Touch Navigation Pills & Quick Controls */}
                <div className="mobile-inventory-header mobile-only">
                  <div className="mobile-category-pill-bar">
                    {[
                      { label: "All stock", count: stones.length },
                      {
                        label: "In stock",
                        count: stones.filter((s) => s.state === "In stock").length,
                      },
                      {
                        label: "On memo",
                        count: stones.filter((s) => s.state === "On memo").length,
                      },
                      {
                        label: "With lab or cutter",
                        count: stones.filter(
                          (s) => s.state === "With lab or cutter",
                        ).length,
                      },
                      {
                        label: "Held",
                        count: stones.filter((s) => s.state === "Held").length,
                      },
                      {
                        label: "Sold",
                        count: stones.filter((s) => s.state === "Sold").length,
                      },
                    ].map((pill) => (
                      <button
                        key={pill.label}
                        type="button"
                        className={`category-pill ${status === pill.label ? "active" : ""}`}
                        aria-pressed={status === pill.label}
                        onClick={() => {
                          setStatus(pill.label);
                          setInventoryPage(1);
                        }}
                      >
                        <span>{formatStatusWord(pill.label)}</span>
                        <span className="pill-count">{pill.count}</span>
                      </button>
                    ))}
                  </div>
                  <div className="mobile-inventory-subbar">
                    <div className="view-toggle-group">
                      <button
                        type="button"
                        className={`view-toggle-btn ${viewMode === "grid" ? "active" : ""}`}
                        onClick={() => setViewMode("grid")}
                        title="Cards"
                        aria-label="Cards"
                        aria-pressed={viewMode === "grid"}
                      >
                        <Mark name="grid" /> Cards
                      </button>
                      <button
                        type="button"
                        className={`view-toggle-btn ${viewMode === "table" ? "active" : ""}`}
                        onClick={() => setViewMode("table")}
                        title="List"
                        aria-label="List"
                        aria-pressed={viewMode === "table"}
                      >
                        <Mark name="list" /> List
                      </button>
                    </div>
                    <button
                      type="button"
                      className={`secondary filter-toggle-pill${activeStockFilters ? " active-filter" : ""}`}
                      onClick={() => setFilterSheetOpen(true)}
                      aria-haspopup="dialog"
                      aria-description={activeStockFilters ? `${activeStockFilters} active` : undefined}
                    >
                      <Mark name="filter" />
                      Filters {activeStockFilters ? `(${activeStockFilters})` : ""}
                    </button>
                  </div>
                </div>

                {query && (
                  <div className="stock-search-summary mobile-only">
                    <span>Search: <strong>{query}</strong></span>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => {
                        setQuery("");
                        setInventoryPage(1);
                      }}
                    >
                      Clear
                    </button>
                  </div>
                )}
                <section className="panel">
                  {/* Top Card Action Bar matching the reference UI (Desktop Only) */}
                  <div className="card-action-bar desktop-only">
                    <div className="card-actions-left">
                      <div className="view-toggle-group">
                        <button
                          className={`view-toggle-btn ${viewMode === "table" ? "active" : ""}`}
                          onClick={() => setViewMode("table")}
                          title="Table view"
                          aria-label="Table view"
                        >
                          <Mark name="table" />
                        </button>
                        <button
                          className={`view-toggle-btn ${viewMode === "grid" ? "active" : ""}`}
                          onClick={() => setViewMode("grid")}
                          title="Grid view"
                          aria-label="Grid view"
                        >
                          <Mark name="grid" />
                        </button>
                      </div>

                      <div className="card-search-box">
                        <Mark name="search" />
                        <input
                          aria-label="Search inventory"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          placeholder="Search variety, ID, safe or custodian..."
                        />
                      </div>
                    </div>

                    <div className="card-actions-right">
                      <select
                        className="select-pill"
                        value={sortBy}
                        onChange={(e) => {
                          setSortBy(e.target.value);
                          setInventoryPage(1);
                        }}
                        aria-label="Sort by"
                      >
                        <option value="default">Sort by: Default</option>
                        <option value="weight-desc">Weight: High to Low</option>
                        <option value="weight-asc">Weight: Low to High</option>
                        <option value="price-desc">Price: High to Low</option>
                        <option value="price-asc">Price: Low to High</option>
                      </select>

                      {can("Inventory clerk") && (
                        <button className="primary" onClick={openReceive}>
                          <Mark name="plus" />
                          <span>Receive Stock</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Refined Domain-Specific Filter Bar (Desktop Only) */}
                  <div className="inventory-filters-bar desktop-only">
                    <div className="filter-group">
                      <label htmlFor="filter-variety" className="filter-label">
                        Gem Variety & Species
                      </label>
                      <select
                        id="filter-variety"
                        className="filter-select"
                        value={varietyFilter}
                        onChange={(e) => {
                          setVarietyFilter(e.target.value);
                          setInventoryPage(1);
                        }}
                      >
                        <option value="all">All Varieties ({stones.length})</option>
                        {[...new Set(stones.map((s) => str(s, "variety")))].map(
                          (v: string) => (
                            <option key={v} value={v}>
                              {v}
                            </option>
                          ),
                        )}
                      </select>
                    </div>

                    <div className="filter-group">
                      <label htmlFor="filter-status" className="filter-label">
                        Vault Custody Status
                      </label>
                      <select
                        id="filter-status"
                        className="filter-select"
                        value={status}
                        onChange={(e) => {
                          setStatus(e.target.value);
                          setInventoryPage(1);
                        }}
                      >
                        <option>All stock</option>
                        {STATES.map((v) => (
                          <option key={v}>{v}</option>
                        ))}
                      </select>
                    </div>

                    <div className="filter-group">
                      <label htmlFor="filter-location" className="filter-label">
                        Vault Safe & Location
                      </label>
                      <select
                        id="filter-location"
                        className="filter-select"
                        value={locationFilter}
                        onChange={(e) => {
                          setLocationFilter(e.target.value);
                          setInventoryPage(1);
                        }}
                      >
                        <option value="all">All Safe Locations</option>
                        {[...new Set(stones.map((s) => str(s, "location")))].map(
                          (loc: string) => (
                            <option key={loc} value={loc}>
                              {loc}
                            </option>
                          ),
                        )}
                      </select>
                    </div>

                    <div className="filter-group">
                      <label htmlFor="filter-evidence" className="filter-label">
                        Laboratory Evidence
                      </label>
                      <select
                        id="filter-evidence"
                        className="filter-select"
                        value={evidenceFilter}
                        onChange={(e) => {
                          setEvidenceFilter(e.target.value);
                          setInventoryPage(1);
                        }}
                      >
                        <option value="all">All Evidence States</option>
                        <option value="Approved">Approved (Verified)</option>
                        <option value="Review needed">Review needed</option>
                        <option value="Conflict">Conflict</option>
                      </select>
                    </div>

                    {(varietyFilter !== "all" ||
                      status !== "All stock" ||
                      locationFilter !== "all" ||
                      evidenceFilter !== "all" ||
                      query) && (
                      <button
                        type="button"
                        className="text-button reset-filter-btn"
                        onClick={() => {
                          setVarietyFilter("all");
                          setStatus("All stock");
                          setLocationFilter("all");
                          setEvidenceFilter("all");
                          setQuery("");
                          setInventoryPage(1);
                        }}
                      >
                        Clear filters
                      </button>
                    )}
                  </div>

                  {/* Selected Action Bar */}
                  {selected.length > 0 && (
                    <div className="selection-bar">
                      <strong role="status">{selected.length} {selected.length === 1 ? "stone" : "stones"} selected</strong>
                      {can("Sales staff") && (
                        <>
                          <button
                            type="button"
                            className="secondary"
                            onClick={openSelection}
                          >
                            Share selection
                          </button>
                          <button
                            type="button"
                            className="secondary"
                            onClick={openMemo}
                          >
                            Issue memo
                          </button>
                          <button
                            type="button"
                            className="secondary"
                            onClick={() => openSale()}
                          >
                            Create sale
                          </button>
                        </>
                      )}
                      {!can("Sales staff") && (
                        <span className="selection-hint">
                          Sales actions require Sales staff role
                        </span>
                      )}
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => setSelected([])}
                      >
                        Clear selection
                      </button>
                    </div>
                  )}

                  {/* The Paginated Stone Table or Grid (fixes F-01) */}
                  {viewMode === "grid"
                    ? stoneGrid(paginatedInventory, true)
                    : stoneTable(paginatedInventory, true)}

                  {/* Fully Functional Reactive Pagination Bar (fixes F-02) */}
                  <div className="pagination-bar">
                    <div className="pagination-info">
                      Showing{" "}
                      <strong>
                        {inventoryView.length === 0
                          ? 0
                          : (currentPage - 1) * PAGE_SIZE + 1}
                      </strong>
                      {" to "}
                      <strong>
                        {Math.min(currentPage * PAGE_SIZE, inventoryView.length)}
                      </strong>
                      {" of "}
                      <strong>{inventoryView.length}</strong> stones
                    </div>
                    <div className="pagination-controls">
                      <button
                        type="button"
                        className="page-btn nav-btn"
                        aria-label="Previous page"
                        disabled={currentPage <= 1}
                        onClick={() =>
                          setInventoryPage((p) => Math.max(1, p - 1))
                        }
                      >
                        ‹
                      </button>
                      {totalPages <= 7 ? (
                        Array.from({ length: totalPages }, (_, i) => i + 1).map(
                          (num) => (
                            <button
                              type="button"
                              key={num}
                              className={`page-btn ${num === currentPage ? "active" : ""}`}
                              aria-label={`Page ${num}`}
                              aria-current={
                                num === currentPage ? "page" : undefined
                              }
                              onClick={() => setInventoryPage(num)}
                            >
                              {num}
                            </button>
                          ),
                        )
                      ) : (
                        <>
                          <button
                            type="button"
                            className={`page-btn ${currentPage === 1 ? "active" : ""}`}
                            aria-label="Page 1"
                            aria-current={currentPage === 1 ? "page" : undefined}
                            onClick={() => setInventoryPage(1)}
                          >
                            1
                          </button>
                          {currentPage > 3 && (
                            <span className="pagination-ellipsis">…</span>
                          )}
                          {Array.from({ length: totalPages }, (_, i) => i + 1)
                            .filter(
                              (num) =>
                                num !== 1 &&
                                num !== totalPages &&
                                Math.abs(num - currentPage) <= 1,
                            )
                            .map((num) => (
                              <button
                                type="button"
                                key={num}
                                className={`page-btn ${num === currentPage ? "active" : ""}`}
                                aria-label={`Page ${num}`}
                                aria-current={
                                  num === currentPage ? "page" : undefined
                                }
                                onClick={() => setInventoryPage(num)}
                              >
                                {num}
                              </button>
                            ))}
                          {currentPage < totalPages - 2 && (
                            <span className="pagination-ellipsis">…</span>
                          )}
                          <button
                            type="button"
                            className={`page-btn ${currentPage === totalPages ? "active" : ""}`}
                            aria-label={`Page ${totalPages}`}
                            aria-current={
                              currentPage === totalPages ? "page" : undefined
                            }
                            onClick={() => setInventoryPage(totalPages)}
                          >
                            {totalPages}
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        className="page-btn nav-btn"
                        aria-label="Next page"
                        disabled={currentPage >= totalPages}
                        onClick={() =>
                          setInventoryPage((p) => Math.min(totalPages, p + 1))
                        }
                      >
                        ›
                      </button>
                    </div>
                  </div>
                </section>
              </>
            )}
            {current === "Evidence" && (
              <>
                <div className="section-note">
                  Clerk: preserve the original and record the claim. Reviewer:
                  compare versions, resolve conflicts and approve buyer wording.
                </div>
                <h2 className="section-title">Awaiting Verification & Review</h2>
                {stoneTable(
                  stones.filter((s) => s.evidence !== "Approved"),
                  false,
                  "All stone evidence is currently approved. No certificates or disclosures are waiting for lab liaison or reviewer sign-off.",
                )}
                <h2 className="section-title">Verified Laboratory Certificates</h2>
                {stoneTable(
                  stones.filter((s) => s.evidence === "Approved"),
                  false,
                  "No verified certificates recorded yet. Receive stock and attach certificate documents to establish provenance.",
                )}
              </>
            )}
            {current === "Processing" && (
              <>
                <Table
                  data={list(w, "jobs")}
                  empty="No processing jobs. Open a stone record to issue it to a laboratory or cutter."
                  columns={[
                    {
                      label: "Job / stone",
                      render: (j) => (
                        <button
                          className="record-link"
                          onClick={() => setDetail(str(j, "stoneId"))}
                        >
                          <strong>{str(j, "id")}</strong>
                          <small>
                            {str(j, "stoneId")} · {str(j, "type")}
                          </small>
                        </button>
                      ),
                    },
                    { label: "Custodian", render: (j) => str(j, "custodian") },
                    {
                      label: "Issue / return",
                      render: (j) => (
                        <>
                          {str(j, "preWeight")} ct
                          <small>
                            {j.postWeight
                              ? `${j.postWeight} ct returned · ${j.loss} ct loss`
                              : "Awaiting return"}
                          </small>
                        </>
                      ),
                    },
                    {
                      label: "Status",
                      render: (j) => <Badge value={j.status} />,
                    },
                    {
                      label: "Action",
                      render: (j) =>
                        j.status === "Issued" && can("Cutter / lab liaison") ? (
                          <button
                            className="secondary compact"
                            onClick={() =>
                              setForm({
                                title: "Receive from processing",
                                intro:
                                  "Returned weight plus loss must equal the issued weight. Disclosure requires another review after processing.",
                                submit: "Record return",
                                fields: [
                                  {
                                    key: "postWeight",
                                    label: "Return weight (ct)",
                                    type: "decimal",
                                  },
                                  {
                                    key: "loss",
                                    label: "Recorded loss (ct)",
                                    value: "0",
                                    type: "decimal",
                                  },
                                  {
                                    key: "charges",
                                    label: "Processing charge",
                                    type: "decimal",
                                    value: "0",
                                  },
                                  {
                                    key: "location",
                                    label: "Internal return location",
                                  },
                                ],
                                onSubmit: async (v) => {
                                  await execute("process-return", {
                                    ...v,
                                    jobId: j.id,
                                    version: stones.find(
                                      (s) => s.id === j.stoneId,
                                    )?.version,
                                  });
                                },
                              })
                            }
                          >
                            Record return
                          </button>
                        ) : (
                          <span className="muted">
                            {j.yield ? `${j.yield}% yield` : "Issued"}
                          </span>
                        ),
                    },
                  ]}
                />
              </>
            )}
            {current === "Holds & selections" && (
              <>
                <h2>Active holds</h2>
                {stoneTable(stones.filter((s) => s.state === "Held"))}
                <div className="section-heading">
                  <h2>Private selections</h2>
                  <span className="muted">Links expire after seven days</span>
                </div>
                <Table
                  data={list(w, "selections")}
                  empty="No private selections. Create a selection from reviewed stock."
                  columns={[
                    {
                      label: "Selection",
                      render: (r) => <strong>{str(r, "title")}</strong>,
                    },
                    {
                      label: "Customer",
                      render: (r) => str(r, "customerName"),
                    },
                    { label: "Expires", render: (r) => date(r.expires) },
                    {
                      label: "Buyer response",
                      render: (r) =>
                        rows(r.decisions).length
                          ? str(rows(r.decisions).at(-1) || {}, "decision")
                          : "No response yet",
                    },
                    {
                      label: "Link",
                      render: (r) => (
                        <a
                          href={`/buyer/${r.token}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open buyer view
                        </a>
                      ),
                    },
                  ]}
                />
              </>
            )}
            {current === "Memos" && (
              <>
                {!customers.length && can("Sales staff") && (
                  <div className="info-note">
                    Add a customer before issuing a memo.{" "}
                    <button className="text-button" onClick={openCustomer}>
                      Add customer
                    </button>
                  </div>
                )}
                {!list(w, "memos").length && (
                  <div className="empty">
                    No outgoing memos. Issue reviewed stock to a customer to
                    start tracking due dates and per-line outcomes.
                  </div>
                )}
                {list(w, "memos").map((m) => (
                  <section className="panel memo-section" key={str(m, "id")}>
                    <div className="section-heading">
                      <div>
                        <h2>
                          {str(m, "id")} · {str(m, "customerName")}
                        </h2>
                        <p>
                          Due {date(m.due)} · {str(m, "terms")}
                        </p>
                      </div>
                      {Date.parse(str(m, "due")) < Date.now() &&
                        rows(m.lines).some((l) => l.status === "Pending") && (
                          <Badge value="Overdue" />
                        )}
                      {can("Sales staff") &&
                        rows(m.lines).some((l) => l.status === "Pending") && (
                          <button
                            className="secondary"
                            onClick={() => openSale(m)}
                          >
                            Sell approved lines
                          </button>
                        )}
                    </div>
                    <Table
                      data={rows(m.lines)}
                      columns={[
                        {
                          label: "Stone",
                          render: (l) => (
                            <button
                              className="record-link"
                              onClick={() => setDetail(str(l, "stoneId"))}
                            >
                              {str(l, "stoneId")}
                            </button>
                          ),
                        },
                        {
                          label: "Outcome",
                          render: (l) => <Badge value={l.status} />,
                        },
                        {
                          label: "Return condition",
                          render: (l) => str(l, "condition") || "Not returned",
                        },
                        {
                          label: "Action",
                          render: (l) =>
                            l.status === "Pending" && can("Inventory clerk") ? (
                              <button
                                className="secondary compact"
                                onClick={() =>
                                  setForm({
                                    title: "Inspect memo return",
                                    submit: "Receive return",
                                    fields: [
                                      {
                                        key: "condition",
                                        label: "Condition inspection",
                                        type: "textarea",
                                      },
                                      {
                                        key: "location",
                                        label: "Internal location",
                                      },
                                    ],
                                    onSubmit: async (v) => {
                                      await execute("return-memo", {
                                        ...v,
                                        memoId: m.id,
                                        id: l.stoneId,
                                        version: stones.find(
                                          (s) => s.id === l.stoneId,
                                        )?.version,
                                      });
                                    },
                                  })
                                }
                              >
                                Receive return
                              </button>
                            ) : (
                              str(l, "invoiceId")
                            ),
                        },
                      ]}
                    />
                  </section>
                ))}
              </>
            )}
            {current === "Quotes" && (
              <Table
                data={list(w, "quotes")}
                empty="No quotes yet. Prepare an offer from available reviewed stones."
                columns={[
                  {
                    label: "Quote",
                    render: (q) => (
                      <>
                        <strong>{str(q, "id")}</strong>
                        <small>{str(q, "customerName")}</small>
                      </>
                    ),
                  },
                  {
                    label: "Offer",
                    render: (q) => (
                      <>
                        {moneyValue(q.total)}
                        <small>
                          {rows(q.lines)
                            .map((l) => str(l, "stoneId"))
                            .join(", ")}
                        </small>
                      </>
                    ),
                  },
                  { label: "Valid until", render: (q) => date(q.expires) },
                  {
                    label: "Status",
                    render: (q) => <Badge value={q.status} />,
                  },
                  {
                    label: "Action",
                    render: (q) =>
                      q.status === "Awaiting owner" ? (
                        can() ? (
                          <button
                            className="secondary compact"
                            onClick={() =>
                              run(() => execute("approve-quote", { id: q.id }))
                            }
                          >
                            Approve discount
                          </button>
                        ) : (
                          "Owner approval needed"
                        )
                      ) : q.status === "Converted" ? (
                        str(q, "invoiceId")
                      ) : can("Sales staff") ? (
                        <button
                          className="secondary compact"
                          onClick={() =>
                            run(() => execute("convert-quote", { id: q.id }))
                          }
                        >
                          Convert to invoice
                        </button>
                      ) : (
                        "Sales can convert"
                      ),
                  },
                ]}
              />
            )}
            {current === "Purchasing" && (
              <Purchasing
                workspace={w}
                role={user.role}
                open={setForm}
                execute={execute}
              />
            )}
            {current === "Customers" && (
              <>
                <div
                  className="card-action-bar"
                  style={{
                    borderRadius: "8px 8px 0 0",
                    borderBottom: "1px solid var(--line)",
                    marginBottom: 0,
                  }}
                >
                  <div className="card-search-box" style={{ maxWidth: 360 }}>
                    <Mark name="search" />
                    <input
                      aria-label="Search customers"
                      value={customerQuery}
                      onChange={(e) => setCustomerQuery(e.target.value)}
                      placeholder="Search customer by name, email or ID..."
                    />
                  </div>
                </div>
                <Table
                  data={customers.filter((c) => {
                    const q = customerQuery.toLowerCase();
                    return (
                      str(c, "name").toLowerCase().includes(q) ||
                      str(c, "email").toLowerCase().includes(q) ||
                      str(c, "id").toLowerCase().includes(q)
                    );
                  })}
                  empty={
                    customerQuery
                      ? "No customers match this search. Try another name, email or ID."
                      : "No customers yet. Add your first customer to create selections, memos and invoices."
                  }
                  columns={[
                    {
                      label: "Customer",
                      render: (c) => (
                        <>
                          <strong>{str(c, "name")}</strong>
                          <small>{str(c, "id")}</small>
                        </>
                      ),
                    },
                    {
                      label: "Contact",
                      render: (c) => (
                        <>
                          {str(c, "email") || "No email"}
                          <small>{str(c, "phone")}</small>
                        </>
                      ),
                    },
                    { label: "Notes", render: (c) => str(c, "notes") },
                    {
                      label: "Invoices",
                      render: (c) =>
                        list(w, "invoices").filter((i) => i.customerId === c.id)
                          .length,
                    },
                  ]}
                />
              </>
            )}
            {current === "Sales" && (
              <>
                <Table
                  data={list(w, "invoices")}
                  empty="No invoices. Create a sale from available, reviewed stock or convert pending memo lines."
                  columns={[
                    {
                      label: "Invoice",
                      render: (i) => (
                        <button
                          className="record-link"
                          onClick={() => setInvoice(i)}
                        >
                          <strong>{str(i, "id")}</strong>
                          <small>{date(i.createdAt)}</small>
                        </button>
                      ),
                    },
                    {
                      label: "Customer",
                      render: (i) => str(i, "customerName"),
                    },
                    { label: "Lines", render: (i) => rows(i.lines).length },
                    {
                      label: "Total",
                      render: (i) =>
                        i.total
                          ? moneyValue(i.total, str(i, "currency"))
                          : "Restricted",
                    },
                    {
                      label: "Outstanding",
                      render: (i) =>
                        i.balance
                          ? moneyValue(i.balance, str(i, "currency"))
                          : "Restricted",
                    },
                    {
                      label: "Document",
                      render: (i) =>
                        can("Sales staff", "Accounts") ? (
                          <a href={`/api/invoices/${i.id}/pdf`}>
                            Download invoice
                          </a>
                        ) : (
                          "Return inspection only"
                        ),
                    },
                  ]}
                />
                {can("Accounts") &&
                  list(w, "creditRequests").filter(
                    (r) => r.status === "Awaiting accounts",
                  ).length > 0 && (
                    <section className="panel section-gap">
                      <h2>Credits awaiting accounts</h2>
                      <Table
                        data={list(w, "creditRequests").filter(
                          (r) => r.status === "Awaiting accounts",
                        )}
                        columns={[
                          {
                            label: "Invoice / stone",
                            render: (r) => (
                              <>
                                {str(r, "invoiceId")}
                                <small>{str(r, "stoneId")}</small>
                              </>
                            ),
                          },
                          {
                            label: "Credit",
                            render: (r) => moneyValue(r.amount),
                          },
                          {
                            label: "Action",
                            render: (r) => (
                              <button
                                className="secondary"
                                onClick={() =>
                                  run(() => execute("credit", { id: r.id }))
                                }
                              >
                                Issue credit
                              </button>
                            ),
                          },
                        ]}
                      />
                    </section>
                  )}
              </>
            )}
            {current === "Payments" && (
              <>
                <div className="actions section-gap">
                  <button
                    className="primary"
                    onClick={() =>
                      setForm({
                        title: "Allocate payment",
                        intro:
                          "This records a receipt you have verified. It does not charge a card or move funds.",
                        submit: "Record payment",
                        fields: [
                          customerField,
                          {
                            key: "invoiceId",
                            label: "Invoice",
                            options: list(w, "invoices")
                              .filter((i) => Number(i.balance) > 0)
                              .map((i) => ({
                                value: str(i, "id"),
                                label: `${i.id} · ${i.customerName} · ${i.balance} outstanding`,
                              })),
                          },
                          {
                            key: "amount",
                            label: "Amount received",
                            type: "decimal",
                          },
                          {
                            key: "reference",
                            label: "Bank or receipt reference",
                          },
                          {
                            key: "method",
                            label: "Payment method",
                            options: [
                              "Bank transfer",
                              "Cash",
                              "Other verified receipt",
                            ].map((v) => ({ value: v, label: v })),
                            value: "Bank transfer",
                          },
                          {
                            key: "exchangeRate",
                            label: "Exchange-rate snapshot",
                            type: "decimal",
                            value: "1",
                          },
                        ],
                        onSubmit: async (v) => {
                          await execute("payment", {
                            ...v,
                            allocations: [
                              { invoiceId: v.invoiceId, amount: v.amount },
                            ],
                          });
                        },
                      })
                    }
                  >
                    Record payment
                  </button>
                  <button
                    className="secondary"
                    onClick={() =>
                      setForm({
                        title: "Record expense",
                        submit: "Record expense",
                        fields: [
                          { key: "description", label: "Description" },
                          {
                            key: "category",
                            label: "Category",
                            value: "Operating",
                          },
                          { key: "amount", label: "Amount", type: "decimal" },
                        ],
                        onSubmit: async (v) => {
                          await execute("expense", v);
                        },
                      })
                    }
                  >
                    Record expense
                  </button>
                  <button
                    className="secondary"
                    onClick={() =>
                      setForm({
                        title: "Record settlement",
                        intro:
                          "Settle a fully paid invoice with a broker or shared owner. This records a verified payment; it does not transfer funds.",
                        submit: "Record settlement",
                        fields: [
                          {
                            key: "invoiceId",
                            label: "Paid invoice",
                            options: list(w, "invoices")
                              .filter((i) => Number(i.balance) <= 0)
                              .map((i) => ({
                                value: str(i, "id"),
                                label: `${i.id} · ${i.customerName}`,
                              })),
                          },
                          {
                            key: "type",
                            label: "Recipient type",
                            options: ["Broker", "Shared owner"].map((v) => ({
                              value: v,
                              label: v,
                            })),
                            value: "Broker",
                          },
                          { key: "recipient", label: "Recipient" },
                          { key: "amount", label: "Amount", type: "decimal" },
                          { key: "reference", label: "Payment reference" },
                        ],
                        onSubmit: async (v) => {
                          await execute("settlement", v);
                        },
                      })
                    }
                  >
                    Settle broker / owner
                  </button>
                </div>
                <button
                  className="secondary"
                  onClick={() =>
                    setForm({
                      title: "Record customer refund",
                      intro:
                        "Record a verified refund against an issued credit. This does not send money.",
                      submit: "Record refund",
                      fields: [
                        {
                          key: "invoiceId",
                          label: "Invoice with customer credit",
                          options: list(w, "invoices")
                            .filter((i) => Number(i.balance) < 0)
                            .map((i) => ({
                              value: str(i, "id"),
                              label: `${i.id} · ${i.customerName} · ${i.balance} ${i.currency}`,
                            })),
                        },
                        {
                          key: "amount",
                          label: "Refund amount in invoice currency",
                          type: "decimal",
                        },
                        {
                          key: "exchangeRate",
                          label:
                            "Base-currency units per one refund-currency unit",
                          value: "1",
                          type: "decimal",
                        },
                        {
                          key: "reference",
                          label: "Verified refund reference",
                        },
                      ],
                      onSubmit: async (v) => {
                        await execute("refund", v);
                      },
                    })
                  }
                >
                  Record refund
                </button>
                <h2 className="section-title">Receipts</h2>
                <Table
                  data={list(w, "payments")}
                  empty="No payments recorded. Select an unpaid invoice and record a verified receipt."
                  columns={[
                    {
                      label: "Receipt",
                      render: (p) => (
                        <>
                          {str(p, "id")}
                          <small>{date(p.createdAt)}</small>
                        </>
                      ),
                    },
                    {
                      label: "Customer",
                      render: (p) => str(p, "customerName"),
                    },
                    {
                      label: "Amount",
                      render: (p) => moneyValue(p.amount, str(p, "currency")),
                    },
                    { label: "Reference", render: (p) => str(p, "reference") },
                    {
                      label: "Allocation",
                      render: (p) =>
                        rows(p.allocations)
                          .map((a) => `${a.invoiceId}: ${a.amount}`)
                          .join(", "),
                    },
                  ]}
                />
                <h2 className="section-title">Settlements & expenses</h2>
                <Table
                  data={[...list(w, "settlements"), ...list(w, "expenses")]}
                  empty="No settlements or expenses recorded."
                  columns={[
                    { label: "Record", render: (r) => str(r, "id") },
                    {
                      label: "Purpose",
                      render: (r) =>
                        str(r, "recipient") || str(r, "description"),
                    },
                    { label: "Amount", render: (r) => moneyValue(r.amount) },
                    {
                      label: "Reference / category",
                      render: (r) => str(r, "reference") || str(r, "category"),
                    },
                  ]}
                />
              </>
            )}
            {current === "Stocktake" && (
              <>
                <button
                  className="primary"
                  onClick={() =>
                    setForm({
                      title: "Count a location",
                      intro:
                        "Scan or paste permanent IDs, one per line. The result records missing and unexpected stones without silently changing stock.",
                      submit: "Compare physical count",
                      fields: [
                        { key: "location", label: "Exact internal location" },
                        {
                          key: "ids",
                          label: "Scanned stone IDs",
                          type: "textarea",
                          required: false,
                        },
                      ],
                      onSubmit: async (v) => {
                        await execute("stocktake", {
                          location: v.location,
                          ids: v.ids.split(/[\s,]+/).filter(Boolean),
                        });
                      },
                    })
                  }
                >
                  Start stocktake
                </button>
                <div className="section-gap">
                  <Table
                    data={list(w, "stocktakes")}
                    empty="No stocktakes yet. Count a location to compare physical stones with recorded stock."
                    columns={[
                      {
                        label: "Count",
                        render: (r) => (
                          <>
                            {str(r, "location")}
                            <small>{date(r.createdAt)}</small>
                          </>
                        ),
                      },
                      {
                        label: "Matched",
                        render: (r) => ids(r.matched).length,
                      },
                      {
                        label: "Missing",
                        render: (r) => ids(r.missing).join(", ") || "None",
                      },
                      {
                        label: "Unexpected",
                        render: (r) => ids(r.unexpected).join(", ") || "None",
                      },
                    ]}
                  />
                </div>
              </>
            )}
            {current === "Reports" && (
              <>
                <section className="report-summary">
                  <div>
                    <small>Recorded receipts</small>
                    <strong>{moneyValue((w.summary as Row)?.receipts)}</strong>
                  </div>
                  <div>
                    <small>Outstanding invoices</small>
                    <strong>
                      {
                        list(w, "invoices").filter((i) => Number(i.balance) > 0)
                          .length
                      }
                    </strong>
                  </div>
                  <div>
                    <small>Open memo lines</small>
                    <strong>
                      {list(w, "memos").reduce(
                        (n, m) =>
                          n +
                          rows(m.lines).filter((l) => l.status === "Pending")
                            .length,
                        0,
                      )}
                    </strong>
                  </div>
                </section>
                <div className="section-heading">
                  <h2>Reconciliation</h2>
                  <button
                    className="secondary"
                    onClick={() =>
                      setForm({
                        title: "Reconcile recorded cash movement",
                        intro:
                          "Expected base-currency net equals verified receipts minus recorded refunds, expenses and settlements. Exchange-rate snapshots are preserved; this is not a bank integration.",
                        submit: "Save reconciliation",
                        fields: [
                          {
                            key: "actual",
                            label: "Verified statement net",
                            type: "decimal",
                          },
                          {
                            key: "note",
                            label: "Difference explanation",
                            type: "textarea",
                            required: false,
                          },
                        ],
                        onSubmit: async (v) => {
                          await execute("reconcile", v);
                        },
                      })
                    }
                  >
                    Reconcile
                  </button>
                </div>
                <Table
                  data={list(w, "reconciliations")}
                  empty="No reconciliation recorded. Compare recorded movement with your verified statement."
                  columns={[
                    { label: "Recorded", render: (r) => date(r.createdAt) },
                    {
                      label: "Expected net",
                      render: (r) => moneyValue(r.expected),
                    },
                    {
                      label: "Statement net",
                      render: (r) => moneyValue(r.actual),
                    },
                    {
                      label: "Difference",
                      render: (r) => moneyValue(r.difference),
                    },
                    { label: "Explanation", render: (r) => str(r, "note") },
                  ]}
                />
                <h2 className="section-title">Export records</h2>
                <div className="export-list">
                  {[
                    "invoices",
                    "payments",
                    "credits",
                    "refunds",
                    "expenses",
                    "settlements",
                    "reconciliations",
                    ...(can()
                      ? [
                          "stones",
                          "claims",
                          "memos",
                          "jobs",
                          "customers",
                          "stocktakes",
                        ]
                      : []),
                  ].map((kind) => (
                    <div key={kind}>
                      <span>{kind[0].toUpperCase() + kind.slice(1)}</span>
                      <a href={`/api/export/${kind}?format=csv`}>CSV</a>
                      <a href={`/api/export/${kind}`}>JSON</a>
                    </div>
                  ))}
                </div>
              </>
            )}
            {current === "Activity log" && (
              <Table
                data={list(w, "events")}
                empty="No changes recorded yet. Workspace actions will appear here."
                columns={[
                  {
                    label: "When / who",
                    render: (r) => (
                      <>
                        {date(r.at)}
                        <small>
                          {str(r, "actor")} · {str(r, "role")}
                        </small>
                      </>
                    ),
                  },
                  { label: "Action", render: (r) => str(r, "action") },
                  { label: "Record", render: (r) => str(r, "record_id") },
                  {
                    label: "Change",
                    render: (r) => (
                      <details>
                        <summary>Inspect before / after</summary>
                        <pre>
                          {JSON.stringify(
                            { before: r.before, after: r.after },
                            null,
                            2,
                          )}
                        </pre>
                      </details>
                    ),
                  },
                ]}
              />
            )}
            {current === "Assistant" && (
              <section className="assistant-workspace">
                <h2>Ask about your records</h2>
                <p>
                  Read-only. Answers use records you can access. The assistant
                  cannot approve evidence, change stock, or post transactions.
                </p>
                {!w.aiConfigured ? (
                  <div className="info-note">
                    AI is not connected. Configure the server’s OpenAI API key
                    to enable this feature. Your stock and trading workflows
                    work without it.
                  </div>
                ) : (
                  <form
                    className="assistant-composer"
                    aria-busy={asking}
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const data = new FormData(e.currentTarget);
                      setAsking(true);
                      setAssistantError("");
                      setAnswer("");
                      try {
                        const r = await request("/api/assistant", {
                          question: data.get("question"),
                        });
                        setAnswer(str(r, "answer"));
                      } catch (e) {
                        setAssistantError((e as Error).message);
                      } finally {
                        setAsking(false);
                      }
                    }}
                  >
                    <label>
                      Your question
                      <textarea
                        name="question"
                        required
                        maxLength={1500}
                        placeholder="Which stones are waiting for evidence review?"
                        rows={4}
                      />
                    </label>
                    <div className="assistant-controls">
                      <span className="muted">Up to 1,500 characters</span>
                      <button className="primary" disabled={asking}>
                        {asking ? "Reading records…" : "Ask assistant"}
                      </button>
                    </div>
                  </form>
                )}
                {assistantError && <p className="error" role="alert">{assistantError}</p>}
                <div aria-live="polite">
                  {answer && (
                    <section className="assistant-answer">
                      <h3>AI-generated answer</h3>
                      <small>Verify the answer against the original records.</small>
                      <p>{answer}</p>
                    </section>
                  )}
                </div>
              </section>
            )}
            {current === "Walkthrough" && (
              <Walkthrough onGo={go} role={user.role} />
            )}
            {current === "Show mode" && (
              <>
                <div className="section-note">
                  Assign stock to one device before disconnecting. Other
                  channels cannot sell assigned stones. Download authority while
                  online, queue signed sales offline, then reconcile every event
                  before release.
                </div>
                {can("Inventory clerk") && (
                  <button
                    className="primary"
                    onClick={() =>
                      setForm({
                        title: "Assign stock to this show device",
                        submit: "Assign exclusively",
                        fields: [
                          { key: "name", label: "Show name" },
                          chooseStones,
                        ],
                        onSubmit: async (v) => {
                          await request("/api/shows", {
                            ...v,
                            stoneIds: JSON.parse(v.stoneIds),
                            deviceId: deviceId(),
                          });
                          await refresh();
                        },
                      })
                    }
                  >
                    Assign show stock
                  </button>
                )}
                <Table
                  data={list(w, "shows")}
                  empty="No show assignments. Assign a subset of reviewed stock while online."
                  columns={[
                    {
                      label: "Show",
                      render: (r) => (
                        <>
                          {str(r, "name")}
                          <small>{str(r, "id")}</small>
                        </>
                      ),
                    },
                    { label: "Stock", render: (r) => ids(r.stoneIds).length },
                    {
                      label: "Status",
                      render: (r) => <Badge value={r.status} />,
                    },
                    {
                      label: "Action",
                      render: (r) =>
                        r.status === "Assigned" ? (
                          <div className="actions">
                            {can("Sales staff") && (
                              <button
                                className="secondary compact"
                                onClick={() =>
                                  run(async () => {
                                    const a = await request(
                                      `/api/shows/${r.id}/authority`,
                                      { deviceId: deviceId() },
                                    );
                                    a.user = {
                                      id: user.id,
                                      name: user.name,
                                      email: user.email,
                                      role: user.role,
                                    };
                                    a.settings = w.settings;
                                    localStorage.setItem(
                                      "gem-show-authority",
                                      JSON.stringify(a),
                                    );
                                    setShowAuthority(a);
                                  }, "Authority downloaded to this device.")
                                }
                              >
                                Download authority
                              </button>
                            )}
                            {can("Inventory clerk") && (
                              <button
                                className="text-button"
                                onClick={() =>
                                  setForm({
                                    title: "Release show stock",
                                    intro:
                                      "Only continue after every selling-device event has been reconciled. Releasing early can invalidate queued sales.",
                                    submit: "Release stock",
                                    fields: [
                                      {
                                        key: "confirm",
                                        label:
                                          "All device sales reconciled; no pending or blocked events remain",
                                        type: "checkbox",
                                      },
                                    ],
                                    onSubmit: async (v) => {
                                      if (v.confirm !== "true" || queue.length)
                                        throw new Error(
                                          "Reconcile the device queue before releasing.",
                                        );
                                      await request(
                                        `/api/shows/${r.id}/release`,
                                        { confirmedReconciled: true },
                                      );
                                      await refresh();
                                    },
                                  })
                                }
                              >
                                Reconcile & release
                              </button>
                            )}
                          </div>
                        ) : (
                          date(r.releasedAt)
                        ),
                    },
                  ]}
                />
                {list(w, "showConflicts")
                  .filter((c) => c.status === "Awaiting owner")
                  .map((c) => (
                    <div className="error" key={str(c, "id")}>
                      <strong>Blocked event · {str(c, "showId")}</strong>
                      <p>{str(c, "error")}</p>
                      {can() && (
                        <button
                          className="secondary"
                          onClick={() =>
                            setForm({
                              title: "Review blocked show event",
                              intro:
                                "Rejecting preserves the record and lets the device remove this event on its next replay. Check the sale and customer before recording a replacement transaction.",
                              submit: "Reject queued event",
                              fields: [
                                {
                                  key: "reason",
                                  label: "Reason and follow-up",
                                  type: "textarea",
                                },
                              ],
                              onSubmit: async (v) => {
                                await request(
                                  `/api/shows/${c.showId}/conflicts/${c.id}/reject`,
                                  v,
                                );
                                await refresh();
                              },
                            })
                          }
                        >
                          Review & reject
                        </button>
                      )}
                    </div>
                  ))}
                {showAuthority && (
                  <section className="panel section-gap">
                    <h2>Downloaded device authority</h2>
                    <p>
                      {str(showAuthority, "id")} · Valid until{" "}
                      {date(showAuthority.expires)}
                    </p>
                    <button
                      className="secondary"
                      onClick={() =>
                        setForm({
                          title: "Queue an offline sale",
                          intro:
                            "This is a signed pending sale. It becomes final only after server reconciliation. Keep this browser’s data until all events reconcile.",
                          submit: "Queue signed sale",
                          fields: [
                            {
                              key: "customerId",
                              label: "Customer",
                              options: rows(showAuthority.customers).map(
                                (c) => ({
                                  value: str(c, "id"),
                                  label: str(c, "name"),
                                }),
                              ),
                            },
                            {
                              key: "stoneId",
                              label: "Assigned stone",
                              options: rows(showAuthority.stones)
                                .filter(
                                  (s) =>
                                    !queue.some((e) =>
                                      rows((e.payload as Row).lines).some(
                                        (l) => l.stoneId === s.id,
                                      ),
                                    ),
                                )
                                .map((s) => ({
                                  value: str(s, "id"),
                                  label: `${s.id} · ${s.variety}`,
                                })),
                            },
                            { key: "price", label: "Price", type: "decimal" },
                          ],
                          onSubmit: async (v) => {
                            if (
                              Date.parse(str(showAuthority, "expires")) <
                              Date.now()
                            )
                              throw new Error(
                                "Authority has expired. Reconnect to review the assignment.",
                              );
                            const stone = rows(showAuthority.stones).find(
                              (s) => s.id === v.stoneId,
                            );
                            const payload = {
                              id: crypto.randomUUID(),
                              showId: showAuthority.id,
                              deviceId: deviceId(),
                              at: new Date().toISOString(),
                              customerId: v.customerId,
                              exchangeRate: "1",
                              lines: [
                                {
                                  stoneId: v.stoneId,
                                  version: stone?.version,
                                  price: v.price,
                                },
                              ],
                            };
                            const key = await crypto.subtle.importKey(
                              "raw",
                              Uint8Array.from(
                                str(showAuthority, "key").match(/.{2}/g) || [],
                                (x) => parseInt(x, 16),
                              ),
                              { name: "HMAC", hash: "SHA-256" },
                              false,
                              ["sign"],
                            );
                            const sig = await crypto.subtle.sign(
                              "HMAC",
                              key,
                              new TextEncoder().encode(JSON.stringify(payload)),
                            );
                            const event = {
                              payload,
                              signature: Array.from(new Uint8Array(sig), (x) =>
                                x.toString(16).padStart(2, "0"),
                              ).join(""),
                            };
                            const updated = [...queue, event];
                            setQueue(updated);
                            localStorage.setItem(
                              "gem-offline-events",
                              JSON.stringify(updated),
                            );
                            setNotice("Signed sale queued on this device.");
                          },
                        })
                      }
                    >
                      Queue offline sale
                    </button>
                    <button
                      className="primary"
                      disabled={!online || !queue.length}
                      onClick={() =>
                        run(async () => {
                          const response = await request(
                            `/api/shows/${showAuthority.id}/replay`,
                            { events: queue },
                          );
                          const results = rows(response.results);
                          const reconciled = results
                            .filter((r) =>
                              ["Reconciled", "Cancelled"].includes(
                                str(r, "status"),
                              ),
                            )
                            .map((r) => r.eventId);
                          const pending = queue.filter(
                            (e) => !reconciled.includes((e.payload as Row).id),
                          );
                          setQueue(pending);
                          localStorage.setItem(
                            "gem-offline-events",
                            JSON.stringify(pending),
                          );
                          const fresh = await request(
                            `/api/shows/${showAuthority.id}/authority`,
                            { deviceId: deviceId() },
                          );
                          fresh.user = {
                            id: user.id,
                            name: user.name,
                            email: user.email,
                            role: user.role,
                          };
                          fresh.settings = w.settings;
                          setShowAuthority(fresh);
                          localStorage.setItem(
                            "gem-show-authority",
                            JSON.stringify(fresh),
                          );
                          if (pending.length)
                            throw new Error(
                              results
                                .filter((r) => r.status === "Blocked")
                                .map((r) => r.error)
                                .join(" "),
                            );
                        }, "All device events reconciled.")
                      }
                    >
                      Reconcile {queue.length} queued sales
                    </button>
                    <p className="muted">
                      {queue.length} events pending. A blocked event remains on
                      this device for review.
                    </p>
                  </section>
                )}
              </>
            )}
            {current === "Settings" && (
              <>
                <section className="settings-section">
                  <h2>Workspace</h2>
                  <dl className="record-details">
                    <div>
                      <dt>Name</dt>
                      <dd>{str(w.settings, "name")}</dd>
                    </div>
                    <div>
                      <dt>Base currency</dt>
                      <dd>
                        {str(w.settings, "currency")} ·{" "}
                        {str(w.settings, "minorUnits")} decimal places
                      </dd>
                    </div>
                    <div>
                      <dt>Launch country</dt>
                      <dd>{str(w.settings, "country")}</dd>
                    </div>
                    <div>
                      <dt>Sales discount limit</dt>
                      <dd>{str(w.settings, "salesDiscountLimit")}%</dd>
                    </div>
                    <div>
                      <dt>AI connection</dt>
                      <dd>
                        {w.aiConfigured ? "Configured" : "Not configured"}
                      </dd>
                    </div>
                  </dl>
                  {can() && (
                    <div className="actions">
                      <button
                        className="secondary"
                        onClick={() =>
                          setForm({
                            title: "Workspace settings",
                            submit: "Save settings",
                            fields: [
                              {
                                key: "name",
                                label: "Business name",
                                value: str(w.settings, "name"),
                              },
                              {
                                key: "country",
                                label: "Country",
                                value: str(w.settings, "country"),
                                options: countries.some(
                                  (c) => c.value === str(w.settings, "country"),
                                )
                                  ? countries
                                  : [
                                      {
                                        value: str(w.settings, "country"),
                                        label: str(w.settings, "country"),
                                      },
                                      ...countries,
                                    ],
                              },
                              {
                                key: "salesDiscountLimit",
                                label: "Sales discount limit (%)",
                                type: "decimal",
                                value: str(w.settings, "salesDiscountLimit"),
                              },
                            ],
                            onSubmit: async (v) => {
                              await request("/api/settings", v);
                              await refresh();
                            },
                          })
                        }
                      >
                        Edit workspace
                      </button>
                      <a className="button secondary" href="/api/backup">
                        Download complete backup
                      </a>
                    </div>
                  )}
                </section>
                <section className="settings-section">
                  <h2>Sign-in security</h2>
                  <p>
                    {w.mfaEnabled
                      ? "Authenticator protection is enabled for your account."
                      : "Add an authenticator to protect your account with a second factor."}
                  </p>
                  <button
                    className="secondary"
                    onClick={() =>
                      setForm({
                        title: "Change password",
                        submit: "Change password",
                        intro:
                          "Other signed-in sessions are revoked after a password change.",
                        fields: [
                          {
                            key: "currentPassword",
                            label: "Current password",
                            type: "password",
                          },
                          {
                            key: "password",
                            label: "New password",
                            type: "password",
                          },
                        ],
                        onSubmit: async (v) => {
                          await request("/api/password", v);
                          setNotice("Password changed.");
                        },
                      })
                    }
                  >
                    Change password
                  </button>
                  {!w.mfaEnabled && (
                    <button
                      className="secondary"
                      onClick={() =>
                        run(async () => {
                          setMfa(await request("/api/mfa/setup", {}));
                        }, "Scan the authenticator code to continue.")
                      }
                    >
                      Set up authenticator
                    </button>
                  )}
                </section>
                {can() && (
                  <>
                    <section className="settings-section">
                      <div className="section-heading">
                        <h2>People & roles</h2>
                        <button
                          className="secondary"
                          onClick={() =>
                            setForm({
                              title: "Create team account",
                              intro:
                                "Create a separate account for each person. Share the temporary password privately and have the person set up an authenticator.",
                              submit: "Create account",
                              fields: [
                                { key: "name", label: "Name" },
                                { key: "email", label: "Email", type: "email" },
                                {
                                  key: "password",
                                  label: "Password (at least 12 characters)",
                                  type: "password",
                                },
                                {
                                  key: "role",
                                  label: "Role",
                                  options: ROLES.map((r) => ({
                                    value: r,
                                    label: r,
                                  })),
                                },
                              ],
                              onSubmit: async (v) => {
                                await request("/api/users", v);
                                await refresh();
                              },
                            })
                          }
                        >
                          Add person
                        </button>
                      </div>
                      <Table
                        data={list(w, "users")}
                        columns={[
                          {
                            label: "Person",
                            render: (r) => (
                              <>
                                {str(r, "name")}
                                <small>{str(r, "email")}</small>
                              </>
                            ),
                          },
                          { label: "Role", render: (r) => str(r, "role") },
                          {
                            label: "Access",
                            render: (r) => (r.active ? "Active" : "Disabled"),
                          },
                          {
                            label: "Action",
                            render: (r) =>
                              r.id !== user.id ? (
                                <button
                                  className="text-button"
                                  onClick={() =>
                                    run(() =>
                                      request(`/api/users/${r.id}/status`, {
                                        active: !r.active,
                                      }),
                                    )
                                  }
                                >
                                  {r.active
                                    ? "Disable access"
                                    : "Enable access"}
                                </button>
                              ) : (
                                "Your account"
                              ),
                          },
                        ]}
                      />
                    </section>
                    <section className="settings-section">
                      <h2>Import stock</h2>
                      <p>
                        CSV headers: reference, variety, shape, carats, count,
                        location, cost, price, supplier. Preview duplicates and
                        confirm totals before committing.
                      </p>
                      <button
                        className="secondary"
                        onClick={() =>
                          setForm({
                            title: "Preview stock import",
                            submit: "Preview CSV",
                            fields: [
                              { key: "file", label: "Stock CSV", type: "file" },
                            ],
                            onSubmit: async (_v, file) => {
                              if (!file) throw new Error("Choose a CSV file.");
                              const data = new FormData();
                              data.append("file", file);
                              setImportPreview(
                                await request("/api/import/preview", data),
                              );
                            },
                          })
                        }
                      >
                        Upload CSV for preview
                      </button>
                    </section>
                  </>
                )}
                <section className="settings-section">
                  <h2>External connections</h2>
                  <p>
                    Card charging, accounting-provider sync, shipping,
                    marketplace distribution and local tax filing are not
                    connected. Current invoices and receipts record the
                    workflow; they do not move external funds.
                  </p>
                </section>
              </>
            )}
            <footer>
              Persistent local workspace · {str(w.settings, "currency")} ·{" "}
              {user.role}
            </footer>
          </div>
        </main>
      </div>

      <nav className="mobile-tab-bar" aria-label="Quick navigation">
        {mobileTabs.map((tab) => {
          const active = activeMobilePage === tab.page;
          const showBadge = tab.page === "Evidence" && pendingEvidence;
          return (
            <button
              key={tab.page}
              type="button"
              className={`mobile-tab-btn${active && !menu ? " active" : ""}`}
              onClick={() => {
                if (current !== tab.page) {
                  go(tab.page);
                  return;
                }
                window.scrollTo({
                  top: 0,
                  behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
                });
              }}
              aria-current={active ? "page" : undefined}
              aria-description={showBadge ? "Review pending" : undefined}
            >
              <span className="tab-icon-wrap">
                <Mark name={tab.page} />
                {showBadge && <span className="tab-badge-dot" aria-hidden="true" />}
              </span>
              <span>{tab.label}</span>
            </button>
          );
        })}
        <button
          type="button"
          className={`mobile-tab-btn ${menu || moreIsCurrent ? "active" : ""}`}
          onClick={() => setMenu(true)}
          aria-label="More workspaces"
          aria-expanded={menu}
          aria-haspopup="dialog"
          aria-current={moreIsCurrent ? "location" : undefined}
        >
          <Mark name="menu" />
          <span>More</span>
        </button>
      </nav>

      {menu && (
        <Dialog title="Workspaces & settings" onClose={() => setMenu(false)}>
          <div className="more-menu-content">
            <div className="more-account-card">
              <div className="more-account-header">
                <div className="user-avatar">
                  {user.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <strong>{user.name}</strong>
                  <p>
                    {user.role} · {str(w.settings, "currency")}
                  </p>
                </div>
              </div>
              <div className="more-account-actions">
                <button
                  type="button"
                  className="secondary wide"
                  onClick={() => setTheme(theme === "light" ? "dark" : "light")}
                >
                  <Mark name={theme === "light" ? "moon" : "sun"} />
                  <span>Appearance: {theme === "light" ? "Light" : "Dark"}</span>
                </button>
                <button
                  type="button"
                  className="text-button danger wide"
                  onClick={() =>
                    run(async () => {
                      await request("/api/logout", {});
                      setUser(null);
                      setAnswer("");
                      setAssistantError("");
                      setW(null);
                      setCsrf("");
                      localStorage.removeItem("gem-show-authority");
                      setShowAuthority(null);
                    }, "Signed out.")
                  }
                >
                  Sign out
                </button>
              </div>
            </div>
            {NAV_GROUPS.map((group) => {
              const groupPages = group.pages.filter((p) => visible.includes(p));
              if (!groupPages.length) return null;
              return (
                <div key={group.title} className="more-group">
                  <h3 className="more-group-title">{group.title}</h3>
                  <div className="more-group-grid">
                    {groupPages.map((p) => (
                      <button
                        key={p}
                        type="button"
                        className={`more-item-card ${current === p ? "active" : ""}`}
                        aria-current={current === p ? "page" : undefined}
                        onClick={() => {
                          go(p);
                          setMenu(false);
                        }}
                      >
                        <div className="more-item-icon">
                          <Mark name={p} />
                        </div>
                        <div className="more-item-info">
                          <strong>{p}</strong>
                          <small>{descriptions[p] || "Open workspace"}</small>
                        </div>
                        {p === "Evidence" &&
                          stones.some((s) => s.evidence !== "Approved") && (
                            <span className="badge-count">
                              {
                                stones.filter(
                                  (s) => s.evidence !== "Approved",
                                ).length
                              }
                            </span>
                          )}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}

          </div>
        </Dialog>
      )}

      {filterSheetOpen && (
        <Dialog
          title="Filters & sort"
          onClose={() => setFilterSheetOpen(false)}
        >
          <div className="filter-sheet-body">
            <div className="filter-sheet-field">
              <label htmlFor="m-status" className="filter-label">Custody status</label>
              <select
                id="m-status"
                className="filter-select"
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  setInventoryPage(1);
                }}
              >
                <option>All stock</option>
                {STATES.map((state) => <option key={state}>{state}</option>)}
              </select>
            </div>
            <div className="filter-sheet-field">
              <label htmlFor="m-variety" className="filter-label">
                Gem Variety & Species
              </label>
              <select
                id="m-variety"
                className="filter-select"
                value={varietyFilter}
                onChange={(e) => {
                  setVarietyFilter(e.target.value);
                  setInventoryPage(1);
                }}
              >
                <option value="all">All Varieties ({stones.length})</option>
                {[...new Set(stones.map((s) => str(s, "variety")))].map(
                  (v: string) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ),
                )}
              </select>
            </div>
            <div className="filter-sheet-field">
              <label htmlFor="m-location" className="filter-label">
                Vault Safe & Location
              </label>
              <select
                id="m-location"
                className="filter-select"
                value={locationFilter}
                onChange={(e) => {
                  setLocationFilter(e.target.value);
                  setInventoryPage(1);
                }}
              >
                <option value="all">All Safe Locations</option>
                {[...new Set(stones.map((s) => str(s, "location")))].map(
                  (loc: string) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ),
                )}
              </select>
            </div>
            <div className="filter-sheet-field">
              <label htmlFor="m-evidence" className="filter-label">
                Laboratory Evidence
              </label>
              <select
                id="m-evidence"
                className="filter-select"
                value={evidenceFilter}
                onChange={(e) => {
                  setEvidenceFilter(e.target.value);
                  setInventoryPage(1);
                }}
              >
                <option value="all">All Evidence States</option>
                <option value="Approved">Approved (Verified)</option>
                <option value="Review needed">Review needed</option>
                <option value="Conflict">Conflict</option>
              </select>
            </div>
            <div className="filter-sheet-field">
              <label htmlFor="m-sort" className="filter-label">
                Sort Order
              </label>
              <select
                id="m-sort"
                className="filter-select"
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  setInventoryPage(1);
                }}
              >
                <option value="default">Default order</option>
                <option value="weight-desc">Weight: High to Low</option>
                <option value="weight-asc">Weight: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="price-asc">Price: Low to High</option>
              </select>
            </div>
            <div className="dialog-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setStatus("All stock");
                  setVarietyFilter("all");
                  setLocationFilter("all");
                  setEvidenceFilter("all");
                  setSortBy("default");
                  setInventoryPage(1);
                  setFilterSheetOpen(false);
                }}
              >
                Clear all
              </button>
              <button
                type="button"
                className="primary"
                onClick={() => setFilterSheetOpen(false)}
              >
                Done
              </button>
            </div>
          </div>
        </Dialog>
      )}
      {detail && s && !form && (
        <Dialog title={str(s, "id")} onClose={() => setDetail(null)}>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="stone-title">
            <h3>{str(s, "variety")}</h3>
            <p>
              {str(s, "shape")} · {str(s, "carats")} ct
            </p>
            <Badge value={s.state} />
          </div>
          <dl className="record-details">
            {[
              ["Location", "location"],
              ["Custodian", "custodian"],
              ["Evidence", "evidence"],
              ["Color", "color"],
              ["Dimensions", "dimensions"],
              ...(s.cost !== undefined ? [["Cost", "cost"]] : []),
              ...(s.price !== undefined ? [["Asking price", "price"]] : []),
              ...(s.supplier !== undefined ? [["Supplier", "supplier"]] : []),
            ].map(([label, key]) => (
              <div key={key}>
                <dt>{label}</dt>
                <dd>{str(s, key) || "Not recorded"}</dd>
              </div>
            ))}
            <div>
              <dt>Ownership authority</dt>
              <dd>{s.ownershipConfirmed ? "Confirmed" : "Not confirmed"}</dd>
            </div>
            {s.holdUntil !== null && s.holdUntil !== undefined && (
              <div>
                <dt>Hold until</dt>
                <dd>{date(s.holdUntil)}</dd>
              </div>
            )}
            {s.showId !== null && s.showId !== undefined && (
              <div>
                <dt>Show assignment</dt>
                <dd>{str(s, "showId")}</dd>
              </div>
            )}
            {s.parentId !== undefined && (
              <div>
                <dt>Parent stone</dt>
                <dd>{str(s, "parentId")}</dd>
              </div>
            )}
          </dl>
          {s.disclosure !== "" && (
            <div className="approved-wording">
              <h4>Reviewed disclosure</h4>
              <p>{str(s, "disclosure")}</p>
              <small>Version {str(s, "approvedVersion")}</small>
            </div>
          )}
          {s.blockReason !== undefined && s.blockReason !== null && (
            <p className="error">{str(s, "blockReason")}</p>
          )}
          <div className="record-actions">
            {can("Inventory clerk") &&
              !["Sold", "On memo", "With lab or cutter"].includes(
                str(s, "state"),
              ) && (
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    setForm({
                      title: "Update stone details",
                      submit: "Save details",
                      fields: [
                        {
                          key: "location",
                          label: "Location",
                          value: str(s, "location"),
                        },
                        ...(can()
                          ? [
                              {
                                key: "cost",
                                label: "Cost",
                                type: "decimal",
                                value: str(s, "cost"),
                              },
                              {
                                key: "price",
                                label: "Asking price",
                                type: "decimal",
                                value: str(s, "price"),
                              },
                              {
                                key: "supplier",
                                label: "Supplier",
                                value: str(s, "supplier"),
                                required: false,
                              },
                              {
                                key: "ownershipConfirmed",
                                label:
                                  "Ownership authority and terms confirmed",
                                type: "checkbox",
                                value: String(s.ownershipConfirmed),
                              },
                            ]
                          : []),
                      ],
                      onSubmit: async (v) => {
                        await execute("edit-stone", {
                          ...v,
                          id: s.id,
                          version: s.version,
                          ...(can()
                            ? {
                                ownershipConfirmed:
                                  v.ownershipConfirmed === "true",
                              }
                            : {}),
                        });
                      },
                    })
                  }
                >
                  Edit details
                </button>
              )}
            {can("Inventory clerk", "Gem reviewer") && (
              <>
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    setForm({
                      title: "Attach original document",
                      intro:
                        "The original is preserved. Attaching a new document requires another evidence review.",
                      submit: "Upload original",
                      fields: [
                        {
                          key: "file",
                          label: "PDF, JPEG or PNG (up to 15 MB)",
                          type: "file",
                        },
                      ],
                      onSubmit: async (_v, file) => {
                        if (!file) throw new Error("Choose a file.");
                        const data = new FormData();
                        data.append("stoneId", str(s, "id"));
                        data.append("file", file);
                        await request("/api/files", data);
                        await refresh();
                      },
                    })
                  }
                >
                  Attach report / photo
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    setForm({
                      title: "Add versioned claim",
                      submit: "Preserve claim",
                      fields: [
                        {
                          key: "type",
                          label: "Evidence type",
                          options: [
                            "Supplier claim",
                            "Lab opinion",
                            "Custody record",
                          ].map((v) => ({ value: v, label: v })),
                          value: "Supplier claim",
                        },
                        {
                          key: "statement",
                          label: "Claim or finding",
                          type: "textarea",
                        },
                        {
                          key: "reportNumber",
                          label: "Report number",
                          required: false,
                        },
                        {
                          key: "fileId",
                          label: "Supporting document",
                          required: false,
                          options: list(w, "fileMeta")
                            .filter((f) => f.stoneId === s.id)
                            .map((f) => ({
                              value: str(f, "id"),
                              label: str(f, "name"),
                            })),
                        },
                        {
                          key: "conflict",
                          label: "This conflicts with existing evidence",
                          type: "checkbox",
                        },
                      ],
                      onSubmit: async (v) => {
                        await execute("claim", {
                          ...v,
                          stoneId: s.id,
                          version: s.version,
                          conflict: v.conflict === "true",
                        });
                      },
                    })
                  }
                >
                  Add claim
                </button>
              </>
            )}
            {can("Gem reviewer") && (
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  setForm({
                    title: "Approve buyer disclosure",
                    intro:
                      "Review the original documents and all claim versions. Conflicting evidence is preserved.",
                    submit: "Approve wording",
                    fields: [
                      {
                        key: "disclosure",
                        label: "Approved buyer-facing wording",
                        type: "textarea",
                        value: str(s, "disclosure"),
                      },
                      {
                        key: "buyerFileIds",
                        label: "Documents approved for buyer sharing",
                        type: "multiple",
                        required: false,
                        value: JSON.stringify(ids(s.buyerFileIds)),
                        options: list(w, "fileMeta")
                          .filter((f) => f.stoneId === s.id)
                          .map((f) => ({
                            value: str(f, "id"),
                            label: str(f, "name"),
                          })),
                        hint: "Only select originals safe for this buyer. Check for supplier names, costs and confidential annotations.",
                      },
                      {
                        key: "resolution",
                        label: "Conflict review and reasoning",
                        type: "textarea",
                        required: s.evidence === "Conflict",
                      },
                    ],
                    onSubmit: async (v) => {
                      await execute("approve", {
                        ...v,
                        buyerFileIds: JSON.parse(v.buyerFileIds || "[]"),
                        id: s.id,
                        version: s.version,
                      });
                    },
                  })
                }
              >
                Review disclosure
              </button>
            )}
            {can("Inventory clerk") &&
              ["Draft", "Returned"].includes(str(s, "state")) && (
                <button
                  type="button"
                  className="primary"
                  onClick={() =>
                    run(() =>
                      execute("stock-in", { id: s.id, version: s.version }),
                    )
                  }
                >
                  Release to stock
                </button>
              )}
            {can("Sales staff") && s.state === "In stock" && (
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  setForm({
                    title: "Reserve stone",
                    submit: "Place hold",
                    fields: [
                      customerField,
                      {
                        key: "hours",
                        label: "Hold duration (hours)",
                        type: "decimal",
                        value: "24",
                      },
                    ],
                    onSubmit: async (v) => {
                      await execute("hold", {
                        ...v,
                        id: s.id,
                        version: s.version,
                      });
                    },
                  })
                }
              >
                Place hold
              </button>
            )}
            {can("Sales staff") && s.state === "Held" && (
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  run(() =>
                    execute("release-hold", { id: s.id, version: s.version }),
                  )
                }
              >
                Release hold
              </button>
            )}
            {can("Cutter / lab liaison") &&
              ["Draft", "In stock"].includes(str(s, "state")) && (
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    setForm({
                      title: "Issue to laboratory or cutter",
                      submit: "Issue stone",
                      fields: [
                        {
                          key: "type",
                          label: "Work type",
                          options: ["Laboratory", "Cutting"].map((v) => ({
                            value: v,
                            label: v,
                          })),
                          value: "Laboratory",
                        },
                        { key: "custodian", label: "Receiving lab / cutter" },
                        {
                          key: "instructions",
                          label: "Instructions",
                          type: "textarea",
                        },
                      ],
                      onSubmit: async (v) => {
                        await execute("process-issue", {
                          ...v,
                          id: s.id,
                          version: s.version,
                        });
                      },
                    })
                  }
                >
                  Issue for processing
                </button>
              )}
            {can("Cutter / lab liaison") &&
              ["Draft", "Returned", "In stock"].includes(str(s, "state")) && (
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    setForm({
                      title: "Split parcel into children",
                      intro:
                        "Child weights plus loss must equal parent weight. Cost is allocated by weight with the rounding remainder preserved. The parent becomes blocked.",
                      submit: "Create linked children",
                      fields: [
                        {
                          key: "weights",
                          label: "Child weights, one per line",
                          type: "textarea",
                        },
                        {
                          key: "loss",
                          label: "Recorded loss (ct)",
                          type: "decimal",
                          value: "0",
                        },
                      ],
                      onSubmit: async (v) => {
                        await execute("split", {
                          id: s.id,
                          version: s.version,
                          loss: v.loss,
                          children: v.weights
                            .split(/[\s,]+/)
                            .filter(Boolean)
                            .map((carats) => ({ carats })),
                        });
                      },
                    })
                  }
                >
                  Split parcel
                </button>
              )}
            {can("Gem reviewer") &&
              !["Sold", "On memo", "With lab or cutter", "Blocked"].includes(
                str(s, "state"),
              ) && (
                <button
                  type="button"
                  className="text-button danger"
                  onClick={() =>
                    setForm({
                      title: "Block stone",
                      submit: "Block stock",
                      fields: [
                        {
                          key: "reason",
                          label: "Reason for blocking",
                          type: "textarea",
                        },
                      ],
                      onSubmit: async (v) => {
                        await execute("block", {
                          ...v,
                          id: s.id,
                          version: s.version,
                        });
                      },
                    })
                  }
                >
                  Block stock
                </button>
              )}
            {can("Gem reviewer") && s.state === "Blocked" && !s.children && (
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  run(() =>
                    execute("unblock", { id: s.id, version: s.version }),
                  )
                }
              >
                Unblock for review
              </button>
            )}
          </div>
          {can("Inventory clerk", "Cutter / lab liaison") && (
            <div className="label-preview">
              <img
                src={`/api/labels/${s.id}`}
                alt={`Stock QR label for ${s.id}`}
                width="120"
                height="120"
              />
              <div>
                <strong>{str(s, "id")}</strong>
                <p>
                  {str(s, "variety")} · {str(s, "carats")} ct
                </p>
                <p className="label-guide-text">
                  Scanning returns the permanent stock ID. Use the link below to open or print this QR label.
                </p>
                <a
                  href={`/api/labels/${s.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="printable-link"
                >
                  Open printable QR
                </a>
              </div>
            </div>
          )}
          <h4>Preserved evidence</h4>
          {list(w, "claims")
            .filter((c) => c.stoneId === s.id)
            .map((c) => (
              <div className="claim" key={str(c, "id")}>
                <strong>
                  {str(c, "type")} · version {str(c, "version")}
                </strong>
                <p>{str(c, "statement")}</p>
                <small>
                  {str(c, "reportNumber")} · {str(c, "actor")} ·{" "}
                  {date(c.createdAt)}
                </small>
              </div>
            ))}
          {list(w, "fileMeta")
            .filter((f) => f.stoneId === s.id)
            .map((f) => (
              <div className="evidence-file" key={str(f, "id")}>
                <a href={`/api/files/${f.id}`}>{str(f, "name")}</a>
                <small>
                  {Math.ceil(Number(f.size) / 1024)} KB · Original preserved
                </small>
                {w.aiConfigured && (
                  <div className="extraction-action">
                    <p id={`extract-${f.id}`} className="muted">
                      Extraction sends this report to the configured AI provider.
                    </p>
                    <button
                      type="button"
                      className="secondary"
                      aria-describedby={`extract-${f.id}`}
                      disabled={Boolean(extractingFile)}
                      onClick={async () => {
                        setExtractingFile(str(f, "id"));
                        setExtractionError(null);
                        try {
                          const r = await request(
                            `/api/files/${f.id}/extract`,
                            {},
                          );
                          const draft = r.draft as Row;
                          setForm({
                            title: "Review AI-extracted report",
                            intro:
                              "Compare each extracted field with the original report. Saving creates a claim draft for reviewer approval; it does not approve evidence or change the stone identity.",
                            submit: "Confirm fields & preserve claim",
                            fields: [
                              ...[
                                "reportNumber",
                                "variety",
                                "carats",
                                "treatment",
                                "origin",
                                "sourceNotes",
                              ].map((key) => ({
                                key,
                                label: (
                                  {
                                    reportNumber: "Report number",
                                    variety: "Variety",
                                    carats: "Weight (ct)",
                                    treatment: "Treatment",
                                    origin: "Origin opinion",
                                    sourceNotes: "Source snippets and pages",
                                  } as Record<string, string>
                                )[key],
                                value: str(draft, key),
                                required: false,
                                type: key === "sourceNotes" ? "textarea" : "text",
                              })),
                              {
                                key: "confirmed",
                                label:
                                  "I checked report number, weight, treatment and origin against the original",
                                type: "checkbox",
                              },
                            ],
                            onSubmit: async (v) => {
                              if (v.confirmed !== "true")
                                throw new Error(
                                  "Check the critical fields before saving.",
                                );
                              const current = list(
                                await request<Workspace>("/api/workspace"),
                                "stones",
                              ).find((x) => x.id === s.id);
                              await execute("claim", {
                                stoneId: s.id,
                                version: current?.version,
                                type: "Lab opinion",
                                reportNumber: v.reportNumber,
                                fileId: f.id,
                                source: "AI",
                                aiConfirmed: true,
                                statement: JSON.stringify(
                                  {
                                    variety: v.variety,
                                    carats: v.carats,
                                    treatment: v.treatment,
                                    origin: v.origin,
                                    sourceNotes: v.sourceNotes,
                                  },
                                  null,
                                  2,
                                ),
                              });
                            },
                          });
                        } catch (e) {
                          setExtractionError({ fileId: str(f, "id"), message: (e as Error).message });
                        } finally {
                          setExtractingFile("");
                        }
                      }}
                    >
                      {extractingFile === f.id ? "Reading report…" : "Extract AI draft"}
                    </button>
                    {extractionError?.fileId === str(f, "id") && (
                      <p className="error" role="alert">{extractionError.message}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          {!list(w, "claims").some((c) => c.stoneId === s.id) && (
            <p className="muted">No versioned claims attached yet.</p>
          )}
        </Dialog>
      )}
      {form && <Editor spec={form} onClose={() => setForm(null)} />}
      {invoice && !form && (
        <Dialog title={str(invoice, "id")} onClose={() => setInvoice(null)}>
          <p>
            {str(invoice, "customerName")} ·{" "}
            {invoice.total
              ? moneyValue(invoice.total, str(invoice, "currency"))
              : "Financial details restricted"}
          </p>
          <Table
            data={rows(invoice.lines)}
            columns={[
              {
                label: "Stone",
                render: (l) => (
                  <>
                    {str(l, "stoneId")}
                    <small>
                      {str(l, "variety")} · {str(l, "carats")} ct
                    </small>
                  </>
                ),
              },
              {
                label: "Disclosure at sale",
                render: (l) => str(l, "disclosure"),
              },
              {
                label: "Outcome",
                render: (l) => (l.returned ? "Returned" : "Sold"),
              },
              {
                label: "Action",
                render: (l) =>
                  !l.returned && can("Inventory clerk") ? (
                    <button
                      type="button"
                      className="secondary compact"
                      onClick={() =>
                        setForm({
                          title: "Inspect sale return",
                          intro:
                            "The physical return creates a request for Accounts to issue the credit.",
                          submit: "Receive return",
                          fields: [
                            {
                              key: "condition",
                              label: "Condition inspection",
                              type: "textarea",
                            },
                            { key: "location", label: "Return location" },
                          ],
                          onSubmit: async (v) => {
                            await execute("sale-return", {
                              ...v,
                              id: l.stoneId,
                              version: stones.find((s) => s.id === l.stoneId)
                                ?.version,
                              invoiceId: invoice.id,
                            });
                            setInvoice(null);
                          },
                        })
                      }
                    >
                      Inspect return
                    </button>
                  ) : (
                    "Recorded"
                  ),
              },
            ]}
          />
          {can("Sales staff", "Accounts") && (
            <a
              className="button secondary"
              href={`/api/invoices/${invoice.id}/pdf`}
            >
              Download invoice PDF
            </a>
          )}
        </Dialog>
      )}
      {importPreview && (
        <Dialog title="Import preview" onClose={() => setImportPreview(null)}>
          <p>
            {rows(importPreview.rows).length} rows ·{" "}
            {str(importPreview, "totalCarats")} ct ·{" "}
            {moneyValue(importPreview.totalCost)}
          </p>
          <Table
            data={rows(importPreview.rows)}
            columns={[
              { label: "CSV row", render: (r) => str(r, "row") },
              {
                label: "Reference",
                render: (r) => str(r.data as Row, "reference"),
              },
              {
                label: "Validation",
                render: (r) => ids(r.errors).join("; ") || "Ready",
              },
            ]}
          />
          <button
            type="button"
            className="primary"
            disabled={rows(importPreview.rows).some(
              (r) => ids(r.errors).length > 0,
            )}
            onClick={() => {
              const p = importPreview;
              setImportPreview(null);
              setForm({
                title: "Confirm source totals",
                intro:
                  "Enter the totals from your source sheet. Both must match the preview exactly.",
                submit: "Commit reconciled import",
                fields: [
                  {
                    key: "totalCarats",
                    label: "Source total carats (3 decimals)",
                  },
                  {
                    key: "totalCost",
                    label: `Source total cost (${w.settings.minorUnits} decimals)`,
                  },
                ],
                onSubmit: async (v) => {
                  await request("/api/import/commit", { ...v, id: p.id });
                  await refresh();
                },
              });
            }}
          >
            Confirm totals & import
          </button>
        </Dialog>
      )}
      {mfa && (
        <Dialog title="Set up authenticator" onClose={() => setMfa(null)}>
          <p>
            Scan this QR in your authenticator, then enter its current six-digit
            code. Keep access to your authenticator; account recovery requires
            an administrator.
          </p>
          <img
            className="mfa-qr"
            src={str(mfa, "qr")}
            alt="Authenticator setup QR"
          />
          <p>
            Manual setup key: <code>{str(mfa, "secret")}</code>
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              await run(async () => {
                await request("/api/mfa/enable", { code: data.get("code") });
                setMfa(null);
              }, "Authenticator enabled.");
            }}
          >
            <label>
              Six-digit code
              <input
                name="code"
                pattern="[0-9]{6}"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
              />
            </label>
            <button className="primary">Verify & enable</button>
          </form>
        </Dialog>
      )}
    </>
  );
}
function deviceId() {
  let id = localStorage.getItem("gem-device-id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("gem-device-id", id);
  }
  return id;
}
function Walkthrough({
  onGo,
  role,
}: {
  onGo: (p: string) => void;
  role: string;
}) {
  const [step, setStep] = useState(0);
  const steps = [
    {
      title: "Receive & identify",
      role: "Inventory clerk",
      page: "Inventory",
      body: "Receive a stone or parcel. Record its weight, count, permanent ID, location and current custodian. The owner confirms ownership authority and financial details.",
      next: "Hand off original reports and claims to the reviewer.",
    },
    {
      title: "Review the evidence",
      role: "Clerk, then Gem reviewer",
      page: "Evidence",
      body: "Attach original reports. Record supplier claims, lab opinions and custody facts separately. The reviewer approves buyer-facing wording and explains conflicts. A new document or claim requires another review.",
      next: "Release reviewed, authorised stock for sales.",
    },
    {
      title: "Process or certify",
      role: "Cutter / lab liaison",
      page: "Processing",
      body: "When needed, issue the stone to a named lab or cutter. It becomes unsellable while away. Record return weight, loss and charges. Split parcels into linked children with reconciled weights and cost.",
      next: "Inventory receives it back. Review evidence again after processing.",
    },
    {
      title: "Offer & reserve",
      role: "Sales staff",
      page: "Holds & selections",
      body: "Find available stock, create a private buyer selection, and place a timed hold. A shared link does not reserve a stone. Buyers can send interest or a hold request; Sales confirms the reservation.",
      next: "Check availability and ownership again before a sale or memo.",
    },
    {
      title: "Sell or issue a memo",
      role: "Sales staff; Owner above limits",
      page: "Memos",
      body: "A direct sale issues an invoice and moves stock in one database transaction. A memo temporarily hands custody to the buyer with terms and a due date. Convert only the chosen pending lines into a sale.",
      next: "Clerk inspects returned lines. Accounts settles sold lines.",
    },
    {
      title: "Return & settle",
      role: "Clerk, then Accounts",
      page: "Payments",
      body: "Inspect each return, preserve its condition record, and release it only after review. Accounts issues credits, records verified payments and settles brokers or shared owners.",
      next: "Reconcile recorded movement and explain any differences.",
    },
    {
      title: "Owner oversight",
      role: "Owner",
      page: "Reports",
      body: "Review available stock, overdue memos, balances and audit history. Export records and download a complete backup. Test restoration before relying on the system for live business.",
      next: "Use real pilot transactions to validate the full journey.",
    },
  ];
  const s = steps[step];
  return (
    <div className="walkthrough">
      <ol className="step-nav">
        {steps.map((s, i) => (
          <li key={s.title}>
            <button
              aria-current={step === i ? "step" : undefined}
              onClick={() => setStep(i)}
            >
              <span>{i + 1}</span>
              {s.title}
            </button>
          </li>
        ))}
      </ol>
      <section className="walkthrough-body">
        <small>
          Step {step + 1} of {steps.length} · {s.role}
        </small>
        <h2>{s.title}</h2>
        <p>{s.body}</p>
        <div className="handoff">
          <strong>Next handoff</strong>
          <p>{s.next}</p>
        </div>
        <div className="actions">
          {access[s.page]?.includes(role) && (
            <button className="primary" onClick={() => onGo(s.page)}>
              Open {s.page}
            </button>
          )}
          <button
            className="secondary"
            disabled={step === 0}
            onClick={() => setStep(step - 1)}
          >
            Previous step
          </button>
          <button
            className="secondary"
            disabled={step === steps.length - 1}
            onClick={() => setStep(step + 1)}
          >
            Next step
          </button>
        </div>
      </section>
    </div>
  );
}
function Buyer({ token }: { token: string }) {
  const [data, setData] = useState<Row | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    request(`/api/buyer/${token}`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [token]);
  return (
    <main className="buyer-page">
      <p className="muted">Private buyer selection</p>
      <h1>{data ? str(data, "title") : "Opening selection…"}</h1>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {data && (
        <>
          <p>
            {str(data, "business")} · Expires{" "}
            {new Date(str(data, "expires")).toLocaleDateString()}
          </p>
          <Table
            data={rows(data.stones)}
            columns={[
              {
                label: "Stone",
                render: (s) => (
                  <>
                    {str(s, "variety")}
                    <small>
                      {str(s, "id")} · {str(s, "shape")}
                    </small>
                  </>
                ),
              },
              { label: "Weight", render: (s) => `${s.carats} ct` },
              {
                label: "Reviewed description",
                mobile: "full",
                render: (s) => str(s, "disclosure"),
              },
              {
                label: "Reviewed reports",
                render: (s) =>
                  rows(s.reports).length
                    ? rows(s.reports).map((f) => (
                        <a
                          key={str(f, "id")}
                          href={`/api/buyer/${token}/files/${f.id}`}
                        >
                          {str(f, "name")}
                        </a>
                      ))
                    : "No original documents shared",
              },
              { label: "Price", render: (s) => `${s.price} ${s.currency}` },
              {
                label: "Availability",
                render: (s) =>
                  s.available
                    ? "Ask Sales to confirm"
                    : "Currently unavailable",
              },
            ]}
          />
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const fields = Object.fromEntries(new FormData(e.currentTarget));
              try {
                await request(`/api/buyer/${token}`, fields);
                setNotice(
                  "Response recorded. A hold request does not reserve stock until Sales confirms.",
                );
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <label>
              Your decision
              <select name="decision" defaultValue="Interested">
                <option>Interested</option>
                <option>Request hold</option>
                <option>Decline</option>
              </select>
            </label>
            <label>
              Message (optional)
              <textarea name="note" maxLength={1000} />
            </label>
            <button className="primary">Send decision</button>
          </form>
          {notice && <p role="status">{notice}</p>}
        </>
      )}
    </main>
  );
}
if ("serviceWorker" in navigator && !location.port.startsWith("517"))
  navigator.serviceWorker.register("/sw.js").catch(() => {});
createRoot(document.getElementById("root")!).render(<App />);
