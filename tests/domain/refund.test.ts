import { describe, expect, it } from "vitest";
import { refundFor, refundPercent } from "@/domain/refund";

const kickoff = new Date("2026-10-10T13:30:00.000Z"); // 7 PM IST
const before = (hours: number, ms = 0) => new Date(kickoff.getTime() - hours * 3_600_000 - ms);

describe("refundPercent", () => {
  it("refunds 100% more than 24h out", () => {
    expect(refundPercent(kickoff, before(72))).toBe(100);
    expect(refundPercent(kickoff, before(24, 1))).toBe(100);
  });

  it("refunds 50% between 6h and 24h, inclusive at both ends", () => {
    expect(refundPercent(kickoff, before(24))).toBe(50);
    expect(refundPercent(kickoff, before(12))).toBe(50);
    expect(refundPercent(kickoff, before(6))).toBe(50);
  });

  it("refunds nothing under 6h", () => {
    expect(refundPercent(kickoff, before(6, -1))).toBe(0);
    expect(refundPercent(kickoff, before(1))).toBe(0);
    expect(refundPercent(kickoff, before(0))).toBe(0);
  });
});

describe("refundFor", () => {
  it("computes paise and floors odd halves", () => {
    expect(refundFor(180000, kickoff, before(48))).toEqual({ percent: 100, refundPaise: 180000 });
    expect(refundFor(180000, kickoff, before(10))).toEqual({ percent: 50, refundPaise: 90000 });
    expect(refundFor(180001, kickoff, before(10))).toEqual({ percent: 50, refundPaise: 90000 });
    expect(refundFor(180000, kickoff, before(2))).toEqual({ percent: 0, refundPaise: 0 });
  });
});
