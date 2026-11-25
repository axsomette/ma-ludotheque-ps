// Prêts : libellés et tri.
import { describe, expect, it } from "vitest";
import { activeLoans, isLoaned, loanLine, since, today } from "../src/lib/loans";
import { normalizeGame } from "../src/lib/types";

const now = new Date(2026, 10, 25); // 25 novembre 2026

describe("prêts", () => {
  it("date du jour en AAAA-MM-JJ", () => {
    expect(today(now)).toBe("2026-11-25");
  });
  it("durée lisible", () => {
    expect(since("2026-11-25", now)).toBe("aujourd'hui");
    expect(since("2026-11-24", now)).toBe("hier");
    expect(since("2026-11-20", now)).toBe("depuis 5 jours");
    expect(since("2026-11-04", now)).toBe("depuis 3 semaines");
    expect(since("2026-08-25", now)).toBe("depuis 3 mois");
    expect(since("2025-06-01", now)).toBe("depuis plus d'un an");
  });
  it("libellé et tri, le plus ancien prêt d'abord", () => {
    const a = normalizeGame({ id: "a", title: "A", platform: "ps5", loaned_to: "Thomas", loaned_at: "2026-11-04" });
    const b = normalizeGame({ id: "b", title: "B", platform: "ps4", loaned_to: "Léa", loaned_at: "2026-09-01" });
    const c = normalizeGame({ id: "c", title: "C", platform: "ps3" });
    expect(isLoaned(c)).toBe(false);
    expect(loanLine(a, now)).toBe("Prêté à Thomas · depuis 3 semaines");
    expect(loanLine(c, now)).toBeNull();
    expect(activeLoans([a, b, c]).map((g) => g.id)).toEqual(["b", "a"]);
  });
});
