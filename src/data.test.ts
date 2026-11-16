import { describe, it, expect } from "vitest";
import { filterStones, initialStones, rolePages, stockCounts } from "./data";
describe("inventory discovery", () => {
  it("combines text search and state without mutating source", () => {
    const result = filterStones(initialStones, "BLUE", "In stock");
    expect(result.map((s) => s.id)).toEqual(["GEM-0104", "GEM-0110"]);
    expect(initialStones).toHaveLength(12);
  });
  it("searches custody and location and returns a genuine empty result", () => {
    expect(filterStones(initialStones, "Demo lab", "All stock")[0].id).toBe(
      "GEM-0108",
    );
    expect(filterStones(initialStones, "not present", "All stock")).toEqual([]);
  });
  it("reconciles all inventory records into one state each", () => {
    expect(stockCounts(initialStones).reduce((n, c) => n + c.count, 0)).toBe(
      initialStones.length,
    );
    expect(
      stockCounts(initialStones).find((c) => c.state === "In stock")?.count,
    ).toBe(3);
  });
});
describe("frontend role navigation", () => {
  it("keeps financial and audit navigation out of Sales preview", () => {
    expect(rolePages["Sales staff"]).not.toContain("Payments");
    expect(rolePages["Sales staff"]).not.toContain("Activity log");
    expect(rolePages["Sales staff"]).not.toContain("Settings");
  });
  it("keeps sales and money navigation out of reviewer and clerk previews", () => {
    for (const role of ["Gem reviewer", "Inventory clerk"] as const) {
      expect(rolePages[role]).not.toContain("Payments");
      expect(rolePages[role]).not.toContain("Memos");
    }
  });
});
