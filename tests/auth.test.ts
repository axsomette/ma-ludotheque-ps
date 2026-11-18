import { describe, expect, it } from "vitest";
import { authMessage } from "../src/components/Login";

describe("authMessage", () => {
  it("traduit les erreurs courantes de Supabase Auth", () => {
    expect(authMessage("Invalid login credentials")).toBe("E-mail ou mot de passe incorrect.");
    expect(authMessage("Email not confirmed")).toMatch(/Confirme/);
    expect(authMessage("User already registered")).toMatch(/existe déjà/);
    expect(authMessage("Password should be at least 6 characters.")).toMatch(/trop faible/);
    expect(authMessage("email rate limit exceeded")).toMatch(/Trop de tentatives/);
  });
  it("donne une consigne générique pour le reste", () => {
    expect(authMessage("Failed to fetch")).toMatch(/réessaie/);
  });
});
