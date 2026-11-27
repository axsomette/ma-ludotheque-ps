// Cote estimée à partir des prix Dealabs.
import { describe, expect, it } from "vitest";
import { estimateFromDeals } from "../src/lib/dealsValue";

describe("estimation d'après les bons plans", () => {
  const prices = [29.99, 31.14, 33.49, 34.99, 39.99, 120];
  it("neuf : médiane des prix, sans l'aberration", () => {
    const e = estimateFromDeals(prices, "new")!;
    expect(e.value).toBeGreaterThanOrEqual(33);
    expect(e.value).toBeLessThanOrEqual(34);
    expect(e.n).toBe(5);
    expect(e.confidence).toBe("medium");
  });
  it("décote d'occasion selon l'état, fourchette autour de la valeur", () => {
    const n = estimateFromDeals(prices, "new")!.value;
    const c = estimateFromDeals(prices, "cib")!;
    const l = estimateFromDeals(prices, "loose")!;
    expect(c.value).toBeCloseTo(n * 0.62, 0);
    expect(l.value).toBeLessThan(c.value);
    expect(c.low).toBeLessThan(c.value);
    expect(c.high).toBeGreaterThan(c.value);
    expect(c.basis).toContain("Dealabs");
  });
  it("rien sans prix, faible confiance avec un seul prix", () => {
    expect(estimateFromDeals([], "cib")).toBeNull();
    expect(estimateFromDeals([21.99], "cib")!.confidence).toBe("low");
  });
});
