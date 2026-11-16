export const states = [
  "Draft",
  "In stock",
  "Held",
  "On memo",
  "Sold",
  "With lab or cutter",
  "Returned",
  "Blocked",
] as const;
export type StoneState = (typeof states)[number];
export type Role =
  | "Owner"
  | "Sales staff"
  | "Inventory clerk"
  | "Accounts"
  | "Cutter / lab liaison"
  | "Gem reviewer";
export type Page =
  | "Overview"
  | "Inventory"
  | "Holds & selections"
  | "Memos"
  | "Evidence"
  | "Processing"
  | "Payments"
  | "Activity log"
  | "Show mode"
  | "Settings";
export interface Stone {
  id: string;
  variety: string;
  shape: string;
  carats: string;
  state: StoneState;
  custodian: string;
  location: string;
  evidence: "Approved" | "Review needed" | "Conflict";
  color: string;
}
export const initialStones: Stone[] = [
  {
    id: "GEM-0104",
    variety: "Blue sapphire",
    shape: "Oval",
    carats: "3.24",
    state: "In stock",
    custodian: "Internal · Vault team",
    location: "Vault A · Tray 02",
    evidence: "Approved",
    color: "#3a4e9a",
  },
  {
    id: "GEM-0105",
    variety: "Pink sapphire",
    shape: "Cushion",
    carats: "2.18",
    state: "Held",
    custodian: "Internal · Vault team",
    location: "Vault A · Tray 04",
    evidence: "Approved",
    color: "#b66083",
  },
  {
    id: "GEM-0106",
    variety: "Yellow sapphire",
    shape: "Emerald cut",
    carats: "4.06",
    state: "On memo",
    custodian: "Demo buyer A",
    location: "Memo M-0021",
    evidence: "Approved",
    color: "#c5a03f",
  },
  {
    id: "GEM-0107",
    variety: "Ruby",
    shape: "Oval",
    carats: "1.86",
    state: "In stock",
    custodian: "Internal · Vault team",
    location: "Vault B · Tray 01",
    evidence: "Review needed",
    color: "#a63d53",
  },
  {
    id: "GEM-0108",
    variety: "Teal tourmaline",
    shape: "Emerald cut",
    carats: "5.12",
    state: "With lab or cutter",
    custodian: "Demo lab",
    location: "Issue P-0008",
    evidence: "Review needed",
    color: "#3b827c",
  },
  {
    id: "GEM-0109",
    variety: "Spinel parcel",
    shape: "Mixed · 6 stones",
    carats: "8.40",
    state: "Blocked",
    custodian: "Internal · Review desk",
    location: "Vault B · Tray 03",
    evidence: "Conflict",
    color: "#7a5b9c",
  },
  {
    id: "GEM-0110",
    variety: "Blue sapphire",
    shape: "Round",
    carats: "1.65",
    state: "In stock",
    custodian: "Internal · Vault team",
    location: "Vault A · Tray 02",
    evidence: "Approved",
    color: "#5267b3",
  },
  {
    id: "GEM-0111",
    variety: "Garnet",
    shape: "Cushion",
    carats: "3.42",
    state: "Returned",
    custodian: "Internal · Intake team",
    location: "Inspection desk",
    evidence: "Approved",
    color: "#8e4657",
  },
  {
    id: "GEM-0112",
    variety: "Green tourmaline",
    shape: "Oval",
    carats: "2.60",
    state: "Draft",
    custodian: "Internal · Intake team",
    location: "Intake desk",
    evidence: "Review needed",
    color: "#648561",
  },
  {
    id: "GEM-0113",
    variety: "Violet spinel",
    shape: "Cushion",
    carats: "2.02",
    state: "Sold",
    custodian: "Demo buyer B",
    location: "Invoice INV-0032",
    evidence: "Approved",
    color: "#8267a1",
  },
  {
    id: "GEM-0114",
    variety: "Blue sapphire",
    shape: "Oval",
    carats: "2.78",
    state: "On memo",
    custodian: "Demo buyer C",
    location: "Memo M-0022",
    evidence: "Approved",
    color: "#435489",
  },
  {
    id: "GEM-0115",
    variety: "Yellow sapphire",
    shape: "Round",
    carats: "1.92",
    state: "Held",
    custodian: "Internal · Vault team",
    location: "Vault A · Tray 03",
    evidence: "Approved",
    color: "#bfa153",
  },
];
export const rolePages: Record<Role, Page[]> = {
  Owner: [
    "Overview",
    "Inventory",
    "Holds & selections",
    "Memos",
    "Evidence",
    "Processing",
    "Payments",
    "Activity log",
    "Show mode",
    "Settings",
  ],
  "Sales staff": [
    "Overview",
    "Inventory",
    "Holds & selections",
    "Memos",
    "Show mode",
  ],
  "Inventory clerk": ["Overview", "Inventory", "Evidence", "Show mode"],
  Accounts: ["Overview", "Memos", "Payments", "Activity log"],
  "Cutter / lab liaison": ["Overview", "Inventory", "Processing"],
  "Gem reviewer": ["Overview", "Inventory", "Evidence"],
};
export function filterStones(stones: Stone[], query: string, state: string) {
  return stones.filter(
    (s) =>
      (state === "All stock" || s.state === state) &&
      `${s.id} ${s.variety} ${s.custodian} ${s.location}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
}
export function stockCounts(stones: Stone[]) {
  return states.map((state) => ({
    state,
    count: stones.filter((s) => s.state === state).length,
  }));
}
export const demoMemos = [
  {
    id: "M-0021",
    buyer: "Demo buyer A",
    stone: "GEM-0106",
    due: "23 Oct 2026",
    status: "Overdue · 3 days",
  },
  {
    id: "M-0022",
    buyer: "Demo buyer C",
    stone: "GEM-0114",
    due: "29 Oct 2026",
    status: "Due in 3 days",
  },
];
