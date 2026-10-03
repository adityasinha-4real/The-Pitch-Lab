import { describe, expect, it } from "vitest";
import { lowestPrice, resolvePrice, timeToMinutes, validateRule, type PricingRuleLike } from "@/domain/pricing";
import { fromLocal } from "@/domain/time";

// The seeded rules for The Nutmeg Box.
const rules: PricingRuleLike[] = [
  { label: "Weekday", dow: [1, 2, 3, 4, 5], startTime: "06:00", endTime: "24:00", pricePaise: 120000 },
  { label: "Weekend", dow: [0, 6], startTime: "06:00", endTime: "24:00", pricePaise: 150000 },
  { label: "Weekday peak", dow: [1, 2, 3, 4, 5], startTime: "18:00", endTime: "23:00", pricePaise: 180000 },
  { label: "Weekend peak", dow: [0, 6], startTime: "18:00", endTime: "23:00", pricePaise: 220000 },
];

// 2026-10-05 is a Monday, 2026-10-03 a Saturday (arena time).
const MON = "2026-10-05";
const SAT = "2026-10-03";

describe("resolvePrice", () => {
  it("charges the weekday base rate on a weekday morning", () => {
    expect(resolvePrice(rules, fromLocal(MON, 9))?.pricePaise).toBe(120000);
  });

  it("charges the weekend base rate on a Saturday afternoon", () => {
    expect(resolvePrice(rules, fromLocal(SAT, 15))?.pricePaise).toBe(150000);
  });

  it("lets peak 18:00–23:00 override the base rate", () => {
    expect(resolvePrice(rules, fromLocal(MON, 18))?.rule.label).toBe("Weekday peak");
    expect(resolvePrice(rules, fromLocal(MON, 22))?.pricePaise).toBe(180000);
    expect(resolvePrice(rules, fromLocal(SAT, 20))?.pricePaise).toBe(220000);
  });

  it("treats the peak window as half-open: 23:00 is back to base", () => {
    expect(resolvePrice(rules, fromLocal(MON, 17))?.pricePaise).toBe(120000);
    expect(resolvePrice(rules, fromLocal(MON, 23))?.pricePaise).toBe(120000);
  });

  it("uses the arena's local weekday, not UTC's", () => {
    const byDay: PricingRuleLike[] = [
      { label: "Sunday", dow: [0], startTime: "00:00", endTime: "24:00", pricePaise: 1 },
      { label: "Monday", dow: [1], startTime: "00:00", endTime: "24:00", pricePaise: 2 },
    ];
    // Monday 02:00 IST is Sunday 20:30 UTC.
    const start = fromLocal(MON, 2);
    expect(start.getUTCDay()).toBe(0);
    expect(resolvePrice(byDay, start)?.rule.label).toBe("Monday");
  });

  it("returns null when no rule covers the slot", () => {
    expect(resolvePrice(rules, fromLocal(MON, 5))).toBeNull();
    expect(resolvePrice([], fromLocal(MON, 12))).toBeNull();
  });

  it("breaks equal-width ties by the higher price", () => {
    const tie: PricingRuleLike[] = [
      { dow: [1], startTime: "10:00", endTime: "12:00", pricePaise: 1000 },
      { dow: [1], startTime: "10:00", endTime: "12:00", pricePaise: 2000 },
    ];
    expect(resolvePrice(tie, fromLocal(MON, 10))?.pricePaise).toBe(2000);
  });
});

describe("helpers", () => {
  it("parses times including 24:00", () => {
    expect(timeToMinutes("06:00")).toBe(360);
    expect(timeToMinutes("18:30:00")).toBe(1110);
    expect(timeToMinutes("24:00")).toBe(1440);
    expect(() => timeToMinutes("25:00")).toThrow();
  });

  it("finds the lowest price", () => {
    expect(lowestPrice(rules)).toBe(120000);
    expect(lowestPrice([])).toBeNull();
  });

  it("validates rules", () => {
    expect(validateRule(rules[0]!)).toBeNull();
    expect(validateRule({ ...rules[0]!, dow: [] })).toMatch(/day/);
    expect(validateRule({ ...rules[0]!, startTime: "20:00", endTime: "18:00" })).toMatch(/after/);
    expect(validateRule({ ...rules[0]!, pricePaise: 0 })).toMatch(/positive/);
    expect(validateRule({ ...rules[0]!, endTime: "nope" })).toMatch(/18:00/);
  });
});
