import { describe, expect, it } from "vitest";
import { buildSlots, type Occupancy } from "@/domain/slots";
import { fromLocal } from "@/domain/time";

const DAY = "2026-10-05"; // Monday
const rules = [{ dow: [1], startTime: "06:00", endTime: "24:00", pricePaise: 100000 }];
const now = fromLocal(DAY, 12); // noon
const occ = (hour: number, o: Partial<Occupancy>): Occupancy => ({
  bookingId: null,
  startAt: fromLocal(DAY, hour),
  endAt: fromLocal(DAY, hour + 1),
  status: "confirmed",
  kind: "booking",
  holdExpiresAt: null,
  isMine: false,
  ...o,
});

const build = (occupancy: Occupancy[], openHour = 6, closeHour = 24) =>
  buildSlots({ dateKey: DAY, openHour, closeHour, rules, occupancy, now });

describe("buildSlots", () => {
  it("creates one slot per opening hour", () => {
    const slots = build([]);
    expect(slots).toHaveLength(18);
    expect(slots[0]!.hour).toBe(6);
    expect(slots.at(-1)!.hour).toBe(23);
  });

  it("derives every state", () => {
    const later = new Date(now.getTime() + 60_000);
    const slots = build([
      occ(14, { status: "confirmed" }),
      occ(15, { status: "held", holdExpiresAt: later }),
      occ(16, { kind: "block" }),
      occ(10, { status: "confirmed" }),
    ]);
    const at = (h: number) => slots.find((s) => s.hour === h)!.state;
    expect(at(10)).toBe("past");
    expect(at(12)).toBe("past"); // starts exactly now
    expect(at(13)).toBe("available");
    expect(at(14)).toBe("booked");
    expect(at(15)).toBe("held");
    expect(at(16)).toBe("blocked");
  });

  it("treats an expired hold as free", () => {
    const earlier = new Date(now.getTime() - 1);
    const slots = build([occ(15, { status: "held", holdExpiresAt: earlier })]);
    expect(slots.find((s) => s.hour === 15)!.state).toBe("available");
  });

  it("marks unpriced hours as blocked", () => {
    const slots = buildSlots({ dateKey: DAY, openHour: 0, closeHour: 24, rules, occupancy: [], now: fromLocal(DAY, 0) });
    expect(slots.find((s) => s.hour === 3)!.state).toBe("blocked");
    expect(slots.find((s) => s.hour === 3)!.pricePaise).toBeNull();
  });

  it("flags my own hold and exposes its id", () => {
    const later = new Date(now.getTime() + 60_000);
    const slots = build([occ(18, { status: "held", holdExpiresAt: later, isMine: true, bookingId: "b1" })]);
    const s = slots.find((x) => x.hour === 18)!;
    expect(s).toMatchObject({ state: "held", isMine: true, bookingId: "b1" });
    expect(s.holdExpiresAt).toBe(later.toISOString());
  });

  it("prices each slot", () => {
    expect(build([]).every((s) => s.pricePaise === 100000)).toBe(true);
  });
});
